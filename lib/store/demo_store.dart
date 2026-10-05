import 'dart:math' as math;

import '../model/day.dart';
import '../model/log.dart';
import '../model/parse.dart';
import 'store.dart';

/// Demo mode: sample metrics and 120 days of sample values in memory. Nothing goes to Google Sheets, and a reload
/// starts again from the sample data. Open the app with `?demo`. See README.md.
///
/// It keeps the tabs as rows of cells, as the Sheets API returns them, and uses the same parsers and write plans as
/// [SheetsStore]. Today has no values, so that all inputs can be tried. Each call waits [delay], as a network call.
final class DemoStore implements Store {
  DemoStore({Day? today, this.delay = const Duration(milliseconds: 400)}) : _log = _sampleLog(today ?? Day.today());

  final Duration delay;

  static const _metrics = [
    ['weight', 'Weight', 'number', 'kg', 0.1, 'Health', 'monitor_weight'],
    ['waist', 'Waist', 'number', 'cm', 0.5, 'Health', 'straighten'],
    ['teeth', 'Morning teeth', 'yesno', '', '', 'Hygiene', 'dentistry'],
    ['shower', 'Morning shower', 'yesno', '', '', 'Hygiene', 'shower'],
    ['meditate', 'Meditate', 'yesno', '', '', 'Activities', 'self_improvement'],
    ['read', 'Read', 'yesno', '', '', 'Activities', 'menu_book'],
    ['water', 'Water', 'count', 'glasses', 1, 'Nutrition', 'water_drop'],
    ['walk', 'Walk', 'count', 'min', 10, 'Activities', 'directions_walk'],
    ['vitamins', 'Vitamins', 'yesno', '', '', 'Nutrition', 'pill'],
  ];

  final List<List<Object?>> _log;

  /// One row for each of the 120 days before [today]. Values are random, with a fixed seed: the same each time.
  static List<List<Object?>> _sampleLog(Day today) {
    final r = math.Random(7);
    final ids = [for (final m in _metrics) m[0]];
    var weight = 84.0;
    return [
      ['date', ...ids],
      for (var i = 120; i >= 1; i--)
        [
          today.addDays(-i).toString(),
          for (final m in _metrics)
            if (r.nextDouble() < 0.15)
              ''
            else
              switch (m) {
                ['weight', ...] => double.parse((weight += (r.nextDouble() - 0.55) * 0.4).toStringAsFixed(1)),
                ['waist', ...] => i % 7 == 0 ? ((95 - (120 - i) / 40) * 2).round() / 2 : '',
                [_, _, 'yesno', ...] => r.nextDouble() < 0.75 ? 'yes' : 'no',
                ['water', ...] => 3 + r.nextInt(6),
                _ => 10 * (1 + r.nextInt(6)),
              },
        ],
    ];
  }

  @override
  Future<void> refreshRules() => Future.delayed(delay);

  @override
  Future<Snapshot> load() async {
    await Future<void>.delayed(delay);
    final metrics = parseMetrics([metricsHeader, ..._metrics]);
    final log = parseLog(_log, {for (final m in metrics.items) m.id: m});
    return Snapshot(metrics.items, log.table, [...metrics.warnings, ...log.warnings]);
  }

  @override
  Future<Snapshot> change(List<LogPlan> plans) async {
    var data = await load();
    for (final plan in plans) {
      if (plan(data.log) case final w?) {
        await Future<void>.delayed(delay);
        _apply(w);
        data = await load();
      }
    }
    return data;
  }

  void _apply(LogWrite w) {
    switch (w) {
      case AppendRow():
        _log.add(w.toCells());
      case SetCell(:final row, :final column, :final value):
        final cells = _log[row - 1];
        while (cells.length <= column) {
          cells.add('');
        }
        cells[column] = value ?? '';
    }
  }
}
