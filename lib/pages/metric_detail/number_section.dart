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

/// The key numbers and charts of a `number` metric in the [window].
class NumberSection extends StatelessComponent {
  const NumberSection({
    required this.metric,
    required this.stats,
    required this.window,
    required this.values,
    super.key,
  });

  final NumberMetric metric;
  final NumberStats stats;
  final ZoomWindow window;
  final Map<Day, num> values;

  @override
  Component build(BuildContext context) => .fragment(_children());

  List<Component> _children() {
    final (m, s, w) = (metric, stats, window);
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
        TimeBars.window(
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
