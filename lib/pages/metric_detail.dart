import 'dart:math' as math;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

import '../components/charts.dart';
import '../components/habit_table.dart';
import '../components/metric_icon.dart';
import '../components/ui.dart';
import '../model/date_format.dart';
import '../model/day.dart';
import '../model/format.dart';
import '../model/log_edits.dart';
import '../model/metric.dart';
import '../model/stats.dart';
import '../model/zoom.dart';
import '../services/pointer.dart';
import '../services/wheel_steps.dart';

/// All data of one metric: key numbers, charts and day heatmap for one time window, and a month calendar to edit days.
///
/// - Time window: the zoom buttons set its span and the bar size (see [ZoomStep]). A tap on the zoom label goes to
///   All, and a second tap goes back. The arrows move the window by its full span. A tap or drag on the overview moves it there. A side drag or side wheel on any chart moves it by bars.
///   All numbers and charts show the same window. The bar at the top stays in view while the page scrolls.
/// - Day heatmap: the days of the window. A tap on a day shows its month in the calendar.
/// - Edit days: any month, with the same day cells and inputs as the Today page. It shows the month of the window end
///   until the arrows, a swipe or a heatmap tap change it. Wide screens also show the month before.
///
/// Styles: lib/constants/theme.dart (layout) and lib/components/charts.dart (charts).
class MetricDetail extends StatefulComponent {
  const MetricDetail({
    required this.metric,
    required this.edits,
    required this.onBack,
    super.key,
  });

  final Metric metric;
  final LogEdits edits;
  final VoidCallback onBack;

  @override
  State<MetricDetail> createState() => _MetricDetailState();
}

class _MetricDetailState extends State<MetricDetail> {
  /// The index in [zoomSteps]. Null: [defaultStep].
  int? _step;

  /// The step before a tap on the zoom label went to All. A second tap goes back to it.
  int? _beforeAll;

  /// A day in the newest bar of the window. Null: the newest bar of all. A day, not an index, so that a zoom keeps
  /// the same time in view.
  Day? _end;

  /// The month in the calendar. Null: the month of the window end.
  MonthKey? _month;

  /// A side drag on the charts: the start `pageX`, the window at the start, and true after the drag captured the
  /// pointer. `pageX`, not `clientX`: package:web declares `clientX` as an int, and real pointers give fractional
  /// values.
  (double, ZoomWindow, bool)? _drag;

  /// A drag shorter than this many pixels is a tap, for example on a heatmap day.
  static const _dragStart = 8;

  /// Side wheel moves: 40 px move the window by one bar.
  final _wheel = WheelSteps(40);

  Metric get _m => component.metric;
  Day get _today => component.edits.today;

  /// The day values, with the count taps that are not written yet. The same values as in the table.
  Map<Day, num> get _values => component.edits.valuesOf(_m);

  void _moveTo(Day? end) {
    if (end == _end) return;
    setState(() {
      _end = end;
      _month = null;
    });
  }

  @override
  Component build(BuildContext context) {
    final states = _m is YesNoMetric ? yesNoStates(_m.id, component.edits.log.entries) : const <Day, bool>{};
    // For yes/no metrics: 1 for yes and 0 for no, as the rate bars expect.
    final values = _m is YesNoMetric
        ? <Day, num>{for (final MapEntry(key: d, value: yes) in states.entries) d: yes ? 1 : 0}
        : _values;
    final first = earliestDay(values.keys) ?? _today;
    final steps = zoomSteps(first, _today);
    final stepIndex = math.min(_step ?? defaultStep(steps), steps.length - 1);
    final w = ZoomWindow(steps[stepIndex], first: first, today: _today, end: _end);
    final aggregate = aggregateOf(_m);

    return div(classes: 'metric-detail', [
      nav(classes: 'detail-head', [
        iconButton('arrow_back', title: 'Back', onClick: component.onBack),
        metricIcon(_m, large: true),
        h5(classes: 'max', [.text(_m.name)]),
      ]),
      _windowBar(w, steps, stepIndex, values, aggregate),
      _draggable(w, [
        ...switch (_m) {
          YesNoMetric() => _yesNo(yesNoStats(states, w.days, w.to), w, values),
          NumberMetric(isCount: true) && final m => _count(m, countStats(values, w.days), w, values),
          final NumberMetric m => _number(m, numberStats(values, w.days), w, values),
        },
        DayHeatmap(
          title: _m is YesNoMetric ? 'Yes days' : 'Days with a value',
          from: w.from,
          to: w.to,
          today: _today,
          filled: (d) => _m is YesNoMetric ? states[d] == true : values.containsKey(d),
          onDay: (d) => setState(() => _month = monthOf(d)),
        ),
      ]),
      _calendar(_month ?? monthOf(w.to)),
    ]);
  }

