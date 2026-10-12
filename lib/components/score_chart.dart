import 'package:jaspr/dom.dart';
import 'package:jaspr/jaspr.dart';

import '../model/day.dart';
import '../model/score.dart';
import 'trend_chart.dart';

/// The score of [days] as a green line chart from 0, at the top of the 5-day table and of the 31-day calendars.
/// Short periods show the value above each dot. A tap on the title opens the Score view.
///
/// Styles: `article.score-card` and `.score-theme` in lib/constants/theme.dart.
final class ScoreChart extends StatelessComponent {
  const ScoreChart({required this.days, required this.scores, required this.onOpen, super.key});

  /// The days of the chart, oldest first.
  final List<Day> days;

  /// The score of each day. See [dayScores].
  final Map<Day, num> scores;

  /// Opens the Score view.
  final VoidCallback onOpen;

  /// The largest number of days that show the value above each dot. Longer periods have too little space.
  static const _maxDaysWithValues = 7;

  @override
  Component build(BuildContext context) => article(classes: 'score-card score-theme', [
    a(
      href: '#',
      classes: 'metric-link',
      attributes: {'title': 'Show the score only'},
      events: {
        'click': (e) {
          e.preventDefault();
          onOpen();
        },
      },
      [
        span([.text(scoreMetric.name)]),
      ],
    ),
    if (days.any(scores.containsKey))
      TrendChart(
        days: days,
        values: scores,
        unit: scoreMetric.unit,
        fromZero: true,
        showsValues: days.length <= _maxDaysWithValues,
      )
    else
      p(classes: 'secondary-text', [.text('No score in these days.')]),
  ]);
}
