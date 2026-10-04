import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../components/habit_table.dart';
import '../components/today_tiles.dart';
import '../model/day.dart';
import '../model/log_entry.dart';
import '../model/metric.dart';
import '../services/prefs.dart';
import '../sheets/store.dart';
import 'metric_detail.dart';

/// Shows the metrics in a HabitKit-style table and records entries.
class TodayPage extends StatefulComponent {
  const TodayPage({
    required this.store,
    required this.expired,
    required this.onExpired,
    required this.range,
    required this.onRange,
    required this.onDetail,
    required this.reload,
    required this.onBusy,
    super.key,
  });

  /// The store of the sheet, or of demo mode. The page keeps the first one.
  final Store store;

  /// True after the Google sign-in expired. Then [onExpired] runs instead of a store call.
  final bool Function() expired;
  final VoidCallback onExpired;

  /// The view: the Today tiles, the 5-day table or the 31-day calendars. The App owns it, because the bottom
  /// navigation bar is a child of `<body>`, outside this page. See App.
  final DayRange range;

  /// Changes [range].
  final void Function(DayRange range) onRange;

  /// Called with true when a metric detail screen opens, and with false when it closes. The App hides the bottom
  /// navigation bar on the detail screen.
  final void Function(bool open) onDetail;

  /// The reload button in the app bar calls [ReloadHandle.run]. The page sets it.
  final ReloadHandle reload;

  /// Called when a load or a write starts (true) and ends (false). The app bar shows a progress circle.
  final void Function(bool busy) onBusy;

  @override
  State<TodayPage> createState() => _TodayPageState();
}

class _TodayPageState extends State<TodayPage> {
  late final Store _store = component.store;
  Snapshot? _data;
  bool _busy = false;
  String? _error;

  DayRange get _range => component.range;

  /// The selected group, or null for all groups.
  String? _group = LocalPrefs.get('group');

  /// The id of the metric with the open detail screen. Null shows the table.
  String? _detail;

  /// Count taps that wait for a write, per metric id and day, in tap order.
  final _queued = <(String, Day), List<CountStep>>{};

  /// Count taps in the write that runs now. The table shows them until the new data arrives.
  final _sending = <(String, Day), List<CountStep>>{};

  /// Opens the detail screen of the metric [id], or closes it with null.
  void _openDetail(String? id) {
    setState(() => _detail = id);
    component.onDetail(id != null);
  }

  void _setGroup(String? g) => setState(() {
    _group = g;
    LocalPrefs.set('group', g);
  });

  /// Tells the app bar about [busy] after the current build: the first load starts in [initState], and the App
  /// must not rebuild during a build.
  void _notifyBusy(bool busy) => Future(() {
    if (mounted) component.onBusy(busy);
  });

  void _reload() => _run(_store.load);

  @override
  void dispose() {
    // A new page (another sheet) can already use the handle.
    if (component.reload.run == _reload) component.reload.run = null;
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    component.reload.run = _reload;
    _run(() async {
      await _store.refreshRules();
      return _store.load();
    });
  }

  /// Runs [task] and shows its data. [done] runs in the same update as the new data or the error.
  /// After that, the count taps that came during the task get written.
  Future<void> _run(Future<Snapshot> Function() task, {VoidCallback? done}) async {
    if (component.expired()) return component.onExpired();
    setState(() {
      _busy = true;
      _error = null;
    });
    _notifyBusy(true);
    try {
      final data = await task();
      setState(() {
        _data = data;
        done?.call();
      });
    } catch (e) {
      setState(() {
        _error = '$e';
        done?.call();
      });
    } finally {
      if (mounted) {
        setState(() => _busy = false);
        _notifyBusy(false);
        _writeCounts();
      }
    }
  }

  void _write(LogWrite? Function(LogTable log) plan) => _run(() => _store.change(plan));

  /// Saves the values of the Today tiles. After a successful save, the page shows the last 5 days. It does not save
  /// that range: the app still opens on the saved range, for example Today. After an error, the Today tiles stay.
  Future<void> _writeAll(List<LogWrite? Function(LogTable log)> plans) async {
    await _run(() => _store.changeAll(plans));
    if (mounted && _error == null) component.onRange(DayRange.short);
  }