  /// The zoom buttons, the dates of the window with arrows, and the overview of all data. See .window-bar in theme.dart.
  Component _windowBar(ZoomWindow w, List<ZoomStep> steps, int stepIndex, Map<Day, num> values, Aggregate aggregate) {
    final count = w.starts.length;
    // The last step shows all data. See zoomSteps.
    final last = steps.length - 1;
    final atAll = stepIndex == last;
    final back = math.min(_beforeAll ?? defaultStep(steps), last);
    return div(classes: 'window-bar', [
      div(classes: 'window-row', [
        nav(
          classes: 'window-zoom',
          attributes: {'aria-label': 'Zoom'},
          [
            iconButton(
              'zoom_in',
              title: 'Zoom in',
              onClick: () => _zoom(w, stepIndex - 1),
              disabled: stepIndex == 0,
              small: true,
            ),
            // A tap goes to All, and from All back to the step before.
            button(
              classes: 'transparent small zoom-label',
              attributes: {'title': atAll ? 'Back to ${steps[back].label}' : 'Show all'},
              onClick: () => atAll ? _zoom(w, back) : _zoom(w, last, beforeAll: stepIndex),
              [.text(atAll ? 'All' : steps[stepIndex].label)],
            ),
            iconButton(
              'zoom_out',
              title: 'Zoom out',
              onClick: () => _zoom(w, stepIndex + 1),
              disabled: atAll,
              small: true,
            ),
          ],
        ),
        nav(classes: 'window-dates', [
          iconButton(
            'chevron_left',
            title: 'Earlier',
            onClick: () => _moveTo(w.moved(-count)),
            disabled: w.atStart,
            small: true,
          ),
          span(classes: 'center-align', [.text(dayRange(w.from, w.to))]),
          iconButton(
            'chevron_right',
            title: 'Later',
            onClick: () => _moveTo(w.moved(count)),
            disabled: w.atEnd,
            small: true,
          ),
        ]),
      ]),
      Overview(
        weeks: zoomBars(
          values,
          aggregate,
          barStarts(w.first, w.today, BarUnit.week),
          BarUnit.week,
          first: w.first,
          today: w.today,
        ),
        fromZero: aggregate != Aggregate.average,
        from: w.from,
        to: w.to,
        onPoint: (d) => _moveTo(w.centeredOn(d)),
      ),
    ]);
  }

  /// Zooms to the step [index] of [zoomSteps]. At the newest bar, the window stays at the newest bar. Else it keeps
  /// the same time in view. [beforeAll]: the step that a tap on the All label goes back to.
  void _zoom(ZoomWindow w, int index, {int? beforeAll}) => setState(() {
    if (!w.atEnd) _end = w.to;
    _step = index;
    _beforeAll = beforeAll;
  });

