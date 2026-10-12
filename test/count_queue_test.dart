import 'package:test/test.dart';
import 'package:trackula/model/count_queue.dart';
import 'package:trackula/model/day.dart';
import 'package:trackula/model/log_entry.dart';
import 'package:trackula/model/metric.dart';
import 'package:trackula/model/parse.dart';

void main() {
  const water = NumberMetric(id: 'water', name: 'Water', icon: 'water_drop', isCount: true);
  const walk = NumberMetric(id: 'walk', name: 'Walk', icon: 'directions_walk', step: 10, isCount: true);
  const meditate = YesNoMetric(id: 'meditate', name: 'Meditate', icon: 'self_improvement');
  final metrics = {
    for (final m in <Metric>[water, walk, meditate]) m.id: m,
  };
  const d30 = Day(2026, 9, 30);
  const d01 = Day(2026, 10, 1);
  const plus = CountStep.add(1);
  const minus = CountStep.add(-1);

  /// The deltas of each cell of [pending], to compare them with `expect`.
  Map<(String, Day), List<num>> deltas(Map<(String, Day), List<CountStep>> pending) => {
    for (final MapEntry(:key, :value) in pending.entries) key: [for (final s in value) s.delta],
  };

  LogTable log(List<List<Object?>> rows) => parseLog([
    ['date', 'water', 'walk', 'meditate'],
    ...rows,
  ], metrics).table;

  test('a new queue has no taps', () {
    final queue = CountQueue();
    expect(queue.hasQueued, isFalse);
    expect(queue.isSending, isFalse);
    expect(queue.pending, isEmpty);
    expect(queue.send(metrics), isEmpty);
  });

  test('add: taps wait in tap order, per cell', () {
    final queue = CountQueue()
      ..add('water', d30, plus)
      ..add('water', d30, minus)
      ..add('water', d01, plus);
    expect(queue.hasQueued, isTrue);
    expect(deltas(queue.pending), {
      ('water', d30): [1, -1],
      ('water', d01): [1],
    });
  });

  test('send: one plan for each cell, with all taps of that cell', () {
    final queue = CountQueue()
      ..add('water', d30, plus)
      ..add('water', d30, plus)
      ..add('walk', d30, const CountStep.add(10));
    final plans = queue.send(metrics);
    expect(queue.hasQueued, isFalse);
    expect(queue.isSending, isTrue);

    final current = log([
      ['2026-09-30', 3, 20],
    ]);
    expect(
      [for (final p in plans) p(current)],
      [
        isA<SetCell>().having((w) => (w.row, w.column, w.value), 'cell', (2, 1, 5)),
        isA<SetCell>().having((w) => (w.row, w.column, w.value), 'cell', (2, 2, 30)),
      ],
    );
  });

  test('a plan adds the taps to the latest value, not to the value at the tap', () {
    final queue = CountQueue()..add('water', d30, plus);
    final plan = queue.send(metrics).single;
    // Another device wrote 6 after the tap.
    final latest = log([
      ['2026-09-30', 6],
    ]);
    expect(plan(latest), isA<SetCell>().having((w) => w.value, 'value', 7));
  });

  test('taps during a write wait for the next write, and pending shows both', () {
    final queue = CountQueue()..add('water', d30, plus);
    queue.send(metrics);
    queue
      ..add('water', d30, plus)
      ..add('water', d01, plus);
    expect(queue.hasQueued, isTrue);
    expect(deltas(queue.pending), {
      ('water', d30): [1, 1],
      ('water', d01): [1],
    });

    queue.sent();
    expect(queue.isSending, isFalse);
    expect(deltas(queue.pending), {
      ('water', d30): [1],
      ('water', d01): [1],
    });
    expect(queue.send(metrics), hasLength(2));
  });

  test('send during a write throws, so two writes cannot overwrite each other', () {
    final queue = CountQueue()..add('water', d30, plus);
    queue
      ..send(metrics)
      ..add('water', d30, plus);
    expect(() => queue.send(metrics), throwsStateError);
  });

  test('sent drops the taps of the write, also after a failed write', () {
    final queue = CountQueue()..add('water', d30, plus);
    queue
      ..send(metrics)
      ..sent();
    expect(queue.pending, isEmpty);
    expect(queue.hasQueued, isFalse);
  });

  test('a metric that is gone or not a number metric gets no plan, and sent drops its taps', () {
    final queue = CountQueue()
      ..add('gone', d30, plus)
      ..add('meditate', d30, plus)
      ..add('water', d30, plus);
    expect(queue.send(metrics), hasLength(1));
    queue.sent();
    expect(queue.pending, isEmpty);
  });

  test('a day without a row gets a new row', () {
    final queue = CountQueue()..add('walk', d01, const CountStep.add(10));
    final plan = queue.send(metrics).single;
    expect(
      plan(log([])),
      isA<AppendRow>().having((w) => w.toCells(), 'cells', ['2026-10-01', '', 10]),
    );
  });
}
