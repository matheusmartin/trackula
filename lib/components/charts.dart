import 'dart:math' as math;

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

import '../model/day.dart';
import '../model/number_input.dart';
import '../model/zoom.dart';

// Charts of the metric detail screen. Inline styles, not @css rules, as in trend_chart.dart: the charts must
// render correctly even when the browser has an old main.css. Colors come from the theme variables.

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/// [v] with at most [decimals] decimals and no zeros at the end. Example: 81.25 → "81.3".
String formatNumber(num v, [int decimals = 1]) => formatShort(double.parse(v.toStringAsFixed(decimals)));

/// Example: "Sep 28".
String shortDay(Day d) => '${_months[d.month - 1]} ${d.day}';

/// The weekday letters, Monday first.
List<String> get weekdayLetters => _weekdays;

const _primary = 'var(--primary)';
const _filled = 'color-mix(in srgb, var(--primary) 70%, var(--surface-container-highest))';
const _empty = 'var(--surface-container-highest)';
const _second = 'var(--tertiary)';

/// Days after today: the empty color, faded. As .cell.future in theme.dart.
const _future = 'color-mix(in srgb, var(--surface-container-highest) 40%, transparent)';

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
const _maxColumnWidth = 5;

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
  if (w.deltaY.abs() <= w.deltaX.abs()) return;
  final box = w.currentTarget as web.Element;
  final before = box.scrollLeft;
  box.scrollLeft = before + w.deltaY * (w.deltaMode == web.WheelEvent.DOM_DELTA_LINE ? 16 : 1);
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
  final floor = fromLowest && values.isNotEmpty ? lowest - math.max((top - lowest) * 0.25, top * 0.01) : 0;
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
    double y(num v) => hi == lo ? h / 2 : 2 + (h - 4) * (hi - v) / (hi - lo);
    String pathOf(List<num?> vs) => [
      for (final (i, v) in vs.indexed)
        if (v != null) '${i == vs.indexWhere((e) => e != null) ? 'M' : 'L'}${x(i)} ${y(v)}',
    ].join(' ');
    final u = unit == null ? '' : ' $unit';
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
        _labels([shortDay(days.first), shortDay(days.last)]),
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
              span([.text('${p.label}: ${p.value} · ${total == 0 ? 0 : (p.value / total * 100).round()}%')]),
            ]),
        ]),
      ]),
    ]);
  }
}

/// Bars over time with zoom: from the first value ([first]) to [today]. The zoom buttons change the span in view and
/// the size of a bar (see [ZoomStep]): weeks, months or quarters. The small chart below shows all data, with a box
/// on the bars in view. Move with a drag on either chart, or with the mouse wheel.
///
/// - Rates and sums use one scale for all bars of a zoom step, so that it does not change while the chart moves.
///   Averages, changes and ranges use the bars in view.
/// - Values show above the bars when 13 bars or fewer are in view.
/// - With [range], each bar goes from the lowest to the highest value, and a dot shows the average.
class ZoomChart extends StatefulComponent {
  const ZoomChart({
    required this.title,
    required this.description,
    required this.values,
    required this.aggregate,
    required this.first,
    required this.today,
    this.format = formatNumber,
    this.max,
    this.signed = false,
    this.fromLowest = false,
    this.range = false,
    this.unit,
    super.key,
  });

  final String title;
  final String description;

  /// The value of each day. For [Aggregate.rate]: 1 for `yes`, 0 for `no`.
  final Map<Day, num> values;
  final Aggregate aggregate;
  final Day first;
  final Day today;

  /// The text of the value above a bar and in its tooltip.
  final String Function(num v) format;

  /// A fixed top of the scale, for example 1 for rates. Null: the highest value.
  final num? max;
  final bool signed;
  final bool fromLowest;
  final bool range;

  /// The unit of the values in the tooltips, for example `Kg`. Not above the bars: there is no space.
  final String? unit;

  @override
  State<ZoomChart> createState() => _ZoomChartState();
}

class _ZoomChartState extends State<ZoomChart> {
  /// Up to this number of bars, the values show above the bars.
  static const _valueBars = 13;

  /// The mouse wheel moves one bar for each this many pixels of scroll.
  static const _wheelStep = 40.0;

  /// The index in [zoomSteps]. Null: 3 months, or the largest step if there are fewer.
  int? _step;

