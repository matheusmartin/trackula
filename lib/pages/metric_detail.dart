import 'dart:math' as math;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

import '../components/charts.dart';
import '../components/habit_table.dart';
import '../components/icon_button.dart';
import '../components/metric_icon.dart';
import '../model/day.dart';
import '../model/format.dart';
import '../model/log_entry.dart';
import '../model/metric.dart';
import '../model/stats.dart';
import '../model/summary.dart';
import '../model/zoom.dart';
import '../services/pointer.dart';

/// All data of one metric: key numbers, charts and day heatmap for one time window, and a month calendar to edit days.
///
/// - Time window: the zoom buttons set its span and the bar size (see [ZoomStep]). A tap on the zoom label goes to
///   All, and a second tap goes back. The arrows move the window by its full span. A tap or drag on the overview
///   moves it there. A side drag or side wheel on any chart moves it by bars. All numbers and charts show the same
///   window. The bar at the top stays in view while the page scrolls.
/// - Day heatmap: the days of the window. A tap on a day shows its month in the calendar.
/// - Edit days: any month, with the same day cells and inputs as the Today page. It shows the month of the window end
///   until the arrows, a swipe or a heatmap tap change it. Wide screens also show the month before.
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

/// A side drag on the charts. `startX` is the start `pageX`, not `clientX`: package:web declares `clientX` as an int,
/// and real pointers give fractional values. `captured` is true after the drag captured the pointer.
typedef _Drag = ({double startX, ZoomWindow window, bool captured});

/// The start of a swipe on the calendar, as `pageX` and `pageY`. See [_Drag].
typedef _Swipe = ({int pointerId, double x, double y});

class _MetricDetailState extends State<MetricDetail> {
  /// A drag shorter than this many pixels is a tap, for example on a heatmap day.
  static const _dragStart = 8;

  /// The side wheel moves one bar for each this many pixels of scroll.
  static const _wheelStep = 40.0;

  /// A swipe is at least this many pixels to the side, and more to the side than up or down.
  static const _swipeDistance = 50;

  /// The index in [zoomSteps]. Null: [defaultStep].
  int? _step;

  /// The step before a tap on the zoom label went to All. A second tap goes back to it.
  int? _beforeAll;

  /// A day in the newest bar of the window. Null: the newest bar of all. A day, not an index, so that a zoom keeps
  /// the same time in view.
  Day? _end;

  /// The month in the calendar. Null: the month of the window end.
  MonthKey? _month;

  _Drag? _drag;

  /// Side wheel movement that is less than one bar, in pixels.
  double _wheel = 0;

  _Swipe? _swipe;

  Metric get _metric => component.metric;
  Day get _today => component.today;

  /// The day values, with the count taps that are not written yet. The same values as in the table.
  Map<Day, num> get _values => dayValuesWithPending(_metric, component.log.entries, component.pending);

  void _moveTo(Day? end) {
    if (end == _end) return;
    setState(() {
      _end = end;
      _month = null;
    });
  }

  /// Zooms to the step [index] of [zoomSteps]. At the newest bar, the window stays at the newest bar. Else it keeps
  /// the same time in view. [beforeAll]: the step that a tap on the All label goes back to.
  void _zoom(ZoomWindow window, int index, {int? beforeAll}) => setState(() {
    if (!window.atEnd) _end = window.to;
    _step = index;
    _beforeAll = beforeAll;
  });

