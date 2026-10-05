import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import 'charts/chart_parts.dart';

/// Key numbers in tiles of 2 columns.
class KeyNumbers extends StatelessComponent {
  const KeyNumbers({required this.items, super.key});

  /// Pairs of label and value.
  final List<(String, String)> items;

  @override
  Component build(BuildContext context) => div(
    styles: const Styles(
      raw: {'display': 'grid', 'grid-template-columns': 'repeat(auto-fit, minmax(9rem, 1fr))', 'gap': '0.5rem'},
    ),
    [
      for (final (label, value) in items)
        div(
          styles: const Styles(
            raw: {
              'padding': '0.6rem 0.75rem',
              'border-radius': '0.75rem',
              'background-color': 'var(--surface-container)',
            },
          ),
          [
            div(
              styles: const Styles(raw: {'font-size': '1.25rem', 'font-weight': '500', 'color': 'var(--primary)'}),
              [.text(value)],
            ),
            small(styles: chartTextStyle, [.text(label)]),
          ],
        ),
    ],
  );
}
