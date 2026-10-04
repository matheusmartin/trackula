import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

import '../model/day.dart';
import '../model/log_entry.dart';
import '../model/metric.dart';
import '../model/number_input.dart';
import '../model/summary.dart';
import 'metric_icon.dart';
import 'number_editor.dart';
import '../services/double_tap.dart';

/// Today input mode: one tile for each metric, for today only. The fewest taps for each input.
///
/// No tile writes at once. Each input makes the value of its tile unsaved, and the Save button at the end of the page
/// saves all unsaved values in one task. Unsaved values are lost when the user
/// leaves the screen. An input that gives the saved value again is not unsaved.
///
/// - Yes/no: a tap on the tile sets done. A second tap goes back: to empty, or to `no` if the day was saved as `yes`.
/// - Count: as the table cells. A mouse click adds the step, a right-click subtracts it. A touch tap adds the step
///   after a short wait, and a double-tap subtracts it instead. Keys on a focused tile: `+` and `-`.
/// - Number: a full-width tile with the ruler of the [NumberEditor]. An empty day starts at the latest earlier value.
///   A drag, a typed value, or a tap on the ruler (to confirm the same value) makes the value unsaved.
///
/// A tile with a value (saved or not) is green. An unsaved tile also has a green frame. Styles: `.tiles` and
/// `.save-button` in lib/constants/theme.dart.
class TodayTiles extends StatefulComponent {
  const TodayTiles({
    required this.metrics,
    required this.log,
    required this.today,
    required this.busy,
    required this.onWriteAll,
    required this.pending,
    super.key,
  });

  final List<Metric> metrics;
  final LogTable log;
  final Day today;
  final bool busy;

  /// Saves several values in one task, in order. For the Save button.
  final void Function(List<LogWrite? Function(LogTable log)> plans) onWriteAll;

  /// Count taps of the table views that are not written yet, per metric id and day. The tiles show them.
  final Map<(String, Day), List<CountStep>> pending;

  @override
  State<TodayTiles> createState() => _TodayTilesState();
}

class _TodayTilesState extends State<TodayTiles> {
  /// Unsaved values, by metric id. Yes/no: 1 for `yes`, 0 for `no`. Null clears the day.
  final _drafts = <String, num?>{};

  /// Values that the Save button sends now, by metric id. The tiles show them until the write ends, not the old values.
  final _saving = <String, num?>{};

  Day get today => component.today;

  /// Touch taps on count tiles: a tap waits 300 ms for a second tap on the same tile. Keys are metric ids.
  final _taps = DoubleTap<String>();

  /// The pointer type of the last press on a count tile: 'mouse', 'touch' or 'pen'. Null after the click, so a
  /// keyboard click (Enter or Space) works like a mouse click.
  String? _pressType;

  @override
  void dispose() {
    _taps.dispose();
    super.dispose();
  }

  @override
  void didUpdateComponent(TodayTiles oldComponent) {
    super.didUpdateComponent(oldComponent);
    // The write ended: the new data has the saved values, or the error shows.
    if (oldComponent.busy && !component.busy) _saving.clear();
  }

  /// The value that a tile shows: unsaved, then being saved, then [saved].
  num? _shown(Metric m, num? saved) => _drafts.containsKey(m.id)
      ? _drafts[m.id]
      : _saving.containsKey(m.id)
      ? _saving[m.id]
      : saved;

  /// Makes [value] the unsaved value of [m]. The [saved] value again is not unsaved.
  void _set(Metric m, num? value, num? saved) => setState(() {
    if (value == saved) {
      _drafts.remove(m.id);
    } else {
      _drafts[m.id] = value;
    }
  });

  void _save() {
    final plans = [
      for (final m in component.metrics)
        if (_drafts.containsKey(m.id))
          switch ((m, _drafts[m.id])) {
            (YesNoMetric(), final v?) => (LogTable log) => planYesNo(m as YesNoMetric, today, v == 1, log),
            (NumberMetric(), final v?) => (LogTable log) => planNumber(m as NumberMetric, today, v, log),
            (_, null) => (LogTable log) => planClear(m, today, log),
          },
    ];
    // The number editors keep their values: the new data shows the same values.
    setState(() {
      _saving.addAll(_drafts);
      _drafts.clear();
    });
    component.onWriteAll(plans);
  }

