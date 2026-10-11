import 'package:web/web.dart' as web;

/// Sends the next moves of the pointer of [event] to its current target, also outside it. A pointer that is already
/// up throws: then nothing changes.
void capturePointer(web.PointerEvent event) {
  try {
    (event.currentTarget as web.Element).setPointerCapture(event.pointerId);
    // The browser throws a DOMException. See readPref in prefs.dart.
    // ignore: avoid_catches_without_on_clauses
  } catch (_) {
    // The pointer is already up.
  }
}
