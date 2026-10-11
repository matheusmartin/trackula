import 'package:web/web.dart' as web;

import 'double_tap.dart';

/// The input handler of count cells and tiles. It turns clicks, keys and taps into steps: +1 adds the metric step,
/// −1 subtracts it.
///
/// - Mouse and keyboard: a click adds a step at once, so two quick clicks add two steps. A right-click subtracts.
/// - Touch: a tap adds a step after the double-tap wait, and a double-tap subtracts instead. See [DoubleTap].
///   A long-press also opens the context menu on Android: it does nothing.
/// - Keys on a focused cell: `+` adds, `-` subtracts.
///
/// The browser menu never opens on a count cell. [K] identifies a cell, for example a metric id and a day.
final class CountInput<K> {
  /// Touch taps: a tap waits for a second tap on the same cell.
  final _taps = DoubleTap<K>();

  /// The pointer type of the last press: 'mouse', 'touch' or 'pen'. Null after the click, so a keyboard click (Enter
  /// or Space) works like a mouse click.
  String? _pressType;

  /// Handles a click on the cell [key]. [add] gets +1 or −1.
  void click(K key, void Function(int sign) add) {
    if (_takeTouchPress()) {
      _taps.tap(key, onSingle: () => add(1), onDouble: () => add(-1));
    } else {
      _addNow(add, 1);
    }
  }

  /// The other event handlers of the cell: `pointerdown`, `contextmenu` and `keydown`. [add] gets +1 or −1.
  Map<String, void Function(web.Event)> events(void Function(int sign) add) => {
    'pointerdown': (e) => _pressType = (e as web.PointerEvent).pointerType,
    'contextmenu': (e) {
      e.preventDefault();
      if (!_takeTouchPress()) _addNow(add, -1);
    },
    'keydown': (e) {
      final sign = switch ((e as web.KeyboardEvent).key) {
        '+' || '=' => 1,
        '-' => -1,
        _ => 0,
      };
      if (sign == 0) return;
      e.preventDefault();
      _addNow(add, sign);
    },
  };

  void dispose() => _taps.dispose();

  /// Adds at once. A waiting touch tap runs first, so the steps keep their order.
  void _addNow(void Function(int sign) add, int sign) {
    _taps.flush();
    add(sign);
  }

  /// True if the last press was a touch or a pen. Clears the press.
  bool _takeTouchPress() {
    final touch = _pressType == 'touch' || _pressType == 'pen';
    _pressType = null;
    return touch;
  }
}
