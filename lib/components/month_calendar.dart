import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

import '../model/day.dart';
import '../model/format.dart';
import '../model/log_entry.dart';
import '../model/metric.dart';
import 'habit_table.dart';
import 'icon_button.dart';

/// The start of a swipe, as `pageX` and `pageY`. Not `clientX`: package:web declares `clientX` as an int, and real
/// pointers give fractional values.
typedef _Swipe = ({int pointerId, double x, double y});

/// The calendar of the detail screen, to edit the days of one metric in any month. It has the same day cells and
/// inputs as the Today page, and its own month arrows and swipes. Wide screens also show the month before on the
/// left. See .month-pair in theme.dart.
final class MonthCalendar extends StatefulComponent {
  const MonthCalendar({
    required this.metric,
    required this.log,
    required this.today,
    required this.busy,
    required this.onWrite,
    required this.pending,
    required this.onCount,
    required this.month,
    required this.onMonth,
    super.key,
  });

  final Metric metric;
  final LogTable log;
  final Day today;
  final bool busy;
  final void Function(LogWrite? Function(LogTable log) plan) onWrite;
  final Map<(String, Day), List<CountStep>> pending;
  final void Function(NumberMetric metric, Day day, CountStep step) onCount;

  /// The month in view.
  final MonthKey month;

  /// Called when the arrows or a swipe change the month.
  final void Function(MonthKey month) onMonth;

  @override
  State<MonthCalendar> createState() => _MonthCalendarState();
}

class _MonthCalendarState extends State<MonthCalendar> {
  /// The smallest side move of a swipe, in pixels. A swipe also moves more to the side than up or down.
  static const _swipeDistance = 50;

  _Swipe? _swipe;

  @override
  Component build(BuildContext context) {
    final month = component.month;
    final before = addMonths(month, -1);
    final isThisMonth = month == monthOf(component.today);
    void move(int delta) => component.onMonth(addMonths(month, delta));
    return div(classes: 'detail-section', [
      h6([.text('Edit days')]),
      nav(classes: 'month-nav', [
        iconButton(icon: 'chevron_left', title: 'Previous month', onClick: () => move(-1)),
        span(classes: 'max center-align', [
          span(classes: 'single-month', [.text(monthTitle(month))]),
          span(classes: 'two-months', [.text(monthPairTitle(before, month))]),
        ]),
        iconButton(icon: 'chevron_right', title: 'Next month', disabled: isThisMonth, onClick: () => move(1)),
      ]),
      _swipeable(
        div(classes: 'month-pair', [
          div(classes: 'previous-month', [_table(daysOfMonth(before), key: 'previous')]),
          _table(daysOfMonth(month), key: 'calendar'),
        ]),
        onPrevious: () => move(-1),
        onNext: isThisMonth ? null : () => move(1),
      ),
    ]);
  }

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

  /// The calendar of [days], with the same cells and inputs as the Today page.
  Component _table(List<Day> days, {required String key}) => HabitTable(
    key: ValueKey(key),
    metrics: [component.metric],
    log: component.log,
    today: component.today,
    days: days,
    layout: DayLayout.calendars,
    busy: component.busy,
    onWrite: component.onWrite,
    pending: component.pending,
    onCount: component.onCount,
    showsTitleAndChart: false,
  );
}
