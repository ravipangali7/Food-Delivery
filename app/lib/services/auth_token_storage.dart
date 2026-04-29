import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'auth_token_mirror_file_stub.dart'
    if (dart.library.io) 'auth_token_mirror_file_io.dart' as mirror_file;

/// Persists the SPA session token (`fd_auth_token`) so the WebView can be re-seeded after a process restart.
///
/// Uses [SharedPreferences] plus an app-private **disk file** on mobile/desktop (`dart:io`) so a token
/// survives even when prefs or the JS bridge misbehaves. Web uses prefs only.
class AuthTokenStorage {
  AuthTokenStorage._();

  static const prefsBackupKey = 'webview_mirror_fd_auth_token';
  static const prefsPhoneKey = 'webview_saved_phone';

  static String _lenTag(String? token) => token == null ? 'null' : 'len=${token.length}';

  static void _dbg(String msg) {
    if (!kDebugMode) return;
    debugPrint('[AuthTokenStorage] $msg');
  }

  static Future<String?> readMirroredToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.reload();
      final fromPrefs = prefs.getString(prefsBackupKey);
      if (fromPrefs != null && fromPrefs.isNotEmpty) {
        _dbg('read -> prefs ${_lenTag(fromPrefs)}');
        return fromPrefs;
      }
      if (!kIsWeb) {
        final fromFile = await mirror_file.readAuthTokenMirrorFile();
        if (fromFile != null && fromFile.isNotEmpty) {
          await prefs.setString(prefsBackupKey, fromFile);
          _dbg('read -> file ${_lenTag(fromFile)} then wrote prefs');
          return fromFile;
        }
      }
      _dbg('read -> empty');
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
      final prefs = await SharedPreferences.getInstance();
      if (token == null || token.isEmpty) {
        await prefs.remove(prefsBackupKey);
        if (!kIsWeb) {
          await mirror_file.writeAuthTokenMirrorFile(null);
        }
        _dbg('write -> cleared');
        return;
      }
      await prefs.setString(prefsBackupKey, token);
      _dbg('write -> prefs ${_lenTag(token)}');
      if (!kIsWeb) {
        await mirror_file.writeAuthTokenMirrorFile(token);
        _dbg('write -> file ${_lenTag(token)}');
      }
    } catch (e, st) {
      assert(() {
        debugPrint('AuthTokenStorage.writeMirroredToken failed: $e\n$st');
        return true;
      }());
    }
  }

  static String? _normalizePhone(String? phone) {
    if (phone == null) return null;
    final digits = phone.replaceAll(RegExp(r'\D+'), '');
    if (digits.length < 7 || digits.length > 15) return null;
    return digits;
  }

  static Future<String?> readSavedPhone() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.reload();
      final fromPrefs = _normalizePhone(prefs.getString(prefsPhoneKey));
      if (fromPrefs != null) {
        return fromPrefs;
      }
      if (!kIsWeb) {
        final fromFile = _normalizePhone(await mirror_file.readAuthPhoneMirrorFile());
        if (fromFile != null) {
          await prefs.setString(prefsPhoneKey, fromFile);
          _dbg('read phone -> file $fromFile then wrote prefs');
          return fromFile;
        }
      }
      return null;
    } catch (e, st) {
      assert(() {
        debugPrint('AuthTokenStorage.readSavedPhone failed: $e\n$st');
        return true;
      }());
      return null;
    }
  }

  static Future<void> writeSavedPhone(String? phone) async {
    try {
      final normalized = _normalizePhone(phone);
      final prefs = await SharedPreferences.getInstance();
      if (normalized == null) {
        await prefs.remove(prefsPhoneKey);
        if (!kIsWeb) {
          await mirror_file.writeAuthPhoneMirrorFile(null);
        }
        _dbg('write phone -> cleared');
        return;
      }
      await prefs.setString(prefsPhoneKey, normalized);
      if (!kIsWeb) {
        await mirror_file.writeAuthPhoneMirrorFile(normalized);
      }
      _dbg('write phone -> $normalized');
    } catch (e, st) {
      assert(() {
        debugPrint('AuthTokenStorage.writeSavedPhone failed: $e\n$st');
        return true;
      }());
    }
  }
}
