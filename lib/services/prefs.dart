import 'package:web/web.dart' as web;

/// The prefix of the keys of this app in the local storage of the browser.
const _prefix = 'trackula.';

/// The setting [key]. Null if it is not set, or if storage is blocked.
String? readPref(String key) {
  try {
    return web.window.localStorage.getItem('$_prefix$key');
    // The browser throws a DOMException. A catch clause cannot check a JavaScript type the same way on all
    // platforms, so this catches all.
    // ignore: avoid_catches_without_on_clauses
  } catch (_) {
    return null;
  }
}

/// Sets the setting [key] to [value]. A null [value] removes the setting. If storage is blocked, the setting is lost
/// after a reload.
void writePref(String key, String? value) {
  try {
    if (value == null) {
      web.window.localStorage.removeItem('$_prefix$key');
    } else {
      web.window.localStorage.setItem('$_prefix$key', value);
    }
    // ignore: avoid_catches_without_on_clauses
  } catch (_) {
    // Storage is blocked. See readPref.
  }
}
