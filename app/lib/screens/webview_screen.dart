import 'dart:async';
import 'dart:collection';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import '../config.dart';
import '../services/auth_token_storage.dart';

/// Must match [TOKEN_KEY] in `web/src/contexts/AuthContext.tsx`.
const String _kWebAuthLocalStorageKey = 'fd_auth_token';
const String _kWebPhoneLocalStorageKey = 'fd_auth_phone';

const String _kJsAuthPersistHandler = 'fdAuthTokenPersist';
const String _kJsPhonePersistHandler = 'fdAuthPhonePersist';

/// Wraps `localStorage.setItem/removeItem` so every SPA login/logout hits Flutter without relying on SPA code.
final String _kLocalStorageHookScript =
    '''
(function(){
  var TOKEN_KEY=${jsonEncode(_kWebAuthLocalStorageKey)};
  var TOKEN_H=${jsonEncode(_kJsAuthPersistHandler)};
  var PHONE_KEY=${jsonEncode(_kWebPhoneLocalStorageKey)};
  var PHONE_H=${jsonEncode(_kJsPhonePersistHandler)};
  function persist(handler,v){
    try{
      var w=window.flutter_inappwebview;
      if(w&&typeof w.callHandler==='function')w.callHandler(handler,v==null?'':String(v));
    }catch(e){}
  }
  try{
    var ls=window.localStorage;
    if(!ls)return;
    var _s=ls.setItem.bind(ls);
    ls.setItem=function(k,val){
      _s(k,val);
      if(k===TOKEN_KEY)persist(TOKEN_H,val);
      if(k===PHONE_KEY)persist(PHONE_H,val);
    };
    var _r=ls.removeItem.bind(ls);
    ls.removeItem=function(k){
      _r(k);
      if(k===TOKEN_KEY)persist(TOKEN_H,'');
      if(k===PHONE_KEY)persist(PHONE_H,'');
    };
  }catch(e){}
})();
''';

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

