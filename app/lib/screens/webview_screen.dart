import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

/// Loads https://shyam-sweets.com with full JS, no zoom, and system-back history.
///
/// Back navigation is driven by [WebViewScreenState.handleSystemBack] from the parent
/// ([PopScope] in connectivity shell) so offline overlay always gets exit, not history.
class WebViewScreen extends StatefulWidget {
  const WebViewScreen({super.key});

  static const String startUrl = 'https://atozmobilenp.com/';

  @override
  WebViewScreenState createState() => WebViewScreenState();
}

class WebViewScreenState extends State<WebViewScreen> {
  InAppWebViewController? _controller;
  double _progress = 0;
  bool _ready = false;

  InAppWebViewSettings get _settings => InAppWebViewSettings(
        javaScriptEnabled: true,
        javaScriptCanOpenWindowsAutomatically: true,
        domStorageEnabled: true,
        databaseEnabled: true,
        geolocationEnabled: true,
        supportZoom: false,
        builtInZoomControls: false,
        displayZoomControls: false,
        minimumZoomScale: 1.0,
        maximumZoomScale: 1.0,
        allowsInlineMediaPlayback: true,
        mediaPlaybackRequiresUserGesture: false,
        allowsBackForwardNavigationGestures: true,
        useHybridComposition: true,
        thirdPartyCookiesEnabled: true,
        cacheEnabled: true,
      );

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
      appBar: AppBar(
        title: const Text('Shyam Sweets'),
        leading: IconButton(
          tooltip: 'Back',
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: _ready ? handleSystemBack : null,
        ),
      ),
      body: Column(
        children: [
          if (_progress < 1.0)
            LinearProgressIndicator(
              value: _progress > 0 ? _progress : null,
              minHeight: 2,
            ),
          Expanded(
            child: InAppWebView(
              initialUrlRequest: URLRequest(url: WebUri(WebViewScreen.startUrl)),
              initialSettings: _settings,
              onWebViewCreated: (c) => _controller = c,
              onProgressChanged: (c, p) {
                if (!mounted) return;
                setState(() => _progress = p / 100.0);
              },
              onLoadStop: (c, uri) async {
                if (!mounted) return;
                setState(() {
                  _ready = true;
                  _progress = 1.0;
                });
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
    );
  }
}
