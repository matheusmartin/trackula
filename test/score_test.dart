import 'package:test/test.dart';
import 'package:trackula/model/day.dart';
import 'package:trackula/model/log_entry.dart';
import 'package:trackula/model/metric.dart';
import 'package:trackula/model/parse.dart';
import 'package:trackula/model/score.dart';

void main() {
  const weight = NumberMetric(
    id: 'weight',
    name: 'Weight',
    icon: 'monitor_weight',
    unit: 'kg',
    step: 0.1,
    goal: NumberGoal(80, isMaximum: true),
  );
  const reading = NumberMetric(id: 'reading', name: 'Reading', icon: 'menu_book', goal: NumberGoal(20));
  const waist = NumberMetric(id: 'waist', name: 'Waist', icon: 'straighten');
  const water = NumberMetric(id: 'water', name: 'Water', icon: 'water_drop', isCount: true, goal: NumberGoal(2));
  const walk = NumberMetric(id: 'walk', name: 'Walk', icon: 'directions_walk', isCount: true, step: 10);
  const meditate = YesNoMetric(id: 'meditate', name: 'Meditate', icon: 'self_improvement');
  const smoke = YesNoMetric(id: 'smoke', name: 'Smoke', icon: 'smoking_rooms', goalIsYes: false);
  const d29 = Day(2026, 9, 29);
  const d30 = Day(2026, 9, 30);

  group('metricPoints', () {
    test('yesno: 1 if the value is the goal', () {
      expect(metricPoints(meditate, 1), 1);
      expect(metricPoints(meditate, 0), 0);
      expect(metricPoints(smoke, 0), 1);
      expect(metricPoints(smoke, 1), 0);
    });

    test('count: 1 for each step, also above the goal', () {
      expect(metricPoints(water, 3), 3);
      expect(metricPoints(walk, 30), 3);
    });

    test('number: 1 if the value reaches the goal, 0 without goal', () {
      expect(metricPoints(weight, 80), 1);
      expect(metricPoints(weight, 80.1), 0);
      expect(metricPoints(reading, 25), 1);
      expect(metricPoints(reading, 15), 0);
      expect(metricPoints(waist, 90), 0);
    });
  });

  group('dayScores', () {
    final metrics = <Metric>[weight, water, meditate, smoke];
    final log = parseLog(
      [
        ['date', 'weight', 'water', 'meditate', 'smoke'],
        ['2026-09-29', 79.5, 3, 'yes', 'no'],
        ['2026-09-30', 81, '', 'no'],
      ],
      {for (final m in metrics) m.id: m},
    ).table;

    test('adds the points of all metrics of each day', () {
      expect(dayScores(metrics, log.entries), {d29: 6, d30: 0});
    });

    test('a day without a value has no score', () {
      expect(dayScores(metrics, log.entries).containsKey(const Day(2026, 9, 28)), isFalse);
    });

    test('includes count taps that are not written yet', () {
      final pending = {
        ('water', d30): [const CountStep.add(1), const CountStep.add(1)],
        ('water', d29): [const CountStep.add(-1)],
      };
      expect(dayScores(metrics, log.entries, pending), {d29: 5, d30: 2});
    });

    test('a goal change changes the score', () {
      const meditateNo = YesNoMetric(id: 'meditate', name: 'Meditate', icon: 'self_improvement', goalIsYes: false);
      expect(dayScores([meditateNo], log.entries), {d29: 0, d30: 1});
    });

    test('removes float noise of decimal steps', () {
      const sips = NumberMetric(id: 'water', name: 'Sips', icon: 'water_drop', isCount: true, step: 0.1);
      final sipLog = parseLog(
        [
          ['date', 'water'],
          ['2026-09-29', 0.3],
        ],
        {'water': sips},
      ).table;
      expect(dayScores([sips], sipLog.entries), {d29: 3});
    });
  });

  group('staleScoreCells', () {
    final metrics = <Metric>[water, meditate];

    test('finds the score cells that do not show the score of their row', () {
      final cells = staleScoreCells(
        [
          ['date', 'water', 'meditate', 'Score'],
          ['2026-09-27', 3, 'yes', 4],
          ['2026-09-28', 3, 'yes', 3],
          ['2026-09-29', 2, 'no'],
          ['2026-09-30', '', '', 5],
          ['2026-10-01', '', 'no', ''],
          ['2026-10-02', 1, '', 'x'],
          ['bad date', 1, 'yes', 2],
          ['2026-10-03'],
        ],
        metrics,
        3,
      );
      expect(cells, [
        (row: 3, score: 4),
        (row: 4, score: 2),
        (row: 5, score: null),
        (row: 6, score: 0),
        (row: 7, score: 1),
        (row: 8, score: null),
      ]);
    });

    test('a past value or a goal change in the sheet makes the score stale', () {
      final rows = [
        ['date', 'water', 'meditate', 'Score'],
        ['2026-09-29', 3, 'yes', 4],
      ];
      expect(staleScoreCells(rows, metrics, 3), isEmpty);

      final edited = [
        rows[0],
        ['2026-09-29', 5, 'yes', 4],
      ];
      expect(staleScoreCells(edited, metrics, 3), [(row: 2, score: 6)]);

      const meditateNo = YesNoMetric(id: 'meditate', name: 'Meditate', icon: 'self_improvement', goalIsYes: false);
      expect(staleScoreCells(rows, [water, meditateNo], 3), [(row: 2, score: 3)]);
    });

    test('reads a score stored as text', () {
      expect(
        staleScoreCells(
          [
            ['date', 'water', 'Score'],
            ['2026-09-29', 3, '3'],
          ],
          metrics,
          2,
        ),
        isEmpty,
      );
    });
  });

  test('scoreColumn finds the Score header, not a metric id', () {
    expect(scoreColumn(['date', 'score', ' Score ']), 2);
    expect(scoreColumn(['date', 'water']), isNull);
  });

  test('scoreMetric is not a valid metric id, so no metric can be the score', () {
    final p = parseMetrics([
      metricsHeader,
      [scoreHeader, 'Score', 'count', '', '', '', 'star'],
    ]);
    expect(p.items, isEmpty);
    expect(isScore(scoreMetric), isTrue);
    expect(isScore(water), isFalse);
  });
}
