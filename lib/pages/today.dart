import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../components/habit_table.dart';
import '../components/score_chart.dart';
import '../components/today_tiles.dart';
import '../model/count_queue.dart';
import '../model/day.dart';
import '../model/log_entry.dart';
import '../model/main_view.dart';
import '../model/metric.dart';
import '../model/score.dart';
import '../services/prefs.dart';
import '../sheets/store.dart';
import 'metric_detail.dart';

/// The main page: the metrics in Today tiles, a HabitKit-style table or calendars, where the user records entries, or
/// the score only. The table and the calendars start with a line chart of the score. The Today tiles do not show it.
final class TodayPage extends StatefulComponent {
  const TodayPage({
    required this.store,
    required this.expired,
    required this.onExpired,
    required this.view,
    required this.onView,
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

  /// The view: the Today tiles, the 5-day table, the 31-day calendars or the score. The App owns it, because the
  /// bottom navigation bar is a child of `<body>`, outside this page. See App.
  final MainView view;

  /// Changes [view].
  final void Function(MainView view) onView;

  /// Called when a metric detail screen opens or closes. The App hides the bottom navigation bar on the detail screen.
  final void Function({required bool open}) onDetail;

  /// The reload button in the app bar calls [ReloadHandle.run]. The page sets it.
  final ReloadHandle reload;

  /// Called when a load or a write starts and ends. The app bar shows a progress circle while `busy` is true.
  final void Function({required bool busy}) onBusy;

  @override
  State<TodayPage> createState() => _TodayPageState();
}

class _TodayPageState extends State<TodayPage> {
  late final Store _store = component.store;
  Snapshot? _data;
  bool _busy = false;
  String? _error;

  MainView get _view => component.view;

  /// The selected group, or null for all groups.
  String? _group = readPref('group');

  /// The id of the metric with the open detail screen. Null shows the table.
  String? _detailId;

  /// The count taps that are not in the sheet yet. The table shows them at once.
  final _counts = CountQueue();

  void _openDetail(String id) {
    setState(() => _detailId = id);
    component.onDetail(open: true);
  }

  void _closeDetail() {
    setState(() => _detailId = null);
    component.onDetail(open: false);
  }

  void _setGroup(String? group) => setState(() {
    _group = group;
    writePref('group', group);
  });

  /// Tells the app bar about [busy] after the current build: the first load starts in [initState], and the App
  /// must not rebuild during a build.
  void _notifyBusy({required bool busy}) => Future(() {
    if (mounted) component.onBusy(busy: busy);
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
    _notifyBusy(busy: true);
    try {
      final data = await task();
      setState(() => _data = data);
    } on Exception catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) {
        // In the same update as the new data or the error. Also after an Error, so that the taps of a failed write
        // are not written again.
        setState(() {
          _busy = false;
          done?.call();
        });
        _notifyBusy(busy: false);
        _writeCounts();
      }
    }
  }

  void _write(LogWrite? Function(LogTable log) plan) => _run(() => _store.change(plan));

  /// Saves the values of the Today tiles. After a successful save, the page shows the last 5 days. The app still
  /// opens on the Today tiles. After an error, the Today tiles stay.
  Future<void> _writeAll(List<LogWrite? Function(LogTable log)> plans) async {
    await _run(() => _store.changeAll(plans));
    if (mounted && _error == null) component.onView(MainView.short);
  }

  /// Adds a count tap. The table shows it at once. The write starts when no other write runs.
  void _count(NumberMetric m, Day d, CountStep step) {
    setState(() => _counts.add(m.id, d, step));
    _writeCounts();
  }

  /// Writes the queued count taps: one write for each cell, with all taps of that cell. See [CountQueue].
  ///
  /// One write at a time: it waits while another load or write runs. If a write fails, its taps are dropped and the
  /// error shows.
  void _writeCounts() {
    if (_busy || !_counts.hasQueued) return;
    final metrics = {for (final m in _data?.metrics ?? const <Metric>[]) m.id: m};
    late final List<LogWrite? Function(LogTable log)> plans;
    setState(() => plans = _counts.send(metrics));
    _run(() => _store.changeAll(plans), done: _counts.sent);
  }

  @override
  Component build(BuildContext context) {
    final data = _data;
    final today = Day.today();
    final metrics = data?.metrics ?? const <Metric>[];
    final pending = _counts.pending;
    final error = [
      if (_error case final e?) p(classes: 'error-text', [.text(e)]),
    ];
    // The scores of all metrics, also with a group filter.
    final scores = data == null ? const <Day, num>{} : dayScores(metrics, data.log, pending);

    // The detail screen of one metric. If the metric is gone from the sheet, the table shows again.
    if ((data, metrics.where((m) => m.id == _detailId).firstOrNull) case (final data?, final metric?)) {
      return .fragment([
        _detail(metric, data, today, pending, scores, onBack: _closeDetail),
        ...error,
      ]);
    }

    final groups = {for (final m in metrics) _groupOf(m)}.toList();
    final group = groups.contains(_group) ? _group : null;
    return .fragment([
      // The score view shows all metrics: no group filter.
      if (groups.length > 1 && _view != MainView.score) _groupChips(groups, group),
      ...error,
      if (data != null) ...[
        if (metrics.isEmpty)
          p(classes: 'secondary-text', [.text('No metrics. Add rows to the "Metrics" tab of the sheet.')])
        else
          ..._days(
            data,
            [
              for (final m in metrics)
                if (group == null || _groupOf(m) == group) m,
            ],
            today,
            pending,
            scores,
          ),
        if (data.warnings.isNotEmpty) _warnings(data.warnings),
      ],
    ]);
  }

  static String _groupOf(Metric m) => m.group ?? 'other';

  /// The content of [_view] for [metrics]: the Today tiles, the 5-day table or the 31-day calendars after the score
  /// chart, or the detail screen of the score.
  ///
  /// A list, not a fragment: Jaspr fails when it replaces a fragment inside a fragment with another component.
  List<Component> _days(
    Snapshot data,
    List<Metric> metrics,
    Day today,
    Map<(String, Day), List<CountStep>> pending,
    Map<Day, num> scores,
  ) => switch (_view) {
    MainView.today => [
      TodayTiles(
        metrics: metrics,
        log: data.log,
        today: today,
        busy: _busy,
        onWriteAll: _writeAll,
        pending: pending,
      ),
    ],
    MainView.score => [_detail(scoreMetric, data, today, pending, scores)],
    MainView.short || MainView.month => [
      ScoreChart(days: _view.daysUntil(today), scores: scores, onOpen: () => component.onView(MainView.score)),
      HabitTable(
        metrics: metrics,
        log: data.log,
        today: today,
        days: _view.daysUntil(today),
        layout: _view == MainView.month ? DayLayout.calendars : DayLayout.table,
        busy: _busy,
        onWrite: _write,
        pending: pending,
        onCount: _count,
        onOpen: (m) => _openDetail(m.id),
      ),
    ],
  };

  /// The detail screen of [metric], or of [scoreMetric] for the score view. Without [onBack], it has no back button.
  Component _detail(
    Metric metric,
    Snapshot data,
    Day today,
    Map<(String, Day), List<CountStep>> pending,
    Map<Day, num> scores, {
    VoidCallback? onBack,
  }) => MetricDetail(
    key: ValueKey(metric.id),
    metric: metric,
    log: data.log,
    today: today,
    busy: _busy,
    onWrite: _write,
    pending: pending,
    onCount: _count,
    scores: scores,
    onBack: onBack,
  );

  /// The group filter: All, and one chip for each of [groups]. [selected] is null for All.
  Component _groupChips(List<String> groups, String? selected) => nav(
    classes: 'chips',
    attributes: {'aria-label': 'Groups'},
    [
      _chip('All', selected: selected == null, onClick: () => _setGroup(null)),
      for (final g in groups) _chip(g, selected: g == selected, onClick: () => _setGroup(g)),
    ],
  );

  /// A group filter chip. The label starts with a capital letter: "habits" shows as "Habits".
  static Component _chip(String label, {required bool selected, required VoidCallback onClick}) => button(
    classes: selected ? 'chip selected' : 'chip',
    attributes: {'aria-pressed': '$selected'},
    onClick: onClick,
    [
      if (selected) i([.text('done')]),
      span([.text(label.isEmpty ? label : '${label[0].toUpperCase()}${label.substring(1)}')]),
    ],
  );

  static Component _warnings(List<String> warnings) => article(classes: 'border warnings', [
    h6([
      i(classes: 'error-text', [.text('warning')]),
      span([.text(' Sheet warnings')]),
    ]),
    ul([
      for (final w in warnings) li([.text(w)]),
    ]),
  ]);
}

/// A handle that lets the app bar reload the data of the Today page. The page sets [run] when it starts.
final class ReloadHandle {
  VoidCallback? run;
}
