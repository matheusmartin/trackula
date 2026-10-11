import 'dart:math' as math;

import 'day.dart';
import 'log_entry.dart';

/// A value on a day, for example the best day of a count.
typedef DayValue = ({Day day, num value});

/// The yes/no states of [metricId] in [entries]: true for `yes`, false for `no`. Days without entry are left out.
Map<Day, bool> yesNoStates(String metricId, List<LogEntry> entries) => {
  for (final e in entries)
    if (e.metricId == metricId) e.date: e.value == 1,
};

/// The numbers and charts of a yes/no metric in a period.
final class YesNoStats {
  const YesNoStats({
    required this.days,
    required this.yes,
    required this.no,
    required this.currentStreak,
    required this.streaks,
    required this.weekdayRates,
    required this.strength,
  });

  /// The number of days in the period.
  final int days;
  final int yes;

  /// Missed days: `no`.
  final int no;

  /// Days without entry.
  int get none => days - yes - no;

  /// The share of `yes` days in the period, from 0 to 1.
  double get rate => days == 0 ? 0 : yes / days;

  /// Consecutive `yes` days up to today. If today has no `yes` yet, up to yesterday.
  final int currentStreak;

  /// The lengths of the runs of `yes` days in the period, oldest first.
  final List<int> streaks;

  /// The longest run of `yes` days in the period.
  int get longestStreak => streaks.fold(0, math.max);

  /// The share of `yes` days for each weekday, Monday first. Null if the period has no such weekday.
  final List<double?> weekdayRates;

  /// The habit strength of each day of the period, from 0 to 1. See [yesNoStats].
  final List<double> strength;
}

/// The habit strength grows with each `yes` day and goes down slowly on other days, as in Loop Habit Tracker.
/// It is an exponential moving average with this weight for each new day.
const strengthWeight = 0.05;

/// The yes/no numbers of [states] for the period [days]. [today] is the last day of the period.
YesNoStats yesNoStats(Map<Day, bool> states, List<Day> days, Day today) => YesNoStats(
  days: days.length,
  yes: days.where((d) => states[d] == true).length,
  no: days.where((d) => states[d] == false).length,
  currentStreak: _currentStreak(states, today),
  streaks: _streaks(states, days),
  weekdayRates: [
    for (var weekday = DateTime.monday; weekday <= DateTime.sunday; weekday++) _weekdayRate(states, days, weekday),
  ],
  strength: _strength(states, days),
);

/// The lengths of the runs of `yes` days in [days], oldest first.
List<int> _streaks(Map<Day, bool> states, List<Day> days) {
  final streaks = <int>[];
  var run = 0;
  for (final d in days) {
    if (states[d] == true) {
      run++;
    } else if (run > 0) {
      streaks.add(run);
      run = 0;
    }
  }
  if (run > 0) streaks.add(run);
  return streaks;
}

/// Consecutive `yes` days up to [today]. If [today] has no `yes` yet, up to the day before.
int _currentStreak(Map<Day, bool> states, Day today) {
  var streak = 0;
  for (var d = states[today] == true ? today : today.addDays(-1); states[d] == true; d = d.addDays(-1)) {
    streak++;
  }
  return streak;
}

/// The share of `yes` days among the days of [days] on [weekday]. Null if [days] has no such weekday.
double? _weekdayRate(Map<Day, bool> states, List<Day> days, int weekday) {
  final onWeekday = days.where((d) => d.weekday == weekday).toList();
  if (onWeekday.isEmpty) return null;
  return onWeekday.where((d) => states[d] == true).length / onWeekday.length;
}

/// The habit strength of each day of [days]. See [strengthWeight].
///
/// The strength starts at the first entry, so a long period does not start with many empty days at 0.
List<double> _strength(Map<Day, bool> states, List<Day> days) {
  final first = earliestDay(states.keys);
  if (first == null) return [for (final _ in days) 0.0];
  var strength = 0.0;
  void addDay(Day d) {
    strength += strengthWeight * ((states[d] == true ? 1 : 0) - strength);
  }

  for (var d = first; d.compareTo(days.first) < 0; d = d.addDays(1)) {
    addDay(d);
  }
  final result = <double>[];
  for (final d in days) {
    if (d.compareTo(first) >= 0) addDay(d);
    result.add(strength);
  }
  return result;
}

/// The numbers and charts of a count metric in a period.
final class CountStats {
  const CountStats({
    required this.total,
    required this.logged,
    required this.best,
    required this.weekdayAverages,
    required this.distribution,
    required this.running,
  });

  final num total;

  /// The number of days with a value.
  final int logged;

  /// The average of the days with a value. Null if no day has a value.
  num? get average => logged == 0 ? null : total / logged;

  /// The day with the highest value. Null if no day has a value.
  final DayValue? best;

  /// The average of the days with a value for each weekday, Monday first. Null if no such day has a value.
  final List<num?> weekdayAverages;

  /// For each value (rounded to a whole number), the number of days with it, from the lowest value.
  final List<({int value, int days})> distribution;

  /// The total up to each day of the period.
  final List<num> running;
}

