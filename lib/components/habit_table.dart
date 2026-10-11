import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../model/day.dart';
import '../model/format.dart';
import '../model/log_entry.dart';
import '../model/metric.dart';
import '../model/score.dart';
import '../model/summary.dart';
import '../services/count_input.dart';
import 'metric_icon.dart';
import 'number_editor.dart';
import 'trend_chart.dart';

/// How [HabitTable] shows its days.
enum DayLayout {
  /// One row per metric, one column per day.
  table,

  /// One small calendar per metric, Monday to Sunday.
  calendars,
}

/// HabitKit-style input table: one row per metric, one column per day, today on the right.
///
/// - Yes/no: a cell click writes `yes`, or `no` if the day is `yes`. A `no` day shows like an empty day.
/// - Count: see [CountInput]. A count has no reset: it goes to empty with subtractions.
/// - Number: a cell click opens the [NumberEditor] for that metric and day, below the metric: a ruler, a text field
///   and a Save button. A second click closes it.
/// - Score ([scoreMetric]): the cells show the [HabitTable.scores]. A click does nothing.
final class HabitTable extends StatefulComponent {
  const HabitTable({
    required this.metrics,
    required this.log,
    required this.today,
    required this.days,
    required this.layout,
    required this.busy,
    required this.onWrite,
    required this.pending,
    required this.onCount,
    this.scores = const {},
    this.onOpen,
    this.showsTitleAndChart = true,
    super.key,
  });

  final List<Metric> metrics;
  final LogTable log;
  final Day today;

  /// The days of the table or of the calendars, oldest first.
  final List<Day> days;
  final DayLayout layout;

  final bool busy;
  final void Function(LogWrite? Function(LogTable log) plan) onWrite;

  /// Count taps that are not written yet, per metric id and day. The table shows them at once.
  final Map<(String, Day), List<CountStep>> pending;
  final void Function(NumberMetric metric, Day day, CountStep step) onCount;

  /// The score of each day, for the cells of [scoreMetric] in [metrics].
  final Map<Day, num> scores;

  /// Opens the detail screen of a metric. Null: the metric names are not links.
  final void Function(Metric metric)? onOpen;

  /// True if [DayLayout.calendars] shows the metric title and a chart. The detail screen shows them itself.
  final bool showsTitleAndChart;

  @override
  State<HabitTable> createState() => _HabitTableState();
}

class _HabitTableState extends State<HabitTable> {
  /// The metric and day open in the editor.
  (String, Day)? _editing;

  /// The inputs on count cells. Keys are metric id and day.
  final _countInput = CountInput<(String, Day)>();

  @override
  void dispose() {
    _countInput.dispose();
    super.dispose();
  }

  void _click(Metric m, Day d, Map<Day, num> values) => switch (m) {
    YesNoMetric() => component.onWrite((log) => planYesNo(m, d, log, done: values[d] == null)),
    NumberMetric(isCount: true) => _countInput.click((m.id, d), (sign) => _addCount(m, d, sign)),
    NumberMetric() => setState(() => _editing = _editing == (m.id, d) ? null : (m.id, d)),
  };

  /// Adds the step of [m] to the day [d] ([sign] +1), or subtracts it ([sign] −1).
  void _addCount(NumberMetric m, Day d, int sign) => component.onCount(m, d, CountStep.add(sign * m.step));

  /// The day values of [m], with the count taps that are not written yet. For [scoreMetric], the scores.
  Map<Day, num> _values(Metric m) =>
      isScore(m) ? component.scores : dayValuesWithPending(m, component.log.entries, component.pending);

