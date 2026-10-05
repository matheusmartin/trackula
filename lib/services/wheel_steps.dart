/// Turns wheel and trackpad deltas into whole steps of [size] pixels. The rest waits for the next delta, so slow
/// trackpad moves still add up to a step.
final class WheelSteps {
  WheelSteps(this.size);

  final double size;

  double _rest = 0;

  /// Adds [delta] pixels and returns the number of whole steps, toward zero. Example with size 40: 30 → 0, then
  /// 30 → 1 (rest 20), then −70 → −1 (rest −10).
  int add(num delta) {
    _rest += delta;
    final steps = (_rest / size).truncate();
    _rest -= steps * size;
    return steps;
  }
}