  @override
  Component build(BuildContext context) {
    final unsaved = [
      for (final m in component.metrics)
        if (_drafts.containsKey(m.id)) m.name,
    ];
    // A div, not a fragment: Jaspr cannot remove a fragment inside the fragment of TodayPage ("Cannot remove fragment
    // from a different parent"), for example when the page changes to the 5-day table.
    return div(classes: 'today-tiles', [
      div(classes: 'tiles', [
        for (final m in component.metrics) _tile(m, dayValuesWithPending(m, component.log.entries, component.pending)),
      ]),
      // At the end of the page, below the tiles. See .save-button in theme.dart.
      button(
        classes: 'save-button',
        disabled: component.busy || unsaved.isEmpty,
        attributes: {'title': unsaved.isEmpty ? 'No changes' : 'Save: ${unsaved.join(', ')}'},
        onClick: _save,
        [.text(_saving.isNotEmpty ? 'Saving…' : 'Save')],
      ),
    ]);
  }

  Component _tile(Metric m, Map<Day, num> values) => switch (m) {
    YesNoMetric() => _yesNo(m, values[today]),
    NumberMetric(isCount: true) => _count(m, values[today]),
    NumberMetric() => _number(m, values),
  };

  String _classes(Metric m, {required bool done, String? kind}) => [
    'tile',
    ?kind,
    if (done) 'done',
    if (_drafts.containsKey(m.id)) 'unsaved',
  ].join(' ');

  /// The icon and the name. No status line.
  List<Component> _head(Metric m) => [
    metricIcon(m),
    div(classes: 'tile-text', [
      span(classes: 'tile-name', [.text(m.name)]),
    ]),
  ];

  Component _yesNo(YesNoMetric m, num? saved) {
    final done = _shown(m, saved) == 1;
    return div(classes: _classes(m, done: done), [
      button(
        classes: 'tile-main',
        attributes: {'aria-pressed': '$done'},
        // Back from done: to empty, or to `no` if the day was saved as `yes`.
        onClick: () => _set(m, done ? (saved == 1 ? 0 : null) : 1, saved),
        [
          ..._head(m),
        ],
      ),
    ]);
  }

  /// Adds [delta] to the shown value of [m]. It reads the value when it runs: a touch tap runs after the wait.
  void _add(NumberMetric m, num delta, num? saved) =>
      _set(m, applyCountSteps(_shown(m, saved), [CountStep.add(delta)]), saved);

  /// Mouse and keyboard: a click adds the step at once. Touch: a tap adds the step after the double-tap wait, and a
  /// double-tap subtracts it. See [DoubleTap].
  void _countClick(NumberMetric m, num? saved) {
    final touch = _pressType == 'touch' || _pressType == 'pen';
    _pressType = null;
    if (touch) {
      _taps.tap(m.id, onSingle: () => _add(m, m.step, saved), onDouble: () => _add(m, -m.step, saved));
    } else {
      _taps.flush();
      _add(m, m.step, saved);
    }
  }

  Component _count(NumberMetric m, num? saved) {
    final v = _shown(m, saved);
    final step = formatStep(m.step, m.step);
    return div(classes: _classes(m, done: v != null, kind: 'count'), [
      button(
        classes: 'tile-main',
        attributes: {'title': 'Tap or click: +$step. Double-tap or right-click: −$step.', 'aria-label': m.name},
        onClick: () => _countClick(m, saved),
        events: {
          'pointerdown': (e) => _pressType = (e as web.PointerEvent).pointerType,
          // Right-click subtracts. A touch long-press also opens the context menu on Android: it does nothing.
          'contextmenu': (e) {
            e.preventDefault();
            final touch = _pressType == 'touch' || _pressType == 'pen';
            _pressType = null;
            if (touch) return;
            _taps.flush();
            _add(m, -m.step, saved);
          },
          'keydown': (e) {
            final k = (e as web.KeyboardEvent).key;
            if (k != '+' && k != '=' && k != '-') return;
            _taps.flush();
            _add(m, k == '-' ? -m.step : m.step, saved);
          },
        },
        [
          ..._head(m),
          // The counter: the value of today, 0 when empty.
          span(classes: 'tile-counter', [.text(v == null ? '0' : formatStep(v, m.step))]),
        ],
      ),
    ]);
  }

  /// A full-width tile with the ruler.
  Component _number(NumberMetric m, Map<Day, num> values) {
    final saved = values[today];
    final v = _shown(m, saved);
    final near = nearestDay(values.keys, today);
    final start = near == null ? null : values[near];
    return div(classes: _classes(m, done: v != null, kind: 'wide'), [
      div(classes: 'tile-main', [..._head(m)]),
      NumberEditor(
        key: ValueKey('${m.id} $today'),
        metric: m,
        label: '${m.name} · today',
        current: saved,
        start: start,
        busy: component.busy,
        autofocus: false,
        // The Save button saves. These run only without onChange.
        onSave: (_) {},
        onClear: () {},
        onClose: () {},
        // On an empty day, a tap on the ruler at the start value is a change: it confirms that value.
        onChange: (value) => _set(m, value, saved),
      ),
    ]);
  }
}
