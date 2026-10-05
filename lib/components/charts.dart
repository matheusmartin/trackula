import 'dart:math' as math;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

import '../model/chart.dart';
import '../model/date_format.dart';
import '../model/day.dart';
import '../model/format.dart';
import '../model/zoom.dart';
import '../services/pointer.dart';

// Charts of the metric detail screen. Inline styles, not @css rules, as in trend_chart.dart: the charts must
// render correctly even when the browser has an old main.css. Colors come from the theme variables.

const _primary = 'var(--primary)';
const _filled = 'color-mix(in srgb, var(--primary) 70%, var(--surface-container-highest))';
const _empty = 'var(--surface-container-highest)';
const _second = 'var(--tertiary)';

const _textStyle = Styles(raw: {'font-size': '0.7rem', 'line-height': '1.2', 'color': 'var(--on-surface-variant)'});

/// A chart card: a title, a one-sentence description, the chart, and labels below it. A [wide] card takes the full
/// width of the chart grid on wide screens. See .chart-wide in theme.dart. [actions] go on the right of the title.
Component _card(
  String title,
  String description,
  List<Component> children, {
  bool wide = false,
  List<Component> actions = const [],
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
      ...actions,
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

/// A chart card with no chart.
Component _noValues(String title, String description) => _card(title, description, [
  small(styles: _textStyle, [.text('No values in this period.')]),
]);

Component _tooltip(String text) => Component.element(tag: 'title', children: [.text(text)]);

Component _svg(double w, double h, List<Component> children, {String height = '6rem', String? label}) => svg(
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
Component _labels(List<String> labels, {bool all = false}) {
  final few = all || labels.length <= 12;
  return div(
    styles: Styles(
      raw: few
          ? {'display': 'grid', 'grid-template-columns': 'repeat(${labels.length}, 1fr)', 'text-align': 'center'}
          : {'display': 'flex', 'justify-content': 'space-between'},
    ),
    [
      for (final l in few ? labels : [labels.first, labels.last]) small(styles: _textStyle, [.text(l)]),
    ],
  );
}

/// [children] at most [columns] × [_maxColumnWidth] wide, centered. They never scroll.
Component _centered(int columns, List<Component> children) => div(
  styles: Styles(raw: {'max-width': '${columns * _maxColumnWidth}rem', 'margin-inline': 'auto'}),
  children,
);

/// [children] at most [columns] × [_maxColumnWidth] wide, centered. With more than [_scrollBars] columns, also at
/// least [columns] × [_columnWidth] wide. If that is wider than the card, the chart scrolls to the side: with a
/// finger, a trackpad, or the mouse wheel. It starts at the right end, with the newest bars.
Component _scroller(int columns, List<Component> children) => columns <= _scrollBars
    ? div(styles: Styles(raw: {'max-width': '${columns * _maxColumnWidth}rem', 'margin-inline': 'auto'}), children)
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

/// A vertical mouse wheel scrolls a [_scroller] to the side. At an end, the page scrolls as usual.
void _wheelToSide(web.Event e) {
  final w = e as web.WheelEvent;
  // Trackpads also send side moves, and the browser scrolls those itself.
  if (!isVerticalWheel(w)) return;
  final box = w.currentTarget as web.Element;
  final before = box.scrollLeft;
  box.scrollLeft = before + wheelPixels(w, w.deltaY, 16);
  if (box.scrollLeft != before) w.preventDefault();
}

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
            small(styles: _textStyle, [.text(label)]),
          ],
        ),
    ],
  );
}

/// One bar of a [BarChart]. A null value draws no bar.
typedef Bar = ({String label, num? value, String tooltip});

/// Bars from 0 to the highest value. With [signed], negative bars go down from a middle line.
class BarChart extends StatelessComponent {
  const BarChart({
    required this.title,
    required this.description,
    required this.bars,
    this.signed = false,
    this.fromLowest = false,
    this.max,
    this.format = formatNumber,
    this.wide = false,
    super.key,
  });

  final String title;
  final String description;
  final List<Bar> bars;
  final bool signed;

