import 'dart:math' as math;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../../constants/tokens.dart';
import '../../model/chart.dart';
import '../../model/date_format.dart';
import '../../model/day.dart';
import '../../model/format.dart';
import '../../model/zoom.dart';
import 'bar_chart.dart';
import 'chart_parts.dart';

/// Bars over time: one bar for each week, month or quarter of the time window. See [ZoomWindow].
///
/// - [max] fixes the top of the scale, for example to all bars of rates and sums, so that the scale does not change
///   while the window moves. Null: the bars in view.
/// - Values show above the bars when 13 bars or fewer are in view.
/// - With [range], each bar goes from the lowest to the highest value, and a dot shows the average.
class TimeBars extends StatelessComponent {
  const TimeBars({
    required this.title,
    required this.description,
    required this.bars,
    required this.barUnit,
    this.format = formatNumber,
    this.max,
    this.range = false,
    this.unit,
    super.key,
  });

  /// The bars of the window [w], from [values] by [aggregate]. With [fixedScale], the scale comes from all bars of
  /// the data, so that it does not change while the window moves: for rates and sums.
  factory TimeBars.window(
    String title,
    String description,
    ZoomWindow w,
    Map<Day, num> values,
    Aggregate aggregate, {
    bool fixedScale = false,
    bool range = false,
    num? max,
    String Function(num v) format = formatNumber,
    String? unit,
  }) {
    final bars = zoomBars(values, aggregate, w.allStarts, w.unit, first: w.first, today: w.today);
    final all = [for (final b in bars) ?b.value];
    return TimeBars(
      title: title,
      description: description,
      bars: bars.sublist(w.allStarts.indexOf(w.starts.first), w.allStarts.indexOf(w.starts.last) + 1),
      barUnit: w.unit,
      max: max ?? (fixedScale && all.isNotEmpty ? all.reduce(math.max) : null),
      range: range,
      format: format,
      unit: unit,
    );
  }

  /// Up to this number of bars, the values show above the bars.
  static const _valueBars = 13;

  final String title;
  final String description;

  /// The bars in view, oldest first.
  final List<ZoomBar> bars;
  final BarUnit barUnit;

  /// The text of the value above a bar and in its tooltip.
  final String Function(num v) format;
  final num? max;
  final bool range;

  /// The unit of the values in the tooltips, for example `Kg`. Not above the bars: there is no space.
  final String? unit;

  @override
  Component build(BuildContext context) {
    final lows = [for (final b in bars) ?(range ? b.low : b.value)];
    final highs = [for (final b in bars) ?(range ? b.high : b.value)];
    if (highs.isEmpty) return noValuesCard(title, description);
    final u = unitSuffix(unit);
    return chartCard(title, description, wide: true, [
      centeredColumns(bars.length, [
        if (range)
          _rangeRows(max ?? highs.reduce(math.max), lows.reduce(math.min), u)
        else
          ...barRows(
            [
              for (final b in bars)
                (
                  label: barLabel(b.start, barUnit),
                  value: b.value,
                  tooltip: '${barTitle(b.start, barUnit)}: ${b.value == null ? 'no value' : '${format(b.value!)}$u'}',
                ),
            ],
            label: title,
            max: max ?? highs.reduce(math.max),
            format: format,
            showValues: bars.length <= _valueBars,
          ),
        chartLabels([for (final (i, b) in bars.indexed) barLabel(b.start, barUnit, first: i == 0)]),
      ]),
    ]);
  }

  /// One bar from the lowest to the highest value for each of [bars], and the average as a dot.
  Component _rangeRows(num hi, num lo, String u) {
    const h = 50.0;
    final w = bars.length * 10.0;
    double y(num v) => linearY(v, lo, hi, h, padding: 2);
    return chartSvg(w, h, label: title, [
      for (final (i, b) in bars.indexed)
        if ((b.low, b.high, b.value) case (final low?, final high?, final avg?)) ...[
          // A stroke, not a rect: the chart stretches to the card width, and a stroke keeps its round ends.
          path(
            d: 'M${i * 10 + 5} ${y(high)} V${math.max(y(high) + 0.5, y(low))}',
            styles: const Styles(
              raw: {
                'fill': 'none',
                'stroke': emptyColor,
                'stroke-width': '10',
                'stroke-linecap': 'round',
                'vector-effect': 'non-scaling-stroke',
              },
            ),
            [svgTooltip('${barTitle(b.start, barUnit)}: ${formatNumber(low, 2)} to ${formatNumber(high, 2)}$u')],
          ),
          path(
            d: 'M${i * 10 + 5} ${y(avg)} h0',
            styles: chartDotStyle(chartPrimary),
            [svgTooltip('${barTitle(b.start, barUnit)}: average ${formatNumber(avg, 2)}$u')],
          ),
        ],
    ]);
  }
}
