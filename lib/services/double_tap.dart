import 'dart:async';

/// Tells single taps from double-taps. One tap waits at a time, for any key, such as a cell.
///
/// A single tap runs only when [wait] ends without a second tap on the same key. A second tap in that time
/// is a double-tap: it runs at once and the single tap is dropped. A tap on another key runs the waiting
/// single tap at once. Fast repeated taps on one key alternate: 3 quick taps are a double-tap and a single tap.
final class DoubleTap<K> {
  DoubleTap({this.wait = const Duration(milliseconds: 300)});

  final Duration wait;

  K? _key;
  void Function()? _single;
  Timer? _timer;

  bool get _waiting => _timer?.isActive ?? false;

  void tap(K key, {required void Function() onSingle, required void Function() onDouble}) {
    if (_waiting) {
      _timer!.cancel();
      final single = _single;
      _single = null;
      if (_key == key) return onDouble();
      single?.call();
    }
    _key = key;
    _single = onSingle;
    _timer = Timer(wait, () {
      final single = _single;
      _single = null;
      single?.call();
    });
  }

  /// Runs the waiting single tap at once, if there is one.
  void flush() {
    if (!_waiting) return;
    _timer!.cancel();
    final single = _single;
    _single = null;
    single?.call();
  }

  void dispose() => _timer?.cancel();
}
