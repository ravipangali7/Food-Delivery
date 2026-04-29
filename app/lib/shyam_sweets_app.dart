import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'models/store_settings.dart';
import 'screens/app_update_screen.dart';
import 'screens/no_internet_screen.dart';
import 'screens/webview_screen.dart';
import 'services/app_update_service.dart';
import 'widgets/update_check_loading_screen.dart';

/// Root app widget: theme and connectivity-aware shell (WebView vs offline).
class ShyamSweetsApp extends StatelessWidget {
  const ShyamSweetsApp({super.key});

  static const Color _brandSeed = Color(0xFFB8860B);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Shyam Sweets',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: _brandSeed,
          brightness: Brightness.light,
        ),
        dialogTheme: DialogThemeData(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
      home: const _ConnectivityShell(),
    );
  }
}

class _ConnectivityShell extends StatefulWidget {
  const _ConnectivityShell();

  @override
  State<_ConnectivityShell> createState() => _ConnectivityShellState();
}

class _ConnectivityShellState extends State<_ConnectivityShell> {
  List<ConnectivityResult> _results = [ConnectivityResult.none];
  StreamSubscription<List<ConnectivityResult>>? _sub;
  bool _hasBuiltWebView = false;
  final GlobalKey<WebViewScreenState> _webViewKey = GlobalKey<WebViewScreenState>();

  /// True until [loadStoreSettingsAtLaunch] finishes (success or failure).
  bool _versionGatePending = true;

  /// When non-null, user must pass the forced-update gate before browsing.
  StoreSettingsDto? _forceUpdateSettings;

  bool get _online =>
      _results.any((r) => r != ConnectivityResult.none);

  @override
  void initState() {
    super.initState();
    _runVersionGate();
    Connectivity().checkConnectivity().then((r) {
      if (!mounted) return;
      setState(() {
        _results = r;
        if (_online && _forceUpdateSettings == null) {
          _hasBuiltWebView = true;
        }
      });
    });
    _sub = Connectivity().onConnectivityChanged.listen((r) {
      if (!mounted) return;
      setState(() {
        _results = r;
        if (_online && _forceUpdateSettings == null) {
          _hasBuiltWebView = true;
        }
      });
    });
  }

  Future<void> _runVersionGate() async {
    try {
      final outcome = await loadStoreSettingsAtLaunch();
      if (!mounted) return;
      setState(() {
        _versionGatePending = false;
        if (outcome == null) {
          _forceUpdateSettings = null;
          if (_online) _hasBuiltWebView = true;
          return;
        }
        if (outcome.requiresForcedUpdate) {
          _forceUpdateSettings = outcome.settings;
          return;
        }
        _forceUpdateSettings = null;
        if (_online) _hasBuiltWebView = true;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _versionGatePending = false;
        _forceUpdateSettings = null;
        if (_online) _hasBuiltWebView = true;
      });
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _retry() async {
    final r = await Connectivity().checkConnectivity();
    if (!mounted) return;
    setState(() {
      _results = r;
      if (_online && _forceUpdateSettings == null) _hasBuiltWebView = true;
    });
  }

  Future<void> _onSystemBack() async {
    if (!_online) {
      await _confirmExit();
      return;
    }
    await _webViewKey.currentState?.handleSystemBack();
  }

  Future<void> _confirmExit() async {
    if (!mounted) return;
    final exit = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Exit app?'),
        content: const Text('Do you want to close Shyam Sweets?'),
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
    if (_forceUpdateSettings != null) {
      return AppUpdateScreen(settings: _forceUpdateSettings!);
    }

    if (_versionGatePending) {
      return const UpdateCheckLoadingScreen();
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, dynamic result) async {
        if (didPop) return;
        await _onSystemBack();
      },
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (_hasBuiltWebView)
            Offstage(
              offstage: !_online,
              child: WebViewScreen(key: _webViewKey),
            ),
          if (!_online)
            NoInternetScreen(onRetry: _retry),
        ],
      ),
    );
  }
}