  /// A day in the newest bar in view. Null: the newest bar of all. A day, not an index, so that a zoom keeps the
  /// same time in view.
  Day? _end;

  /// A drag on the large chart: the start `pageX` and the end index at the start. `pageX`, not `clientX`: package:web
  /// declares `clientX` as an int, and real pointers give fractional values.
  (double, int)? _drag;
  bool _miniDrag = false;
  double _wheel = 0;

  @override
  Component build(BuildContext context) {
    final c = component;
    final steps = zoomSteps(c.first, c.today);
    final stepIndex = math.min(_step ?? 1, steps.length - 1);
    final step = steps[stepIndex];
    final starts = barStarts(c.first, c.today, step.unit);
    final bars = zoomBars(c.values, c.aggregate, starts, step.unit, first: c.first, today: c.today);
    final count = math.min(step.bars, starts.length);
    final endDay = _end;
    final end = endDay == null
        ? starts.length
        : (starts.indexOf(barStart(endDay, step.unit)) + 1).clamp(count, starts.length);
    final view = bars.sublist(end - count, end);

    void moveTo(int newEnd) {
      final e = newEnd.clamp(count, starts.length);
      setState(() => _end = e == starts.length ? null : starts[e - 1]);
    }

    void zoom(int delta) => setState(() {
      // At the newest bar, stay at the newest bar. Else keep the same time in view.
      if (end < starts.length) _end = view.last.start;
      _step = (stepIndex + delta).clamp(0, steps.length - 1);
    });

    final all = showsAll(step, c.first, c.today);
    final unitText = c.unit == null ? '' : ' ${c.unit}';
    final label = all ? 'All' : step.label;
    // Rates and sums start at 0: one scale for all bars, so that it does not change while the chart moves. Averages,
    // changes and ranges use the bars in view: over all data, small changes would not show.
    final fixedScale = c.aggregate == Aggregate.rate || c.aggregate == Aggregate.sum;
    final scaleBars = fixedScale && !c.range ? bars : view;
    final lows = [for (final b in scaleBars) ?(c.range ? b.low : b.value)];
    final highs = [for (final b in scaleBars) ?(c.range ? b.high : b.value)];

    return _card(
      c.title,
      c.description,
      wide: true,
      actions: [
        button(
          classes: 'circle transparent small',
          attributes: {'title': 'Zoom in', 'aria-label': 'Zoom in'},
          disabled: stepIndex == 0,
          onClick: () => zoom(-1),
          [
            i([.text('zoom_in')]),
          ],
        ),
        small(
          styles: const Styles(raw: {'min-width': '4.5rem', 'text-align': 'center', 'font-size': '0.75rem'}),
          [.text(label)],
        ),
        button(
          classes: 'circle transparent small',
          attributes: {'title': 'Zoom out', 'aria-label': 'Zoom out'},
          disabled: stepIndex == steps.length - 1,
          onClick: () => zoom(1),
          [
            i([.text('zoom_out')]),
          ],
        ),
      ],
      [
        div(
          styles: const Styles(raw: {'touch-action': 'pan-y', 'user-select': 'none', 'cursor': 'grab'}),
          events: {
            'pointerdown': (e) {
              final p = e as web.PointerEvent;
              _capture(p);
              _drag = (p.pageX, end);
            },
            'pointermove': (e) {
              final drag = _drag;
              if (drag == null) return;
              final p = e as web.PointerEvent;
              final width = (p.currentTarget as web.Element).getBoundingClientRect().width;
              final shift = ((p.pageX - drag.$1) / (width / count)).round();
              if (drag.$2 - shift != end) moveTo(drag.$2 - shift);
            },
            'pointerup': (_) => _drag = null,
            'pointercancel': (_) => _drag = null,
            'wheel': (e) {
              final w = e as web.WheelEvent;
              final delta = w.deltaX.abs() > w.deltaY.abs() ? w.deltaX : w.deltaY;
              final target = (end + (_wheel + delta) ~/ _wheelStep).clamp(count, starts.length);
              _wheel = (_wheel + delta).remainder(_wheelStep);
              // At an end, the page scrolls as usual.
              if (target == end && (end == count && delta < 0 || end == starts.length && delta > 0)) return;
              w.preventDefault();
              if (target != end) moveTo(target);
            },
          },
          [
            if (c.range)
              _rangeRows(
                view,
                highs.isEmpty ? 1 : highs.reduce(math.max),
                lows.isEmpty ? 0 : lows.reduce(math.min),
                step.unit,
              )
            else
              ..._barRows(
                [
                  for (final b in view)
                    (
                      label: _barLabel(b.start, step.unit),
                      value: b.value,
                      tooltip:
                          '${_barTitle(b.start, step.unit)}: ${b.value == null ? 'no value' : '${c.format(b.value!)}$unitText'}',
                    ),
                ],
                label: c.title,
                signed: c.signed,
                fromLowest: c.fromLowest,
                max:
                    c.max ??
                    (highs.isEmpty
                        ? null
                        : (c.signed
                              ? [...highs, ...lows].map((v) => v.abs()).reduce(math.max)
                              : highs.reduce(math.max))),
                min: lows.isEmpty ? null : lows.reduce(math.min),
                format: c.format,
                showValues: count <= _valueBars,
              ),
            _labels([for (final (i, b) in view.indexed) _barLabel(b.start, step.unit, first: i == 0)]),
          ],
        ),
        _overview(step, view, count, starts),
      ],
    );
  }

