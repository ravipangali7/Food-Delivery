import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persists the SPA session token ([AuthContext] `fd_auth_token`) in Flutter local storage:
/// secure storage on Android/iOS, [SharedPreferences] on Web.
///
/// The WebView injects this on load so the user stays signed in after app restarts.
/// Logout in the SPA calls `fdAuthTokenPersist` with an empty value, which clears this mirror.
class AuthTokenStorage {
  AuthTokenStorage._();

  static const _secureKey = 'fd_web_auth_token_mirror';

  /// Legacy plaintext mirror (pre–secure storage); migrated once then removed.
  static const legacyPrefsKey = 'webview_mirror_fd_auth_token';

  static const FlutterSecureStorage _secure = FlutterSecureStorage(
    aOptions: AndroidOptions(resetOnError: true),
  );

  static Future<String?> readMirroredToken() async {
    try {
      if (kIsWeb) {
        final prefs = await SharedPreferences.getInstance();
        return prefs.getString(legacyPrefsKey);
      }

      final fromSecure = await _secure.read(key: _secureKey);
      if (fromSecure != null && fromSecure.isNotEmpty) {
        return fromSecure;
      }

      final prefs = await SharedPreferences.getInstance();
      final legacy = prefs.getString(legacyPrefsKey);
      if (legacy != null && legacy.isNotEmpty) {
        await _secure.write(key: _secureKey, value: legacy);
        await prefs.remove(legacyPrefsKey);
        return legacy;
      }
      return null;
    } catch (e, st) {
      assert(() {
        debugPrint('AuthTokenStorage.readMirroredToken failed: $e\n$st');
        return true;
      }());
      return null;
    }
  }

  static Future<void> writeMirroredToken(String? token) async {
    try {
      if (kIsWeb) {
        final prefs = await SharedPreferences.getInstance();
        if (token == null || token.isEmpty) {
          await prefs.remove(legacyPrefsKey);
        } else {
          await prefs.setString(legacyPrefsKey, token);
        }
        return;
      }

      final prefs = await SharedPreferences.getInstance();
      if (token == null || token.isEmpty) {
        await _secure.delete(key: _secureKey);
        await prefs.remove(legacyPrefsKey);
        return;
      }

      await _secure.write(key: _secureKey, value: token);
      await prefs.remove(legacyPrefsKey);
    } catch (e, st) {
      assert(() {
        debugPrint('AuthTokenStorage.writeMirroredToken failed: $e\n$st');
        return true;
      }());
    }
  }
}
