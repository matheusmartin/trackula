import 'dart:math' as math;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../../components/charts.dart';
import '../../components/ui.dart';
import '../../model/date_format.dart';
import '../../model/day.dart';
import '../../model/zoom.dart';

/// The zoom buttons, the dates of the window with arrows, and the overview of all data. The page keeps the state.
/// See .window-bar in theme.dart.
class WindowBar extends StatelessComponent {
  const WindowBar({
    required this.window,
    required this.steps,
    required this.stepIndex,
    required this.beforeAll,
    required this.values,
    required this.aggregate,
    required this.onZoom,
    required this.onMove,
    super.key,
  });

  final ZoomWindow window;

  /// All zoom steps, and the index of the step in view. The last step shows all data. See [zoomSteps].
  final List<ZoomStep> steps;
  final int stepIndex;

  /// The step that a tap on the All label goes back to. Null: [defaultStep].
  final int? beforeAll;

  /// The day values for the overview.
  final Map<Day, num> values;
  final Aggregate aggregate;

  /// Zooms to the step [index]. [beforeAll]: the step that a tap on the All label goes back to.
  final void Function(int index, {int? beforeAll}) onZoom;

  /// Moves the window so that its newest bar has [end]. Null: the newest bar of all.
  final void Function(Day? end) onMove;

  @override
  Component build(BuildContext context) {
    final w = window;
    final count = w.starts.length;
    final last = steps.length - 1;
    final atAll = stepIndex == last;
    final back = math.min(beforeAll ?? defaultStep(steps), last);
    return div(classes: 'window-bar', [
      div(classes: 'window-row', [
        nav(
          classes: 'window-zoom',
          attributes: {'aria-label': 'Zoom'},
          [
            iconButton(
              'zoom_in',
              title: 'Zoom in',
              onClick: () => onZoom(stepIndex - 1),
              disabled: stepIndex == 0,
              small: true,
            ),
            // A tap goes to All, and from All back to the step before.
            button(
              classes: 'transparent small zoom-label',
              attributes: {'title': atAll ? 'Back to ${steps[back].label}' : 'Show all'},
              onClick: () => atAll ? onZoom(back) : onZoom(last, beforeAll: stepIndex),
              [.text(atAll ? 'All' : steps[stepIndex].label)],
            ),
            iconButton(
              'zoom_out',
              title: 'Zoom out',
              onClick: () => onZoom(stepIndex + 1),
              disabled: atAll,
              small: true,
            ),
          ],
        ),
        nav(classes: 'window-dates', [
          iconButton(
            'chevron_left',
            title: 'Earlier',
            onClick: () => onMove(w.moved(-count)),
            disabled: w.atStart,
            small: true,
          ),
          span(classes: 'center-align', [.text(dayRange(w.from, w.to))]),
          iconButton(
            'chevron_right',
            title: 'Later',
            onClick: () => onMove(w.moved(count)),
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
        onPoint: (d) => onMove(w.centeredOn(d)),
      ),
    ]);
  }
}