  /// The small chart of all data in weeks, with a box on the bars in view. A tap or a drag moves the box there.
  Component _overview(ZoomStep step, List<ZoomBar> view, int count, List<Day> starts) {
    final c = component;
    final weeks = barStarts(c.first, c.today, BarUnit.week);
    final aggregate = c.aggregate == Aggregate.change ? Aggregate.average : c.aggregate;
    final bars = zoomBars(c.values, aggregate, weeks, BarUnit.week, first: c.first, today: c.today);
    final values = [for (final b in bars) ?b.value];
    final hi = values.isEmpty ? 1 : values.reduce(math.max);
    // Rates and sums start at 0. Averages start a little below the lowest week, so that changes show.
    final fromZero = aggregate == Aggregate.rate || aggregate == Aggregate.sum;
    final lo = fromZero || values.isEmpty ? 0 : values.reduce(math.min) - (hi - values.reduce(math.min)) * 0.15;
    const h = 30.0;
    final w = weeks.length * 10.0;
    double x(Day d) => (d.serial - weeks.first.serial) / 7 * 10;
    final from = view.first.start, to = nextBarStart(view.last.start, step.unit);

    void moveTo(web.PointerEvent p) {
      final rect = (p.currentTarget as web.Element).getBoundingClientRect();
      final f = ((p.pageX - web.window.scrollX - rect.left) / rect.width).clamp(0.0, 1.0);
      final day = c.first.addDays((f * (c.today.serial - c.first.serial)).round());
      final index = starts.indexOf(barStart(day, step.unit));
      final e = (index + 1 + count ~/ 2).clamp(count, starts.length);
      setState(() => _end = e == starts.length ? null : starts[e - 1]);
    }

    return div(
      styles: const Styles(raw: {'margin-top': '0.5rem', 'touch-action': 'pan-y', 'cursor': 'pointer'}),
      events: {
        'pointerdown': (e) {
          final p = e as web.PointerEvent;
          _capture(p);
          _miniDrag = true;
          moveTo(p);
        },
        'pointermove': (e) {
          if (_miniDrag) moveTo(e as web.PointerEvent);
        },
        'pointerup': (_) => _miniDrag = false,
        'pointercancel': (_) => _miniDrag = false,
      },
      [
        _svg(w, h + 2, height: '2rem', label: '${c.title}: all data', [
          for (final (i, b) in bars.indexed)
            if (b.value case final v?)
              rect(
                x: '${i * 10 + 1}',
                y: '${h + 1 - math.max(0.5, (v - lo) / (hi - lo == 0 ? 1 : hi - lo) * h)}',
                width: '8',
                height: '${math.max(0.5, (v - lo) / (hi - lo == 0 ? 1 : hi - lo) * h)}',
                styles: Styles(
                  raw: {
                    'fill': b.start.compareTo(from) >= 0 && b.start.compareTo(to) < 0
                        ? _filled
                        : 'var(--outline-variant)',
                  },
                ),
                [],
              ),
          rect(
            x: '${x(from)}',
            y: '0.5',
            width: '${math.max(4.0, x(to) - x(from))}',
            height: '${h + 1}',
            rx: '3',
            styles: const Styles(
              raw: {'fill': 'none', 'stroke': _primary, 'stroke-width': '1.5', 'vector-effect': 'non-scaling-stroke'},
            ),
            [],
          ),
        ]),
      ],
    );
  }