  @override
  Component build(BuildContext context) {
    final states = _metric is YesNoMetric ? yesNoStates(_metric.id, component.log.entries) : const <Day, bool>{};
    // For yes/no metrics: 1 for yes and 0 for no, as the rate bars expect.
    final values = _metric is YesNoMetric
        ? <Day, num>{for (final MapEntry(key: d, value: yes) in states.entries) d: yes ? 1 : 0}
        : _values;
    final first = earliestDay(values.keys) ?? _today;
    final steps = zoomSteps(first, _today);
    final stepIndex = math.min(_step ?? defaultStep(steps), steps.length - 1);
    final window = ZoomWindow(steps[stepIndex], first: first, today: _today, end: _end);
    final aggregate = switch (_metric) {
      YesNoMetric() => Aggregate.rate,
      NumberMetric(isCount: true) => Aggregate.sum,
      _ => Aggregate.average,
    };

    return div(classes: 'metric-detail', [
      nav(classes: 'detail-head', [
        iconButton(icon: 'arrow_back', title: 'Back', onClick: component.onBack),
        metricIcon(_metric, large: true),
        h5(classes: 'max', [.text(_metric.name)]),
      ]),
      _windowBar(window, steps, stepIndex, values, aggregate),
      _draggable(window, [
        ...switch (_metric) {
          YesNoMetric() => _yesNoCharts(yesNoStats(states, window.days, window.to), window, values),
          NumberMetric(isCount: true) && final m => _countCharts(m, countStats(values, window.days), window, values),
          final NumberMetric m => _numberCharts(m, numberStats(values, window.days), window, values),
        },
        DayHeatmap(
          title: _metric is YesNoMetric ? 'Yes days' : 'Days with a value',
          from: window.from,
          to: window.to,
          today: _today,
          filled: (d) => _metric is YesNoMetric ? states[d] == true : values.containsKey(d),
          onDay: (d) => setState(() => _month = (year: d.year, month: d.month)),
        ),
      ]),
      _calendar(_month ?? (year: window.to.year, month: window.to.month)),
    ]);
  }

  /// The zoom buttons, the dates of the window with arrows, and the overview of all data. See .window-bar in theme.dart.
  Component _windowBar(
    ZoomWindow window,
    List<ZoomStep> steps,
    int stepIndex,
    Map<Day, num> values,
    Aggregate aggregate,
  ) => div(classes: 'window-bar', [
    div(classes: 'window-row', [
      _zoomButtons(window, steps, stepIndex),
      _windowDates(window),
    ]),
    Overview(
      weeks: zoomBars(
        values,
        aggregate,
        barStarts(window.first, window.today, BarUnit.week),
        BarUnit.week,
        first: window.first,
        today: window.today,
      ),
      fromZero: aggregate != Aggregate.average,
      from: window.from,
      to: window.to,
      onPoint: (d) => _moveTo(window.centeredOn(d)),
    ),
  ]);

  /// Zoom in, the zoom label, and zoom out. A tap on the label goes to All, and from All back to the step before.
  Component _zoomButtons(ZoomWindow window, List<ZoomStep> steps, int stepIndex) {
    // The last step shows all data. See zoomSteps.
    final last = steps.length - 1;
    final atAll = stepIndex == last;
    final back = math.min(_beforeAll ?? defaultStep(steps), last);
    return nav(
      classes: 'window-zoom',
      attributes: {'aria-label': 'Zoom'},
      [
        iconButton(
          icon: 'zoom_in',
          title: 'Zoom in',
          small: true,
          disabled: stepIndex == 0,
          onClick: () => _zoom(window, stepIndex - 1),
        ),
        button(
          classes: 'transparent small zoom-label',
          attributes: {'title': atAll ? 'Back to ${steps[back].label}' : 'Show all'},
          onClick: () => atAll ? _zoom(window, back) : _zoom(window, last, beforeAll: stepIndex),
          [.text(atAll ? 'All' : steps[stepIndex].label)],
        ),
        iconButton(
          icon: 'zoom_out',
          title: 'Zoom out',
          small: true,
          disabled: atAll,
          onClick: () => _zoom(window, stepIndex + 1),
        ),
      ],
    );
  }

