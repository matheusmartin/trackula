import 'dart:math' as math;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

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

/// The height of the bar and line charts, in chart units.
const _chartHeight = 50.0;

/// The width of one bar column, in chart units.
const _columnUnits = 10.0;

/// A line or a dot that keeps its size when the chart stretches. A zero-length path with a round cap draws a dot.
Styles _strokeStyle(String color, String width, {bool round = true}) => Styles(
  raw: {
    'fill': 'none',
    'stroke': color,
    'stroke-width': width,
    if (round) 'stroke-linecap': 'round' else 'stroke-linejoin': 'round',
    'vector-effect': 'non-scaling-stroke',
  },
);

/// A chart card: a title, a one-sentence description, the chart, and labels below it. A [wide] card takes the full
/// width of the chart grid on wide screens. See .chart-wide in theme.dart.
Component _card(String title, String description, List<Component> children, {bool wide = false}) => div(
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
    div(styles: const Styles(raw: {'font-size': '0.85rem'}), [.text(title)]),
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

/// An SVG that stretches to the card width. [width] and [height] are in chart units.
Component _svg(double width, double height, List<Component> children, {String cssHeight = '6rem', String? label}) =>
    svg(
      viewBox: '0 0 $width $height',
      styles: Styles(raw: {'display': 'block', 'width': '100%', 'height': cssHeight, 'overflow': 'visible'}),
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
      for (final label in few ? labels : [labels.first, labels.last]) small(styles: _textStyle, [.text(label)]),
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
    ? _centered(columns, children)
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
void _wheelToSide(web.Event event) {
  final wheel = event as web.WheelEvent;
  // Trackpads also send side moves, and the browser scrolls those itself.
  if (wheel.deltaY.abs() <= wheel.deltaX.abs()) return;
  final box = wheel.currentTarget as web.Element;
  final before = box.scrollLeft;
  box.scrollLeft = before + wheel.deltaY * (wheel.deltaMode == web.WheelEvent.DOM_DELTA_LINE ? 16 : 1);
  if (box.scrollLeft != before) wheel.preventDefault();
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
  Component build(BuildContext context) => _card(title, description, wide: wide, [
    _scroller(bars.length, [
      ..._barRows(bars, label: title, max: max, format: format),
      _labels([for (final b in bars) b.label], all: true),
    ]),
  ]);
}

/// The value row and the bars of a bar chart, without labels. Bars start at 0. [max] fixes the top of the scale, for
/// example to the highest value of all bars of a zoom chart, so that the scale stays the same while it moves.
List<Component> _barRows(
  List<Bar> bars, {
  required String label,
  num? max,
  String Function(num v) format = formatNumber,
  bool showValues = true,
}) {
  final values = [for (final b in bars) ?b.value];
  final top = max ?? (values.isEmpty ? 1 : values.map((v) => v.abs()).fold<num>(0, math.max));
  final scale = top == 0 ? 1 : top;
  double barHeight(num v) => v.abs() / scale * _chartHeight;
  return [
    if (showValues) _valueRow(bars, format),
    _svg(bars.length * _columnUnits, _chartHeight, label: label, [
      for (final (i, b) in bars.indexed)
        if (b.value case final v?)
          rect(
            x: '${i * _columnUnits + 1.5}',
            y: '${v >= 0 ? _chartHeight - barHeight(v) : _chartHeight}',
            width: '7',
            height: '${math.max(0.4, barHeight(v))}',
            styles: Styles(raw: {'fill': v >= 0 ? _filled : _second}),
            [_tooltip(b.tooltip)],
          ),
    ]),
  ];
}

/// The value of each bar, above the bar.
Component _valueRow(List<Bar> bars, String Function(num v) format) => div(
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
        .text(b.value == null ? '' : format(b.value!).replaceFirst('-', '−')),
      ]),
  ],
);

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
    final high = range?.$2 ?? all.reduce(math.max);
    final low = range?.$1 ?? all.reduce(math.min);
    final width = math.max(1, values.length - 1).toDouble();
    double x(int i) => values.length == 1 ? width / 2 : i.toDouble();
    double y(num v) => high == low ? _chartHeight / 2 : 2 + (_chartHeight - 4) * (high - v) / (high - low);
    String pathOf(List<num?> series) => [
      for (final (i, v) in series.indexed)
        if (v != null) '${i == series.indexWhere((e) => e != null) ? 'M' : 'L'}${x(i)} ${y(v)}',
    ].join(' ');
    final unitSuffix = unit == null ? '' : ' $unit';
    final dotStyle = _strokeStyle(trend == null ? _primary : _filled, values.length > 60 ? '3' : '5');
    return _card(title, description, wide: true, [
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
            small(styles: _textStyle, [.text(formatNumber(high, decimals))]),
            if (high != low) small(styles: _textStyle, [.text(formatNumber(low, decimals))]),
          ],
        ),
        _svg(width, _chartHeight, label: title, [
          path(d: pathOf(trend ?? values), styles: _strokeStyle(_primary, '2', round: false), []),
          for (final (i, v) in values.indexed)
            if (dots && v != null)
              path(d: 'M${x(i)} ${y(v)} h0', styles: dotStyle, [
                _tooltip('${shortDay(days[i])}: ${formatNumber(v, decimals)}$unitSuffix'),
              ]),
        ]),
        span([]),
        div(styles: const Styles(raw: {'display': 'flex', 'justify-content': 'space-between'}), [
          small(styles: _textStyle, [.text(shortDay(days.first))]),
          small(styles: _textStyle, [.text(shortDay(days.last))]),
        ]),
      ]),
    ]);
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

  /// The radius of the ring and the middle of the chart, in chart units.
  static const _radius = 40.0, _middle = 50.0;

  int get _total => parts.fold(0, (total, part) => total + part.value);

  @override
  Component build(BuildContext context) => _card(title, description, [
    div(styles: const Styles(raw: {'display': 'flex', 'align-items': 'center', 'gap': '1rem'}), [
      div(styles: const Styles(raw: {'position': 'relative', 'width': '6.5rem', 'flex': 'none'}), [
        svg(
          viewBox: '0 0 100 100',
          styles: const Styles(raw: {'display': 'block', 'width': '100%'}),
          _arcs(),
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
      _legend(),
    ]),
  ]);

  /// One arc for each part with a value, clockwise from the top.
  List<Component> _arcs() {
    final total = _total;
    var start = -math.pi / 2;
    final arcs = <Component>[];
    for (final part in parts) {
      if (part.value == 0 || total == 0) continue;
      final end = start + part.value / total * 2 * math.pi;
      arcs.add(
        path(
          d: part.value == total ? _ringPath() : _arcPath(start, end),
          styles: Styles(raw: {'fill': 'none', 'stroke': part.color, 'stroke-width': '16'}),
          [_tooltip('${part.label}: ${part.value}')],
        ),
      );
      start = end;
    }
    return arcs;
  }

  /// A full ring. An SVG arc cannot end where it starts, so it ends a little before.
  static String _ringPath() =>
      'M$_middle ${_middle - _radius} A$_radius $_radius 0 1 1 ${_middle - 0.01} ${_middle - _radius}';

  /// An arc from the angle [start] to the angle [end], in radians.
  static String _arcPath(double start, double end) =>
      'M${_middle + _radius * math.cos(start)} ${_middle + _radius * math.sin(start)} '
      'A$_radius $_radius 0 ${end - start > math.pi ? 1 : 0} 1 '
      '${_middle + _radius * math.cos(end)} ${_middle + _radius * math.sin(end)}';

  /// The color, the label, the value and the percentage of each part.
  Component _legend() {
    final total = _total;
    return div(styles: const Styles(raw: {'display': 'grid', 'gap': '0.35rem', 'font-size': '0.8rem'}), [
      for (final part in parts)
        div(styles: const Styles(raw: {'display': 'flex', 'align-items': 'center', 'gap': '0.4rem'}), [
          span(
            styles: Styles(
              raw: {'width': '0.7rem', 'height': '0.7rem', 'border-radius': '3px', 'background-color': part.color},
            ),
            [],
          ),
          span([.text('${part.label}: ${part.value} · ${total == 0 ? 0 : (part.value / total * 100).round()}%')]),
        ]),
    ]);
  }
}

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

  /// Up to this number of bars, the values show above the bars.
  static const _maxBarsWithValues = 13;

  final String title;
  final String description;

  /// The bars in view, oldest first.
  final List<ZoomBar> bars;
  final BarUnit barUnit;

  /// The text of the value above a bar and in its tooltip.
  final String Function(num v) format;
  final num? max;
  final bool range;

  /// The unit of the values in the tooltips, for example `kg`. Not above the bars: there is no space.
  final String? unit;

  String get _unitSuffix => unit == null ? '' : ' $unit';

  @override
  Component build(BuildContext context) {
    final lows = [for (final b in bars) ?(range ? b.low : b.value)];
    final highs = [for (final b in bars) ?(range ? b.high : b.value)];
    if (highs.isEmpty) return _noValues(title, description);
    final high = max ?? highs.reduce(math.max);
    final low = lows.reduce(math.min);
    return _card(title, description, wide: true, [
      _centered(bars.length, [
        if (range) _rangeBars(high, low) else ..._barsFromZero(high),
        _labels([for (final (i, b) in bars.indexed) _barLabel(b.start, barUnit, first: i == 0)]),
      ]),
    ]);
  }

  /// One bar from 0 to the value for each of [bars].
  List<Component> _barsFromZero(num high) => _barRows(
    [
      for (final b in bars)
        (
          label: _barLabel(b.start, barUnit),
          value: b.value,
          tooltip:
              '${_barTitle(b.start, barUnit)}: ${b.value == null ? 'no value' : '${format(b.value!)}$_unitSuffix'}',
        ),
    ],
    label: title,
    max: high,
    format: format,
    showValues: bars.length <= _maxBarsWithValues,
  );

  /// One bar from the lowest to the highest value for each of [bars], and the average as a dot.
  Component _rangeBars(num high, num low) {
    double y(num v) => high == low ? _chartHeight / 2 : 2 + (_chartHeight - 4) * (high - v) / (high - low);
    return _svg(bars.length * _columnUnits, _chartHeight, label: title, [
      for (final (i, b) in bars.indexed)
        if ((b.low, b.high, b.value) case (final barLow?, final barHigh?, final average?)) ...[
          // A stroke, not a rect: the chart stretches to the card width, and a stroke keeps its round ends.
          path(
            d: 'M${i * _columnUnits + 5} ${y(barHigh)} V${math.max(y(barHigh) + 0.5, y(barLow))}',
            styles: _strokeStyle(_empty, '10'),
            [
              _tooltip(
                '${_barTitle(b.start, barUnit)}: ${formatNumber(barLow, 2)} to ${formatNumber(barHigh, 2)}$_unitSuffix',
              ),
            ],
          ),
          path(d: 'M${i * _columnUnits + 5} ${y(average)} h0', styles: _strokeStyle(_primary, '5'), [
            _tooltip('${_barTitle(b.start, barUnit)}: average ${formatNumber(average, 2)}$_unitSuffix'),
          ]),
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
  /// The height of the bars, in chart units.
  static const _height = 30.0;

  bool _drag = false;

  List<ZoomBar> get _weeks => component.weeks;

  /// Calls [Overview.onPoint] with the day under [pointer].
  void _point(web.PointerEvent pointer) {
    final rect = (pointer.currentTarget as web.Element).getBoundingClientRect();
    final fraction = ((pointer.pageX - web.window.scrollX - rect.left) / rect.width).clamp(0.0, 1.0);
    final first = _weeks.first.start;
    final last = _weeks.last.start.addDays(6);
    component.onPoint(first.addDays((fraction * (last.serial - first.serial)).round()));
  }

  @override
  Component build(BuildContext context) {
    final values = [for (final b in _weeks) ?b.value];
    final high = values.isEmpty ? 1 : values.reduce(math.max);
    final lowest = values.isEmpty ? 0 : values.reduce(math.min);
    final low = component.fromZero ? 0 : lowest - (high - lowest) * 0.15;
    double x(Day d) => (d.serial - _weeks.first.start.serial) / 7 * _columnUnits;
    double bar(num v) => math.max(0.5, (v - low) / (high - low == 0 ? 1 : high - low) * _height);
    bool inWindow(ZoomBar week) =>
        week.start.addDays(6).compareTo(component.from) >= 0 && week.start.compareTo(component.to) <= 0;
    return div(
      styles: const Styles(raw: {'touch-action': 'none', 'cursor': 'pointer', 'user-select': 'none'}),
      events: {
        'pointerdown': (e) {
          final pointer = e as web.PointerEvent;
          capturePointer(pointer);
          _drag = true;
          _point(pointer);
        },
        'pointermove': (e) {
          if (_drag) _point(e as web.PointerEvent);
        },
        'pointerup': (_) => _drag = false,
        'pointercancel': (_) => _drag = false,
      },
      [
        _svg(_weeks.length * _columnUnits, _height + 2, cssHeight: '2rem', label: 'All data', [
          for (final (i, b) in _weeks.indexed)
            if (b.value case final v?)
              rect(
                x: '${i * _columnUnits + 1}',
                y: '${_height + 1 - bar(v)}',
                width: '8',
                height: '${bar(v)}',
                styles: Styles(raw: {'fill': inWindow(b) ? _filled : 'var(--outline-variant)'}),
                [],
              ),
          rect(
            x: '${x(component.from)}',
            y: '0.5',
            width: '${math.max(4.0, x(component.to.addDays(1)) - x(component.from))}',
            height: '${_height + 1}',
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

/// The label under a bar. Examples: "Sep 28" (week), "Sep" or "Jan ’26" (month), "Q3 ’26" (quarter). A month shows
/// its year in January and on the [first] bar. The apostrophe tells a year from a day: "Feb ’24" is not "Feb 24".
String _barLabel(Day start, BarUnit unit, {bool first = false}) => switch (unit) {
  BarUnit.day || BarUnit.week => shortDay(start),
  BarUnit.month =>
    start.month == 1 || first ? '${shortMonth(start.month)} ’${start.year % 100}' : shortMonth(start.month),
  BarUnit.quarter => 'Q${(start.month + 2) ~/ 3} ’${start.year % 100}',
};

/// The name of a bar in a tooltip. Examples: "Week of Sep 28, 2026", "Sep 2026", "Q3 2026".
String _barTitle(Day start, BarUnit unit) => switch (unit) {
  BarUnit.day => '${shortDay(start)}, ${start.year}',
  BarUnit.week => 'Week of ${shortDay(start)}, ${start.year}',
  BarUnit.month => '${shortMonth(start.month)} ${start.year}',
  BarUnit.quarter => 'Q${(start.month + 2) ~/ 3} ${start.year}',
};

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

  static const _description = 'Tap a day to show its month in the calendar.';

  @override
  Component build(BuildContext context) {
    if (to.serial - from.serial + 1 > maxDays) {
      return _card(title, _description, wide: true, [
        small(styles: _textStyle, [.text('Zoom in to 1 year or less to see single days.')]),
      ]);
    }
    return _card(title, _description, wide: true, [_grid()]);
  }

  Component _grid() {
    final offset = from.weekday - 1;
    final days = daysBetween(from, to);
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
