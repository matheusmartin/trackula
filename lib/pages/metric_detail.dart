import 'dart:math' as math;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

import '../components/charts.dart';
import '../components/icon_button.dart';
import '../components/metric_charts.dart';
import '../components/metric_icon.dart';
import '../components/month_calendar.dart';
import '../model/day.dart';
import '../model/format.dart';
import '../model/log_entry.dart';
import '../model/metric.dart';
import '../model/score.dart';
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
/// - Score ([scoreMetric]): the numbers and charts of a count, from [scores]. It has no Edit days section: the app
///   calculates the scores.
///
/// Styles: lib/constants/theme.dart (layout) and lib/components/charts.dart (charts).
final class MetricDetail extends StatefulComponent {
  const MetricDetail({
    required this.metric,
    required this.log,
    required this.today,
    required this.busy,
    required this.onWrite,
    required this.pending,
    required this.onCount,
    required this.scores,
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

  /// The score of each day. The values of the detail screen of [scoreMetric].
  final Map<Day, num> scores;
  final VoidCallback onBack;

  @override
  State<MetricDetail> createState() => _MetricDetailState();
}

/// A side drag on the charts. `startX` is the start `pageX`, not `clientX`: package:web declares `clientX` as an int,
/// and real pointers give fractional values. `captured` is true after the drag captured the pointer.
typedef _Drag = ({double startX, ZoomWindow window, bool captured});

class _MetricDetailState extends State<MetricDetail> {
  /// The shortest drag, in pixels. A shorter drag is a tap, for example on a heatmap day.
  static const _dragStart = 8;

  /// The side wheel scroll for one bar, in pixels.
  static const _wheelStep = 40.0;

  /// The index in [zoomSteps]. Null: [defaultStepIndex].
  int? _stepIndex;

  /// The step index before a tap on the zoom label went to All. A second tap goes back to it.
  int? _beforeAll;

  /// A day in the newest bar of the window. Null: the newest bar of all. A day, not an index, so that a zoom keeps
  /// the same time in view.
  Day? _end;

  /// The month in the calendar. Null: the month of the window end.
  MonthKey? _month;

  _Drag? _drag;

  /// Side wheel movement that is less than one bar, in pixels.
  double _wheel = 0;

  Metric get _metric => component.metric;
  Day get _today => component.today;

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
    _stepIndex = index;
    _beforeAll = beforeAll;
  });

  @override
  Component build(BuildContext context) {
    final states = _metric is YesNoMetric ? yesNoStates(_metric.id, component.log.entries) : const <Day, bool>{};
    // For yes/no metrics: 1 for yes and 0 for no, as the rate bars expect.
    final values = switch (_metric) {
      YesNoMetric() => <Day, num>{for (final MapEntry(key: d, value: yes) in states.entries) d: yes ? 1 : 0},
      _ when isScore(_metric) => component.scores,
      _ => dayValuesWithPending(_metric, component.log.entries, component.pending),
    };
    final first = earliestDay(values.keys) ?? _today;
    final steps = zoomSteps(first, _today);
    final stepIndex = math.min(_stepIndex ?? defaultStepIndex(steps), steps.length - 1);
    final window = ZoomWindow(steps[stepIndex], first: first, today: _today, end: _end);

    return div(classes: 'metric-detail', [
      nav(classes: 'detail-head', [
        iconButton(icon: 'arrow_back', title: 'Back', onClick: component.onBack),
        metricIcon(_metric, large: true),
        h5(classes: 'max', [.text(_metric.name)]),
      ]),
      _windowBar(window, steps, stepIndex, values),
      _draggable(window, [
        MetricCharts(metric: _metric, window: window, values: values, states: states),
        DayHeatmap(
          title: _metric is YesNoMetric ? 'Yes days' : 'Days with a value',
          from: window.from,
          to: window.to,
          today: _today,
          filled: (d) => _metric is YesNoMetric ? states[d] == true : values.containsKey(d),
          onDay: isScore(_metric) ? null : (d) => setState(() => _month = monthOf(d)),
        ),
      ]),
      if (!isScore(_metric))
        MonthCalendar(
          metric: _metric,
          log: component.log,
          today: _today,
          busy: component.busy,
          onWrite: component.onWrite,
          pending: component.pending,
          onCount: component.onCount,
          month: _month ?? monthOf(window.to),
          onMonth: (month) => setState(() => _month = month),
        ),
    ]);
  }

  /// The zoom buttons, the dates of the window with arrows, and the overview of all data. See .window-bar in theme.dart.
  Component _windowBar(ZoomWindow window, List<ZoomStep> steps, int stepIndex, Map<Day, num> values) {
    final aggregate = switch (_metric) {
      YesNoMetric() => Aggregate.rate,
      NumberMetric(isCount: true) => Aggregate.sum,
      _ => Aggregate.average,
    };
    final box = window.boxOn(BarUnit.week);
    return div(classes: 'window-bar', [
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
        from: box.from,
        to: box.to,
        onPoint: (d) => _moveTo(window.endCenteredOn(d)),
      ),
    ]);
  }

  /// Zoom in, the zoom label, and zoom out. A tap on the label goes to All, and from All back to the step before.
  Component _zoomButtons(ZoomWindow window, List<ZoomStep> steps, int stepIndex) {
    // The last step shows all data. See zoomSteps.
    final last = steps.length - 1;
    final atAll = stepIndex == last;
    final back = math.min(_beforeAll ?? defaultStepIndex(steps), last);
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
        onClick: () => _moveTo(window.endMovedBy(-count)),
      ),
      span(classes: 'center-align', [.text(formatDateRange(window.from, window.to))]),
      iconButton(
        icon: 'chevron_right',
        title: 'Later',
        small: true,
        disabled: window.atEnd,
        onClick: () => _moveTo(window.endMovedBy(count)),
      ),
    ]);
  }

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
    _moveTo(drag.window.endMovedBy(-(dx / (width / drag.window.starts.length)).round()));
  }

  void _wheelMove(ZoomWindow window, web.WheelEvent wheel) {
    // Vertical wheel moves scroll the page.
    if (wheel.deltaX.abs() <= wheel.deltaY.abs()) return;
    wheel.preventDefault();
    _wheel += wheel.deltaX;
    final bars = _wheel ~/ _wheelStep;
    if (bars == 0) return;
    _wheel = _wheel.remainder(_wheelStep);
    _moveTo(window.endMovedBy(bars));
  }
}
