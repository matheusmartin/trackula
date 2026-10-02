import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

import '../model/day.dart';
import '../model/log_entry.dart';
import '../model/metric.dart';
import '../model/summary.dart';
import '../services/double_tap.dart';
import 'number_editor.dart';
import 'trend_chart.dart';

/// How many past days the table shows. Matches the HabitKit "Last 7 days" and "Last 31 days" modes.
enum DayRange {
  week(7, phoneDays: 5),
  month(31);

  const DayRange(this.days, {int? phoneDays}) : phoneDays = phoneDays ?? days;

  final int days;

  /// The number of days on phones. The week table shows fewer days, so the metric icons fit.
  final int phoneDays;

  int count({required bool phone}) => phone ? phoneDays : days;

  String label({required bool phone}) => 'Last ${count(phone: phone)} days';

  /// The days of the range, oldest first, ending on [today].
  List<Day> daysUntil(Day today, {required bool phone}) {
    final n = count(phone: phone);
    return [for (var i = n - 1; i >= 0; i--) today.addDays(-i)];
  }
}

const _weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/// HabitKit-style input table: one row per metric, one column per day, today on the right.
///
/// - Yes/no: a cell click toggles that day.
/// - Count: a mouse click adds the step, a right-click subtracts it. A touch tap adds the step after a short wait,
///   and a double-tap subtracts it instead. Keys on a focused cell: `+` and `-`. A count has no reset: it goes to
///   empty with subtractions.
/// - Number: a cell click opens the [NumberEditor] for that metric and day, below the metric: a ruler, a text field
///   and a Save button. A second click closes it. For [PerDay.many] metrics the value is the day total.
class HabitTable extends StatefulComponent {
  const HabitTable({
    required this.metrics,
    required this.log,
    required this.today,
    required this.range,
    required this.phone,
    required this.busy,
    required this.onWrite,
    required this.pending,
    required this.onCount,
    super.key,
  });

  final List<Metric> metrics;
  final LogTable log;
  final Day today;
  final DayRange range;

  /// True on phone screens. See [DayRange.phoneDays].
  final bool phone;
  final bool busy;
  final void Function(LogWrite? Function(LogTable log) plan) onWrite;

  /// Count taps that are not written yet, per metric id and day. The table shows them at once.
  final Map<(String, Day), List<CountStep>> pending;
  final void Function(NumberMetric metric, Day day, CountStep step) onCount;

  @override
  State<HabitTable> createState() => _HabitTableState();
}

class _HabitTableState extends State<HabitTable> {
  /// The metric and day open in the editor.
  (String, Day)? _editing;

  /// Touch taps on count cells: a tap waits 300 ms for a second tap on the same cell. Keys are metric id and day.
  final _taps = DoubleTap<(String, Day)>();

  /// The pointer type of the last press on a count cell: 'mouse', 'touch' or 'pen'. Null after the click, so a
  /// keyboard click (Enter or Space) works like a mouse click.
  String? _pressType;

  bool get _touchPress => _pressType == 'touch' || _pressType == 'pen';

  @override
  void dispose() {
    _taps.dispose();
    super.dispose();
  }

  void _click(Metric m, Day d, Map<Day, num> values) => switch (m) {
    YesNoMetric() => component.onWrite((log) => planYesNo(m, d, values[d] == null, log)),
    NumberMetric(isCount: true) => _countClick(m, d),
    NumberMetric() => setState(() => _editing = _editing == (m.id, d) ? null : (m.id, d)),
  };

  /// Mouse and keyboard: a click adds the step at once, so two quick clicks add two steps.
  /// Touch: a tap adds the step after the double-tap wait, and a double-tap subtracts it. See [DoubleTap].
  void _countClick(NumberMetric m, Day d) {
    final touch = _touchPress;
    _pressType = null;
    if (touch) {
      _taps.tap(
        (m.id, d),
        onSingle: () => component.onCount(m, d, CountStep.add(m.step)),
        onDouble: () => component.onCount(m, d, CountStep.add(-m.step)),
      );
    } else {
      _addCount(m, d, m.step);
    }
  }

  /// Right-click: subtracts the step. A touch long-press also opens the context menu on Android: it does nothing.
  /// The browser menu never opens on a count cell.
  void _countMenu(NumberMetric m, Day d, web.Event e) {
    e.preventDefault();
    final touch = _touchPress;
    _pressType = null;
    if (!touch) _addCount(m, d, -m.step);
  }

