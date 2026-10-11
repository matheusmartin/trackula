import 'dart:math' as math;

import 'day.dart';

/// A point of a line chart, in chart units: x from 0 to the chart width, y from 0 (top) to the chart height.
typedef ChartPoint = ({Day day, num value, double x, double y});

/// Places each day of [days] that has a value in [values] on a [width] × [height] chart.
///
/// - x: the position of the day in [days]. The first day is at 0, the last at [width].
/// - y: the value between the lowest and highest value. The highest is at [padding], the lowest at
///   [height] − [padding]. If all values are equal, they are in the middle. With [fromZero], the lowest is 0: 0 is
///   always at [height] − [padding].
/// - Days without a value get no point, so the line connects the days before and after them.
List<ChartPoint> chartPoints(
  List<Day> days,
  Map<Day, num> values, {
  double width = 100,
  double height = 40,
  double padding = 4,
  bool fromZero = false,
}) {
  final present = _present(days, values);
  if (present.isEmpty) return const [];
  final low = present.map((p) => p.value).fold<num>(fromZero ? 0 : double.infinity, math.min);
  final high = present.map((p) => p.value).reduce(math.max);
  final span = math.max(1, days.length - 1);
  return [
    for (final p in present)
      (
        day: p.day,
        value: p.value,
        x: width * p.index / span,
        y: high == low
            ? (fromZero ? height - padding : height / 2)
            : padding + (height - 2 * padding) * (high - p.value) / (high - low),
      ),
  ];
}

/// A bar of a bar chart, in chart units: from x to x + w, and from y (top) to the chart height.
typedef ChartBar = ({Day day, num value, double x, double w, double y});

/// Places a bar for each day of [days] that has a value in [values] on a [width] × [height] chart.
///
/// - Each day gets an equal slot. The bar fills [fill] of its slot, in the middle.
/// - Bars start at 0 at the bottom. The highest value reaches [padding] from the top.
/// - Negative values count as 0.
List<ChartBar> chartBars(
  List<Day> days,
  Map<Day, num> values, {
  double width = 100,
  double height = 40,
  double padding = 4,
  double fill = 0.6,
}) {
  final present = _present(days, values);
  if (present.isEmpty) return const [];
  final high = present.map((b) => b.value).fold<num>(0, math.max);
  final slot = width / days.length;
  return [
    for (final b in present)
      (
        day: b.day,
        value: b.value,
        x: slot * b.index + slot * (1 - fill) / 2,
        w: slot * fill,
        y: high <= 0 ? height : height - (height - padding) * math.max(0, b.value) / high,
      ),
  ];
}

/// The days of [days] that have a value in [values], with their index in [days].
List<({int index, Day day, num value})> _present(List<Day> days, Map<Day, num> values) => [
  for (final (i, d) in days.indexed)
    if (values[d] case final v?) (index: i, day: d, value: v),
];
