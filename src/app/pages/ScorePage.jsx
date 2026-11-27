import { monthOf } from '../../model/Day.js';
import { Aggregate, defaultStepIndex } from '../../model/Zoom.js';
import { useElementWidth } from '../components/ElementWidth.js';
import { ScoreCharts } from '../components/MetricCharts.jsx';
import { ChartsArea, PeriodBar, usePeriod } from '../components/Period.jsx';
import { ScoreCalendar } from '../components/ScoreCalendar.jsx';
import { WIDE_CONTENT } from '../components/Sizes.js';
import './MetricDetail.css';

/** @import { JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { Metric } from '../../model/Metric.js' */

/**
 * The Score view: the score of each day over a period. Key numbers and charts over time, by weekday, by group and by
 * metric, and a read-only month calendar with the score of each day: the app calculates the scores.
 *
 * The period works as on the detail screen of a metric (see `usePeriod`). It opens at All. The group filter of the
 * page selects the metrics of the score: the parent gives a new key for each group, so each group starts with its own
 * period.
 * @param {object} props
 * @param {string} props.title "Score", or the score of the group of the filter, for example "Score · Habits".
 * @param {Map<Day, number>} props.scores The score of each day with a score. See `dayScores`.
 * @param {Day} props.today
 * @param {Metric[]} props.metrics The metrics of the score.
 * @param {Map<string, Map<Day, number>>} props.points The points of each metric by metric id. See `pointsByMetric`.
 * @returns {JSX.Element}
 */
export function ScorePage({ title, scores, today, metrics, points }) {
  const [measure, width] = useElementWidth();
  const period = usePeriod(scores, today, (steps) => defaultStepIndex(null, steps));
  return (
    <div ref={measure} class="metric-detail score-theme">
      <div class="metric-detail-header">
        <h2 class="metric-detail-title headline-small">{title}</h2>
      </div>
      <PeriodBar period={period} values={scores} aggregate={Aggregate.AVERAGE} fromZero wide={width >= WIDE_CONTENT} />
      <ChartsArea period={period}>
        <ScoreCharts window={period.window} values={scores} scoreMetrics={metrics} points={points} />
      </ChartsArea>
      <ScoreCalendar
        scores={scores}
        today={today}
        month={period.month ?? monthOf(period.window.to)}
        onMonth={period.setMonth}
      />
    </div>
  );
}