  /// Keys on a focused count cell: `+` adds the step, `-` subtracts it.
  void _countKey(NumberMetric m, Day d, web.KeyboardEvent e) {
    final sign = switch (e.key) {
      '+' || '=' => 1,
      '-' => -1,
      _ => 0,
    };
    if (sign == 0) return;
    e.preventDefault();
    _addCount(m, d, sign * m.step);
  }

  /// Adds [delta] at once. A waiting touch tap runs first, so the steps keep their order.
  void _addCount(NumberMetric m, Day d, num delta) {
    _taps.flush();
    component.onCount(m, d, CountStep.add(delta));
  }

  /// The day values of [m], with the count taps that are not written yet.
  Map<Day, num> _values(Metric m) {
    final values = dayValues(m, component.log.entries);
    for (final MapEntry(key: (id, day), value: steps) in component.pending.entries) {
      if (id != m.id) continue;
      final v = applyCountSteps(values[day], steps);
      v == null ? values.remove(day) : values[day] = v;
    }
    return values;
  }

  @override
  Component build(BuildContext context) {
    final days = component.range.daysUntil(component.today, phone: component.phone);
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
    final values = _values(m);
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
        for (final d in days) _cell(m, d, values, editing == (m.id, d), label: '${d.day}'),
      ]),
      if (m is NumberMetric) TrendChart(days: days, values: values, unit: m.unit, bars: m.isCount),
      if (m is NumberMetric && editing != null && editing.$1 == m.id) _editor(m, editing.$2, values),
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
    final values = _values(m);
    final editing = _editing;
    return [
      tr([
        th(scope: 'row', classes: 'name', [
          div([
            _icon(m),
            span([.text(m.name)]),
          ]),
        ]),
        for (final d in days) td([_cell(m, d, values, editing == (m.id, d))]),
      ]),
      if (m is NumberMetric && editing != null && editing.$1 == m.id)
        tr(classes: 'editor-row', [
          td(colspan: days.length + 1, [_editor(m, editing.$2, values)]),
        ]),
    ];
  }

  /// A day button. [label] replaces the default text: the value of number metrics.
  /// A day cell. A cell with a value has one fixed color, whatever the value. See .cell.filled in theme.dart.
  Component _cell(Metric m, Day d, Map<Day, num> values, bool selected, {String? label}) {
    final v = values[d];
    return button(
      classes: [
        'cell',
        if (v != null) 'filled',
        if (d == component.today) 'today',
        if (selected) 'selected',
      ].join(' '),
      disabled: component.busy && m is YesNoMetric,
      attributes: {'title': '${m.name}, $d${_valueText(m, v)}${_hint(m)}', 'aria-pressed': '${v != null}'},
      onClick: () => _click(m, d, values),
      events: {
        // Count cells are not disabled during a write: taps queue and show at once. See TodayPage.
        if (m case NumberMetric(isCount: true)) ...{
          'pointerdown': (e) => _pressType = (e as web.PointerEvent).pointerType,
          'contextmenu': (e) => _countMenu(m, d, e),
          'keydown': (e) => _countKey(m, d, e as web.KeyboardEvent),
        },
      },
      [
        if (label != null) .text(label) else if (m is NumberMetric && v != null) .text(_compact(v)),
      ],
    );
  }

  /// The editor of a `number` metric. An empty day starts at the latest earlier value, else at the first later
  /// value. See [NumberEditor].
  Component _editor(NumberMetric m, Day d, Map<Day, num> values) {
    final near = nearestDay(values.keys, d);
    return NumberEditor(
      key: ValueKey('${m.id} $d'),
      metric: m,
      label: '${m.name}${m.perDay == PerDay.many ? ' (day total)' : ''} · ${d == component.today ? 'today' : '$d'}',
      current: values[d],
      start: near == null ? null : values[near],
      busy: component.busy,
      onSave: (v) {
        component.onWrite((log) => planNumber(m, d, v, log));
        setState(() => _editing = null);
      },
      onClear: () {
        component.onWrite((log) => planClear(m, d, log));
        setState(() => _editing = null);
      },
      onClose: () => setState(() => _editing = null),
    );
  }

  /// The input help in the cell tooltip of count metrics.
  static String _hint(Metric m) => switch (m) {
    NumberMetric(isCount: true, :final step) =>
      ' · Click or tap: +${_format(step)}. Right-click or double-tap: −${_format(step)}.',
    _ => '',
  };

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
