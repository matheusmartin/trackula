import 'dart:math' as math;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../model/day.dart';
import '../model/format.dart';
import '../model/metric.dart';
import '../model/stats.dart';
import '../model/zoom.dart';
import 'charts.dart';

/// The key numbers and the charts of one metric in the time [window] of the detail screen.
final class MetricCharts extends StatelessComponent {
  const MetricCharts({
    required this.metric,
    required this.window,
    required this.values,
    required this.states,
    super.key,
  });

  final Metric metric;
  final ZoomWindow window;

  /// The value of each day with a value. For yes/no metrics: 1 for yes and 0 for no, as the rate bars expect.
  final Map<Day, num> values;

  /// The yes/no states of a yes/no metric: true for `yes`, false for `no`. Empty for other metrics.
  final Map<Day, bool> states;

  @override
  Component build(BuildContext context) => .fragment(switch (metric) {
    YesNoMetric() => _yesNoCharts(yesNoStats(states, window.days, window.to)),
    NumberMetric(isCount: true) && final NumberMetric m => _countCharts(m, countStats(values, window.days)),
    final NumberMetric m => _numberCharts(m, numberStats(values, window.days)),
  });

  List<Component> _yesNoCharts(YesNoStats stats) => [
    KeyNumbers(
      items: [
        (label: 'done days', value: '${stats.yes}'),
        (label: 'rate', value: formatPercent(stats.rate)),
        (label: 'missed (no)', value: '${stats.no}'),
        (label: 'no entry', value: '${stats.none}'),
        (
          label: window.atEnd ? 'current streak' : 'streak on ${shortDay(window.to)}',
          value: '${stats.currentStreak} d',
        ),
        (label: 'longest streak', value: '${stats.longestStreak} d'),
      ],
    ),
    div(classes: 'detail-charts', [
      _timeBars(
        'Yes rate',
        'The percentage of yes days in each ${window.unit.name}.',
        Aggregate.rate,
        max: 1,
        format: (v) => formatPercent(v.toDouble()),
      ),
      LineChart(
        title: 'Habit strength (%)',
        description: 'It goes up on yes days and down on all other days.',
        days: window.days,
        values: [for (final strength in stats.strength) strength * 100],
        dots: false,
        decimals: 0,
        range: (0, 100),
      ),
      DonutChart(
        title: 'Yes, no and no entry',
        description: 'The share of days with yes, with no and with no entry.',
        center: formatPercent(stats.rate),
        parts: [
          (label: 'Yes', value: stats.yes, color: DonutChart.yesColor),
          (label: 'No', value: stats.no, color: DonutChart.noColor),
          (label: 'No entry', value: stats.none, color: DonutChart.noneColor),
        ],
      ),
      BarChart(
        title: 'Weekday pattern',
        description: 'The percentage of yes days on each weekday.',
        max: 100,
        format: (v) => '${v.round()}%',
        bars: [
          for (final (i, rate) in stats.weekdayRates.indexed)
            (
              label: weekdayNames[i][0],
              value: rate == null ? null : rate * 100,
              tooltip: rate == null ? 'No day' : formatPercent(rate),
            ),
        ],
      ),
      BarChart(
        title: 'Streak lengths',
        wide: true,
        description: 'The number of runs of yes days in a row, for each length in days.',
        bars: [
          for (final (i, count) in streakLengths(stats.streaks).indexed)
            if (streakRanges[i] case (:final from, :final to))
              (
                label: to == null ? '$from+' : (from == to ? '$from' : '$from–$to'),
                value: count,
                tooltip: '$count streaks',
              ),
        ],
      ),
    ]),
  ];

