/// Number formats of the app. All remove float noise, for example 82.10000000000001, and zeros at the end.
library;

/// [v] without zeros at the end. Examples: 82.0 → "82", 2.5 → "2.5".
String formatShort(num v) =>
    v == v.roundToDouble() ? v.round().toString() : double.parse(v.toStringAsFixed(6)).toString();

/// [v] with at most [decimals] decimals and no zeros at the end. Example: 81.25 → "81.3". More than 6 decimals
/// show as 6.
String formatNumber(num v, [int decimals = 1]) => formatShort(double.parse(v.toStringAsFixed(decimals)));

/// Short text for a small cell: 1 decimal at most, and "k" from 1000. Example: 12500 → "12.5k".
String formatCompact(num v) => v.abs() >= 1000 ? '${formatNumber(v / 1000)}k' : formatNumber(v);

/// A space and [unit], or nothing if there is no unit. Example: "kg" → " kg".
String unitSuffix(String? unit) => unit == null || unit.isEmpty ? '' : ' $unit';

/// [v] as [formatNumber] does, then [unit] if there is one. Examples: (82.1, "kg") → "82.1 kg", (3, null) → "3".
String withUnit(num v, String? unit, [int decimals = 1]) => '${formatNumber(v, decimals)}${unitSuffix(unit)}';

/// [withUnit] with a "+" or "−" sign. A value that rounds to 0 has no sign. Examples: 0.4 → "+0.4 kg", -1 → "−1 kg".
String formatSigned(num v, String? unit, [int decimals = 1]) {
  final rounded = double.parse(v.toStringAsFixed(decimals));
  final sign = rounded > 0
      ? '+'
      : rounded < 0
      ? '−'
      : '';
  return '$sign${withUnit(rounded.abs(), unit, decimals)}';
}

/// A rate from 0 to 1 as a whole percentage. Example: 0.456 → "46%".
String formatPercent(num rate) => '${(rate * 100).round()}%';
