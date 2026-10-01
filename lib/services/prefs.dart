import 'package:web/web.dart' as web;

/// Settings in this browser's local storage. Storage can be blocked, so reads can return null.
abstract final class LocalPrefs {
  static const _prefix = 'trackula.';

  static String? get(String key) {
    try {
      return web.window.localStorage.getItem('$_prefix$key');
    } catch (_) {
      return null;
    }
  }

  static void set(String key, String? value) {
    try {
      value == null
          ? web.window.localStorage.removeItem('$_prefix$key')
          : web.window.localStorage.setItem('$_prefix$key', value);
    } catch (_) {
      // Storage is blocked. The setting is lost after a reload.
    }
  }
}