  /// Bars start a little below the lowest value, not at 0. For values that differ little, for example monthly
  /// averages of a weight.
  final bool fromLowest;

  /// A fixed top of the scale, for example 100 for percentages. Null: the highest value.
  final num? max;

  /// The text of the value above each bar. Example: `(v) => '${v.round()}%'`.
  final String Function(num v) format;

  /// The full width of the chart grid on wide screens. For bars over time, so that the layout stays the same for
  /// all periods.
  final bool wide;

  @override
  Component build(BuildContext context) => _card(title, description, [
    _scroller(bars.length, [
      ..._barRows(bars, label: title, signed: signed, fromLowest: fromLowest, max: max, format: format),
      _labels([for (final b in bars) b.label], all: true),
    ]),
  ], wide: wide);
}

/// The value row and the bars of a bar chart, without labels. [max] and [min] fix the scale, for example to the
/// highest and lowest value of all bars of a zoom chart, so that the scale stays the same while it moves.
List<Component> _barRows(
  List<Bar> bars, {
  required String label,
  bool signed = false,
  bool fromLowest = false,
  num? max,
  num? min,
  String Function(num v) format = formatNumber,
  bool showValues = true,
}) {
  final values = [for (final b in bars) ?b.value];
  final top = max ?? (values.isEmpty ? 1 : values.map((v) => v.abs()).fold<num>(0, math.max));
  final lowest = min ?? (values.isEmpty ? 0 : values.reduce(math.min));
  final floor = fromLowest && values.isNotEmpty ? barFloor(lowest, top) : 0;
  final scale = top - floor == 0 ? 1 : top - floor;
  const h = 50.0;
  final base = signed ? h / 2 : h;
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
            small(styles: _textStyle.combine(const Styles(raw: {'color': 'var(--on-surface)'})), [
              .text(switch (b.value) {
                null => '',
                final v => '${signed && v > 0 ? '+' : ''}${format(v).replaceFirst('-', '−')}',
              }),
            ]),
        ],
      ),
    _svg(w, h, label: label, [
      if (signed)
        line(
          x1: '0',
          y1: '$base',
          x2: '$w',
          y2: '$base',
          styles: const Styles(raw: {'stroke': 'var(--outline)'}),
          [],
        ),
      for (final (i, b) in bars.indexed)
        if (b.value case final v?)
          rect(
            x: '${i * 10 + 1.5}',
            y: '${v >= 0 ? base - (v - floor) / scale * (signed ? h / 2 : h) : base}',
            width: '7',
            height: '${math.max(0.4, (v.abs() - floor) / scale * (signed ? h / 2 : h))}',
            styles: Styles(raw: {'fill': v >= 0 ? _filled : _second}),
            [_tooltip(b.tooltip)],
          ),
    ]),
  ];
}

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
    if (all.isEmpty) return _noValues(title, description);
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
    return _card(title, description, [
      div(styles: const Styles(raw: {'display': 'grid', 'grid-template-columns': 'auto 1fr', 'column-gap': '0.4rem'}), [
        div(
          styles: const Styles(
            raw: {
              'display': 'flex',
              'flex-direction': 'column',
              'justify-content': 'space-between',
              'text-align': 'right',
            },
          ),
          [
            small(styles: _textStyle, [.text(formatNumber(hi, decimals))]),
            if (hi != lo) small(styles: _textStyle, [.text(formatNumber(lo, decimals))]),
          ],
        ),
        _svg(w, h, label: title, [
          path(
            d: pathOf(trend ?? values),
            styles: const Styles(
              raw: {
                'fill': 'none',
                'stroke': _primary,
                'stroke-width': '2',
                'stroke-linejoin': 'round',
                'vector-effect': 'non-scaling-stroke',
              },
            ),
            [],
          ),
          for (final (i, v) in values.indexed)
            if (dots && v != null)
              path(
                d: 'M${x(i)} ${y(v)} h0',
                styles: Styles(
                  raw: {
                    'fill': 'none',
                    'stroke': trend == null ? _primary : _filled,
                    'stroke-width': values.length > 60 ? '3' : '5',
                    'stroke-linecap': 'round',
                    'vector-effect': 'non-scaling-stroke',
                  },
                ),
                [_tooltip('${shortDay(days[i])}: ${formatNumber(v, decimals)}$u')],
              ),
        ]),
        span([]),
        div(styles: const Styles(raw: {'display': 'flex', 'justify-content': 'space-between'}), [
          small(styles: _textStyle, [.text(shortDay(days.first))]),
          small(styles: _textStyle, [.text(shortDay(days.last))]),
        ]),
      ]),
    ], wide: true);
  }
}

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

  static const yesColor = _filled;
  static const noColor = _second;
  static const noneColor = _empty;

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
          [_tooltip('${p.label}: ${p.value}')],
        ),
      );
      a = a2;
    }
    return _card(title, description, [
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

/// Bars over time: one bar for each week, month or quarter of the time window. See [ZoomWindow].
///
/// - [min] and [max] fix the scale, for example to all bars of rates and sums, so that the scale does not change
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
    this.min,
    this.max,
    this.fromLowest = false,
    this.range = false,
    this.unit,
    super.key,
  });

  /// Up to this number of bars, the values show above the bars.
  static const _valueBars = 13;

  final String title;
  final String description;

  /// The bars in view, oldest first.
  final List<ZoomBar> bars;
  final BarUnit barUnit;

  /// The text of the value above a bar and in its tooltip.
  final String Function(num v) format;
  final num? min;
  final num? max;
  final bool fromLowest;
  final bool range;

  /// The unit of the values in the tooltips, for example `Kg`. Not above the bars: there is no space.
  final String? unit;

  @override
  Component build(BuildContext context) {
    final lows = [for (final b in bars) ?(range ? b.low : b.value)];
    final highs = [for (final b in bars) ?(range ? b.high : b.value)];
    if (highs.isEmpty) return _noValues(title, description);
    final u = unitSuffix(unit);
    return _card(title, description, wide: true, [
      _centered(bars.length, [
        if (range)
          _rangeRows(max ?? highs.reduce(math.max), min ?? lows.reduce(math.min), u)
        else
          ..._barRows(
            [
              for (final b in bars)
                (
                  label: barLabel(b.start, barUnit),
                  value: b.value,
                  tooltip: '${barTitle(b.start, barUnit)}: ${b.value == null ? 'no value' : '${format(b.value!)}$u'}',
                ),
            ],
            label: title,
            fromLowest: fromLowest,
            max: max ?? highs.reduce(math.max),
            min: min ?? lows.reduce(math.min),
            format: format,
            showValues: bars.length <= _valueBars,
          ),
        _labels([for (final (i, b) in bars.indexed) barLabel(b.start, barUnit, first: i == 0)]),
      ]),
    ]);
  }

  /// One bar from the lowest to the highest value for each of [bars], and the average as a dot.
  Component _rangeRows(num hi, num lo, String u) {
    const h = 50.0;
    final w = bars.length * 10.0;
    double y(num v) => linearY(v, lo, hi, h, padding: 2);
    return _svg(w, h, label: title, [
      for (final (i, b) in bars.indexed)
        if ((b.low, b.high, b.value) case (final low?, final high?, final avg?)) ...[
          // A stroke, not a rect: the chart stretches to the card width, and a stroke keeps its round ends.
          path(
            d: 'M${i * 10 + 5} ${y(high)} V${math.max(y(high) + 0.5, y(low))}',
            styles: const Styles(
              raw: {
                'fill': 'none',
                'stroke': _empty,
                'stroke-width': '10',
                'stroke-linecap': 'round',
                'vector-effect': 'non-scaling-stroke',
              },
            ),
            [_tooltip('${barTitle(b.start, barUnit)}: ${formatNumber(low, 2)} to ${formatNumber(high, 2)}$u')],
          ),
          path(
            d: 'M${i * 10 + 5} ${y(avg)} h0',
            styles: const Styles(
              raw: {
                'fill': 'none',
                'stroke': _primary,
                'stroke-width': '5',
                'stroke-linecap': 'round',
                'vector-effect': 'non-scaling-stroke',
              },
            ),
            [_tooltip('${barTitle(b.start, barUnit)}: average ${formatNumber(avg, 2)}$u')],
          ),
        ],
    ]);
  }
}