  /// The dates of the window, with arrows that move it by its full span.
  Component _windowDates(ZoomWindow window) {
    final count = window.starts.length;
    return nav(classes: 'window-dates', [
      iconButton(
        icon: 'chevron_left',
        title: 'Earlier',
        small: true,
        disabled: window.atStart,
        onClick: () => _moveTo(window.moved(-count)),
      ),
      span(classes: 'center-align', [.text(_dates(window.from, window.to))]),
      iconButton(
        icon: 'chevron_right',
        title: 'Later',
        small: true,
        disabled: window.atEnd,
        onClick: () => _moveTo(window.moved(count)),
      ),
    ]);
  }

  /// Example: "Jul 6 – Oct 3, 2026", or "Nov 3, 2025 – Feb 1, 2026" across a year.
  String _dates(Day from, Day to) => from.year == to.year
      ? '${shortDay(from)} – ${shortDay(to)}, ${to.year}'
      : '${shortDay(from)}, ${from.year} – ${shortDay(to)}, ${to.year}';

  /// [children] with side drags and side wheel moves that move the window by bars. A drag starts only after
  /// [_dragStart] pixels, so that a tap on a heatmap day still works. `.swipe` in theme.dart keeps vertical scroll.
  Component _draggable(ZoomWindow window, List<Component> children) => div(
    classes: 'swipe detail-body',
    events: {
      'pointerdown': (e) => _drag = (startX: (e as web.PointerEvent).pageX, window: window, captured: false),
      'pointermove': (e) => _dragMove(e as web.PointerEvent),
      'pointerup': (_) => _drag = null,
      'pointercancel': (_) => _drag = null,
      'wheel': (e) => _wheelMove(window, e as web.WheelEvent),
    },
    children,
  );

  void _dragMove(web.PointerEvent pointer) {
    final drag = _drag;
    if (drag == null) return;
    final dx = pointer.pageX - drag.startX;
    if (!drag.captured) {
      if (dx.abs() < _dragStart) return;
      capturePointer(pointer);
      _drag = (startX: drag.startX, window: drag.window, captured: true);
    }
    final width = (pointer.currentTarget as web.Element).getBoundingClientRect().width;
    _moveTo(drag.window.moved(-(dx / (width / drag.window.starts.length)).round()));
  }

  void _wheelMove(ZoomWindow window, web.WheelEvent wheel) {
    // Vertical wheel moves scroll the page.
    if (wheel.deltaX.abs() <= wheel.deltaY.abs()) return;
    wheel.preventDefault();
    _wheel += wheel.deltaX;
    final bars = _wheel ~/ _wheelStep;
    if (bars == 0) return;
    _wheel = _wheel.remainder(_wheelStep);
    _moveTo(window.moved(bars));
  }

  /// The month [delta] months after [month], or before it if [delta] is negative.
  static MonthKey _addMonths(MonthKey month, int delta) {
    final m = DateTime(month.year, month.month + delta);
    return (year: m.year, month: m.month);
  }

  /// All days of [month]. Days after today show faded.
  static List<Day> _daysOf(MonthKey month) =>
      daysBetween(Day(month.year, month.month, 1), Day.fromDateTime(DateTime(month.year, month.month + 1, 0)));

  /// The calendar to edit days, with its own month arrows and swipes. Wide screens also show the month before on the
  /// left. See .month-pair in theme.dart.
  Component _calendar(MonthKey month) {
    final before = _addMonths(month, -1);
    final isThisMonth = month.year == _today.year && month.month == _today.month;
    void move(int delta) => setState(() => _month = _addMonths(month, delta));
    return _section('Edit days', [
      nav(classes: 'month-nav', [
        iconButton(icon: 'chevron_left', title: 'Previous month', onClick: () => move(-1)),
        span(classes: 'max center-align', [
          span(classes: 'single-month', [.text(_monthTitle(month))]),
          span(classes: 'two-months', [.text(_monthPairTitle(before, month))]),
        ]),
        iconButton(
          icon: 'chevron_right',
          title: 'Next month',
          disabled: isThisMonth,
          onClick: () => move(1),
        ),
      ]),
      _swipeable(
        div(classes: 'month-pair', [
          div(classes: 'previous-month', [_table(_daysOf(before), key: 'previous')]),
          _table(_daysOf(month), key: 'calendar'),
        ]),
        onPrevious: () => move(-1),
        onNext: isThisMonth ? null : () => move(1),
      ),
    ]);
  }

