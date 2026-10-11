import 'package:test/test.dart';
import 'package:trackula/model/day.dart';

void main() {
  const d30 = Day(2026, 9, 30);

  group('Day', () {
    test('parses and formats ISO dates', () {
      expect(Day.tryParse('2026-09-30'), d30);
      expect(d30.toString(), '2026-09-30');
    });

    test('adds days across month ends and knows the weekday', () {
      expect(d30.addDays(1), const Day(2026, 10, 1));
      expect(d30.addDays(-30), const Day(2026, 8, 31));
      expect(d30.weekday, DateTime.wednesday);
    });

    test('converts Google Sheets date serial numbers', () {
      expect(const Day(2026, 10, 2).serial, 46297);
      expect(const Day(1900, 3, 1).serial, 61);
      expect(Day.fromSerial(46297), const Day(2026, 10, 2));
      // The fraction is the time of day.
      expect(Day.fromSerial(46297.75), const Day(2026, 10, 2));
      expect(Day.fromSerial(0), isNull);
      for (final d in [const Day(2024, 2, 29), const Day(2026, 3, 29), const Day(2026, 12, 31)]) {
        expect(Day.fromSerial(d.serial), d);
      }
    });

    test('rejects invalid dates', () {
      expect(Day.tryParse('2026-02-30'), isNull);
      expect(Day.tryParse('30/09/2026'), isNull);
      expect(Day.tryParse(''), isNull);
    });
  });

  test('daysBetween: all days, oldest first, and empty if the last day is before the first', () {
    expect(daysBetween(const Day(2026, 2, 27), const Day(2026, 3, 2)).map((d) => '$d'), [
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ]);
    expect(daysBetween(const Day(2026, 3, 2), const Day(2026, 3, 1)), isEmpty);
  });

  test('earliestDay: the earliest day, or null', () {
    expect(earliestDay(const [Day(2026, 3, 2), Day(2025, 12, 31), Day(2026, 1, 1)]), const Day(2025, 12, 31));
    expect(earliestDay(const []), isNull);
  });
}
