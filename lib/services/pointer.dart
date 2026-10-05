import 'package:web/web.dart' as web;

/// Sends the next moves of the pointer of [p] to its element, also outside it. A pointer that is already up throws:
/// then nothing changes.
void capturePointer(web.PointerEvent p) {
  try {
    (p.currentTarget as web.Element).setPointerCapture(p.pointerId);
  } catch (_) {}
}

/// True if [e] moves more to the side than up or down, for example a side trackpad swipe.
bool isSideWheel(web.WheelEvent e) => e.deltaX.abs() > e.deltaY.abs();

/// True if [e] moves more up or down than to the side, for example a mouse wheel.
bool isVerticalWheel(web.WheelEvent e) => e.deltaY.abs() > e.deltaX.abs();

/// [delta] of [e] in pixels. In line mode, one line is [lineSize] pixels.
double wheelPixels(web.WheelEvent e, num delta, double lineSize) =>
    delta * (e.deltaMode == web.WheelEvent.DOM_DELTA_LINE ? lineSize : 1);
