import 'dart:js_interop';

import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';
import 'package:web/web.dart' as web;

import '../components/habit_table.dart';
import '../model/day.dart';
import '../model/log_entry.dart';
import '../model/metric.dart';
import '../services/prefs.dart';
import '../services/session.dart';
import '../sheets/sheets_store.dart';

/// Shows the metrics in a HabitKit-style table and records entries.
class TodayPage extends StatefulComponent {
  const TodayPage({required this.session, required this.sheetId, required this.onExpired, super.key});

  final Session session;
  final String sheetId;
  final VoidCallback onExpired;

  @override
  State<TodayPage> createState() => _TodayPageState();
}

class _TodayPageState extends State<TodayPage> {
  late final SheetsStore _store = component.session.store(component.sheetId);
  Snapshot? _data;
  bool _busy = false;
  String? _error;
  DayRange _range = DayRange.values.asNameMap()[LocalPrefs.get('range')] ?? DayRange.week;

  /// The selected group, or null for all groups.
  String? _group = LocalPrefs.get('group');

  /// Count taps that wait for a write, per metric id and day, in tap order.
  final _queued = <(String, Day), List<CountStep>>{};

  /// Count taps in the write that runs now. The table shows them until the new data arrives.
  final _sending = <(String, Day), List<CountStep>>{};

  /// Phone screens: the same width as the phone rules in lib/constants/theme.dart.
  final _phoneQuery = web.window.matchMedia('(max-width: 480px)');
  late bool _phone = _phoneQuery.matches;
  late final JSFunction _onPhoneChange = ((web.Event _) => setState(() => _phone = _phoneQuery.matches)).toJS;

  void _toggleRange() => setState(() {
    _range = _range == DayRange.week ? DayRange.month : DayRange.week;
    LocalPrefs.set('range', _range.name);
  });

  void _setGroup(String? g) => setState(() {
    _group = g;
    LocalPrefs.set('group', g);
  });

  @override
  void initState() {
    super.initState();
    _phoneQuery.addEventListener('change', _onPhoneChange);
    _run(() async {
      await _store.refreshRules();
      return _store.load();
    });
  }

  @override
  void dispose() {
    _phoneQuery.removeEventListener('change', _onPhoneChange);
    super.dispose();
  }

  /// Runs [task] and shows its data. [done] runs in the same update as the new data or the error.
  /// After that, the count taps that came during the task get written.
  Future<void> _run(Future<Snapshot> Function() task, {VoidCallback? done}) async {
    if (component.session.expired) return component.onExpired();
    setState(() {
      _busy = true;
      _error = null;
    });
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
        _writeCounts();
      }
    }
  }

  void _write(LogWrite? Function(LogTable log) plan) => _run(() => _store.change(plan));

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
    final days = _range.daysUntil(today, phone: _phone);
    final metrics = data?.metrics ?? const <Metric>[];
    final groups = {for (final m in metrics) m.group ?? 'other'}.toList();
    final group = groups.contains(_group) ? _group : null;

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
      nav(classes: 'toolbar-row', [
        button(classes: 'chip', onClick: _toggleRange, [
          i([.text('date_range')]),
          span([.text(_range.label(phone: _phone))]),
        ]),
        span(classes: 'max small-text secondary-text range', [
          .text('${_short(days.first)} — ${_short(days.last)}'),
        ]),
        if (_busy) progress(classes: 'circle small', []),
        button(
          classes: 'circle transparent',
          disabled: _busy,
          attributes: {'title': 'Reload'},
          onClick: () => _run(_store.load),
          [
            i([.text('refresh')]),
          ],
        ),
      ]),
      if (_error case final e?) p(classes: 'error-text', [.text(e)]),
      if (data != null) ...[
        if (metrics.isEmpty)
          p(classes: 'secondary-text', [.text('No metrics. Add rows to the "metrics" tab of the sheet.')])
        else
          HabitTable(
            metrics: [
              for (final m in metrics)
                if (group == null || (m.group ?? 'other') == group) m,
            ],
            log: data.log,
            today: today,
            range: _range,
            phone: _phone,
            busy: _busy,
            onWrite: _write,
            pending: {
              for (final key in {..._sending.keys, ..._queued.keys}) key: [...?_sending[key], ...?_queued[key]],
            },
            onCount: _count,
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

  static const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /// Example: "Sep 24".
  static String _short(Day d) => '${_months[d.month - 1]} ${d.day}';
}