  /// One bar from the lowest to the highest value for each of [view], and the average as a dot.
  Component _rangeRows(List<ZoomBar> view, num hi, num lo, BarUnit unit) {
    const h = 50.0;
    final w = view.length * 10.0;
    double y(num v) => hi == lo ? h / 2 : 2 + (h - 4) * (hi - v) / (hi - lo);
    final u = component.unit == null ? '' : ' ${component.unit}';
    return _svg(w, h, label: component.title, [
      for (final (i, b) in view.indexed)
        if ((b.low, b.high, b.value) case (final low?, final high?, final avg?)) ...[
          rect(
            x: '${i * 10 + 2.5}',
            y: '${y(high)}',
            width: '5',
            height: '${math.max(1.0, y(low) - y(high))}',
            rx: '2',
            styles: const Styles(raw: {'fill': _empty}),
            [_tooltip('${_barTitle(b.start, unit)}: ${formatNumber(low, 2)} to ${formatNumber(high, 2)}$u')],
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
            [_tooltip('${_barTitle(b.start, unit)}: average ${formatNumber(avg, 2)}$u')],
          ),
        ],
    ]);
  }
}

/// Sends the next moves of the pointer of [p] to its element, also outside it. A pointer that is already up throws:
/// then nothing changes.
void _capture(web.PointerEvent p) {
  try {
    (p.currentTarget as web.Element).setPointerCapture(p.pointerId);
  } catch (_) {}
}

/// The label under a bar. Examples: "Sep 28" (week), "Sep" or "Jan ’26" (month), "Q3 ’26" (quarter). A month shows
/// its year in January and on the [first] bar. The apostrophe tells a year from a day: "Feb ’24" is not "Feb 24".
String _barLabel(Day start, BarUnit unit, {bool first = false}) => switch (unit) {
  BarUnit.week => shortDay(start),
  BarUnit.month =>
    start.month == 1 || first ? '${_months[start.month - 1]} ’${start.year % 100}' : _months[start.month - 1],
  BarUnit.quarter => 'Q${(start.month + 2) ~/ 3} ’${start.year % 100}',
};

/// The name of a bar in a tooltip. Examples: "Week of Sep 28, 2026", "Sep 2026", "Q3 2026".
String _barTitle(Day start, BarUnit unit) => switch (unit) {
  BarUnit.week => 'Week of ${shortDay(start)}, ${start.year}',
  BarUnit.month => '${_months[start.month - 1]} ${start.year}',
  BarUnit.quarter => 'Q${(start.month + 2) ~/ 3} ${start.year}',
};

/// All days of a [year] in week columns, Monday at the top. A day with a value is filled. A tap on a day calls
/// [onDay]. Days after [today] show faded and do nothing on a tap.
class YearHeatmap extends StatelessComponent {
  const YearHeatmap({required this.year, required this.filled, required this.today, required this.onDay, super.key});

  final int year;
  final bool Function(Day day) filled;
  final Day today;
  final void Function(Day day) onDay;

  @override
  Component build(BuildContext context) {
    final first = Day(year, 1, 1);
    final offset = first.weekday - 1;
    final days = [for (var d = first; d.year == year; d = d.addDays(1)) d];
    final columns = ((offset + days.length) / 7).ceil();
    const size = 10.0, gap = 2.0;
    return svg(
      viewBox: '0 0 ${columns * (size + gap)} ${7 * (size + gap)}',
      styles: const Styles(raw: {'display': 'block', 'width': '100%', 'height': 'auto'}),
      attributes: {'role': 'img', 'aria-label': 'All days of $year'},
      [
        for (final (i, d) in days.indexed)
          if (d.compareTo(today) > 0)
            rect(
              x: '${((i + offset) ~/ 7) * (size + gap)}',
              y: '${((i + offset) % 7) * (size + gap)}',
              width: '$size',
              height: '$size',
              rx: '2',
              styles: const Styles(raw: {'fill': _future}),
              [_tooltip('$d')],
            )
          else
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
