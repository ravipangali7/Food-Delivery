import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:version/version.dart';

import '../config.dart';
import '../models/store_settings.dart';

Future<StoreSettingsDto?> fetchStoreSettings() async {
  final uri = Uri.parse(kSettingsApiUrl);
  final res = await http.get(uri).timeout(const Duration(seconds: 20));
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw Exception('Settings HTTP ${res.statusCode}');
  }
  final raw = res.body;
  if (raw.isEmpty) return null;
  final map = json.decode(raw) as Map<String, dynamic>;
  return StoreSettingsDto.fromJson(map);
}

bool needsUpdateVersusRequired(String appVersion, String? requiredRaw) {
  final required = requiredRaw?.trim();
  if (required == null || required.isEmpty) return false;

  try {
    final a = Version.parse(appVersion);
    final b = Version.parse(required);
    return a < b;
  } catch (_) {
    return appVersion != required;
  }
}

/// When non-null, show the app update screen before the WebView.
Future<StoreSettingsDto?> blockingUpdateSettingsIfNeeded() async {
  final settings = await fetchStoreSettings();
  if (settings == null) return null;

  final pkg = await PackageInfo.fromPlatform();
  final appVer = pkg.version.trim();

  if (Platform.isAndroid) {
    if (!needsUpdateVersusRequired(appVer, settings.androidVersion)) return null;
    return settings;
  }
  if (Platform.isIOS) {
    if (!needsUpdateVersusRequired(appVer, settings.iosVersion)) return null;
    return settings;
  }
  return null;
}
