import 'dart:io';

import 'package:path_provider/path_provider.dart';

const _fileName = 'fd_auth_token_mirror.txt';

Future<File> _file() async {
  final dir = await getApplicationSupportDirectory();
  return File('${dir.path}/$_fileName');
}

Future<String?> readAuthTokenMirrorFile() async {
  try {
    final f = await _file();
    if (!await f.exists()) return null;
    final t = await f.readAsString();
    return t.isEmpty ? null : t;
  } catch (_) {
    return null;
  }
}

Future<void> writeAuthTokenMirrorFile(String? token) async {
  try {
    final f = await _file();
    if (token == null || token.isEmpty) {
      if (await f.exists()) await f.delete();
      return;
    }
    await f.writeAsString(token, flush: true);
  } catch (_) {}
}