/// A small chart of all data in weeks, with a box on the days from [from] to [to]. A tap or a drag calls [onPoint]
/// with the day under the pointer.
class Overview extends StatefulComponent {
  const Overview({
    required this.weeks,
    required this.fromZero,
    required this.from,
    required this.to,
    required this.onPoint,
    super.key,
  });

  /// One bar for each week of all data, oldest first.
  final List<ZoomBar> weeks;

  /// Bars start at 0, for rates and sums. Else a little below the lowest week, so that changes show.
  final bool fromZero;
  final Day from;
  final Day to;
  final void Function(Day day) onPoint;

  @override
  State<Overview> createState() => _OverviewState();
}

class _OverviewState extends State<Overview> {
  bool _drag = false;

  void _point(web.PointerEvent p) {
    final c = component;
    final rect = (p.currentTarget as web.Element).getBoundingClientRect();
    final f = ((p.pageX - web.window.scrollX - rect.left) / rect.width).clamp(0.0, 1.0);
    final first = c.weeks.first.start, last = c.weeks.last.start.addDays(6);
    c.onPoint(first.addDays((f * (last.serial - first.serial)).round()));
  }

  @override
  Component build(BuildContext context) {
    final c = component;
    final values = [for (final b in c.weeks) ?b.value];
    final hi = values.isEmpty ? 1 : values.reduce(math.max);
    final lo = c.fromZero || values.isEmpty ? 0 : barFloor(values.reduce(math.min), hi);
    const h = 30.0;
    final w = c.weeks.length * 10.0;
    double x(Day d) => (d.serial - c.weeks.first.start.serial) / 7 * 10;
    double bar(num v) => math.max(0.5, (v - lo) / (hi - lo == 0 ? 1 : hi - lo) * h);
    return div(
      styles: const Styles(raw: {'touch-action': 'none', 'cursor': 'pointer', 'user-select': 'none'}),
      events: {
        'pointerdown': (e) {
          final p = e as web.PointerEvent;
          capturePointer(p);
          _drag = true;
          _point(p);
        },
        'pointermove': (e) {
          if (_drag) _point(e as web.PointerEvent);
        },
        'pointerup': (_) => _drag = false,
        'pointercancel': (_) => _drag = false,
      },
      [
        _svg(w, h + 2, height: '2rem', label: 'All data', [
          for (final (i, b) in c.weeks.indexed)
            if (b.value case final v?)
              rect(
                x: '${i * 10 + 1}',
                y: '${h + 1 - bar(v)}',
                width: '8',
                height: '${bar(v)}',
                styles: Styles(
                  raw: {
                    'fill': b.start.addDays(6).compareTo(c.from) >= 0 && b.start.compareTo(c.to) <= 0
                        ? _filled
                        : 'var(--outline-variant)',
                  },
                ),
                [],
              ),
          rect(
            x: '${x(c.from)}',
            y: '0.5',
            width: '${math.max(4.0, x(c.to.addDays(1)) - x(c.from))}',
            height: '${h + 1}',
            styles: const Styles(
              raw: {'fill': 'none', 'stroke': _primary, 'stroke-width': '1.5', 'vector-effect': 'non-scaling-stroke'},
            ),
            [],
          ),
        ]),
      ],
    );
  }
}

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
      return _card(title, description, wide: true, [
        small(styles: _textStyle, [.text('Zoom in to 1 year or less to see single days.')]),
      ]);
    }
    return _card(title, description, wide: true, [_grid()]);
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
                'fill': filled(d) ? _filled : _empty,
                'cursor': 'pointer',
                if (d == today) 'stroke': 'var(--on-surface)',
                if (d == today) 'stroke-width': '1',
              },
            ),
            events: {'click': (_) => onDay(d)},
            [_tooltip('$d')],
          ),
      ],
    );
  }
}
