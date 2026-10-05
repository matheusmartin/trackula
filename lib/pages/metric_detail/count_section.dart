import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../../components/charts.dart';
import '../../components/key_numbers.dart';
import '../../model/date_format.dart';
import '../../model/day.dart';
import '../../model/format.dart';
import '../../model/metric.dart';
import '../../model/stats.dart';
import '../../model/zoom.dart';

/// The key numbers and charts of a `count` metric in the [window].
class CountSection extends StatelessComponent {
  const CountSection({
    required this.metric,
    required this.stats,
    required this.window,
    required this.values,
    super.key,
  });

  final NumberMetric metric;
  final CountStats stats;
  final ZoomWindow window;
  final Map<Day, num> values;

  @override
  Component build(BuildContext context) => .fragment(_children());

  List<Component> _children() {
    final (m, s, w) = (metric, stats, window);
    return [
      KeyNumbers(
        items: [
          ('total', withUnit(s.total, m.unit)),
          ('per day', s.average == null ? '–' : withUnit(s.average!, m.unit)),
          ('best day', s.best == null ? '–' : '${formatNumber(s.best!.value)} · ${shortDay(s.best!.day)}'),
          ('days logged', '${s.logged}'),
        ],
      ),
      div(classes: 'detail-charts', [
        TimeBars.window(
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
  }
}
