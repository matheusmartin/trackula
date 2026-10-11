import 'package:meta/meta.dart';

/// A calendar day without time or time zone. Stored as `YYYY-MM-DD`.
@immutable
final class Day implements Comparable<Day> {
  const Day(this.year, this.month, this.day);

  factory Day.fromDateTime(DateTime t) => Day(t.year, t.month, t.day);

  factory Day.today() => Day.fromDateTime(DateTime.now());

  final int year;
  final int month;
  final int day;

  /// 1 = Monday, 7 = Sunday.
  int get weekday => DateTime(year, month, day).weekday;

  Day addDays(int n) => Day.fromDateTime(DateTime(year, month, day + n));

  /// Day 0 of the Google Sheets date count. Sheets stores a date as the number of days since this day.
  static final _sheetsEpoch = DateTime.utc(1899, 12, 30);

  /// The day of a Google Sheets date serial number. A fraction (the time of day) is ignored.
  /// Returns null for a serial number below 1. Example: 46297 → 2026-10-02.
  static Day? fromSerial(num serial) =>
      serial < 1 ? null : Day.fromDateTime(_sheetsEpoch.add(Duration(days: serial.floor())));

  /// The Google Sheets date serial number of this day. Example: 2026-10-02 → 46297.
  int get serial => DateTime.utc(year, month, day).difference(_sheetsEpoch).inDays;

  static final _pattern = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$');

  /// The day of a `YYYY-MM-DD` text. Null if [s] is not a valid date.
  static Day? tryParse(String s) {
    final m = _pattern.firstMatch(s.trim());
    if (m == null) return null;
    final d = Day(int.parse(m[1]!), int.parse(m[2]!), int.parse(m[3]!));
    // Reject dates such as 2026-02-30.
    final t = DateTime.utc(d.year, d.month, d.day);
    if (t.year != d.year || t.month != d.month || t.day != d.day) return null;
    return d;
  }

  @override
  String toString() =>
      '${year.toString().padLeft(4, '0')}-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';

  @override
  int compareTo(Day other) => toString().compareTo(other.toString());

  @override
  bool operator ==(Object other) => other is Day && other.year == year && other.month == month && other.day == day;

  @override
  int get hashCode => Object.hash(year, month, day);
}

/// All days from [first] to [last], oldest first. Empty if [last] is before [first].
List<Day> daysBetween(Day first, Day last) => [for (var d = first; d.compareTo(last) <= 0; d = d.addDays(1)) d];

/// The earliest day of [days]. Null if [days] is empty.
Day? earliestDay(Iterable<Day> days) => days.isEmpty ? null : days.reduce((a, b) => a.compareTo(b) <= 0 ? a : b);

/// A month of the calendar.
typedef MonthKey = ({int year, int month});

/// The month of [day].
MonthKey monthOf(Day day) => (year: day.year, month: day.month);

/// The month [delta] months after [month], or before it if [delta] is negative.
MonthKey addMonths(MonthKey month, int delta) => monthOf(Day.fromDateTime(DateTime(month.year, month.month + delta)));

/// All days of [month], oldest first.
List<Day> daysOfMonth(MonthKey month) =>
    daysBetween(Day(month.year, month.month, 1), Day.fromDateTime(DateTime(month.year, month.month + 1, 0)));

/// [days] in week rows, Monday to Sunday. Null fills the days before the first day and after the last day.
List<List<Day?>> weekRows(List<Day> days) {
  final slots = <Day?>[for (var i = 1; i < days.first.weekday; i++) null, ...days];
  while (slots.length % 7 != 0) {
    slots.add(null);
  }
  return [for (var i = 0; i < slots.length; i += 7) slots.sublist(i, i + 7)];
}
