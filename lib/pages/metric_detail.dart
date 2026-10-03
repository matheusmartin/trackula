import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

import '../components/charts.dart';
import '../components/habit_table.dart';
import '../model/day.dart';
import '../model/log_entry.dart';
import '../model/metric.dart';
import '../model/stats.dart';
import '../model/summary.dart';
import '../model/zoom.dart';

/// All data of one metric: numbers and charts for a period, a month calendar and a year heatmap.
///
/// - Period (Week, Month, Year, All): the numbers and charts. Each period ends today.
/// - Month calendar: any month, with the same day cells and inputs as the Today page. Arrows go back to any month.
///   Wide screens also show the month before.
/// - Year heatmap: all days of a year. A tap on a day shows its month in the calendar.
/// - Swipe left or right on the calendar or the heatmap to go to the next or previous month or year.
///
/// Styles: lib/constants/theme.dart (layout) and lib/components/charts.dart (charts).
class MetricDetail extends StatefulComponent {
  const MetricDetail({
    required this.metric,
    required this.log,
    required this.today,
    required this.busy,
    required this.onWrite,
    required this.pending,
    required this.onCount,
    required this.onBack,
    super.key,
  });

  final Metric metric;
  final LogTable log;
  final Day today;
  final bool busy;
  final void Function(LogWrite? Function(LogTable log) plan) onWrite;
  final Map<(String, Day), List<CountStep>> pending;
  final void Function(NumberMetric metric, Day day, CountStep step) onCount;
  final VoidCallback onBack;

  @override
  State<MetricDetail> createState() => _MetricDetailState();
}

class _MetricDetailState extends State<MetricDetail> {
  static const _monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  Period _period = Period.month;
  late MonthKey _month = (year: component.today.year, month: component.today.month);
  late int _year = component.today.year;

  Metric get _m => component.metric;
  Day get _today => component.today;

  /// The day values, with the count taps that are not written yet. The same values as in the table.
  Map<Day, num> get _values {
    final values = dayValues(_m, component.log.entries);
    for (final MapEntry(key: (id, day), value: steps) in component.pending.entries) {
      if (id != _m.id) continue;
      final v = applyCountSteps(values[day], steps);
      v == null ? values.remove(day) : values[day] = v;
    }
    return values;
  }

  /// The month before the month in the calendar. Wide screens show it on the left. See .month-pair in theme.dart.
  MonthKey get _previousMonth {
    final m = DateTime(_month.year, _month.month - 1);
    return (year: m.year, month: m.month);
  }

  /// All days of [month]. Days after today show faded.
  List<Day> _daysOf(MonthKey month) => [
    for (var d = Day(month.year, month.month, 1); d.month == month.month; d = d.addDays(1)) d,
  ];

  /// The title of the calendar on wide screens. Example: "September – October 2026", or "December 2025 – January
  /// 2026" across a year.
  String get _pairTitle {
    final p = _previousMonth;
    final current = '${_monthNames[_month.month - 1]} ${_month.year}';
    return p.year == _month.year
        ? '${_monthNames[p.month - 1]} – $current'
        : '${_monthNames[p.month - 1]} ${p.year} – $current';
  }

  bool get _isThisMonth => _month.year == _today.year && _month.month == _today.month;

  void _moveMonth(int delta) => setState(() {
    final m = DateTime(_month.year, _month.month + delta);
    _month = (year: m.year, month: m.month);
  });

