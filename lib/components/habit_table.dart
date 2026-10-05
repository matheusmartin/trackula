import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

import '../model/date_format.dart';
import '../model/day.dart';
import '../model/format.dart';
import '../model/log_entry.dart';
import '../model/metric.dart';
import '../model/summary.dart';
import '../services/double_tap.dart';
import 'metric_icon.dart';
import 'number_editor.dart';
import 'trend_chart.dart';

/// How many past days the app shows: today as input tiles (see TodayTiles), a table of the last 5 days on all
/// screens, or one small calendar per metric for the last 31 days.
enum DayRange {
  today(1),
  short(5),
  month(31);

  const DayRange(this.days);

  final int days;

  /// The label in the bottom navigation bar.
  String get label => days == 1 ? 'Today' : '$days days';

  /// The Material Symbols icon in the bottom navigation bar.
  String get icon => switch (this) {
    DayRange.today => 'today',
    DayRange.short => 'view_week',
    DayRange.month => 'calendar_month',
  };

  /// The days of the range, oldest first, ending on [today].
  List<Day> daysUntil(Day today) => [for (var i = days - 1; i >= 0; i--) today.addDays(-i)];
}

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
/// - Count: a mouse click adds the step, a right-click subtracts it. A touch tap adds the step after a short wait,
///   and a double-tap subtracts it instead. Keys on a focused cell: `+` and `-`. A count has no reset: it goes to
///   empty with subtractions.
/// - Number: a cell click opens the [NumberEditor] for that metric and day, below the metric: a ruler, a text field
///   and a Save button. A second click closes it.
class HabitTable extends StatefulComponent {
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
    this.onOpen,
    this.bare = false,
    super.key,
  });

  final List<Metric> metrics;
  final LogTable log;
  final Day today;

  /// The days to show.
  final List<Day> days;
  final DayLayout layout;

  final bool busy;
  final void Function(LogWrite? Function(LogTable log) plan) onWrite;

  /// Count taps that are not written yet, per metric id and day. The table shows them at once.
  final Map<(String, Day), List<CountStep>> pending;
  final void Function(NumberMetric metric, Day day, CountStep step) onCount;

  /// Opens the detail screen of a metric. Null: the metric names are not links.
  final void Function(Metric metric)? onOpen;

  /// No metric title and no chart in [DayLayout.calendars]: the detail screen shows them itself.
  final bool bare;

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
  Map<Day, num> _values(Metric m) => dayValuesWithPending(m, component.log.entries, component.pending);

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
                small([.text(weekdayShort[d.weekday - 1])]),
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
    final weeks = _weeks(days);
    final labels = _weekLabels(weeks);
    return article(classes: 'calendar', [
      if (!component.bare) div(classes: 'calendar-title', _name(m)),
      // Cells show values, as in the short table. Dates are on the edges: weekdays on top, and the first day of
      // each week row on the left, with the month when it changes.
      div(classes: 'month', [
        span([]),
        for (final w in weekdayLetters) small([.text(w)]),
        for (final (i, week) in weeks.indexed) ...[
          small(classes: 'week', [.text(labels[i])]),
          for (final d in week) d == null ? span([]) : _cell(m, d, values, editing == (m.id, d)),
        ],
      ]),
      if (m is NumberMetric && !component.bare) TrendChart(days: days, values: values, unit: m.unit, bars: m.isCount),
      if (m is NumberMetric && editing != null && editing.$1 == m.id) _editor(m, editing.$2, values),
    ]);
  }

  /// The icon and the name of a metric. With [HabitTable.onOpen], a link to its detail screen.
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

  /// [days] in week rows, Monday to Sunday. Null fills the days before the first day and after the last day.
  static List<List<Day?>> _weeks(List<Day> days) {
    final slots = <Day?>[for (var i = 1; i < days.first.weekday; i++) null, ...days];
    while (slots.length % 7 != 0) {
      slots.add(null);
    }
    return [for (var i = 0; i < slots.length; i += 7) slots.sublist(i, i + 7)];
  }

  /// The labels of the week rows: the first day of each row, with the month on the first row and when the month
  /// changes. Example: "Sep 2", "7", "14", "21", "28", "Oct 5".
  static List<String> _weekLabels(List<List<Day?>> weeks) {
    int? month;
    return [
      for (final week in weeks)
        switch (week.whereType<Day>().first) {
          final d when d.month != month => '${shortMonth(month = d.month)} ${d.day}',
          final d => '${d.day}',
        },
    ];
  }

  List<Component> _rows(Metric m, List<Day> days) {
    final values = _values(m);
    final editing = _editing;
    return [
      tr([
        th(scope: 'row', classes: 'name', [
          div(_name(m)),
        ]),
        for (final d in days) td([_cell(m, d, values, editing == (m.id, d))]),
      ]),
      if (m is NumberMetric && editing != null && editing.$1 == m.id)
        tr(classes: 'editor-row', [
          td(colspan: days.length + 1, [_editor(m, editing.$2, values)]),
        ]),
    ];
  }

  /// A day cell. A cell with a value has one fixed color, whatever the value. See .cell.filled in theme.dart.
  /// A day after today is a faded cell that does nothing. See .cell.future.
  Component _cell(Metric m, Day d, Map<Day, num> values, bool selected) {
    if (d.compareTo(component.today) > 0) {
      return button(classes: 'cell future', disabled: true, attributes: {'title': '$d'}, []);
    }
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
        if (m is NumberMetric && v != null) .text(formatCompact(v)),
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
      label: '${m.name} · ${d == component.today ? 'today' : '$d'}',
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
      ' · Click or tap: +${formatNumber(step, 3)}. Right-click or double-tap: −${formatNumber(step, 3)}.',
    _ => '',
  };

  static String _valueText(Metric m, num? v) => switch ((m, v)) {
    (_, null) => '',
    (YesNoMetric(), _) => ': yes',
    (NumberMetric(unit: final unit), final v?) => ': ${withUnit(v, unit, 3)}',
  };
}