  List<Component> _countCharts(NumberMetric metric, CountStats stats) => [
    KeyNumbers(
      items: [
        (label: 'total', value: _withUnit(stats.total, metric)),
        (label: 'per day', value: stats.average == null ? '–' : _withUnit(stats.average!, metric)),
        (
          label: 'best day',
          value: stats.best == null ? '–' : '${formatNumber(stats.best!.value)} · ${shortDay(stats.best!.day)}',
        ),
        (label: 'days logged', value: '${stats.logged}'),
      ],
    ),
    div(classes: 'detail-charts', [
      _timeBars(
        'Totals',
        'The total of each ${window.unit.name}.',
        Aggregate.sum,
        fixedScale: true,
        unit: metric.unit,
      ),
      LineChart(
        title: 'Running total',
        description: 'The sum of all values from the start of the window.',
        days: window.days,
        values: stats.running,
        unit: metric.unit,
        dots: false,
        decimals: 0,
        range: (0, stats.total),
      ),
      BarChart(
        title: 'Weekday averages',
        description: 'The average on each weekday, from the days with a value.',
        bars: [
          for (final (i, average) in stats.weekdayAverages.indexed)
            (
              label: weekdayNames[i][0],
              value: average,
              tooltip: average == null ? 'No value' : _withUnit(average, metric),
            ),
        ],
      ),
      BarChart(
        title: 'Distribution (days)',
        description: 'The number of days with each value.',
        bars: [
          for (final (:value, :days) in stats.distribution)
            (label: '$value', value: days, tooltip: '$days days with $value'),
        ],
      ),
    ]),
  ];

  List<Component> _numberCharts(NumberMetric metric, NumberStats stats) => [
    KeyNumbers(
      items: [
        (label: _dayLabel('latest', stats.latest), value: _dayValue(stats.latest, metric)),
        (label: 'change', value: stats.change == null ? '–' : formatSigned(stats.change!, metric.unit)),
        (label: _dayLabel('lowest', stats.low), value: _dayValue(stats.low, metric)),
        (label: _dayLabel('highest', stats.high), value: _dayValue(stats.high, metric)),
        (label: 'average', value: stats.average == null ? '–' : _withUnit(stats.average!, metric, 2)),
        (label: 'days logged', value: '${stats.logged}'),
      ],
    ),
    div(classes: 'detail-charts', [
      _timeBars(
        'Averages and range',
        'Each bar goes from the lowest to the highest value of a ${window.unit.name}. The dot is the average.',
        Aggregate.average,
        showsRange: true,
        unit: metric.unit,
      ),
      LineChart(
        title: 'Values and 7-day trend',
        description: 'Dots are the values. The line is a smooth average that ignores small daily changes.',
        days: window.days,
        values: stats.values,
        trend: stats.trend,
        unit: metric.unit,
      ),
      BarChart(
        title: 'Distribution (days)',
        wide: true,
        description: 'The number of days in each value range. The label is the start of the range.',
        bars: [
          for (final bin in stats.histogram)
            (
              label: formatNumber(bin.from),
              value: bin.days,
              tooltip: '${bin.days} days from ${formatNumber(bin.from, 2)} to ${formatNumber(bin.to, 2)}',
            ),
        ],
      ),
    ]),
  ];

  /// The bars of the window. With [fixedScale], the top of the scale comes from all bars, so that it does not change
  /// while the window moves: for sums.
  Component _timeBars(
    String title,
    String description,
    Aggregate aggregate, {
    bool fixedScale = false,
    bool showsRange = false,
    num? max,
    String Function(num v) format = formatNumber,
    String? unit,
  }) {
    final bars = zoomBars(values, aggregate, window.allStarts, window.unit, first: window.first, today: window.today);
    final all = [for (final b in bars) ?b.value];
    final firstInView = window.allStarts.indexOf(window.starts.first);
    return TimeBars(
      title: title,
      description: description,
      bars: bars.sublist(firstInView, firstInView + window.starts.length),
      barUnit: window.unit,
      max: max ?? (fixedScale && all.isNotEmpty ? all.reduce(math.max) : null),
      showsRange: showsRange,
      format: format,
      unit: unit,
    );
  }

  /// [value] with at most [decimals] decimals and the unit of [metric]. Example: "82.1 kg".
  static String _withUnit(num value, NumberMetric metric, [int decimals = 1]) =>
      withUnit(formatNumber(value, decimals), metric.unit);

  /// The value of [dayValue] with the unit of [metric], or "–" if there is no value.
  static String _dayValue(DayValue? dayValue, NumberMetric metric) =>
      dayValue == null ? '–' : _withUnit(dayValue.value, metric, 2);

  /// [label] and the day of [dayValue]. Example: "latest · Oct 10".
  static String _dayLabel(String label, DayValue? dayValue) =>
      '$label · ${dayValue == null ? '' : shortDay(dayValue.day)}';
}
