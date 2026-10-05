import 'dart:math' as math;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../../constants/tokens.dart';
import '../../model/chart.dart';
import '../../model/date_format.dart';
import '../../model/day.dart';
import '../../model/format.dart';
import 'chart_parts.dart';

/// Dots for each value, and a line: the [trend] if given, else through the dots.
class LineChart extends StatelessComponent {
  const LineChart({
    required this.title,
    required this.description,
    required this.days,
    required this.values,
    this.trend,
    this.unit,
    this.dots = true,
    this.decimals = 2,
    this.range,
    super.key,
  });

  final String title;
  final String description;
  final List<Day> days;
  final List<num?> values;
  final List<num?>? trend;
  final String? unit;

  /// Dots for the values. Off for long series, for example the habit strength.
  final bool dots;

  /// The decimals of the axis labels and tooltips.
  final int decimals;

  /// A fixed scale, for example (0, 100) for percentages. Null: from the lowest to the highest value.
  final (num, num)? range;

  @override
  Component build(BuildContext context) {
    final all = [...values.nonNulls, ...?trend?.nonNulls];
    if (all.isEmpty) return noValuesCard(title, description);
    final hi = range?.$2 ?? all.reduce(math.max), lo = range?.$1 ?? all.reduce(math.min);
    final w = math.max(1, values.length - 1).toDouble();
    const h = 50.0;
    double x(int i) => values.length == 1 ? w / 2 : i.toDouble();
    double y(num v) => linearY(v, lo, hi, h, padding: 2);
    String pathOf(List<num?> vs) => [
      for (final (i, v) in vs.indexed)
        if (v != null) '${i == vs.indexWhere((e) => e != null) ? 'M' : 'L'}${x(i)} ${y(v)}',
    ].join(' ');
    final u = unitSuffix(unit);
    return chartCard(title, description, [
      chartWithAxes(
        chartSvg(w, h, label: title, [
          path(d: pathOf(trend ?? values), styles: chartLineStyle, []),
          for (final (i, v) in values.indexed)
            if (dots && v != null)
              path(
                d: 'M${x(i)} ${y(v)} h0',
                styles: chartDotStyle(trend == null ? chartPrimary : filledColor, size: values.length > 60 ? 3 : 5),
                [svgTooltip('${shortDay(days[i])}: ${formatNumber(v, decimals)}$u')],
              ),
        ]),
        high: formatNumber(hi, decimals),
        low: hi == lo ? null : formatNumber(lo, decimals),
        first: shortDay(days.first),
        last: shortDay(days.last),
      ),
    ], wide: true);
  }
}