  @override
  Component build(BuildContext context) {
    final values = _values;
    final states = _m is YesNoMetric ? yesNoStates(_m.id, component.log.entries) : const <Day, bool>{};
    final recorded = [...values.keys, ...states.keys];
    final first = recorded.isEmpty ? null : recorded.reduce((x, y) => x.compareTo(y) < 0 ? x : y);
    final days = _period.days(_today, first);

    return div(classes: 'metric-detail', [
      nav(classes: 'detail-head', [
        button(
          classes: 'circle transparent',
          attributes: {'title': 'Back'},
          onClick: component.onBack,
          [
            i([.text('arrow_back')]),
          ],
        ),
        h5(classes: 'max', [.text(_m.name)]),
      ]),
      nav(
        classes: 'chips',
        attributes: {'aria-label': 'Period'},
        [
          for (final p in Period.values)
            button(
              classes: p == _period ? 'chip selected' : 'chip',
              attributes: {'aria-pressed': '${p == _period}'},
              onClick: () => setState(() => _period = p),
              [
                if (p == _period) i([.text('done')]),
                span([.text(p.label)]),
              ],
            ),
        ],
      ),
      ...switch (_m) {
        YesNoMetric() => _yesNo(yesNoStats(states, days, _today), days, {
          for (final MapEntry(key: d, value: yes) in states.entries) d: yes ? 1 : 0,
        }, first ?? _today),
        NumberMetric(isCount: true) && final m => _count(m, countStats(values, days), days, values, first ?? _today),
        final NumberMetric m => _number(m, numberStats(values, days), days, values, first ?? _today),
      },
      _section('Calendar', [
        nav(classes: 'month-nav', [
          button(
            classes: 'circle transparent',
            attributes: {'title': 'Previous month'},
            onClick: () => _moveMonth(-1),
            [
              i([.text('chevron_left')]),
            ],
          ),
          span(classes: 'max center-align', [
            span(classes: 'single-month', [.text('${_monthNames[_month.month - 1]} ${_month.year}')]),
            span(classes: 'two-months', [.text(_pairTitle)]),
          ]),
          button(
            classes: 'circle transparent',
            attributes: {'title': 'Next month'},
            disabled: _isThisMonth,
            onClick: () => _moveMonth(1),
            [
              i([.text('chevron_right')]),
            ],
          ),
        ]),
        _swipeable(
          div(classes: 'month-pair', [
            div(classes: 'previous-month', [_table(DayLayout.calendars, _daysOf(_previousMonth), key: 'previous')]),
            _table(DayLayout.calendars, _daysOf(_month), key: 'calendar'),
          ]),
          onPrevious: () => _moveMonth(-1),
          onNext: _isThisMonth ? null : () => _moveMonth(1),
        ),
      ]),
      _section('Year', [
        nav(classes: 'month-nav', [
          button(
            classes: 'circle transparent',
            attributes: {'title': 'Previous year'},
            onClick: () => setState(() => _year--),
            [
              i([.text('chevron_left')]),
            ],
          ),
          span(classes: 'max center-align', [.text('$_year')]),
          button(
            classes: 'circle transparent',
            attributes: {'title': 'Next year'},
            disabled: _year >= _today.year,
            onClick: () => setState(() => _year++),
            [
              i([.text('chevron_right')]),
            ],
          ),
        ]),
        _swipeable(
          onPrevious: () => setState(() => _year--),
          onNext: _year >= _today.year ? null : () => setState(() => _year++),
          YearHeatmap(
            year: _year,
            today: _today,
            filled: (d) => _m is YesNoMetric ? states[d] == true : values.containsKey(d),
            onDay: (d) => setState(() => _month = (year: d.year, month: d.month)),
          ),
        ),
        small(classes: 'secondary-text', [
          .text('Tap a day to show its month in the calendar. Swipe to change the year or the month.'),
        ]),
      ]),
    ]);
  }

  /// A swipe is at least this many pixels to the side, and more to the side than up or down.
  static const _swipeDistance = 50;

  /// The start of a swipe: pointer id, x and y. The x and y are `pageX` and `pageY`, not `clientX`: package:web
  /// declares `clientX` as an int, and real pointers give fractional values.
  (int, double, double)? _swipeStart;

