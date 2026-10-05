import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../../components/charts.dart';
import '../../components/key_numbers.dart';
import '../../model/date_format.dart';
import '../../model/day.dart';
import '../../model/format.dart';
import '../../model/stats.dart';
import '../../model/zoom.dart';

/// The key numbers and charts of a yes/no metric in the [window].
class YesNoSection extends StatelessComponent {
  const YesNoSection({required this.stats, required this.window, required this.values, super.key});

  final YesNoStats stats;
  final ZoomWindow window;

  /// 1 for yes and 0 for no, as the rate bars expect.
  final Map<Day, num> values;

  @override
  Component build(BuildContext context) => .fragment(_children());

  List<Component> _children() {
    final (s, w) = (stats, window);
    return [
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
        TimeBars.window(
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
  }
}
