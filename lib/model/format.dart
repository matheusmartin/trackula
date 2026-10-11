import 'day.dart';
import 'zoom.dart';

/// The month names, January first.
const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/// The short weekday names, Monday first. The first letter is the weekday letter of the charts.
const weekdayNames = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/// The first 3 letters of the name of [month]. Example: 9 → "Sep".
String shortMonth(int month) => monthNames[month - 1].substring(0, 3);

/// The short month and the day of [day]. Example: "Sep 28".
String shortDay(Day day) => '${shortMonth(day.month)} ${day.day}';

/// [value] without zeros at the end. Examples: 82.0 → "82", 2.5 → "2.5".
///
/// This also removes float noise, for example 82.10000000000001 → "82.1" and 82.00000000000001 → "82".
String formatTrimmed(num value) {
  final rounded = double.parse(value.toStringAsFixed(6));
  return rounded == rounded.roundToDouble() ? '${rounded.round()}' : '$rounded';
}

/// [value] with at most [decimals] decimals and no zeros at the end. Example: 81.25 → "81.3".
String formatNumber(num value, [int decimals = 1]) => formatTrimmed(double.parse(value.toStringAsFixed(decimals)));

/// Short text for a small cell: 1 decimal at most, and "k" from 1000. Examples: 82.25 → "82.3", 12500 → "12.5k".
String formatCompact(num value) => value.abs() >= 1000 ? '${formatNumber(value / 1000)}k' : formatNumber(value);

/// [text] and the [unit] after a space. Only [text] if [unit] is null. Example: ("82.1", "kg") → "82.1 kg".
String withUnit(String text, String? unit) => unit == null ? text : '$text $unit';

/// [value] with its sign, at most 2 decimals and the [unit]. Examples: −1.3 → "−1.3 kg", 0.5 → "+0.5 kg", 0 → "0 kg".
String formatSigned(num value, String? unit) {
  final sign = value > 0 ? '+' : (value < 0 ? '−' : '');
  return '$sign${withUnit(formatNumber(value.abs(), 2), unit)}';
}

/// A [rate] from 0 to 1 as a whole percentage. Example: 0.756 → "76%".
String formatPercent(double rate) => '${(rate * 100).round()}%';

/// The days from [from] to [to]. Examples: "Jul 6 – Oct 3, 2026", or "Nov 3, 2025 – Feb 1, 2026" across a year.
String formatDateRange(Day from, Day to) => from.year == to.year
    ? '${shortDay(from)} – ${shortDay(to)}, ${to.year}'
    : '${shortDay(from)}, ${from.year} – ${shortDay(to)}, ${to.year}';

/// The name and the year of [month]. Example: "October 2026".
String monthTitle(MonthKey month) => '${monthNames[month.month - 1]} ${month.year}';

/// The names of [first] and the month after it, [second]. Examples: "September – October 2026", or
/// "December 2025 – January 2026" across a year.
String monthPairTitle(MonthKey first, MonthKey second) => first.year == second.year
    ? '${monthNames[first.month - 1]} – ${monthTitle(second)}'
    : '${monthTitle(first)} – ${monthTitle(second)}';

/// The labels of [weeks], the rows of [weekRows]: the first day of each row, with the month on the first row and when
/// the month changes. Example: "Sep 2", "7", "14", "21", "28", "Oct 5".
List<String> weekLabels(List<List<Day?>> weeks) {
  int? month;
  return [
    for (final week in weeks)
      switch (week.nonNulls.first) {
        final d when d.month != month => '${shortMonth(month = d.month)} ${d.day}',
        final d => '${d.day}',
      },
  ];
}

/// The quarter of [month], from 1 to 4.
int quarterOf(int month) => (month + 2) ~/ 3;

/// The label under a bar that starts on [start]. Examples: "Sep 28" (week), "Sep" or "Jan ’26" (month), "Q3 ’26"
/// (quarter). A month shows its year in January and on the [first] bar. The apostrophe tells a year from a day:
/// "Feb ’24" is not "Feb 24".
String barLabel(Day start, BarUnit unit, {bool first = false}) => switch (unit) {
  BarUnit.day || BarUnit.week => shortDay(start),
  BarUnit.month =>
    start.month == 1 || first ? '${shortMonth(start.month)} ’${start.year % 100}' : shortMonth(start.month),
  BarUnit.quarter => 'Q${quarterOf(start.month)} ’${start.year % 100}',
};

/// The name of a bar that starts on [start], for a tooltip. Examples: "Week of Sep 28, 2026", "Sep 2026", "Q3 2026".
String barTitle(Day start, BarUnit unit) => switch (unit) {
  BarUnit.day => '${shortDay(start)}, ${start.year}',
  BarUnit.week => 'Week of ${shortDay(start)}, ${start.year}',
  BarUnit.month => '${shortMonth(start.month)} ${start.year}',
  BarUnit.quarter => 'Q${quarterOf(start.month)} ${start.year}',
};