  /// [child] with swipes: to the left calls [onNext], to the right calls [onPrevious]. A null [onNext] does nothing.
  /// `.swipe` in theme.dart keeps vertical scroll and stops the browser from using side moves.
  Component _swipeable(Component child, {required VoidCallback onPrevious, VoidCallback? onNext}) => div(
    classes: 'swipe',
    events: {
      'pointerdown': (e) {
        final p = e as web.PointerEvent;
        _swipeStart = (p.pointerId, p.pageX, p.pageY);
      },
      'pointerup': (e) {
        final p = e as web.PointerEvent;
        final start = _swipeStart;
        _swipeStart = null;
        if (start == null || start.$1 != p.pointerId) return;
        final dx = p.pageX - start.$2, dy = p.pageY - start.$3;
        if (dx.abs() < _swipeDistance || dx.abs() < 2 * dy.abs()) return;
        dx < 0 ? onNext?.call() : onPrevious();
      },
      'pointercancel': (_) => _swipeStart = null,
    },
    [child],
  );

  Component _section(String title, List<Component> children) => div(classes: 'detail-section', [
    h6([.text(title)]),
    ...children,
  ]);

  Component _table(DayLayout layout, List<Day> days, {required String key}) => HabitTable(
    key: ValueKey(key),
    metrics: [_m],
    log: component.log,
    today: _today,
    days: days,
    layout: layout,
    busy: component.busy,
    onWrite: component.onWrite,
    pending: component.pending,
    onCount: component.onCount,
    bare: true,
  );

  String _percent(double rate) => '${(rate * 100).round()}%';

  List<Component> _yesNo(YesNoStats s, List<Day> days, Map<Day, num> all, Day first) => [
    KeyNumbers(
      items: [
        ('done days', '${s.yes}'),
        ('rate', _percent(s.rate)),
        ('missed (no)', '${s.no}'),
        ('no entry', '${s.none}'),
        ('current streak', '${s.currentStreak} d'),
        ('longest streak', '${s.longestStreak} d'),
      ],
    ),
    div(classes: 'detail-charts', [
      DonutChart(
        title: 'Yes, no and no entry',
        description: 'The share of days with yes, with no and with no entry.',
        center: _percent(s.rate),
        parts: [
          (label: 'Yes', value: s.yes, color: DonutChart.yesColor),
          (label: 'No', value: s.no, color: DonutChart.noColor),
          (label: 'No entry', value: s.none, color: DonutChart.noneColor),
        ],
      ),
      BarChart(
        title: 'Weekday pattern',
        description: 'The percentage of yes days on each weekday.',
        max: 100,
        format: (v) => '${v.round()}%',
        bars: [
          for (final (i, r) in s.weekdayRates.indexed)
            (
              label: weekdayLetters[i],
              value: r == null ? null : r * 100,
              tooltip: r == null ? 'No day' : _percent(r),
            ),
        ],
      ),
      BarChart(
        title: 'Streak lengths',
        wide: true,
        description: 'The number of runs of yes days in a row, for each length in days.',
        bars: [
          for (final (i, n) in streakLengths(s.streaks).indexed)
            if (streakRanges[i] case (final from, final to))
              (
                label: to == null ? '$from+' : (from == to ? '$from' : '$from–$to'),
                value: n,
                tooltip: '$n streaks',
              ),
        ],
      ),
      ZoomChart(
        title: 'Yes rate',
        description: 'The percentage of yes days in each week, month or quarter.',
        values: all,
        aggregate: Aggregate.rate,
        first: first,
        today: _today,
        max: 1,
        format: (v) => _percent(v.toDouble()),
      ),
      LineChart(
        title: 'Habit strength (%)',
        description: 'It goes up on yes days and down on all other days.',
        days: days,
        values: [for (final v in s.strength) v * 100],
        dots: false,
        decimals: 0,
        range: (0, 100),
      ),
    ]),
  ];

  String _withUnit(num v, NumberMetric m, [int decimals = 1]) =>
      '${formatNumber(v, decimals)}${m.unit == null ? '' : ' ${m.unit}'}';

