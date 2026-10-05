import 'dart:math' as math;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

import '../components/charts.dart';
import '../components/metric_icon.dart';
import '../components/ui.dart';
import '../model/day.dart';
import '../model/log_edits.dart';
import '../model/metric.dart';
import '../model/stats.dart';
import '../model/zoom.dart';
import '../services/pointer.dart';
import '../services/wheel_steps.dart';
import 'metric_detail/count_section.dart';
import 'metric_detail/edit_days.dart';
import 'metric_detail/number_section.dart';
import 'metric_detail/window_bar.dart';
import 'metric_detail/yes_no_section.dart';

/// All data of one metric: key numbers, charts and day heatmap for one time window, and a month calendar to edit days.
///
/// - Time window: the zoom buttons set its span and the bar size (see [ZoomStep]). A tap on the zoom label goes to
///   All, and a second tap goes back. The arrows move the window by its full span. A tap or drag on the overview moves it there. A side drag or side wheel on any chart moves it by bars.
///   All numbers and charts show the same window. The bar at the top stays in view while the page scrolls.
/// - Day heatmap: the days of the window. A tap on a day shows its month in the calendar.
/// - Edit days: any month, with the same day cells and inputs as the Today page. It shows the month of the window end
///   until the arrows, a swipe or a heatmap tap change it. Wide screens also show the month before.
///
/// Parts: metric_detail/. Styles: lib/constants/theme.dart (layout) and lib/components/charts/ (charts).
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

  /// The data that does not depend on the window. See [_MetricData].
  _MetricData? _data;

  _MetricData get _metricData {
    final data = _data;
    if (data != null && data.isFor(_m, component.edits)) return data;
    return _data = _MetricData(_m, component.edits);
  }

  void _moveTo(Day? end) {
    if (end == _end) return;
    setState(() {
      _end = end;
      _month = null;
    });
  }

  @override
  Component build(BuildContext context) {
    final _MetricData(:states, :values, :first, :steps) = _metricData;
    final stepIndex = math.min(_step ?? defaultStep(steps), steps.length - 1);
    final w = ZoomWindow(steps[stepIndex], first: first, today: _today, end: _end);

    return div(classes: 'metric-detail', [
      nav(classes: 'detail-head', [
        iconButton('arrow_back', title: 'Back', onClick: component.onBack),
        metricIcon(_m, large: true),
        h5(classes: 'max', [.text(_m.name)]),
      ]),
      WindowBar(
        window: w,
        steps: steps,
        stepIndex: stepIndex,
        beforeAll: _beforeAll,
        weeks: _metricData.weeks,
        fromZero: aggregateOf(_m) != Aggregate.average,
        onZoom: (index, {beforeAll}) => _zoom(w, index, beforeAll: beforeAll),
        onMove: _moveTo,
      ),
      _draggable(w, [
        switch (_m) {
          YesNoMetric() => YesNoSection(stats: yesNoStats(states, w.days, w.to), window: w, values: values),
          NumberMetric(isCount: true) && final m => CountSection(
            metric: m,
            stats: countStats(values, w.days),
            window: w,
            values: values,
          ),
          final NumberMetric m => NumberSection(
            metric: m,
            stats: numberStats(values, w.days),
            window: w,
            values: values,
          ),
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
      EditDays(
        metric: _m,
        edits: component.edits,
        month: _month ?? monthOf(w.to),
        onMonth: (m) => setState(() => _month = m),
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
}

/// The data of [metric] that does not depend on the window. A drag or a wheel move builds the page again many times,
/// so the page keeps this data until the log, the pending count taps, the metric or today change.
final class _MetricData {
  _MetricData(this.metric, this.edits) {
    final m = metric;
    states = m is YesNoMetric ? yesNoStates(m.id, edits.log.entries) : const {};
    // For yes/no metrics: 1 for yes and 0 for no, as the rate bars expect. Else the values with the pending taps, the
    // same values as in the table.
    values = m is YesNoMetric
        ? {for (final MapEntry(key: d, value: yes) in states.entries) d: yes ? 1 : 0}
        : edits.valuesOf(m);
    first = earliestDay(values.keys) ?? edits.today;
    steps = zoomSteps(first, edits.today);
    weeks = zoomBars(
      values,
      aggregateOf(m),
      barStarts(first, edits.today, BarUnit.week),
      BarUnit.week,
      first: first,
      today: edits.today,
    );
  }

  final Metric metric;
  final LogEdits edits;

  /// Yes/no metrics: the state of each day with an entry. Else empty.
  late final Map<Day, bool> states;
  late final Map<Day, num> values;

  /// The first day with a value, or today.
  late final Day first;
  late final List<ZoomStep> steps;

  /// One bar for each week of all data, for the overview.
  late final List<ZoomBar> weeks;

  /// True if this data is still correct for [m] and [e].
  bool isFor(Metric m, LogEdits e) =>
      identical(m, metric) &&
      identical(e.log, edits.log) &&
      identical(e.pending, edits.pending) &&
      e.today == edits.today;
}
