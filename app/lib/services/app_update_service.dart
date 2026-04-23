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

/// Result of loading store settings at cold start: always includes branding when [settings] is non-null.
class StoreLaunchSettings {
  const StoreLaunchSettings({
    required this.settings,
    required this.requiresForcedUpdate,
  });

  final StoreSettingsDto settings;
  final bool requiresForcedUpdate;
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

/// Loads public store settings once; [requiresForcedUpdate] drives the blocking update screen.
Future<StoreLaunchSettings?> loadStoreSettingsAtLaunch() async {
  final settings = await fetchStoreSettings();
  if (settings == null) return null;

  final pkg = await PackageInfo.fromPlatform();
  final appVer = pkg.version.trim();

  if (Platform.isAndroid) {
    final needs = needsUpdateVersusRequired(appVer, settings.androidVersion);
    return StoreLaunchSettings(settings: settings, requiresForcedUpdate: needs);
  }
  if (Platform.isIOS) {
    final needs = needsUpdateVersusRequired(appVer, settings.iosVersion);
    return StoreLaunchSettings(settings: settings, requiresForcedUpdate: needs);
  }
  return StoreLaunchSettings(settings: settings, requiresForcedUpdate: false);
}
