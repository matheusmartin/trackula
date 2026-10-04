import 'package:test/test.dart';
import 'package:trackula/model/day.dart';
import 'package:trackula/model/log_entry.dart';
import 'package:trackula/model/metric.dart';
import 'package:trackula/sheets/demo_store.dart';

void main() {
  const today = Day(2026, 10, 3);
  DemoStore store() => DemoStore(today: today, delay: Duration.zero);

  test('loads the sample data without warnings, and today has no values', () async {
    final s = await store().load();
    expect(s.warnings, isEmpty);
    expect(s.metrics, hasLength(9));
    expect(s.log.rows, hasLength(120));
    expect(s.log.rows.containsKey(today), isFalse);
  });

  test('changeAll adds one row for today, also for two values', () async {
    final st = store();
    final metrics = (await st.load()).metrics;
    final weight = metrics.firstWhere((m) => m.id == 'weight') as NumberMetric;
    final meditate = metrics.firstWhere((m) => m.id == 'meditate') as YesNoMetric;
    final s = await st.changeAll([
      (log) => planNumber(weight, today, 82.3, log),
      (log) => planYesNo(meditate, today, true, log),
    ]);
    expect(s.warnings, isEmpty);
    expect(s.log.rows, hasLength(121));
    expect(s.log.valueAt('weight', today), 82.3);
    expect(s.log.valueAt('meditate', today), 1);

    final cleared = await st.change((log) => planClear(weight, today, log));
    expect(cleared.log.valueAt('weight', today), isNull);
  });
}
