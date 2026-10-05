/// Date formats of the app, in English.
library;

import 'day.dart';
import 'zoom.dart';

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

/// Examples: "Jan", "Sep".
String shortMonth(int month) => monthNames[month - 1].substring(0, 3);

/// The weekday names with 2 letters, Monday first.
const weekdayShort = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/// The weekday letters, Monday first.
const weekdayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/// Example: "Sep 28".
String shortDay(Day d) => '${shortMonth(d.month)} ${d.day}';

/// Example: "Jul 6 – Oct 3, 2026", or "Nov 3, 2025 – Feb 1, 2026" across a year.
String dayRange(Day from, Day to) => from.year == to.year
    ? '${shortDay(from)} – ${shortDay(to)}, ${to.year}'
    : '${shortDay(from)}, ${from.year} – ${shortDay(to)}, ${to.year}';

/// Example: "September 2026".
String monthYear(MonthKey m) => '${monthNames[m.month - 1]} ${m.year}';

/// Example: "September – October 2026", or "December 2025 – January 2026" across a year.
String monthRange(MonthKey from, MonthKey to) =>
    from.year == to.year ? '${monthNames[from.month - 1]} – ${monthYear(to)}' : '${monthYear(from)} – ${monthYear(to)}';

/// The label under a bar. Examples: "Sep 28" (week), "Sep" or "Jan ’26" (month), "Q3 ’26" (quarter). A month shows
/// its year in January and on the [first] bar. The apostrophe tells a year from a day: "Feb ’24" is not "Feb 24".
String barLabel(Day start, BarUnit unit, {bool first = false}) => switch (unit) {
  BarUnit.day || BarUnit.week => shortDay(start),
  BarUnit.month =>
    start.month == 1 || first ? '${shortMonth(start.month)} ’${start.year % 100}' : shortMonth(start.month),
  BarUnit.quarter => 'Q${(start.month + 2) ~/ 3} ’${start.year % 100}',
};

/// The name of a bar in a tooltip. Examples: "Week of Sep 28, 2026", "Sep 2026", "Q3 2026".
String barTitle(Day start, BarUnit unit) => switch (unit) {
  BarUnit.day => '${shortDay(start)}, ${start.year}',
  BarUnit.week => 'Week of ${shortDay(start)}, ${start.year}',
  BarUnit.month => '${shortMonth(start.month)} ${start.year}',
  BarUnit.quarter => 'Q${(start.month + 2) ~/ 3} ${start.year}',
};
