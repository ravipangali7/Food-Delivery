import 'dart:async';
import 'dart:collection';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

import '../config.dart';
import '../services/auth_token_storage.dart';

/// Must match [TOKEN_KEY] in `web/src/contexts/AuthContext.tsx`.
const String _kWebAuthLocalStorageKey = 'fd_auth_token';

const String _kJsAuthPersistHandler = 'fdAuthTokenPersist';

/// Locks pinch/zoom from pages that set `user-scalable=yes` or omit viewport limits.
/// Runs at document end and again on [InAppWebView.onLoadStop] for full navigations.
const String _kLockViewportScript = r'''
(function() {
  function lock() {
    try {
      var head = document.head;
      if (!head) return;
      var content =
          'width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover';
      var m = document.querySelector('meta[name="viewport"]');
      if (m) {
        m.setAttribute('content', content);
      } else {
        m = document.createElement('meta');
        m.setAttribute('name', 'viewport');
        m.setAttribute('content', content);
        head.insertBefore(m, head.firstChild);
      }
    } catch (e) {}
  }
  lock();
  document.addEventListener('DOMContentLoaded', lock);
})();
''';

final UnmodifiableListView<UserScript> _kNoZoomUserScripts =
    UnmodifiableListView<UserScript>(<UserScript>[
  UserScript(
    source: _kLockViewportScript,
    injectionTime: UserScriptInjectionTime.AT_DOCUMENT_END,
    forMainFrameOnly: true,
  ),
]);

UnmodifiableListView<UserScript> _initialUserScriptsWithAuth(String? authToken) {
  final scripts = <UserScript>[];
  if (authToken != null && authToken.isNotEmpty) {
    final key = jsonEncode(_kWebAuthLocalStorageKey);
    final val = jsonEncode(authToken);
    scripts.add(
      UserScript(
        source: 'try{localStorage.setItem($key,$val);}catch(e){}',
        injectionTime: UserScriptInjectionTime.AT_DOCUMENT_START,
        forMainFrameOnly: true,
      ),
    );
    scripts.add(
      UserScript(
        source: 'try{localStorage.setItem($key,$val);}catch(e){}',
        injectionTime: UserScriptInjectionTime.AT_DOCUMENT_END,
        forMainFrameOnly: true,
      ),
    );
  }
  scripts.addAll(_kNoZoomUserScripts);
  return UnmodifiableListView<UserScript>(scripts);
}

bool get _useNativePullRefresh =>
    !kIsWeb &&
    (defaultTargetPlatform == TargetPlatform.android ||
        defaultTargetPlatform == TargetPlatform.iOS);

/// Loads the customer site with full JS, no zoom, and system-back history.
///
/// Back navigation is driven by [WebViewScreenState.handleSystemBack] from the parent
/// ([PopScope] in connectivity shell) so offline overlay always gets exit, not history.
class WebViewScreen extends StatefulWidget {
  const WebViewScreen({super.key});

  @override
  WebViewScreenState createState() => WebViewScreenState();
}

class WebViewScreenState extends State<WebViewScreen> with WidgetsBindingObserver {
  InAppWebViewController? _controller;
  PullToRefreshController? _pullToRefreshController;
  double _progress = 0;
  bool _prefsReady = false;
  String? _mirroredAuthToken;
  bool _didEarlyAuthInjectThisLoad = false;