  /// [children] with side drags and side wheel moves that move the window by bars. A drag starts only after
  /// [_dragStart] pixels, so that a tap on a heatmap day still works. `.swipe` in theme.dart keeps vertical scroll.
  Component _draggable(ZoomWindow w, List<Component> children) => div(
    classes: 'swipe detail-body',
    events: {
      'pointerdown': (e) => _drag = ((e as web.PointerEvent).pageX, w, false),
      'pointermove': (e) {
        final drag = _drag;
        if (drag == null) return;
        final p = e as web.PointerEvent;
        final dx = p.pageX - drag.$1;
        if (!drag.$3) {
          if (dx.abs() < _dragStart) return;
          capturePointer(p);
          _drag = (drag.$1, drag.$2, true);
        }
        final width = (p.currentTarget as web.Element).getBoundingClientRect().width;
        _moveTo(drag.$2.moved(-(dx / (width / drag.$2.starts.length)).round()));
      },
      'pointerup': (_) => _drag = null,
      'pointercancel': (_) => _drag = null,
      'wheel': (e) {
        final ev = e as web.WheelEvent;
        // Vertical wheel moves scroll the page.
        if (!isSideWheel(ev)) return;
        ev.preventDefault();
        final bars = _wheel.add(ev.deltaX);
        if (bars != 0) _moveTo(w.moved(bars));
      },
    },
    children,
  );