  List<Component> _count(NumberMetric m, CountStats s, List<Day> days, Map<Day, num> all, Day first) => [
    KeyNumbers(
      items: [
        ('total', _withUnit(s.total, m)),
        ('per day', s.average == null ? '–' : _withUnit(s.average!, m)),
        ('best day', s.best == null ? '–' : '${formatNumber(s.best!.value)} · ${shortDay(s.best!.day)}'),
        ('days logged', '${s.logged}'),
      ],
    ),
    div(classes: 'detail-charts', [
      BarChart(
        title: 'Weekday averages',
        description: 'The average on each weekday, from the days with a value.',
        bars: [
          for (final (i, a) in s.weekdayAverages.indexed)
            (label: weekdayLetters[i], value: a, tooltip: a == null ? 'No value' : _withUnit(a, m)),
        ],
      ),
      BarChart(
        title: 'Distribution (days)',
        description: 'The number of days with each value.',
        bars: [for (final (v, n) in s.distribution) (label: '$v', value: n, tooltip: '$n days with $v')],
      ),
      ZoomChart(
        title: 'Totals',
        description: 'The total of each week, month or quarter.',
        values: all,
        aggregate: Aggregate.sum,
        first: first,
        today: _today,
        unit: m.unit,
      ),
      LineChart(
        title: 'Running total',
        description: 'The sum of all values from the start of the period.',
        days: days,
        values: s.running,
        unit: m.unit,
        dots: false,
        decimals: 0,
        range: (0, s.total),
      ),
    ]),
  ];

  List<Component> _number(NumberMetric m, NumberStats s, List<Day> days, Map<Day, num> all, Day first) {
    final change = s.change;
    return [
      KeyNumbers(
        items: [
          (
            'latest · ${s.latest == null ? '' : shortDay(s.latest!.day)}',
            s.latest == null ? '–' : _withUnit(s.latest!.value, m, 2),
          ),
          (
            'change',
            change == null
                ? '–'
                : '${change > 0
                      ? '+'
                      : change < 0
                      ? '−'
                      : ''}${_withUnit(change.abs(), m, 2)}',
          ),
          (
            'lowest · ${s.low == null ? '' : shortDay(s.low!.day)}',
            s.low == null ? '–' : _withUnit(s.low!.value, m, 2),
          ),
          (
            'highest · ${s.high == null ? '' : shortDay(s.high!.day)}',
            s.high == null ? '–' : _withUnit(s.high!.value, m, 2),
          ),
          ('average', s.average == null ? '–' : _withUnit(s.average!, m, 2)),
          ('days logged', '${s.logged}'),
        ],
      ),
      div(classes: 'detail-charts', [
        LineChart(
          title: 'Values and 7-day trend',
          description: 'Dots are the values. The line is a smooth average that ignores small daily changes.',
          days: days,
          values: s.values,
          trend: s.trend,
          unit: m.unit,
        ),
        ZoomChart(
          title: 'Averages',
          description: 'The average value of each week, month or quarter.',
          values: all,
          aggregate: Aggregate.average,
          first: first,
          today: _today,
          fromLowest: true,
          unit: m.unit,
        ),
        ZoomChart(
          title: 'Change',
          description: 'The change of the average from the bar before.',
          values: all,
          aggregate: Aggregate.change,
          first: first,
          today: _today,
          signed: true,
          format: (v) => formatNumber(v, 2),
          unit: m.unit,
        ),
        ZoomChart(
          title: 'Range',
          description: 'Each bar goes from the lowest to the highest value. The dot is the average.',
          values: all,
          aggregate: Aggregate.average,
          first: first,
          today: _today,
          range: true,
          unit: m.unit,
        ),
        BarChart(
          title: 'Distribution (days)',
          wide: true,
          description: 'The number of days in each value range. The label is the start of the range.',
          bars: [
            for (final b in s.histogram)
              (
                label: formatNumber(b.from),
                value: b.days,
                tooltip: '${b.days} days from ${formatNumber(b.from, 2)} to ${formatNumber(b.to, 2)}',
              ),
          ],
        ),
      ]),
    ];
  }
}
