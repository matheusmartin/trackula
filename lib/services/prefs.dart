import 'package:web/web.dart' as web;

/// Settings in this browser's local storage. Storage can be blocked: then a read returns null, and a write is lost
/// after a reload.
const _prefix = 'trackula.';

/// The setting [key]. Null if it is not set, or if storage is blocked.
String? readPref(String key) {
  try {
    return web.window.localStorage.getItem('$_prefix$key');
  } catch (_) {
    return null;
  }
}

/// Sets the setting [key] to [value]. A null [value] removes the setting.
void writePref(String key, String? value) {
  try {
    if (value == null) {
      web.window.localStorage.removeItem('$_prefix$key');
    } else {
      web.window.localStorage.setItem('$_prefix$key', value);
    }
  } catch (_) {
    // Storage is blocked. The setting is lost after a reload.
  }
}
