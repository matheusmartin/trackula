import 'dart:math' as math;

import 'day.dart';

/// The y of [v] on a scale from [lo] at the bottom to [hi] at the top, in a box of [height]. The top value is at
/// [padding] from the top, the lowest at [padding] from the bottom. If [hi] equals [lo], all values are in the middle.
double linearY(num v, num lo, num hi, double height, {double padding = 0}) =>
    hi == lo ? height / 2 : padding + (height - 2 * padding) * (hi - v) / (hi - lo);

/// The bottom of a bar scale that does not start at 0: a quarter of the range below [lowest], and at least 1 % of
/// the size of [top] below it. So small changes show, and the lowest bar is never empty.
num barFloor(num lowest, num top) => lowest - math.max((top - lowest) * 0.25, top.abs() * 0.01);

/// A point of a line chart, in chart units: x from 0 to [width], y from 0 (top) to [height].
typedef ChartPoint = ({Day day, num value, double x, double y});

/// Places each day of [days] that has a value in [values] on a [width] × [height] chart.
///
/// - x: the position of the day in [days]. The first day is at 0, the last at [width].
/// - y: the value between the lowest and highest value. The highest is at [padding], the lowest at
///   [height] − [padding]. If all values are equal, they are in the middle.
/// - Days without a value get no point, so the line connects the days before and after them.
List<ChartPoint> chartPoints(
  List<Day> days,
  Map<Day, num> values, {
  double width = 100,
  double height = 40,
  double padding = 4,
}) {
  final present = [
    for (final (i, d) in days.indexed)
      if (values[d] case final v?) (i: i, day: d, value: v),
  ];
  if (present.isEmpty) return const [];
  final lo = present.map((p) => p.value).reduce((a, b) => a < b ? a : b);
  final hi = present.map((p) => p.value).reduce((a, b) => a > b ? a : b);
  final span = days.length > 1 ? days.length - 1 : 1;
  return [
    for (final p in present)
      (
        day: p.day,
        value: p.value,
        x: width * p.i / span,
        y: linearY(p.value, lo, hi, height, padding: padding),
      ),
  ];
}

/// A bar of a bar chart, in chart units: from x to x + w, and from y (top) to [height].
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
  final present = [
    for (final (i, d) in days.indexed)
      if (values[d] case final v?) (i: i, day: d, value: v),
  ];
  if (present.isEmpty) return const [];
  final hi = present.map((b) => b.value).fold<num>(0, (m, v) => v > m ? v : m);
  final slot = width / days.length;
  return [
    for (final b in present)
      (
        day: b.day,
        value: b.value,
        x: slot * b.i + slot * (1 - fill) / 2,
        w: slot * fill,
        y: hi <= 0 ? height : height - (height - padding) * (b.value < 0 ? 0 : b.value) / hi,
      ),
  ];
}
