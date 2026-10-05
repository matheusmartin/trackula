import 'package:web/web.dart' as web;

import 'double_tap.dart';

/// The input of `count` cells and tiles. [add] gets +1 to add one step, or −1 to subtract it.
///
/// - Mouse and keyboard: a click adds the step at once, so two quick clicks add two steps. A right-click subtracts it.
///   Keys `+` (or `=`) and `-` add and subtract it.
/// - Touch: a tap adds the step after the double-tap wait, and a double-tap subtracts it. See [DoubleTap].
///
/// A step that runs at once runs the waiting touch tap first, so the steps keep their order. Call [dispose] when the
/// owner goes away.
final class CountInput<K> {
  /// Touch taps: a tap waits 300 ms for a second tap on the same key, such as a cell.
  final _taps = DoubleTap<K>();

  /// The pointer type of the last press: 'mouse', 'touch' or 'pen'. Null after the click, so a keyboard click
  /// (Enter or Space) works like a mouse click.
  String? _pressType;

  void dispose() => _taps.dispose();

  /// The touch state of the last press. It clears it.
  bool _takeTouch() {
    final touch = _pressType == 'touch' || _pressType == 'pen';
    _pressType = null;
    return touch;
  }

  void _now(void Function(int sign) add, int sign) {
    _taps.flush();
    add(sign);
  }

  /// The click of the element with [key].
  void click(K key, void Function(int sign) add) {
    if (_takeTouch()) {
      _taps.tap(key, onSingle: () => add(1), onDouble: () => add(-1));
    } else {
      _now(add, 1);
    }
  }

  /// The other events of the element: the pointer type, the right-click and the keys.
  ///
  /// A touch long-press also opens the context menu on Android: it does nothing. The browser menu never opens.
  Map<String, void Function(web.Event)> events(void Function(int sign) add) => {
    'pointerdown': (e) => _pressType = (e as web.PointerEvent).pointerType,
    'contextmenu': (e) {
      e.preventDefault();
      if (!_takeTouch()) _now(add, -1);
    },
    'keydown': (e) {
      final sign = switch ((e as web.KeyboardEvent).key) {
        '+' || '=' => 1,
        '-' => -1,
        _ => 0,
      };
      if (sign == 0) return;
      e.preventDefault();
      _now(add, sign);
    },
  };
}
