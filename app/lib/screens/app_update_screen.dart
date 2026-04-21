import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/store_settings.dart';

/// Full-screen forced update UI with optional auto store redirect or APK/IPA download.
class AppUpdateScreen extends StatefulWidget {
  const AppUpdateScreen({
    super.key,
    required this.settings,
  });

  final StoreSettingsDto settings;

  @override
  State<AppUpdateScreen> createState() => _AppUpdateScreenState();
}

class _AppUpdateScreenState extends State<AppUpdateScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  )..repeat(reverse: true);

  String _status = '';
  double? _progress;
  bool _busy = false;
  bool _started = false;

  bool get _isIos => Platform.isIOS;

  String? get _storeLink =>
      _isIos ? widget.settings.applestoreLink?.trim() : widget.settings.googlePlaystoreLink?.trim();

  String? get _fileLink => _isIos ? widget.settings.iosFile?.trim() : widget.settings.androidFile?.trim();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _autoStart());
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  Future<void> _autoStart() async {
    if (_started || !mounted) return;
    _started = true;
    final store = _storeLink;
    if (store != null && store.isNotEmpty) {
      setState(() {
        _busy = true;
        _status = 'Opening store…';
      });
      await _openExternal(store);
      if (mounted) setState(() => _busy = false);
      return;
    }
    final file = _fileLink;
    if (file != null && file.isNotEmpty) {
      await _downloadAndOpen(file);
    } else {
      setState(() => _status = 'No update link or package is configured. Contact support.');
    }
  }

  Future<void> _openExternal(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) {
      setState(() => _status = 'Invalid store URL.');
      return;
    }
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      setState(() => _status = 'Could not open the store. Try again from the button below.');
    }
  }

  Future<void> _downloadAndOpen(String url) async {
    setState(() {
      _busy = true;
      _progress = 0;
      _status = 'Downloading update…';
    });
    try {
      final uri = Uri.parse(url);
      final ext = _isIos ? 'ipa' : 'apk';
      final dir = await getTemporaryDirectory();
      final path = '${dir.path}/shyam_update.$ext';
      final file = File(path);
      if (await file.exists()) {
        await file.delete();
      }
      await Dio().download(
        uri.toString(),
        path,
        onReceiveProgress: (c, t) {
          if (!mounted || t <= 0) return;
          setState(() => _progress = c / t);
        },
      );
      if (!mounted) return;
      setState(() {
        _status = _isIos ? 'Opening downloaded file…' : 'Starting installer…';
        _progress = 1;
      });
      final result = await OpenFilex.open(path);
      if (!mounted) return;
      if (result.type != ResultType.done && result.type != ResultType.noAppToOpen) {
        setState(() => _status = 'Could not open the file (${result.message}).');
      } else {
        setState(() => _status = _isIos ? 'Follow the prompts in Files or Safari.' : 'Complete installation in the system dialog.');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _status = 'Download failed: $e');
      }
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      body: Container(
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
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ScaleTransition(
                  scale: Tween<double>(begin: 0.92, end: 1.0).animate(
                    CurvedAnimation(parent: _pulse, curve: Curves.easeInOut),
                  ),
                  child: Container(
                    padding: const EdgeInsets.all(22),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: scheme.primary.withValues(alpha: 0.12),
                      boxShadow: [
                        BoxShadow(
                          color: scheme.primary.withValues(alpha: 0.2),
                          blurRadius: 28,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: Icon(Icons.system_update_alt_rounded, size: 56, color: scheme.primary),
                  ),
                ),
                const SizedBox(height: 28),
                Text(
                  'Update required',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                      ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  'A newer version of Shyam Sweets is available. '
                  '${(_storeLink?.isNotEmpty ?? false) ? 'We opened the store for you.' : 'We are preparing your download.'}',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: scheme.onSurfaceVariant,
                        height: 1.45,
                      ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                if (_progress != null)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      minHeight: 8,
                      value: _progress != null && _progress! <= 1 ? _progress : null,
                      backgroundColor: scheme.surfaceContainerHighest,
                    ),
                  ),
                if (_progress != null) const SizedBox(height: 8),
                if (_status.isNotEmpty)
                  Text(
                    _status,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
                    textAlign: TextAlign.center,
                  ),
                const SizedBox(height: 28),
                FilledButton.icon(
                  onPressed: _busy
                      ? null
                      : () async {
                          final store = _storeLink;
                          if (store != null && store.isNotEmpty) {
                            await _openExternal(store);
                            return;
                          }
                          final file = _fileLink;
                          if (file != null && file.isNotEmpty) {
                            await _downloadAndOpen(file);
                          }
                        },
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Retry update'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
