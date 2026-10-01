import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

import '../model/day.dart';
import '../model/log_entry.dart';
import '../model/metric.dart';
import '../model/summary.dart';
import 'trend_chart.dart';

/// How many past days the table shows. Matches the HabitKit "Last 7 days" and "Last 31 days" modes.
enum DayRange {
  week(7, 'Last 7 days'),
  month(31, 'Last 31 days');

  const DayRange(this.days, this.label);

  final int days;
  final String label;

  /// The days of the range, oldest first, ending on [today].
  List<Day> daysUntil(Day today) => [for (var i = days - 1; i >= 0; i--) today.addDays(-i)];
}

const _weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/// HabitKit-style input table: one row per metric, one column per day, today on the right.
///
/// - Yes/no: a cell click toggles that day.
/// - Number: a cell click opens the editor for that metric and day, in a row below the metric.
///   The editor sets or clears the value. For [PerDay.many] metrics the value is the day total.
class HabitTable extends StatefulComponent {
  const HabitTable({
    required this.metrics,
    required this.log,
    required this.today,
    required this.range,
    required this.busy,
    required this.onWrite,
    super.key,
  });

  final List<Metric> metrics;
  final LogTable log;
  final Day today;
  final DayRange range;
  final bool busy;
  final void Function(LogWrite? Function(LogTable log) plan) onWrite;

  @override
  State<HabitTable> createState() => _HabitTableState();
}

class _HabitTableState extends State<HabitTable> {
  /// The metric and day open in the editor.
  (String, Day)? _editing;
  String _draft = '';

  void _click(Metric m, Day d, Map<Day, num> values) => switch (m) {
    YesNoMetric() => component.onWrite((log) => planYesNo(m, d, values[d] == null, log)),
    NumberMetric() => setState(() {
      _editing = _editing == (m.id, d) ? null : (m.id, d);
      _draft = values[d] == null ? '' : _format(values[d]!);
    }),
  };

  void _save(NumberMetric m, Day d) {
    final v = num.tryParse(_draft.trim());
    if (v == null) return;
    component.onWrite((log) => planNumber(m, d, v, log));
    setState(() => _editing = null);
  }

  void _clear(NumberMetric m, Day d) {
    component.onWrite((log) => planClear(m, d, log));
    setState(() => _editing = null);
  }

  @override
  Component build(BuildContext context) {
    final days = component.range.daysUntil(component.today);
    if (component.range == DayRange.month) {
      return div(classes: 'calendars', [for (final m in component.metrics) _calendar(m, days)]);
    }
    return article(classes: 'no-padding table-wrap', [
      table(classes: 'habits', [
        thead([
          tr([
            th(classes: 'corner', []),
            for (final d in days)
              th(classes: d == component.today ? 'today' : null, [
                small([.text(_weekdays[d.weekday - 1])]),
                span([.text('${d.day}')]),
              ]),
          ]),
        ]),
        tbody([
          for (final m in component.metrics) ..._rows(m, days),
        ]),
      ]),
    ]);
  }

  /// 31-day mode: one small calendar per metric. Columns are Monday to Sunday.
  /// Number metrics also get a line chart of the same days.
  Component _calendar(Metric m, List<Day> days) {
    final values = dayValues(m, component.log.entries);
    final max = days.map((d) => values[d] ?? 0).fold<num>(0, (hi, v) => v > hi ? v : hi);
    final editing = _editing;
    return article(classes: 'calendar', [
      div(classes: 'calendar-title', [
        _icon(m),
        span([.text(m.name)]),
      ]),
      div(classes: 'month', [
        for (final w in _weekdays) small([.text(w.substring(0, 1))]),
        // Empty cells, so the first day is in its weekday column.
        for (var i = 1; i < days.first.weekday; i++) span([]),
        for (final d in days) _cell(m, d, values, max, editing == (m.id, d), label: '${d.day}'),
      ]),
      if (m is NumberMetric) TrendChart(days: days, values: values, unit: m.unit, bars: m.isCount),
      if (m is NumberMetric && editing != null && editing.$1 == m.id) _editor(m, editing.$2, values[editing.$2]),
    ]);
  }

  /// The metric icon: a Material Symbol for a lowercase name such as `water_drop`, else the text, such as an emoji.
  /// Without an icon: the first letter of the name. [String.runes] keeps an emoji at the start in one piece.
  static Component _icon(Metric m) => span(classes: 'icon', [
    switch (m.icon) {
      final icon? when _symbolName.hasMatch(icon) => i([.text(icon)]),
      final icon? => .text(icon),
      null => .text(m.name.isEmpty ? '?' : String.fromCharCode(m.name.runes.first).toUpperCase()),
    },
  ]);