/// The count numbers of [values] for the period [days].
CountStats countStats(Map<Day, num> values, List<Day> days) {
  final present = _present(values, days);
  num total = 0;
  final running = <num>[];
  for (final d in days) {
    total += values[d] ?? 0;
    running.add(total);
  }
  final counts = <int, int>{};
  for (final p in present) {
    counts.update(p.value.round(), (n) => n + 1, ifAbsent: () => 1);
  }
  return CountStats(
    total: total,
    logged: present.length,
    best: _highest(present),
    weekdayAverages: [
      for (var weekday = DateTime.monday; weekday <= DateTime.sunday; weekday++)
        _average(present.where((p) => p.day.weekday == weekday)),
    ],
    distribution: [for (final e in counts.entries) (value: e.key, days: e.value)]
      ..sort((a, b) => a.value.compareTo(b.value)),
    running: running,
  );
}

/// A range of values and the number of days in it.
typedef Bin = ({num from, num to, int days});

/// The numbers and charts of a number metric in a period.
final class NumberStats {
  const NumberStats({
    required this.latest,
    required this.change,
    required this.low,
    required this.high,
    required this.values,
    required this.trend,
    required this.histogram,
  });

  /// The last value of the period. Null if no day has a value.
  final DayValue? latest;

  /// The last value minus the first value of the period. Null with fewer than 2 values.
  final num? change;
  final DayValue? low;
  final DayValue? high;

  /// The value of each day of the period. Null if the day has no value.
  final List<num?> values;

  /// The number of days with a value.
  int get logged => values.nonNulls.length;

  /// The average of the days with a value. Null if no day has a value.
  num? get average => logged == 0 ? null : values.nonNulls.fold<num>(0, (total, v) => total + v) / logged;

  /// The smooth trend of each day: an exponential moving average. Null before the first value. See [trendWeight].
  final List<num?> trend;

  /// The values in [histogramBins] ranges of the same width, from the lowest value.
  final List<Bin> histogram;
}

/// The weight of each new value in the trend: a 7-day smoothing, as in the Libra weight app (2 / (7 + 1)).
const trendWeight = 0.25;

/// The number of ranges in [NumberStats.histogram].
const histogramBins = 8;

/// The numbers of a number metric: [values] in the period [days].
NumberStats numberStats(Map<Day, num> values, List<Day> days) {
  final present = _present(values, days);
  return NumberStats(
    latest: present.lastOrNull,
    change: present.length < 2 ? null : present.last.value - present.first.value,
    low: _lowest(present),
    high: _highest(present),
    values: [for (final d in days) values[d]],
    trend: _trend(values, days),
    histogram: _histogram(present),
  );
}

/// The trend of each day of [days]. See [NumberStats.trend].
List<num?> _trend(Map<Day, num> values, List<Day> days) {
  num? trend;
  return [
    for (final d in days)
      if (values[d] case final v?) trend = trend == null ? v : trend + trendWeight * (v - trend) else trend,
  ];
}

/// The values of [present] in [histogramBins] ranges. One range if all values are equal. Empty if [present] is empty.
List<Bin> _histogram(List<DayValue> present) {
  if (present.isEmpty) return const [];
  final low = present.map((p) => p.value).reduce(math.min);
  final high = present.map((p) => p.value).reduce(math.max);
  final width = high == low ? 1 : (high - low) / histogramBins;
  final counts = List.filled(high == low ? 1 : histogramBins, 0);
  for (final p in present) {
    counts[math.min(counts.length - 1, ((p.value - low) / width).floor())]++;
  }
  return [for (final (i, n) in counts.indexed) (from: low + i * width, to: low + (i + 1) * width, days: n)];
}

/// The days of [days] that have a value in [values], oldest first.
List<DayValue> _present(Map<Day, num> values, List<Day> days) => [
  for (final d in days)
    if (values[d] case final v?) (day: d, value: v),
];

/// The first day with the highest value of [values]. Null if [values] is empty.
DayValue? _highest(List<DayValue> values) =>
    values.fold<DayValue?>(null, (high, p) => high == null || p.value > high.value ? p : high);

/// The first day with the lowest value of [values]. Null if [values] is empty.
DayValue? _lowest(List<DayValue> values) =>
    values.fold<DayValue?>(null, (low, p) => low == null || p.value < low.value ? p : low);

num? _average(Iterable<DayValue> values) =>
    values.isEmpty ? null : values.fold<num>(0, (total, p) => total + p.value) / values.length;

/// The ranges of streak lengths in days, for [streakLengths]. The last range has no end.
const streakRanges = [
  (from: 1, to: 1),
  (from: 2, to: 2),
  (from: 3, to: 3),
  (from: 4, to: 6),
  (from: 7, to: 13),
  (from: 14, to: 29),
  (from: 30, to: null),
];

/// The number of [streaks] in each range of [streakRanges]. Example: streaks 1, 2, 2, 5 → 1, 2, 0, 1, 0, 0, 0.
List<int> streakLengths(List<int> streaks) => [
  for (final (:from, :to) in streakRanges) streaks.where((s) => s >= from && (to == null || s <= to)).length,
];
