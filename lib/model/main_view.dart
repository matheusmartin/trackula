import 'day.dart';

/// The views of the bottom navigation bar: today as input tiles, a table of the last 5 days on all screens, one small
/// calendar per metric for the last 31 days, or the score only.
enum MainView {
  today(1),
  short(5),
  month(31),
  score(null);

  const MainView(this.days);

  /// The number of past days that the view shows. Null for [score]: it shows all days, with zoom buttons.
  final int? days;

  /// The label in the bottom navigation bar.
  String get label => switch (this) {
    MainView.today => 'Today',
    MainView.score => 'Score',
    _ => '$days days',
  };

  /// The Material Symbols icon in the bottom navigation bar.
  String get icon => switch (this) {
    MainView.today => 'today',
    MainView.short => 'view_week',
    MainView.month => 'calendar_month',
    MainView.score => 'show_chart',
  };

  /// The days of the view, oldest first, ending on [today]. Only for a view with [days].
  List<Day> daysUntil(Day today) => daysBetween(today.addDays(1 - days!), today);
}