  static final _symbolName = RegExp(r'^[a-z0-9_]+$');

  List<Component> _rows(Metric m, List<Day> days) {
    final values = dayValues(m, component.log.entries);
    final max = days.map((d) => values[d] ?? 0).fold<num>(0, (hi, v) => v > hi ? v : hi);
    final editing = _editing;
    return [
      tr([
        th(scope: 'row', classes: 'name', [
          div([
            _icon(m),
            span([.text(m.name)]),
          ]),
        ]),
        for (final d in days) td([_cell(m, d, values, max, editing == (m.id, d))]),
      ]),
      if (m is NumberMetric && editing != null && editing.$1 == m.id)
        tr(classes: 'editor-row', [
          td(colspan: days.length + 1, [_editor(m, editing.$2, values[editing.$2])]),
        ]),
    ];
  }

  /// A day button. [label] replaces the default text: the value of number metrics.
  Component _cell(Metric m, Day d, Map<Day, num> values, num max, bool selected, {String? label}) {
    final v = values[d];
    return button(
      classes: [
        'cell',
        if (v != null) 'filled',
        if (m is NumberMetric && m.perDay == PerDay.many) 'count',
        if (d == component.today) 'today',
        if (selected) 'selected',
      ].join(' '),
      styles: Styles(raw: {'--i': '${_intensity(m, v, max)}%'}),
      disabled: component.busy && m is YesNoMetric,
      attributes: {'title': '${m.name}, $d${_valueText(m, v)}', 'aria-pressed': '${v != null}'},
      onClick: () => _click(m, d, values),
      [
        if (label != null) .text(label) else if (m is NumberMetric && v != null) .text(_compact(v)),
      ],
    );
  }

  Component _editor(NumberMetric m, Day d, num? current) {
    return div(classes: 'editor', [
      span([
        .text(
          '${m.name}${m.perDay == PerDay.many ? ' (day total)' : ''} · ${d == component.today ? 'today' : '$d'}',
        ),
      ]),
      div(classes: 'field border small${m.unit == null ? '' : ' suffix'}', [
        input(
          type: .number,
          value: _draft,
          attributes: {'step': '${m.step}', 'inputmode': 'decimal', 'aria-label': 'Value'},
          events: {
            'input': (e) => _draft = (e.target as web.HTMLInputElement).value,
            'keydown': (e) {
              if ((e as web.KeyboardEvent).key == 'Enter') _save(m, d);
            },
          },
        ),
        if (m.unit case final unit?) span(classes: 'unit small-text', [.text(unit)]),
      ]),
      button(disabled: component.busy, onClick: () => _save(m, d), [.text('Set')]),
      if (current != null)
        button(classes: 'border', disabled: component.busy, onClick: () => _clear(m, d), [.text('Clear')]),
      button(
        classes: 'circle transparent',
        attributes: {'title': 'Close'},
        onClick: () => setState(() => _editing = null),
        [
          i([.text('close')]),
        ],
      ),
    ]);
  }

  /// Color strength in percent: 0 if empty, 100 if done or measured,
  /// 35–100 for counts relative to the highest day in the range.
  static int _intensity(Metric m, num? v, num max) {
    if (v == null) return 0;
    if (m is! NumberMetric || m.perDay == PerDay.one || max <= 0) return 100;
    return (35 + 65 * (v / max).clamp(0, 1)).round();
  }

  static String _valueText(Metric m, num? v) => switch ((m, v)) {
    (_, null) => '',
    (YesNoMetric(), _) => ': done',
    (NumberMetric(unit: final unit), final v?) => ': ${_format(v)} ${unit ?? ''}'.trimRight(),
  };

  /// Short text for a cell: 1 decimal at most, and "k" from 1000. Example: 12500 → 12.5k.
  static String _compact(num v) => v.abs() >= 1000
      ? '${_format(double.parse((v / 1000).toStringAsFixed(1)))}k'
      : _format(double.parse(v.toStringAsFixed(1)));

  /// Removes float noise, for example 82.10000000000001.
  static String _format(num v) =>
      v == v.roundToDouble() ? v.toInt().toString() : double.parse(v.toStringAsFixed(3)).toString();
}
