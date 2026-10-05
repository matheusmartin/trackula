import 'dart:math' as math;

import 'day.dart';
import 'log.dart';

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
    required this.longestStreak,
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

  /// The longest run of `yes` days in the period.
  final int longestStreak;

  /// The lengths of the runs of `yes` days in the period, oldest first.
  final List<int> streaks;

  /// The share of `yes` days for each weekday, Monday first. Null if the period has no such weekday.
  final List<double?> weekdayRates;

  /// The habit strength of each day of the period, from 0 to 1. See [yesNoStats].
  final List<double> strength;
}

/// The habit strength grows with each `yes` day and goes down slowly on other days, as in Loop Habit Tracker.
/// It is an exponential moving average with this weight for each new day.
const strengthWeight = 0.05;

/// The yes/no numbers of [states] for the period [days]. [today] is the last day of the period.
YesNoStats yesNoStats(Map<Day, bool> states, List<Day> days, Day today) {
  final yes = days.where((d) => states[d] == true).length;
  final no = days.where((d) => states[d] == false).length;

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

  var current = 0;
  for (var d = states[today] == true ? today : today.addDays(-1); states[d] == true; d = d.addDays(-1)) {
    current++;
  }

  final weekdayRates = [
    for (var w = DateTime.monday; w <= DateTime.sunday; w++)
      switch (days.where((d) => d.weekday == w).toList()) {
        final ds when ds.isEmpty => null,
        final ds => ds.where((d) => states[d] == true).length / ds.length,
      },
  ];

  // The strength starts at the first entry, so a long period does not start with many empty days at 0.
  final first = earliestDay(states.keys);
  final strength = <double>[];
  var s = 0.0;
  if (first != null) {
    for (var d = first; d.compareTo(days.first) < 0; d = d.addDays(1)) {
      s += strengthWeight * ((states[d] == true ? 1 : 0) - s);
    }
  }
  for (final d in days) {
    if (first != null && d.compareTo(first) >= 0) s += strengthWeight * ((states[d] == true ? 1 : 0) - s);
    strength.add(s);
  }

  return YesNoStats(
    days: days.length,
    yes: yes,
    no: no,
    currentStreak: current,
    longestStreak: streaks.fold(0, math.max),
    streaks: streaks,
    weekdayRates: weekdayRates,
    strength: strength,
  );
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
  final List<(int, int)> distribution;

  /// The total up to each day of the period.
  final List<num> running;
}

/// The count numbers of [values] for the period [days].
CountStats countStats(Map<Day, num> values, List<Day> days) {
  final present = [
    for (final d in days)
      if (values[d] case final v?) (day: d, value: v),
  ];
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
    best: present.fold<DayValue?>(null, (b, p) => b == null || p.value > b.value ? p : b),
    weekdayAverages: [
      for (var w = DateTime.monday; w <= DateTime.sunday; w++) _average(present.where((p) => p.day.weekday == w)),
    ],
    distribution: (counts.entries.map((e) => (e.key, e.value)).toList()..sort((a, b) => a.$1.compareTo(b.$1))),
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
    required this.average,
    required this.logged,
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
  final num? average;

  /// The number of days with a value.
  final int logged;

  /// The value of each day of the period. Null if the day has no value.
  final List<num?> values;

  /// The smooth trend of each day: an exponential moving average. Null before the first value. See [trendWeight].
  final List<num?> trend;

  /// The values in [histogramBins] ranges of the same width, from the lowest value.
  final List<Bin> histogram;
}

/// The weight of each new value in the trend: a 7-day smoothing, as in the Libra weight app (2 / (7 + 1)).
const trendWeight = 0.25;

/// The number of ranges in [NumberStats.histogram].
const histogramBins = 8;

/// The number numbers of [values] for the period [days].
NumberStats numberStats(Map<Day, num> values, List<Day> days) {
  final present = [
    for (final d in days)
      if (values[d] case final v?) (day: d, value: v),
  ];
  num? t;
  final trend = <num?>[
    for (final d in days)
      if (values[d] case final v?) t = t == null ? v : t + trendWeight * (v - t) else t,
  ];

  final histogram = <Bin>[];
  if (present.isNotEmpty) {
    final lo = present.map((p) => p.value).reduce(math.min);
    final hi = present.map((p) => p.value).reduce(math.max);
    final width = hi == lo ? 1 : (hi - lo) / histogramBins;
    final counts = List.filled(hi == lo ? 1 : histogramBins, 0);
    for (final p in present) {
      counts[math.min(counts.length - 1, ((p.value - lo) / width).floor())]++;
    }
    for (final (i, n) in counts.indexed) {
      histogram.add((from: lo + i * width, to: lo + (i + 1) * width, days: n));
    }
  }

  return NumberStats(
    latest: present.isEmpty ? null : present.last,
    change: present.length < 2 ? null : present.last.value - present.first.value,
    low: present.fold<DayValue?>(null, (b, p) => b == null || p.value < b.value ? p : b),
    high: present.fold<DayValue?>(null, (b, p) => b == null || p.value > b.value ? p : b),
    average: _average(present),
    logged: present.length,
    values: [for (final d in days) values[d]],
    trend: trend,
    histogram: histogram,
  );
}

num? _average(Iterable<DayValue> values) =>
    values.isEmpty ? null : values.fold<num>(0, (t, p) => t + p.value) / values.length;

/// The ranges of streak lengths in days, for [streakLengths]. The last range has no end.
const streakRanges = [(1, 1), (2, 2), (3, 3), (4, 6), (7, 13), (14, 29), (30, null)];

/// The number of [streaks] in each range of [streakRanges]. Example: streaks 1, 2, 2, 5 → 1, 2, 0, 1, 0, 0, 0.
List<int> streakLengths(List<int> streaks) => [
  for (final (from, to) in streakRanges) streaks.where((s) => s >= from && (to == null || s <= to)).length,
];