  /// Adds a count tap. The table shows it at once. The write starts when no other write runs.
  void _count(NumberMetric m, Day d, CountStep step) {
    setState(() => (_queued[(m.id, d)] ??= []).add(step));
    _writeCounts();
  }

  /// Writes the queued count taps: one write for each cell, with all taps of that cell.
  ///
  /// One write at a time, so two writes cannot overwrite each other. Each write adds the taps
  /// to the latest value in the sheet. If a write fails, its taps are dropped and the error shows.
  void _writeCounts() {
    if (_busy || _queued.isEmpty) return;
    final metrics = {for (final m in _data?.metrics ?? const <Metric>[]) m.id: m};
    setState(() {
      _sending.addAll(_queued);
      _queued.clear();
    });
    _run(() async {
      Snapshot? data;
      for (final MapEntry(key: (id, day), value: steps) in _sending.entries) {
        if (metrics[id] case final NumberMetric m) data = await _store.change((log) => planCount(m, day, steps, log));
      }
      return data ?? _store.load();
    }, done: _sending.clear);
  }

  @override
  Component build(BuildContext context) {
    final data = _data;
    final today = Day.today();
    final days = _range.daysUntil(today);
    final metrics = data?.metrics ?? const <Metric>[];
    final groups = {for (final m in metrics) m.group ?? 'other'}.toList();
    final group = groups.contains(_group) ? _group : null;
    final shown = [
      for (final m in metrics)
        if (group == null || (m.group ?? 'other') == group) m,
    ];
    final pending = {
      for (final key in {..._sending.keys, ..._queued.keys}) key: [...?_sending[key], ...?_queued[key]],
    };

    // The detail screen of one metric. If the metric is gone from the sheet, the table shows again.
    if ((data, metrics.where((m) => m.id == _detail).firstOrNull) case (final data?, final metric?)) {
      return .fragment([
        MetricDetail(
          key: ValueKey(metric.id),
          metric: metric,
          log: data.log,
          today: today,
          busy: _busy,
          onWrite: _write,
          pending: pending,
          onCount: _count,
          onBack: () => _openDetail(null),
        ),
        if (_error case final e?) p(classes: 'error-text', [.text(e)]),
      ]);
    }

    return .fragment([
      if (groups.length > 1)
        nav(
          classes: 'chips',
          attributes: {'aria-label': 'Groups'},
          [
            _chip('All', group == null, () => _setGroup(null)),
            for (final g in groups) _chip(g, g == group, () => _setGroup(g)),
          ],
        ),
      if (_error case final e?) p(classes: 'error-text', [.text(e)]),
      if (data != null) ...[
        if (metrics.isEmpty)
          p(classes: 'secondary-text', [.text('No metrics. Add rows to the "Metrics" tab of the sheet.')])
        else if (_range == DayRange.today)
          TodayTiles(
            metrics: shown,
            log: data.log,
            today: today,
            busy: _busy,
            onWriteAll: _writeAll,
            pending: pending,
          )
        else
          HabitTable(
            metrics: shown,
            log: data.log,
            today: today,
            days: days,
            layout: _range == DayRange.month ? DayLayout.calendars : DayLayout.table,
            busy: _busy,
            onWrite: _write,
            pending: pending,
            onCount: _count,
            onOpen: (m) => _openDetail(m.id),
          ),
        if (data.warnings.isNotEmpty)
          article(classes: 'border warnings', [
            h6([
              i(classes: 'error-text', [.text('warning')]),
              span([.text(' Sheet warnings')]),
            ]),
            ul([
              for (final w in data.warnings) li([.text(w)]),
            ]),
          ]),
      ],
    ]);
  }

  /// A group filter chip. The label starts with a capital letter: "habits" shows as "Habits".
  static Component _chip(String label, bool selected, VoidCallback onClick) => button(
    classes: selected ? 'chip selected' : 'chip',
    attributes: {'aria-pressed': '$selected'},
    onClick: onClick,
    [
      if (selected) i([.text('done')]),
      span([.text(label.isEmpty ? label : label[0].toUpperCase() + label.substring(1))]),
    ],
  );
}

/// Lets the app bar reload the data of the Today page. The page sets [run] when it starts.
final class ReloadHandle {
  VoidCallback? run;
}
