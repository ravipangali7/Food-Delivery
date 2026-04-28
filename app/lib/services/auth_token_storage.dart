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
}
