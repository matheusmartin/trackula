import 'day.dart';

/// How many past days the app shows: today as input tiles (see TodayTiles), a table of the last 5 days on all
/// screens, or one small calendar per metric for the last 31 days.
enum DayRange {
  today(1),
  short(5),
  month(31);

  const DayRange(this.days);

  final int days;

  /// The label in the bottom navigation bar.
  String get label => days == 1 ? 'Today' : '$days days';

  /// The Material Symbols icon in the bottom navigation bar.
  String get icon => switch (this) {
    DayRange.today => 'today',
    DayRange.short => 'view_week',
    DayRange.month => 'calendar_month',
  };

  /// The days of the range, oldest first, ending on [today].
  List<Day> daysUntil(Day today) => [for (var i = days - 1; i >= 0; i--) today.addDays(-i)];
}