  /// The calendar to edit days, with its own month arrows and swipes.
  Component _calendar(MonthKey month) {
    // Wide screens also show the month before, on the left. See .month-pair in theme.dart.
    final before = addMonths(month, -1);
    final isThisMonth = month == monthOf(_today);
    void move(int delta) => setState(() => _month = addMonths(month, delta));
    final current = monthYear(month);
    // Wide screens.
    final pair = monthRange(before, month);
    return _section('Edit days', [
      nav(classes: 'month-nav', [
        iconButton('chevron_left', title: 'Previous month', onClick: () => move(-1)),
        span(classes: 'max center-align', [
          span(classes: 'single-month', [.text(current)]),
          span(classes: 'two-months', [.text(pair)]),
        ]),
        iconButton('chevron_right', title: 'Next month', onClick: () => move(1), disabled: isThisMonth),
      ]),
      _swipeable(
        div(classes: 'month-pair', [
          div(classes: 'previous-month', [_table(DayLayout.calendars, daysOfMonth(before), key: 'previous')]),
          _table(DayLayout.calendars, daysOfMonth(month), key: 'calendar'),
        ]),
        onPrevious: () => move(-1),
        onNext: isThisMonth ? null : () => move(1),
      ),
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
    edits: component.edits,
    days: days,
    layout: layout,
    bare: true,
  );

  /// The bars of the window. With [fixedScale], the scale comes from all bars, so that it does not change while the
  /// window moves: for rates and sums.
  Component _timeBars(
    String title,
    String description,
    ZoomWindow w,
    Map<Day, num> values,
    Aggregate aggregate, {
    bool fixedScale = false,
    bool range = false,
    num? max,
    String Function(num v) format = formatNumber,
    String? unit,
  }) {
    final bars = zoomBars(values, aggregate, w.allStarts, w.unit, first: w.first, today: w.today);
    final all = [for (final b in bars) ?b.value];
    return TimeBars(
      title: title,
      description: description,
      bars: bars.sublist(w.allStarts.indexOf(w.starts.first), w.allStarts.indexOf(w.starts.last) + 1),
      barUnit: w.unit,
      max: max ?? (fixedScale && all.isNotEmpty ? all.reduce(math.max) : null),
      range: range,
      format: format,
      unit: unit,
    );
  }

  List<Component> _yesNo(YesNoStats s, ZoomWindow w, Map<Day, num> values) => [
    KeyNumbers(
      items: [
        ('done days', '${s.yes}'),
        ('rate', formatPercent(s.rate)),
        ('missed (no)', '${s.no}'),
        ('no entry', '${s.none}'),
        (w.atEnd ? 'current streak' : 'streak on ${shortDay(w.to)}', '${s.currentStreak} d'),
        ('longest streak', '${s.longestStreak} d'),
      ],
    ),
    div(classes: 'detail-charts', [
      _timeBars(
        'Yes rate',
        'The percentage of yes days in each ${w.unit.name}.',
        w,
        values,
        Aggregate.rate,
        max: 1,
        format: (v) => formatPercent(v.toDouble()),
      ),
      LineChart(
        title: 'Habit strength (%)',
        description: 'It goes up on yes days and down on all other days.',
        days: w.days,
        values: [for (final v in s.strength) v * 100],
        dots: false,
        decimals: 0,
        range: (0, 100),
      ),
      DonutChart(
        title: 'Yes, no and no entry',
        description: 'The share of days with yes, with no and with no entry.',
        center: formatPercent(s.rate),
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
              tooltip: r == null ? 'No day' : formatPercent(r),
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
    ]),
  ];

  List<Component> _count(NumberMetric m, CountStats s, ZoomWindow w, Map<Day, num> values) => [
    KeyNumbers(
      items: [
        ('total', withUnit(s.total, m.unit)),
        ('per day', s.average == null ? '–' : withUnit(s.average!, m.unit)),
        ('best day', s.best == null ? '–' : '${formatNumber(s.best!.value)} · ${shortDay(s.best!.day)}'),
        ('days logged', '${s.logged}'),
      ],
    ),
    div(classes: 'detail-charts', [
      _timeBars(
        'Totals',
        'The total of each ${w.unit.name}.',
        w,
        values,
        Aggregate.sum,
        fixedScale: true,
        unit: m.unit,
      ),
      LineChart(
        title: 'Running total',
        description: 'The sum of all values from the start of the window.',
        days: w.days,
        values: s.running,
        unit: m.unit,
        dots: false,
        decimals: 0,
        range: (0, s.total),
      ),
      BarChart(
        title: 'Weekday averages',
        description: 'The average on each weekday, from the days with a value.',
        bars: [
          for (final (i, a) in s.weekdayAverages.indexed)
            (label: weekdayLetters[i], value: a, tooltip: a == null ? 'No value' : withUnit(a, m.unit)),
        ],
      ),
      BarChart(
        title: 'Distribution (days)',
        description: 'The number of days with each value.',
        bars: [for (final (v, n) in s.distribution) (label: '$v', value: n, tooltip: '$n days with $v')],
      ),
    ]),
  ];

  List<Component> _number(NumberMetric m, NumberStats s, ZoomWindow w, Map<Day, num> values) {
    final change = s.change;
    return [
      KeyNumbers(
        items: [
          (
            'latest · ${s.latest == null ? '' : shortDay(s.latest!.day)}',
            s.latest == null ? '–' : withUnit(s.latest!.value, m.unit, 2),
          ),
          (
            'change',
            change == null ? '–' : formatSigned(change, m.unit, 2),
          ),
          (
            'lowest · ${s.low == null ? '' : shortDay(s.low!.day)}',
            s.low == null ? '–' : withUnit(s.low!.value, m.unit, 2),
          ),
          (
            'highest · ${s.high == null ? '' : shortDay(s.high!.day)}',
            s.high == null ? '–' : withUnit(s.high!.value, m.unit, 2),
          ),
          ('average', s.average == null ? '–' : withUnit(s.average!, m.unit, 2)),
          ('days logged', '${s.logged}'),
        ],
      ),
      div(classes: 'detail-charts', [
        _timeBars(
          'Averages and range',
          'Each bar goes from the lowest to the highest value of a ${w.unit.name}. The dot is the average.',
          w,
          values,
          Aggregate.average,
          range: true,
          unit: m.unit,
        ),
        LineChart(
          title: 'Values and 7-day trend',
          description: 'Dots are the values. The line is a smooth average that ignores small daily changes.',
          days: w.days,
          values: s.values,
          trend: s.trend,
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
