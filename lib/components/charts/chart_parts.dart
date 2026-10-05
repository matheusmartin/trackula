/// Shared parts of the charts: the card, the SVG box, the labels and the scroll box.
///
/// Inline styles, not @css rules: the charts must render correctly even when the browser has an old main.css.
/// Colors come from the theme variables.
library;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

import '../../services/pointer.dart';

/// The color of lines, dots and the window box.
const chartPrimary = 'var(--primary)';

/// The color of negative bars and of "no" days.
const chartSecond = 'var(--tertiary)';

/// Small text: axis labels, bar labels and notes.
const chartTextStyle = Styles(raw: {'font-size': '0.7rem', 'line-height': '1.2', 'color': 'var(--on-surface-variant)'});

/// The line of a line chart. The SVG stretches, so the stroke does not scale.
const chartLineStyle = Styles(
  raw: {
    'fill': 'none',
    'stroke': chartPrimary,
    'stroke-width': '2',
    'stroke-linejoin': 'round',
    'vector-effect': 'non-scaling-stroke',
  },
);

/// A dot of a line chart: a zero-length path with a round cap is a round dot of [size] pixels.
Styles chartDotStyle(String color, {int size = 5}) => Styles(
  raw: {
    'fill': 'none',
    'stroke': color,
    'stroke-width': '$size',
    'stroke-linecap': 'round',
    'vector-effect': 'non-scaling-stroke',
  },
);

/// A chart card: a title, a one-sentence description, the chart, and labels below it. A [wide] card takes the full
/// width of the chart grid on wide screens. See .chart-wide in theme.dart.
Component chartCard(
  String title,
  String description,
  List<Component> children, {
  bool wide = false,
}) => div(
  classes: wide ? 'chart-wide' : null,
  styles: const Styles(
    raw: {
      'padding': '0.75rem',
      'border-radius': '0.75rem',
      'background-color': 'var(--surface-container)',
      'min-width': '0',
    },
  ),
  [
    div(styles: const Styles(raw: {'display': 'flex', 'align-items': 'center', 'gap': '0.25rem'}), [
      div(styles: const Styles(raw: {'font-size': '0.85rem', 'flex': '1'}), [.text(title)]),
    ]),
    div(
      styles: const Styles(
        raw: {
          'font-size': '0.7rem',
          'line-height': '1.3',
          'color': 'var(--on-surface-variant)',
          'margin': '0.15rem 0 0.5rem',
        },
      ),
      [.text(description)],
    ),
    ...children,
  ],
);

/// [chart] with the [high] and [low] values on the left, and the [first] and [last] day below. A null [low]: one
/// label only, for example when all values are equal.
Component chartWithAxes(
  Component chart, {
  required String high,
  String? low,
  required String first,
  required String last,
  String? marginTop,
}) => div(
  styles: Styles(
    raw: {
      'display': 'grid',
      'grid-template-columns': 'auto 1fr',
      'column-gap': '0.4rem',
      'margin-top': ?marginTop,
    },
  ),
  [
    div(
      styles: const Styles(
        raw: {'display': 'flex', 'flex-direction': 'column', 'justify-content': 'space-between', 'text-align': 'right'},
      ),
      [
        small(styles: chartTextStyle, [.text(high)]),
        if (low != null) small(styles: chartTextStyle, [.text(low)]),
      ],
    ),
    chart,
    span([]),
    div(styles: const Styles(raw: {'display': 'flex', 'justify-content': 'space-between'}), [
      small(styles: chartTextStyle, [.text(first)]),
      small(styles: chartTextStyle, [.text(last)]),
    ]),
  ],
);

/// A chart card with no chart.
Component noValuesCard(String title, String description) => chartCard(title, description, [
  small(styles: chartTextStyle, [.text('No values in this period.')]),
]);

/// A tooltip of an SVG element: a `<title>` child.
Component svgTooltip(String text) => Component.element(tag: 'title', children: [.text(text)]);

/// An SVG box of [w] × [h] chart units that stretches to the card width, [height] high. [label] is for screen
/// readers. Strokes with `non-scaling-stroke` keep their width.
Component chartSvg(double w, double h, List<Component> children, {String height = '6rem', String? label}) => svg(
  viewBox: '0 0 $w $h',
  styles: Styles(raw: {'display': 'block', 'width': '100%', 'height': height, 'overflow': 'visible'}),
  attributes: {'preserveAspectRatio': 'none', 'role': 'img', 'aria-label': ?label},
  children,
);

/// A chart with more bars than this can scroll to the side. With fewer, the bars always fit in the card, so that
/// charts with fixed groups, such as weekdays, never scroll.
const _scrollBars = 12;

/// The smallest width of one bar column in a chart that scrolls.
const _columnWidth = 2.6;

/// The largest width of one bar column. A wide card with few bars shows them centered, not stretched.
const _maxColumnWidth = 3.5;

/// Labels under a chart: all labels in equal columns if there are few or [all], else the first and the last.
Component chartLabels(List<String> labels, {bool all = false}) {
  final few = all || labels.length <= _scrollBars;
  return div(
    styles: Styles(
      raw: few
          ? {'display': 'grid', 'grid-template-columns': 'repeat(${labels.length}, 1fr)', 'text-align': 'center'}
          : {'display': 'flex', 'justify-content': 'space-between'},
    ),
    [
      for (final l in few ? labels : [labels.first, labels.last]) small(styles: chartTextStyle, [.text(l)]),
    ],
  );
}

/// [children] at most [columns] × [_maxColumnWidth] wide, centered. They never scroll.
Component centeredColumns(int columns, List<Component> children) => div(
  styles: Styles(raw: {'max-width': '${columns * _maxColumnWidth}rem', 'margin-inline': 'auto'}),
  children,
);

/// [children] at most [columns] × [_maxColumnWidth] wide, centered. With more than [_scrollBars] columns, also at
/// least [columns] × [_columnWidth] wide. If that is wider than the card, the chart scrolls to the side: with a
/// finger, a trackpad, or the mouse wheel. It starts at the right end, with the newest bars.
Component scrollColumns(int columns, List<Component> children) => columns <= _scrollBars
    ? centeredColumns(columns, children)
    : div(
        styles: const Styles(
          raw: {
            'display': 'flex',
            // row-reverse: the browser shows the right end first.
            'flex-direction': 'row-reverse',
            'overflow-x': 'auto',
            'overscroll-behavior-x': 'contain',
            'scrollbar-width': 'thin',
            // Room for the scrollbar below the labels.
            'padding-bottom': '0.5rem',
          },
        ),
        events: {'wheel': _wheelToSide},
        [
          div(
            styles: Styles(
              raw: {
                'flex': 'none',
                'width': 'max(min(100%, ${columns * _maxColumnWidth}rem), ${columns * _columnWidth}rem)',
                // Centered while it fits. While it scrolls, auto margins are 0.
                'margin-inline': 'auto',
              },
            ),
            children,
          ),
        ],
      );

/// A vertical mouse wheel scrolls a [scrollColumns] to the side. At an end, the page scrolls as usual.
void _wheelToSide(web.Event e) {
  final w = e as web.WheelEvent;
  // Trackpads also send side moves, and the browser scrolls those itself.
  if (!isVerticalWheel(w)) return;
  final box = w.currentTarget as web.Element;
  final before = box.scrollLeft;
  box.scrollLeft = before + wheelPixels(w, w.deltaY, 16);
  if (box.scrollLeft != before) w.preventDefault();
}
