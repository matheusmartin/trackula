import 'dart:async';

/// A filter that tells single taps from double-taps. One tap waits at a time, for any key, such as a cell.
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

  /// Adds a tap on [key]. [onSingle] runs after [wait] if no second tap comes, and [onDouble] runs at the second tap.
  void tap(K key, {required void Function() onSingle, required void Function() onDouble}) {
    if (_waiting && _key == key) {
      _timer!.cancel();
      _single = null;
      return onDouble();
    }
    flush();
    _key = key;
    _single = onSingle;
    _timer = Timer(wait, _runSingle);
  }

  /// Runs the waiting single tap at once, if there is one.
  void flush() {
    if (!_waiting) return;
    _timer!.cancel();
    _runSingle();
  }

  /// Runs the waiting single tap, and removes it so that it runs only once.
  void _runSingle() {
    final single = _single;
    _single = null;
    single?.call();
  }

  void dispose() => _timer?.cancel();
}
