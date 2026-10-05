import 'dart:math' as math;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../../constants/tokens.dart';
import '../../model/format.dart';
import 'chart_parts.dart';

/// One bar of a [BarChart]. A null value draws no bar.
typedef Bar = ({String label, num? value, String tooltip});

/// Bars from 0 to the highest value.
class BarChart extends StatelessComponent {
  const BarChart({
    required this.title,
    required this.description,
    required this.bars,
    this.max,
    this.format = formatNumber,
    this.wide = false,
    super.key,
  });

  final String title;
  final String description;
  final List<Bar> bars;

  /// A fixed top of the scale, for example 100 for percentages. Null: the highest value.
  final num? max;

  /// The text of the value above each bar. Example: `(v) => '${v.round()}%'`.
  final String Function(num v) format;

  /// The full width of the chart grid on wide screens. For bars over time, so that the layout stays the same for
  /// all periods.
  final bool wide;

  @override
  Component build(BuildContext context) => chartCard(title, description, [
    scrollColumns(bars.length, [
      ...barRows(bars, label: title, max: max, format: format),
      chartLabels([for (final b in bars) b.label], all: true),
    ]),
  ], wide: wide);
}

/// The value row and the bars of a bar chart, without labels. [max] fixes the top of the scale, for example to the
/// highest value of all bars of a zoom chart, so that the scale stays the same while it moves.
List<Component> barRows(
  List<Bar> bars, {
  required String label,
  num? max,
  String Function(num v) format = formatNumber,
  bool showValues = true,
}) {
  final values = [for (final b in bars) ?b.value];
  final top = max ?? (values.isEmpty ? 1 : values.map((v) => v.abs()).fold<num>(0, math.max));
  final scale = top == 0 ? 1 : top;
  const h = 50.0;
  final w = bars.length * 10.0;
  return [
    if (showValues)
      div(
        // Many values on a phone: smaller text. See .bar-values in theme.dart.
        classes: bars.length > 8 ? 'bar-values dense' : 'bar-values',
        styles: Styles(
          raw: {
            'display': 'grid',
            'grid-template-columns': 'repeat(${bars.length}, 1fr)',
            'text-align': 'center',
            'margin-bottom': '0.2rem',
          },
        ),
        [
          for (final b in bars)
            small(styles: chartTextStyle.combine(const Styles(raw: {'color': 'var(--on-surface)'})), [
              .text(switch (b.value) {
                null => '',
                final v => format(v).replaceFirst('-', '−'),
              }),
            ]),
        ],
      ),
    chartSvg(w, h, label: label, [
      for (final (i, b) in bars.indexed)
        if (b.value case final v?)
          rect(
            x: '${i * 10 + 1.5}',
            y: '${v >= 0 ? h - v / scale * h : h}',
            width: '7',
            height: '${math.max(0.4, v.abs() / scale * h)}',
            styles: Styles(raw: {'fill': v >= 0 ? filledColor : chartSecond}),
            [svgTooltip(b.tooltip)],
          ),
    ]),
  ];
}
