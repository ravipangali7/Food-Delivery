import 'dart:io';

import 'package:path_provider/path_provider.dart';

const _fileName = 'fd_auth_token_mirror.txt';
const _phoneFileName = 'fd_auth_phone_mirror.txt';

Future<File> _file() async {
  final dir = await getApplicationSupportDirectory();
  return File('${dir.path}/$_fileName');
}

Future<File> _phoneFile() async {
  final dir = await getApplicationSupportDirectory();
  return File('${dir.path}/$_phoneFileName');
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

Future<String?> readAuthPhoneMirrorFile() async {
  try {
    final f = await _phoneFile();
    if (!await f.exists()) return null;
    final t = await f.readAsString();
    return t.isEmpty ? null : t;
  } catch (_) {
    return null;
  }
}

Future<void> writeAuthPhoneMirrorFile(String? phone) async {
  try {
    final f = await _phoneFile();
    if (phone == null || phone.isEmpty) {
      if (await f.exists()) await f.delete();
      return;
    }
    await f.writeAsString(phone, flush: true);
  } catch (_) {}
}
