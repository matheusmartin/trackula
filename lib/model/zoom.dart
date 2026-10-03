import 'dart:math' as math;

import 'day.dart';

// The time window of the metric detail screen: bars over time, from the first value to today. A zoom step sets the
// span in view and the size of one bar. All charts of the screen show the same window. Pure Dart, no browser code.

/// The days of one bar.
enum BarUnit { day, week, month, quarter }

/// The zoom steps, from the smallest span to the largest. A step has a fixed number of bars, so that a chart keeps its
/// shape while it moves. The shortest spans show days, short spans weeks, middle spans months, long spans quarters.
enum ZoomStep {
  week1('1 week', BarUnit.day, 7),
  week2('2 weeks', BarUnit.day, 14),
  month1('1 month', BarUnit.week, 5),
  month3('3 months', BarUnit.week, 13),
  month6('6 months', BarUnit.week, 26),
  year1('1 year', BarUnit.month, 12),
  year2('2 years', BarUnit.month, 24),
  year3('3 years', BarUnit.quarter, 12),
  year5('5 years', BarUnit.quarter, 20);

  const ZoomStep(this.label, this.unit, this.bars);

  final String label;
  final BarUnit unit;

  /// The number of bars in view.
  final int bars;
}

/// How the days of a bar become its value.
enum Aggregate {
  /// The share of yes days among all days of the bar, from 0 to 1. A value of 1 is `yes`. Days without entry count
  /// as not yes, as in the rate of the period.
  rate,

  /// The sum of the values.
  sum,

  /// The average of the values. Days without value are left out.
  average,

  /// The [average] minus the average of the bar before.
  change,
}

/// One bar: its first day, its value, and the lowest and highest value of its days. A null value draws no bar.
typedef ZoomBar = ({Day start, num? value, num? low, num? high});

/// The first day of the bar that holds [d]. Weeks start on Monday.
Day barStart(Day d, BarUnit unit) => switch (unit) {
  BarUnit.day => d,
  BarUnit.week => d.addDays(1 - d.weekday),
  BarUnit.month => Day(d.year, d.month, 1),
  BarUnit.quarter => Day(d.year, d.month - (d.month - 1) % 3, 1),
};

/// The first day of the bar after the bar that starts on [start].
Day nextBarStart(Day start, BarUnit unit) => switch (unit) {
  BarUnit.day => start.addDays(1),
  BarUnit.week => start.addDays(7),
  BarUnit.month => Day.fromDateTime(DateTime(start.year, start.month + 1)),
  BarUnit.quarter => Day.fromDateTime(DateTime(start.year, start.month + 3)),
};

/// The first days of all bars from the bar of [first] to the bar of [today], oldest first.
List<Day> barStarts(Day first, Day today, BarUnit unit) => [
  for (var d = barStart(first, unit); d.compareTo(today) <= 0; d = nextBarStart(d, unit)) d,
];

/// The zoom steps for data from [first] to [today]. The list ends with the first step that shows all bars. Example:
/// for 2 months of data, 1 month and 3 months.
List<ZoomStep> zoomSteps(Day first, Day today) {
  final steps = <ZoomStep>[];
  for (final s in ZoomStep.values) {
    steps.add(s);
    if (showsAll(s, first, today)) break;
  }
  return steps;
}

/// The step that the detail screen opens with: 3 months, or the last of [steps] if there are fewer.
int defaultStep(List<ZoomStep> steps) => switch (steps.indexOf(ZoomStep.month3)) {
  -1 => steps.length - 1,
  final i => i,
};

/// True if [step] shows all bars from [first] to [today].
bool showsAll(ZoomStep step, Day first, Day today) => barStarts(first, today, step.unit).length <= step.bars;

/// The time window in view: whole bars of [step], from the bar of [first] to the bar of [today].
final class ZoomWindow {
  /// The window of [step] that ends with the bar of [end]. Null [end]: the newest bar. The window has [ZoomStep.bars]
  /// bars, or all bars if there are fewer.
  factory ZoomWindow(ZoomStep step, {required Day first, required Day today, Day? end}) {
    final starts = barStarts(first, today, step.unit);
    final count = math.min(step.bars, starts.length);
    final last = end == null
        ? starts.length
        : (starts.indexOf(barStart(end, step.unit)) + 1).clamp(count, starts.length);
    return ZoomWindow._(step, first, today, starts, last - count, last);
  }