  /// Example: "October 2026".
  static String _monthTitle(MonthKey month) => '${monthNames[month.month - 1]} ${month.year}';

  /// Example: "September – October 2026", or "December 2025 – January 2026" across a year.
  static String _monthPairTitle(MonthKey before, MonthKey month) => before.year == month.year
      ? '${monthNames[before.month - 1]} – ${_monthTitle(month)}'
      : '${_monthTitle(before)} – ${_monthTitle(month)}';

  /// [child] with swipes: to the left calls [onNext], to the right calls [onPrevious]. A null [onNext] does nothing.
  /// `.swipe` in theme.dart keeps vertical scroll and stops the browser from using side moves.
  Component _swipeable(Component child, {required VoidCallback onPrevious, VoidCallback? onNext}) => div(
    classes: 'swipe',
    events: {
      'pointerdown': (e) {
        final pointer = e as web.PointerEvent;
        _swipe = (pointerId: pointer.pointerId, x: pointer.pageX, y: pointer.pageY);
      },
      'pointerup': (e) {
        final pointer = e as web.PointerEvent;
        final start = _swipe;
        _swipe = null;
        if (start == null || start.pointerId != pointer.pointerId) return;
        final dx = pointer.pageX - start.x, dy = pointer.pageY - start.y;
        if (dx.abs() < _swipeDistance || dx.abs() < 2 * dy.abs()) return;
        if (dx < 0) {
          onNext?.call();
        } else {
          onPrevious();
        }
      },
      'pointercancel': (_) => _swipe = null,
    },
    [child],
  );

  Component _section(String title, List<Component> children) => div(classes: 'detail-section', [
    h6([.text(title)]),
    ...children,
  ]);

  /// The calendar of [days], with the same cells and inputs as the Today page.
  Component _table(List<Day> days, {required String key}) => HabitTable(
    key: ValueKey(key),
    metrics: [_metric],
    log: component.log,
    today: _today,
    days: days,
    layout: DayLayout.calendars,
    busy: component.busy,
    onWrite: component.onWrite,
    pending: component.pending,
    onCount: component.onCount,
    bare: true,
  );

  /// The bars of the window. With [fixedScale], the top of the scale comes from all bars, so that it does not change
  /// while the window moves: for sums.
  Component _timeBars(
    String title,
    String description,
    ZoomWindow window,
    Map<Day, num> values,
    Aggregate aggregate, {
    bool fixedScale = false,
    bool range = false,
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
      range: range,
      format: format,
      unit: unit,
    );
  }

  static String _percent(double rate) => '${(rate * 100).round()}%';

  /// [value] with at most [decimals] decimals and the unit of [m].
  static String _withUnit(num value, NumberMetric m, [int decimals = 1]) =>
      '${formatNumber(value, decimals)}${m.unit == null ? '' : ' ${m.unit}'}';

  /// [value] with its sign and the unit of [m]. Example: "−1.3 kg".
  static String _signed(num value, NumberMetric m) {
    final sign = value > 0 ? '+' : (value < 0 ? '−' : '');
    return '$sign${_withUnit(value.abs(), m, 2)}';
  }

  /// [dayValue] with the unit of [m], or "–" if there is no value.
  static String _dayValue(DayValue? dayValue, NumberMetric m) =>
      dayValue == null ? '–' : _withUnit(dayValue.value, m, 2);

  /// [label] with the day of [dayValue]. Example: "latest · Oct 10".
  static String _dayLabel(String label, DayValue? dayValue) =>
      '$label · ${dayValue == null ? '' : shortDay(dayValue.day)}';