  InAppWebViewSettings get _settings => InAppWebViewSettings(
        javaScriptEnabled: true,
        javaScriptCanOpenWindowsAutomatically: true,
        domStorageEnabled: true,
        databaseEnabled: true,
        geolocationEnabled: true,
        supportZoom: false,
        builtInZoomControls: false,
        displayZoomControls: false,
        textZoom: 100,
        minimumZoomScale: 1.0,
        maximumZoomScale: 1.0,
        allowsInlineMediaPlayback: true,
        mediaPlaybackRequiresUserGesture: false,
        allowsBackForwardNavigationGestures: true,
        useHybridComposition: true,
        thirdPartyCookiesEnabled: true,
        cacheEnabled: true,
        clearSessionCache: false,
        incognito: false,
      );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (_useNativePullRefresh) {
      _pullToRefreshController = PullToRefreshController(
        settings: PullToRefreshSettings(
          color: const Color(0xFFB8860B),
          backgroundColor: Colors.white10,
        ),
        onRefresh: _onPullToRefresh,
      );
    }
    _loadMirroredAuthToken();
  }

  Future<void> _loadMirroredAuthToken() async {
    final t = await AuthTokenStorage.readMirroredToken();
    if (!mounted) return;
    setState(() {
      _mirroredAuthToken = t;
      _prefsReady = true;
    });
  }

  /// Re-reads Flutter-persisted session after cold start or resume, then pushes it into the WebView.
  Future<void> _refreshSessionFromNativeStorageAndInject() async {
    if (!_prefsReady) return;
    final t = await AuthTokenStorage.readMirroredToken();
    if (!mounted) return;
    if (t != _mirroredAuthToken) {
      setState(() => _mirroredAuthToken = t);
    }
    final c = _controller;
    if (c != null) {
      await _injectMirroredAuthIntoPage(c);
    }
  }

  String get _bootStatusLine {
    final t = _mirroredAuthToken;
    if (t != null && t.isNotEmpty) return 'Restoring session…';
    return 'Loading…';
  }

  Future<void> _persistAuthMirrorFromWeb(List<dynamic> args) async {
    final raw = args.isNotEmpty ? args[0] : null;
    final s = raw is String ? raw : raw?.toString();
    final next = (s == null || s.isEmpty) ? null : s;
    await AuthTokenStorage.writeMirroredToken(next);
    if (!mounted) return;
    setState(() => _mirroredAuthToken = next);
  }

  Future<void> _backupAuthTokenFromLocalStorage(InAppWebViewController c) async {
    try {
      final v = await c.webStorage.localStorage.getItem(key: _kWebAuthLocalStorageKey);
      final tokenFromWeb = v is String ? v : v?.toString();
      if (tokenFromWeb == null || tokenFromWeb.isEmpty) return;
      await AuthTokenStorage.writeMirroredToken(tokenFromWeb);
      if (!mounted) return;
      if (_mirroredAuthToken != tokenFromWeb) {
        setState(() => _mirroredAuthToken = tokenFromWeb);
      }
    } catch (_) {}
  }

  /// Re-applies the native mirror into `localStorage` on every navigation so sessions survive
  /// app restarts even if document-start user scripts are skipped or run late on some WebViews.
  Future<void> _injectMirroredAuthIntoPage(InAppWebViewController c) async {
    try {
      var t = _mirroredAuthToken;
      if (t == null || t.isEmpty) {
        t = await AuthTokenStorage.readMirroredToken();
        if (t != null && t.isNotEmpty && mounted) {
          setState(() => _mirroredAuthToken = t);
        }
      }
      if (t == null || t.isEmpty) return;
      await c.evaluateJavascript(
        source:
            'try{localStorage.setItem(${jsonEncode(_kWebAuthLocalStorageKey)},${jsonEncode(t)});}catch(e){}',
      );
    } catch (_) {}
  }

  Future<void> _performWebReload(InAppWebViewController c) async {
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      final uri = await c.getUrl();
      if (uri != null) {
        await c.loadUrl(urlRequest: URLRequest(url: uri));
        return;
      }
    }
    await c.reload();
  }

  Future<void> _onPullToRefresh() async {
    final c = _controller;
    if (c == null) {
      await _pullToRefreshController?.endRefreshing();
      return;
    }
    try {
      await _injectMirroredAuthIntoPage(c);
      await _performWebReload(c);
    } catch (_) {
      await _pullToRefreshController?.endRefreshing();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pullToRefreshController?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final c = _controller;
    if (c == null) return;
    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
        c.pause();
        break;
      case AppLifecycleState.resumed:
        c.resume();
        unawaited(_refreshSessionFromNativeStorageAndInject());
        break;
      default:
        break;
    }
  }

  /// Web history [C→B→A], then exit confirmation on the last page (same as system back).
  Future<void> handleSystemBack() async {
    final c = _controller;
    if (c == null) return;

    if (await c.canGoBack()) {
      await c.goBack();
      return;
    }

    if (!mounted) return;
    final exit = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Exit app?'),
        content: const Text(
          'You are on the first page. Do you want to close Shyam Sweets?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Exit'),
          ),
        ],
      ),
    );

    if (exit == true && mounted) {
      SystemNavigator.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.colorScheme.surface,
      body: SafeArea(
        child: Column(
          children: [
            if (_progress < 1.0)
              LinearProgressIndicator(
                value: _progress > 0 ? _progress : null,
                minHeight: 2,
              ),
            Expanded(
              child: !_prefsReady
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(
                            width: 44,
                            height: 44,
                            child: CircularProgressIndicator(
                              strokeWidth: 3,
                              color: theme.colorScheme.primary,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            _bootStatusLine,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    )
                  : InAppWebView(
                      initialUrlRequest: URLRequest(url: WebUri(kWebViewStartUrl)),
                      initialSettings: _settings,
                      initialUserScripts: _initialUserScriptsWithAuth(_mirroredAuthToken),
                      pullToRefreshController: _pullToRefreshController,
                      onWebViewCreated: (c) {
                        _controller = c;
                        c.addJavaScriptHandler(
                          handlerName: _kJsAuthPersistHandler,
                          callback: _persistAuthMirrorFromWeb,
                        );
                      },
                      onLoadStart: (c, uri) async {
                        _didEarlyAuthInjectThisLoad = false;
                        await _injectMirroredAuthIntoPage(c);
                      },
                      onProgressChanged: (c, p) {
                        if (!mounted) return;
                        setState(() => _progress = p / 100.0);
                        if (!_didEarlyAuthInjectThisLoad &&
                            p >= 15 &&
                            _mirroredAuthToken != null &&
                            _mirroredAuthToken!.isNotEmpty) {
                          _didEarlyAuthInjectThisLoad = true;
                          unawaited(_injectMirroredAuthIntoPage(c));
                        }
                      },
                      onLoadStop: (c, uri) async {
                        await _injectMirroredAuthIntoPage(c);
                        await _backupAuthTokenFromLocalStorage(c);
                        await c.evaluateJavascript(source: _kLockViewportScript);
                        await _pullToRefreshController?.endRefreshing();
                        if (!mounted) return;
                        setState(() => _progress = 1.0);
                      },
                      onZoomScaleChanged: (c, oldScale, newScale) async {
                        if ((newScale - 1.0).abs() < 0.001) return;
                        try {
                          await c.zoomBy(zoomFactor: 1.0 / newScale, animated: false);
                        } catch (_) {}
                      },
                      shouldOverrideUrlLoading: (c, action) async {
                        return NavigationActionPolicy.ALLOW;
                      },
                      onPermissionRequest: (c, request) async {
                        return PermissionResponse(
                          resources: request.resources,
                          action: PermissionResponseAction.GRANT,
                        );
                      },
                      onConsoleMessage: (c, msg) {
                        if (kDebugMode) {
                          debugPrint('[WebView console] ${msg.message}');
                        }
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