  ZoomWindow._(this.step, this.first, this.today, this.allStarts, this._from, this._to);

  final ZoomStep step;
  final Day first;
  final Day today;

  /// The first days of all bars, oldest first.
  final List<Day> allStarts;

  /// The bars in view: indexes in [allStarts], from [_from] to before [_to].
  final int _from, _to;

  BarUnit get unit => step.unit;

  /// The first days of the bars in view, oldest first.
  List<Day> get starts => allStarts.sublist(_from, _to);

  /// The first day in view: the start of the first bar, but not before [first].
  Day get from => allStarts[_from].compareTo(first) < 0 ? first : allStarts[_from];

  /// The last day in view: the end of the last bar, but not after [today].
  Day get to {
    final end = nextBarStart(allStarts[_to - 1], unit).addDays(-1);
    return end.compareTo(today) > 0 ? today : end;
  }

  /// All days in view, oldest first.
  List<Day> get days => [for (var d = from; d.compareTo(to) <= 0; d = d.addDays(1)) d];

  /// True if the window shows the newest bar.
  bool get atEnd => _to == allStarts.length;

  /// True if the window shows the oldest bar.
  bool get atStart => _from == 0;

  /// The `end` day of the window that is [bars] bars later (or earlier, if negative). Null: the newest bar.
  Day? moved(int bars) {
    final last = (_to + bars).clamp(_to - _from, allStarts.length);
    return last == allStarts.length ? null : allStarts[last - 1];
  }

  /// The `end` day of the window with its middle on [day]. Null: the newest bar.
  Day? centeredOn(Day day) {
    final count = _to - _from;
    final last = (allStarts.indexOf(barStart(day, unit)) + 1 + count ~/ 2).clamp(count, allStarts.length);
    return last == allStarts.length ? null : allStarts[last - 1];
  }
}

/// One bar for each day of [starts], from the day [values]. Days before [first] and after [today] are not part of a
/// bar. For [Aggregate.change], the first bar has no value.
List<ZoomBar> zoomBars(
  Map<Day, num> values,
  Aggregate aggregate,
  List<Day> starts,
  BarUnit unit, {
  required Day first,
  required Day today,
}) {
  final byBar = <Day, List<num>>{};
  for (final MapEntry(key: day, value: v) in values.entries) {
    if (day.compareTo(first) < 0 || day.compareTo(today) > 0) continue;
    (byBar[barStart(day, unit)] ??= []).add(v);
  }
  num? average(List<num>? vs) => vs == null || vs.isEmpty ? null : vs.reduce((a, b) => a + b) / vs.length;
  final bars = <ZoomBar>[];
  for (final (i, start) in starts.indexed) {
    final vs = byBar[start];
    final value = switch (aggregate) {
      Aggregate.rate => _rate(vs, start, unit, first, today),
      Aggregate.sum => vs?.fold<num>(0, (a, b) => a + b),
      Aggregate.average => average(vs),
      Aggregate.change => switch ((i == 0 ? null : average(byBar[starts[i - 1]]), average(vs))) {
        (final before?, final now?) => now - before,
        _ => null,
      },
    };
    bars.add((
      start: start,
      value: value,
      low: vs == null || vs.isEmpty ? null : vs.reduce(math.min),
      high: vs == null || vs.isEmpty ? null : vs.reduce(math.max),
    ));
  }
  return bars;
}

/// The share of yes days among the days of the bar from [first] to [today].
double? _rate(List<num>? vs, Day start, BarUnit unit, Day first, Day today) {
  final from = math.max(start.serial, first.serial);
  final to = math.min(nextBarStart(start, unit).serial - 1, today.serial);
  final days = to - from + 1;
  if (days <= 0) return null;
  return (vs?.where((v) => v == 1).length ?? 0) / days;
}
