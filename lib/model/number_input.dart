import 'dart:math' as math;

/// Reads a number that the user typed. A period and a comma both work as decimal mark: "81.9" and "81,9" are 81.9.
///
/// A dot at the end is allowed while the user types: "81." is 81.
/// Returns null if [text] is empty, is not a number, or is below 0.
num? parseDecimal(String text) {
  var t = text.trim().replaceAll(',', '.');
  if (t.endsWith('.')) t = t.substring(0, t.length - 1);
  return _decimal.hasMatch(t) ? num.parse(t) : null;
}

final _decimal = RegExp(r'^(\d+(\.\d+)?|\.\d+)$');

/// The number of decimals of [step]. Examples: 0.1 → 1, 0.25 → 2, 5 → 0.
int stepDecimals(num step) {
  if (step == step.roundToDouble()) return 0;
  final s = step.toString();
  final i = s.indexOf('.');
  return i < 0 ? 0 : math.min(6, s.length - i - 1);
}

/// Rounds [v] to the decimals of [step]. With [snap], also to the nearest multiple of [step]. Never below 0.
///
/// This removes float noise, for example 81.9 + 0.1 = 82.00000000000001.
num roundToStep(num v, num step, {bool snap = false}) {
  final x = snap ? (v / step).round() * step : v;
  final decimals = stepDecimals(step);
  final rounded = double.parse(math.max<num>(0, x).toStringAsFixed(decimals));
  return decimals == 0 ? rounded.round() : rounded;
}

/// [v] with the decimals of [step]. Examples: (82, 0.1) → "82.0", (1250, 250) → "1250".
String formatStep(num v, num step) => v.toStringAsFixed(stepDecimals(step));

/// [v] without zeros at the end. Examples: 82.0 → "82", 2.5 → "2.5".
String formatShort(num v) =>
    v == v.roundToDouble() ? v.round().toString() : double.parse(v.toStringAsFixed(6)).toString();
