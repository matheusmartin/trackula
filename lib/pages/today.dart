import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../components/habit_table.dart';
import '../model/day.dart';
import '../model/log_entry.dart';
import '../model/metric.dart';
import '../services/prefs.dart';
import '../services/session.dart';
import '../sheets/sheets_store.dart';

/// Shows the active metrics in a HabitKit-style table and records entries.
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
    _run(() async {
      await _store.refreshRules();
      return _store.load();
    });
  }

  Future<void> _run(Future<Snapshot> Function() task) async {
    if (component.session.expired) return component.onExpired();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final data = await task();
      setState(() => _data = data);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _write(LogWrite? Function(LogTable log) plan) => _run(() => _store.change(plan));

  @override
  Component build(BuildContext context) {
    final data = _data;
    final today = Day.today();
    final days = _range.daysUntil(today);
    final active = [
      for (final m in data?.metrics ?? const <Metric>[])
        if (m.active) m,
    ];
    final groups = {for (final m in active) m.group ?? 'other'}.toList();
    final group = groups.contains(_group) ? _group : null;

    return .fragment([
      if (groups.length > 1)
        nav(
          classes: 'scroll chips',
          attributes: {'aria-label': 'Groups'},
          [
            _chip('All', group == null, () => _setGroup(null)),
            for (final g in groups) _chip(g, g == group, () => _setGroup(g)),
          ],
        ),
      nav(classes: 'toolbar-row', [
        button(classes: 'chip', onClick: _toggleRange, [
          i([.text('date_range')]),
          span([.text(_range.label)]),
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
        if (active.isEmpty)
          p(classes: 'secondary-text', [.text('No active metrics. Add rows to the "metrics" tab of the sheet.')])
        else
          HabitTable(
            metrics: [
              for (final m in active)
                if (group == null || (m.group ?? 'other') == group) m,
            ],
            log: data.log,
            today: today,
            range: _range,
            busy: _busy,
            onWrite: _write,
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

  static Component _chip(String label, bool selected, VoidCallback onClick) => button(
    classes: selected ? 'chip fill' : 'chip',
    attributes: {'aria-pressed': '$selected'},
    onClick: onClick,
    [
      if (selected) i([.text('done')]),
      span([.text(label)]),
    ],
  );

  static const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /// Example: "Sep 24".
  static String _short(Day d) => '${_months[d.month - 1]} ${d.day}';
}