  List<Component> _yesNoCharts(YesNoStats stats, ZoomWindow window, Map<Day, num> values) => [
    KeyNumbers(
      items: [
        ('done days', '${stats.yes}'),
        ('rate', _percent(stats.rate)),
        ('missed (no)', '${stats.no}'),
        ('no entry', '${stats.none}'),
        (window.atEnd ? 'current streak' : 'streak on ${shortDay(window.to)}', '${stats.currentStreak} d'),
        ('longest streak', '${stats.longestStreak} d'),
      ],
    ),
    div(classes: 'detail-charts', [
      _timeBars(
        'Yes rate',
        'The percentage of yes days in each ${window.unit.name}.',
        window,
        values,
        Aggregate.rate,
        max: 1,
        format: (v) => _percent(v.toDouble()),
      ),
      LineChart(
        title: 'Habit strength (%)',
        description: 'It goes up on yes days and down on all other days.',
        days: window.days,
        values: [for (final v in stats.strength) v * 100],
        dots: false,
        decimals: 0,
        range: (0, 100),
      ),
      DonutChart(
        title: 'Yes, no and no entry',
        description: 'The share of days with yes, with no and with no entry.',
        center: _percent(stats.rate),
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
              tooltip: rate == null ? 'No day' : _percent(rate),
            ),
        ],
      ),
      BarChart(
        title: 'Streak lengths',
        wide: true,
        description: 'The number of runs of yes days in a row, for each length in days.',
        bars: [
          for (final (i, n) in streakLengths(stats.streaks).indexed)
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

  List<Component> _countCharts(NumberMetric m, CountStats stats, ZoomWindow window, Map<Day, num> values) => [
    KeyNumbers(
      items: [
        ('total', _withUnit(stats.total, m)),
        ('per day', stats.average == null ? '–' : _withUnit(stats.average!, m)),
        (
          'best day',
          stats.best == null ? '–' : '${formatNumber(stats.best!.value)} · ${shortDay(stats.best!.day)}',
        ),
        ('days logged', '${stats.logged}'),
      ],
    ),
    div(classes: 'detail-charts', [
      _timeBars(
        'Totals',
        'The total of each ${window.unit.name}.',
        window,
        values,
        Aggregate.sum,
        fixedScale: true,
        unit: m.unit,
      ),
      LineChart(
        title: 'Running total',
        description: 'The sum of all values from the start of the window.',
        days: window.days,
        values: stats.running,
        unit: m.unit,
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
              tooltip: average == null ? 'No value' : _withUnit(average, m),
            ),
        ],
      ),
      BarChart(
        title: 'Distribution (days)',
        description: 'The number of days with each value.',
        bars: [for (final (v, n) in stats.distribution) (label: '$v', value: n, tooltip: '$n days with $v')],
      ),
    ]),
  ];

  List<Component> _numberCharts(NumberMetric m, NumberStats stats, ZoomWindow window, Map<Day, num> values) => [
    KeyNumbers(
      items: [
        (_dayLabel('latest', stats.latest), _dayValue(stats.latest, m)),
        ('change', stats.change == null ? '–' : _signed(stats.change!, m)),
        (_dayLabel('lowest', stats.low), _dayValue(stats.low, m)),
        (_dayLabel('highest', stats.high), _dayValue(stats.high, m)),
        ('average', stats.average == null ? '–' : _withUnit(stats.average!, m, 2)),
        ('days logged', '${stats.logged}'),
      ],
    ),
    div(classes: 'detail-charts', [
      _timeBars(
        'Averages and range',
        'Each bar goes from the lowest to the highest value of a ${window.unit.name}. The dot is the average.',
        window,
        values,
        Aggregate.average,
        range: true,
        unit: m.unit,
      ),
      LineChart(
        title: 'Values and 7-day trend',
        description: 'Dots are the values. The line is a smooth average that ignores small daily changes.',
        days: window.days,
        values: stats.values,
        trend: stats.trend,
        unit: m.unit,
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
}
