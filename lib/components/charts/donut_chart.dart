import 'dart:math' as math;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../../constants/tokens.dart';
import '../../model/format.dart';
import 'chart_parts.dart';

/// One part of a [DonutChart].
typedef DonutPart = ({String label, int value, String color});

/// A ring with one arc per part, the [center] text in the middle, and a legend with totals and percentages.
class DonutChart extends StatelessComponent {
  const DonutChart({
    required this.title,
    required this.description,
    required this.parts,
    required this.center,
    super.key,
  });

  final String title;
  final String description;
  final List<DonutPart> parts;
  final String center;

  static const yesColor = filledColor;
  static const noColor = chartSecond;
  static const noneColor = emptyColor;

  @override
  Component build(BuildContext context) {
    final total = parts.fold(0, (t, part) => t + part.value);
    const r = 40.0, c = 50.0;
    var a = -math.pi / 2;
    final arcs = <Component>[];
    for (final p in parts) {
      if (p.value == 0 || total == 0) continue;
      final a2 = a + p.value / total * 2 * math.pi;
      final full = p.value == total;
      final d = full
          ? 'M$c ${c - r} A$r $r 0 1 1 ${c - 0.01} ${c - r}'
          : 'M${c + r * math.cos(a)} ${c + r * math.sin(a)} '
                'A$r $r 0 ${a2 - a > math.pi ? 1 : 0} 1 ${c + r * math.cos(a2)} ${c + r * math.sin(a2)}';
      arcs.add(
        path(
          d: d,
          styles: Styles(raw: {'fill': 'none', 'stroke': p.color, 'stroke-width': '16'}),
          [svgTooltip('${p.label}: ${p.value}')],
        ),
      );
      a = a2;
    }
    return chartCard(title, description, [
      div(styles: const Styles(raw: {'display': 'flex', 'align-items': 'center', 'gap': '1rem'}), [
        div(styles: const Styles(raw: {'position': 'relative', 'width': '6.5rem', 'flex': 'none'}), [
          svg(
            viewBox: '0 0 100 100',
            styles: const Styles(raw: {'display': 'block', 'width': '100%'}),
            arcs,
          ),
          div(
            styles: const Styles(
              raw: {
                'position': 'absolute',
                'inset': '0',
                'display': 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                'font-size': '1.1rem',
                'font-weight': '500',
                'color': 'var(--primary)',
              },
            ),
            [.text(center)],
          ),
        ]),
        div(styles: const Styles(raw: {'display': 'grid', 'gap': '0.35rem', 'font-size': '0.8rem'}), [
          for (final p in parts)
            div(styles: const Styles(raw: {'display': 'flex', 'align-items': 'center', 'gap': '0.4rem'}), [
              span(
                styles: Styles(
                  raw: {'width': '0.7rem', 'height': '0.7rem', 'border-radius': '3px', 'background-color': p.color},
                ),
                [],
              ),
              span([.text('${p.label}: ${p.value} · ${formatPercent(total == 0 ? 0 : p.value / total)}')]),
            ]),
        ]),
      ]),
    ]);
  }
}