UnmodifiableListView<UserScript> _initialUserScriptsWithAuth(
  String? authToken,
  String? phone,
) {
  final scripts = <UserScript>[
    UserScript(
      source: _kLocalStorageHookScript,
      injectionTime: UserScriptInjectionTime.AT_DOCUMENT_START,
      forMainFrameOnly: true,
    ),
  ];
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
  if (phone != null && phone.isNotEmpty) {
    final key = jsonEncode(_kWebPhoneLocalStorageKey);
    final val = jsonEncode(phone);
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

class WebViewScreenState extends State<WebViewScreen>
    with WidgetsBindingObserver {
  InAppWebViewController? _controller;
  PullToRefreshController? _pullToRefreshController;
  Timer? _authTokenPollTimer;
  bool _prefsReady = false;
  String? _mirroredAuthToken;
  String? _mirroredPhone;
  bool _didEarlyAuthInjectThisLoad = false;
  bool _didBootstrapReload = false;
  bool _authBootstrapSettled = false;
  bool _hasLoadedInitialPage = false;

  String _lenTag(String? token) =>
      token == null ? 'null' : 'len=${token.length}';

  void _dbg(String msg) {
    if (!kDebugMode) return;
    debugPrint('[AuthMirror] $msg');
  }

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
    final p = await AuthTokenStorage.readSavedPhone();
    String? nextToken = t;
    if ((nextToken == null || nextToken.isEmpty) && p != null && p.isNotEmpty) {
      nextToken = await _autoLoginFromSavedPhone(p);
    }
    if (!mounted) return;
    setState(() {
      _mirroredAuthToken = nextToken;
      _mirroredPhone = p;
      _authBootstrapSettled = nextToken == null || nextToken.isEmpty;
      _prefsReady = true;
    });
    _dbg(
      '_loadMirroredAuthToken -> token=${_lenTag(nextToken)} phone=$p settled=$_authBootstrapSettled',
    );
  }

  Future<String?> _autoLoginFromSavedPhone(String phone) async {
    try {
      final uri = Uri.parse('$kApiBase/api/auth/flutter/phone-login/');
      final response = await http.post(
        uri,
        headers: const {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({'phone': phone}),
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        _dbg('_autoLoginFromSavedPhone failed status=${response.statusCode}');
        return null;
      }
      final dynamic decoded = jsonDecode(response.body);
      if (decoded is! Map<String, dynamic>) return null;
      final token = _tokenFromWebBridgeValue(decoded['token']);
      final user = decoded['user'];
      String? userPhone;
      if (user is Map<String, dynamic>) {
        userPhone = _tokenFromWebBridgeValue(user['phone']);
      }
      if (userPhone != null && userPhone.isNotEmpty) {
        await AuthTokenStorage.writeSavedPhone(userPhone);
      }
      if (token == null || token.isEmpty) return null;
      await AuthTokenStorage.writeMirroredToken(token);
      final c = _controller;
      if (c != null) {
        await _injectMirroredAuthIntoPage(c);
        await _warmAuthMeProbeInPage(c, token);
      }
      _dbg('_autoLoginFromSavedPhone success ${_lenTag(token)}');
      return token;
    } catch (e) {
      _dbg('_autoLoginFromSavedPhone exception=$e');
      return null;
    }
  }

  /// Re-reads Flutter-persisted session after cold start or resume, then pushes it into the WebView.
  Future<void> _refreshSessionFromNativeStorageAndInject() async {
    if (!_prefsReady) return;
    final t = await AuthTokenStorage.readMirroredToken();
    _dbg(
      '_refreshSessionFromNativeStorageAndInject read ${_lenTag(t)} current=${_lenTag(_mirroredAuthToken)}',
    );
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

  String? _tokenFromWebBridgeValue(dynamic raw) {
    if (raw == null) return null;
    var s = raw is String ? raw : raw.toString();
    if (s.isEmpty || s == 'null') return null;
    if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
      try {
        final d = jsonDecode(s);
        if (d is String) s = d;
      } catch (_) {}
    }
    return s.isEmpty ? null : s;
  }

  Future<void> _persistAuthMirrorFromWeb(List<dynamic> args) async {
    final raw = args.isNotEmpty ? args[0] : null;
    final s = _tokenFromWebBridgeValue(raw);
    final next = (s == null || s.isEmpty) ? null : s;
    _dbg(
      '_persistAuthMirrorFromWeb raw=$raw parsed=${_lenTag(next)} settled=$_authBootstrapSettled current=${_lenTag(_mirroredAuthToken)}',
    );
    // During first startup restore, ignore premature clear signals from the page
    // until we've confirmed bootstrap auth synchronization.
    if (!_authBootstrapSettled &&
        (next == null || next.isEmpty) &&
        _mirroredAuthToken != null &&
        _mirroredAuthToken!.isNotEmpty) {
      _dbg(
        '_persistAuthMirrorFromWeb ignored premature clear during bootstrap',
      );
      return;
    }
    await AuthTokenStorage.writeMirroredToken(next);
    if (!mounted) return;
    setState(() {
      _mirroredAuthToken = next;
      if (next != null && next.isNotEmpty) {
        _authBootstrapSettled = true;
      }
    });
    _dbg(
      '_persistAuthMirrorFromWeb wrote ${_lenTag(next)} settled=$_authBootstrapSettled',
    );
  }

  Future<void> _persistPhoneMirrorFromWeb(List<dynamic> args) async {
    final raw = args.isNotEmpty ? args[0] : null;
    final s = _tokenFromWebBridgeValue(raw);
    final normalized = s?.replaceAll(RegExp(r'\D+'), '');
    final next =
        (normalized == null || normalized.length < 7 || normalized.length > 15)
        ? null
        : normalized;
    await AuthTokenStorage.writeSavedPhone(next);
    if (!mounted) return;
    setState(() => _mirroredPhone = next);
    _dbg('_persistPhoneMirrorFromWeb wrote phone=$next');
  }

  Future<void> _backupAuthTokenFromLocalStorage(
    InAppWebViewController c,
  ) async {
    await _pullWebAuthTokenIntoNativeMirror(c);
    await _pullWebPhoneIntoNativeMirror(c);
  }

  /// Copies `fd_auth_token` from the WebView into Flutter storage (SPA often never reloads after login).
  Future<void> _pullWebAuthTokenIntoNativeMirror(
    InAppWebViewController c,
  ) async {
    try {
      String? tokenFromWeb;
      try {
        final v = await c.webStorage.localStorage.getItem(
          key: _kWebAuthLocalStorageKey,
        );
        tokenFromWeb = v is String ? v : v?.toString();
        if (tokenFromWeb == 'null') tokenFromWeb = null;
        _dbg(
          '_pullWebAuthTokenIntoNativeMirror webStorage value=${_lenTag(_tokenFromWebBridgeValue(tokenFromWeb))}',
        );
      } catch (_) {}
      tokenFromWeb =
          _tokenFromWebBridgeValue(tokenFromWeb) ??
          await _readAuthTokenFromWebViaEvaluateJavascript(c);
      _dbg(
        '_pullWebAuthTokenIntoNativeMirror final web token=${_lenTag(tokenFromWeb)} current=${_lenTag(_mirroredAuthToken)}',
      );
      if (tokenFromWeb == null || tokenFromWeb.isEmpty) return;
      if (tokenFromWeb == _mirroredAuthToken) return;
      final existing = await AuthTokenStorage.readMirroredToken();
      if (existing == tokenFromWeb) return;
      await AuthTokenStorage.writeMirroredToken(tokenFromWeb);
      if (!mounted) return;
      if (_mirroredAuthToken != tokenFromWeb) {
        setState(() {
          _mirroredAuthToken = tokenFromWeb;
          _authBootstrapSettled = true;
        });
        _dbg(
          '_pullWebAuthTokenIntoNativeMirror mirrored ${_lenTag(tokenFromWeb)}',
        );
      }
    } catch (_) {}
  }

  Future<String?> _readAuthTokenFromWebViaEvaluateJavascript(
    InAppWebViewController c,
  ) async {
    try {
      final r = await c.evaluateJavascript(
        source:
            '(function(){try{return localStorage.getItem(${jsonEncode(_kWebAuthLocalStorageKey)});}catch(e){return null;}})()',
      );
      final parsed = _tokenFromWebBridgeValue(r);
      _dbg(
        '_readAuthTokenFromWebViaEvaluateJavascript raw=$r parsed=${_lenTag(parsed)}',
      );
      return parsed;
    } catch (_) {
      return null;
    }
  }

  Future<void> _pullWebPhoneIntoNativeMirror(InAppWebViewController c) async {
    try {
      String? phoneFromWeb;
      try {
        final v = await c.webStorage.localStorage.getItem(
          key: _kWebPhoneLocalStorageKey,
        );
        phoneFromWeb = v is String ? v : v?.toString();
        if (phoneFromWeb == 'null') phoneFromWeb = null;
      } catch (_) {}
      phoneFromWeb =
          _tokenFromWebBridgeValue(phoneFromWeb) ??
          await _readPhoneFromWebViaEvaluateJavascript(c);
      final normalized = phoneFromWeb?.replaceAll(RegExp(r'\D+'), '');
      final next =
          (normalized == null ||
              normalized.length < 7 ||
              normalized.length > 15)
          ? null
          : normalized;
      if (next == null || next == _mirroredPhone) return;
      await AuthTokenStorage.writeSavedPhone(next);
      if (!mounted) return;
      setState(() => _mirroredPhone = next);
      _dbg('_pullWebPhoneIntoNativeMirror mirrored phone=$next');
    } catch (_) {}
  }

  Future<String?> _readPhoneFromWebViaEvaluateJavascript(
    InAppWebViewController c,
  ) async {
    try {
      final r = await c.evaluateJavascript(
        source:
            '(function(){try{return localStorage.getItem(${jsonEncode(_kWebPhoneLocalStorageKey)});}catch(e){return null;}})()',
      );
      return _tokenFromWebBridgeValue(r);
    } catch (_) {
      return null;
    }
  }

  Future<void> _warmAuthMeProbeInPage(
    InAppWebViewController c,
    String token,
  ) async {
    try {
      await c.evaluateJavascript(
        source:
            'fetch(${jsonEncode('$kApiBase/api/auth/me/')},{method:"GET",headers:{Accept:"application/json",Authorization:"Token $token"}}).catch(function(){})',
      );
    } catch (_) {}
  }

  Future<void> _syncWebMirrorsFromPage(InAppWebViewController c) async {
    await _pullWebAuthTokenIntoNativeMirror(c);
    await _pullWebPhoneIntoNativeMirror(c);
  }

  void _startAuthTokenPoll() {
    _authTokenPollTimer?.cancel();
    _dbg('_startAuthTokenPoll every 1s');
    _authTokenPollTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      final c = _controller;
      if (c == null || !mounted) return;
      unawaited(_pullWebAuthTokenIntoNativeMirror(c));
    });
  }

  /// Re-applies stored token a few times after first paint (SPA may read `localStorage` very early).
  Future<void> _burstReinjectNativeAuthToken(InAppWebViewController c) async {
    for (var i = 0; i < 10; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 250));
      if (!mounted || _controller != c) return;
      await _injectMirroredAuthIntoPage(c);
    }
  }

  /// Forces one reload after first page bootstrap when a mirrored token exists.
  /// This guarantees the SPA initializes with `fd_auth_token` already present.
  Future<void> _ensureBootstrapReloadWithMirroredAuth(
    InAppWebViewController c,
  ) async {
    if (_didBootstrapReload) return;
    final t = _mirroredAuthToken;
    if (t == null || t.isEmpty) {
      _didBootstrapReload = true;
      _dbg(
        '_ensureBootstrapReloadWithMirroredAuth skip reload (no mirrored token)',
      );
      return;
    }

    _dbg('_ensureBootstrapReloadWithMirroredAuth reloading with ${_lenTag(t)}');
    await _injectMirroredAuthIntoPage(c);
    _didBootstrapReload = true;
    _authBootstrapSettled = true;
    await _performWebReload(c);
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
      if (t == null || t.isEmpty) {
        _dbg('_injectMirroredAuthIntoPage skipped (no token)');
        return;
      }
      _dbg('_injectMirroredAuthIntoPage writing ${_lenTag(t)}');
      await c.evaluateJavascript(
        source:
            'try{localStorage.setItem(${jsonEncode(_kWebAuthLocalStorageKey)},${jsonEncode(t)});}catch(e){}',
      );
    } catch (_) {}
  }

  Future<void> _performWebReload(InAppWebViewController c) async {
    _dbg('_performWebReload');
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
    _authTokenPollTimer?.cancel();
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
        _dbg('lifecycle -> $state');
        unawaited(_pullWebAuthTokenIntoNativeMirror(c));
        c.pause();
        break;
      case AppLifecycleState.resumed:
        _dbg('lifecycle -> resumed');
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

  Uri? _parseNavigationUri(NavigationAction action) {
    final raw = action.request.url?.toString();
    if (raw == null || raw.isEmpty) return null;
    return Uri.tryParse(raw);
  }

  bool _isGoogleMapsNavigationUri(Uri uri) {
    final scheme = uri.scheme.toLowerCase();
    if (scheme == 'geo' ||
        scheme == 'google.navigation' ||
        scheme == 'comgooglemaps') {
      return true;
    }
    if (scheme != 'http' && scheme != 'https') return false;
    final host = uri.host.toLowerCase();
    if (host == 'maps.google.com') return true;
    if (host == 'www.google.com' || host == 'google.com') {
      return uri.path.startsWith('/maps');
    }
    return false;
  }

  bool _isDirectExternalAppUri(Uri uri) {
    final scheme = uri.scheme.toLowerCase();
    return scheme == 'tel' || scheme == 'sms' || scheme == 'mailto';
  }

  Future<NavigationActionPolicy> _handleUrlOverride(
    NavigationAction action,
  ) async {
    final uri = _parseNavigationUri(action);
    if (uri == null) {
      return NavigationActionPolicy.ALLOW;
    }

    final shouldLaunchExternal =
        _isGoogleMapsNavigationUri(uri) || _isDirectExternalAppUri(uri);
    if (!shouldLaunchExternal) {
      return NavigationActionPolicy.ALLOW;
    }

    try {
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (opened) return NavigationActionPolicy.CANCEL;
    } catch (_) {}
    return NavigationActionPolicy.ALLOW;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final showBootLoading = !_prefsReady || !_hasLoadedInitialPage;

    return Scaffold(
      backgroundColor: theme.colorScheme.surface,
      body: SafeArea(
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (_prefsReady)
              InAppWebView(
                      initialUrlRequest: URLRequest(
                        url: WebUri(kWebViewStartUrl),
                      ),
                      initialSettings: _settings,
                      initialUserScripts: _initialUserScriptsWithAuth(
                        _mirroredAuthToken,
                        _mirroredPhone,
                      ),
                      pullToRefreshController: _pullToRefreshController,
                      onWebViewCreated: (c) {
                        _controller = c;
                        _dbg('onWebViewCreated');
                        c.addJavaScriptHandler(
                          handlerName: _kJsAuthPersistHandler,
                          callback: (args) {
                            unawaited(_persistAuthMirrorFromWeb(args));
                            return null;
                          },
                        );
                        c.addJavaScriptHandler(
                          handlerName: _kJsPhonePersistHandler,
                          callback: (args) {
                            unawaited(_persistPhoneMirrorFromWeb(args));
                            return null;
                          },
                        );
                        _startAuthTokenPoll();
                        unawaited(_syncWebMirrorsFromPage(c));
                        final t = _mirroredAuthToken;
                        if (t != null && t.isNotEmpty) {
                          unawaited(_injectMirroredAuthIntoPage(c));
                          unawaited(_warmAuthMeProbeInPage(c, t));
                        }
                      },
                      onLoadStart: (c, uri) async {
                        _dbg('onLoadStart url=${uri?.toString()}');
                        _didEarlyAuthInjectThisLoad = false;
                        await _injectMirroredAuthIntoPage(c);
                      },
                      onProgressChanged: (c, p) {
                        if (!mounted) return;
                        if (!_didEarlyAuthInjectThisLoad &&
                            p >= 15 &&
                            _mirroredAuthToken != null &&
                            _mirroredAuthToken!.isNotEmpty) {
                          _didEarlyAuthInjectThisLoad = true;
                          unawaited(_injectMirroredAuthIntoPage(c));
                        }
                      },
                      onLoadStop: (c, uri) async {
                        _dbg('onLoadStop url=${uri?.toString()}');
                        await _injectMirroredAuthIntoPage(c);
                        await _backupAuthTokenFromLocalStorage(c);
                        await c.evaluateJavascript(
                          source: _kLockViewportScript,
                        );
                        await _ensureBootstrapReloadWithMirroredAuth(c);
                        await _pullToRefreshController?.endRefreshing();
                        if (!mounted) return;
                        setState(() {
                          _hasLoadedInitialPage = true;
                        });
                        unawaited(_burstReinjectNativeAuthToken(c));
                      },
                      onZoomScaleChanged: (c, oldScale, newScale) async {
                        if ((newScale - 1.0).abs() < 0.001) return;
                        try {
                          await c.zoomBy(
                            zoomFactor: 1.0 / newScale,
                            animated: false,
                          );
                        } catch (_) {}
                      },
                      shouldOverrideUrlLoading: (c, action) async {
                        return _handleUrlOverride(action);
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
            if (showBootLoading) _buildWebBootLoading(theme),
          ],
        ),
      ),
    );
  }

  Widget _buildWebBootLoading(ThemeData theme) {
    final scheme = theme.colorScheme;
    return Container(
      width: double.infinity,
      height: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            scheme.primaryContainer.withValues(alpha: 0.35),
            scheme.surface,
            scheme.secondaryContainer.withValues(alpha: 0.25),
          ],
        ),
      ),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: Image.asset(
                  'assets/logo.png',
                  width: 88,
                  height: 88,
                  fit: BoxFit.cover,
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: 36,
                height: 36,
                child: CircularProgressIndicator(
                  strokeWidth: 3,
                  color: scheme.primary,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                _bootStatusLine,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: scheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
