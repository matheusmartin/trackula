import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../../constants/tokens.dart';
import '../../model/day.dart';
import 'chart_parts.dart';

/// The days from [from] to [to] in week columns, Monday at the top. A day with a value is filled. A tap on a day
/// calls [onDay].
class DayHeatmap extends StatelessComponent {
  const DayHeatmap({
    required this.title,
    required this.from,
    required this.to,
    required this.filled,
    required this.today,
    required this.onDay,
    super.key,
  });

  final String title;
  final Day from;
  final Day to;
  final bool Function(Day day) filled;
  final Day today;
  final void Function(Day day) onDay;

  /// Longer windows: single days are too small.
  static const maxDays = 371;

  @override
  Component build(BuildContext context) {
    const description = 'Tap a day to show its month in the calendar.';
    final count = to.serial - from.serial + 1;
    if (count > maxDays) {
      return chartCard(title, description, wide: true, [
        small(styles: chartTextStyle, [.text('Zoom in to 1 year or less to see single days.')]),
      ]);
    }
    return chartCard(title, description, wide: true, [_grid()]);
  }

  Component _grid() {
    final offset = from.weekday - 1;
    final days = [for (var d = from; d.compareTo(to) <= 0; d = d.addDays(1)) d];
    final columns = ((offset + days.length) / 7).ceil();
    const size = 10.0, gap = 2.0;
    return svg(
      viewBox: '0 0 ${columns * (size + gap)} ${7 * (size + gap)}',
      // Short windows: cells at most about 1.5rem, centered, not the full width.
      styles: Styles(
        raw: {
          'display': 'block',
          'width': '100%',
          'max-width': '${columns * 1.5}rem',
          'height': 'auto',
          'margin-inline': 'auto',
        },
      ),
      attributes: {'role': 'img', 'aria-label': 'Days from $from to $to'},
      [
        for (final (i, d) in days.indexed)
          rect(
            x: '${((i + offset) ~/ 7) * (size + gap)}',
            y: '${((i + offset) % 7) * (size + gap)}',
            width: '$size',
            height: '$size',
            rx: '2',
            styles: Styles(
              raw: {
                'fill': filled(d) ? filledColor : emptyColor,
                'cursor': 'pointer',
                if (d == today) 'stroke': 'var(--on-surface)',
                if (d == today) 'stroke-width': '1',
              },
            ),
            events: {'click': (_) => onDay(d)},
            [svgTooltip('$d')],
          ),
      ],
    );
  }
}