  @override
  Component build(BuildContext context) {
    final days = component.days;
    switch (component.layout) {
      case DayLayout.calendars:
        return div(classes: 'calendars', [for (final m in component.metrics) _calendar(m, days)]);
      case DayLayout.table:
    }
    return article(classes: 'no-padding table-wrap', [
      table(classes: 'habits', [
        thead([
          tr([
            th(classes: 'corner', []),
            for (final d in days)
              th(classes: d == component.today ? 'today' : null, [
                small([.text(weekdayNames[d.weekday - 1])]),
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
  Component _calendar(Metric metric, List<Day> days) {
    final values = _values(metric);
    final editing = _editing;
    final weeks = weekRows(days);
    final labels = weekLabels(weeks);
    return article(classes: 'calendar', [
      if (component.showsTitleAndChart) div(classes: 'calendar-title', _name(metric)),
      // Cells show values, as in the short table. Dates are on the edges: weekdays on top, and the first day of
      // each week row on the left, with the month when it changes.
      div(classes: 'month', [
        span([]),
        for (final name in weekdayNames) small([.text(name[0])]),
        for (final (i, week) in weeks.indexed) ...[
          small(classes: 'week', [.text(labels[i])]),
          for (final day in week)
            day == null ? span([]) : _cell(metric, day, values, selected: editing == (metric.id, day)),
        ],
      ]),
      if (metric is NumberMetric && component.showsTitleAndChart)
        TrendChart(days: days, values: values, unit: metric.unit, showsBars: metric.isCount),
      if (metric is NumberMetric && editing != null && editing.$1 == metric.id) _editor(metric, editing.$2, values),
    ]);
  }

  /// The icon and the name of [m]. With [HabitTable.onOpen], a link to its detail screen.
  List<Component> _name(Metric m) {
    final open = component.onOpen;
    final content = [
      metricIcon(m),
      span([.text(m.name)]),
    ];
    if (open == null) return content;
    return [
      a(
        href: '#',
        classes: 'metric-link',
        attributes: {'title': 'Show all data of ${m.name}'},
        events: {
          'click': (e) {
            e.preventDefault();
            open(m);
          },
        },
        content,
      ),
    ];
  }

  /// The table row of [metric], and the row of its number editor if it is open.
  List<Component> _rows(Metric metric, List<Day> days) {
    final values = _values(metric);
    final editing = _editing;
    return [
      tr([
        th(scope: 'row', classes: 'name', [
          div(_name(metric)),
        ]),
        for (final day in days) td([_cell(metric, day, values, selected: editing == (metric.id, day))]),
      ]),
      if (metric is NumberMetric && editing != null && editing.$1 == metric.id)
        tr(classes: 'editor-row', [
          td(colspan: days.length + 1, [_editor(metric, editing.$2, values)]),
        ]),
    ];
  }

  /// A day cell. A cell with a value has one fixed color, whatever the value. See .cell.filled in theme.dart.
  /// A day after today is a faded cell that does nothing. See .cell.future.
  Component _cell(Metric metric, Day day, Map<Day, num> values, {required bool selected}) {
    if (day.compareTo(component.today) > 0) {
      return button(classes: 'cell future', disabled: true, attributes: {'title': '$day'}, []);
    }
    final value = values[day];
    if (isScore(metric)) return _scoreCell(day, value);
    return button(
      classes: [
        'cell',
        if (value != null) 'filled',
        if (day == component.today) 'today',
        if (selected) 'selected',
      ].join(' '),
      disabled: component.busy && metric is YesNoMetric,
      attributes: {
        'title': '${metric.name}, $day${_valueText(metric, value)}${_hint(metric)}',
        'aria-pressed': '${value != null}',
      },
      onClick: () => _click(metric, day, values),
      events: {
        // Count cells are not disabled during a write: taps queue and show at once. See TodayPage.
        if (metric case NumberMetric(isCount: true)) ..._countInput.events((sign) => _addCount(metric, day, sign)),
      },
      [
        if (metric is NumberMetric && value != null) .text(formatCompact(value)),
      ],
    );
  }

  /// A read-only cell of [scoreMetric]. See .cell.score in theme.dart.
  Component _scoreCell(Day day, num? score) => span(
    classes: ['cell', 'score', if (score != null) 'filled', if (day == component.today) 'today'].join(' '),
    attributes: {'title': '${scoreMetric.name}, $day${_valueText(scoreMetric, score)}'},
    [if (score != null) .text(formatCompact(score))],
  );

  /// The editor of a `number` metric. An empty day starts at the latest earlier value, else at the first later
  /// value. See [NumberEditor].
  Component _editor(NumberMetric metric, Day day, Map<Day, num> values) {
    final near = nearestDay(values.keys, day);
    return NumberEditor(
      key: ValueKey('${metric.id} $day'),
      metric: metric,
      label: '${metric.name} · ${day == component.today ? 'today' : '$day'}',
      current: values[day],
      start: near == null ? null : values[near],
      busy: component.busy,
      onSave: (value) {
        component.onWrite((log) => planNumber(metric, day, value, log));
        setState(() => _editing = null);
      },
      onClear: () {
        component.onWrite((log) => planClear(metric, day, log));
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

  /// The value part of the cell tooltip. Example: ": 82.1 kg".
  static String _valueText(Metric m, num? v) => switch ((m, v)) {
    (_, null) => '',
    (YesNoMetric(), _) => ': yes',
    (NumberMetric(:final unit), final v?) => ': ${withUnit(_format(v), unit)}',
  };

  static String _format(num value) => formatNumber(value, 3);
}
