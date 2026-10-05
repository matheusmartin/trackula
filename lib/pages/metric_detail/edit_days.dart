import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

import '../../components/habit_table.dart';
import '../../components/ui.dart';
import '../../model/date_format.dart';
import '../../model/day.dart';
import '../../model/log_edits.dart';
import '../../model/metric.dart';

/// The calendar to edit the days of [metric] in [month], with month arrows and swipes. Wide screens also show the
/// month before, on the left. See .month-pair in theme.dart.
class EditDays extends StatefulComponent {
  const EditDays({required this.metric, required this.edits, required this.month, required this.onMonth, super.key});

  final Metric metric;
  final LogEdits edits;
  final MonthKey month;

  /// Shows another month. The page keeps the month: a heatmap tap also sets it.
  final void Function(MonthKey month) onMonth;

  @override
  State<EditDays> createState() => _EditDaysState();
}

class _EditDaysState extends State<EditDays> {
  /// A swipe is at least this many pixels to the side, and more to the side than up or down.
  static const _swipeDistance = 50;

  /// The start of a swipe: pointer id, x and y. The x and y are `pageX` and `pageY`, not `clientX`: package:web
  /// declares `clientX` as an int, and real pointers give fractional values.
  (int, double, double)? _swipeStart;

  @override
  Component build(BuildContext context) {
    final month = component.month;
    final before = addMonths(month, -1);
    final isThisMonth = month == monthOf(component.edits.today);
    void move(int delta) => component.onMonth(addMonths(month, delta));
    return div(classes: 'detail-section', [
      h6([.text('Edit days')]),
      nav(classes: 'month-nav', [
        iconButton('chevron_left', title: 'Previous month', onClick: () => move(-1)),
        span(classes: 'max center-align', [
          span(classes: 'single-month', [.text(monthYear(month))]),
          // Wide screens.
          span(classes: 'two-months', [.text(monthRange(before, month))]),
        ]),
        iconButton('chevron_right', title: 'Next month', onClick: () => move(1), disabled: isThisMonth),
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

  Component _table(List<Day> days, {required String key}) => HabitTable(
    key: ValueKey(key),
    metrics: [component.metric],
    edits: component.edits,
    days: days,
    layout: DayLayout.calendars,
    bare: true,
  );
}
