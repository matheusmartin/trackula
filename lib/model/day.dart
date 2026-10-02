/// A calendar day without time or time zone. Stored as `YYYY-MM-DD`.
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

  /// Returns null if [s] is not a valid `YYYY-MM-DD` date.
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
