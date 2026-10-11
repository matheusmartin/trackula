import 'day.dart';

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
