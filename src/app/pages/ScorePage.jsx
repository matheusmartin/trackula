import { useMemo } from 'preact/hooks';
import { StripKind, dayBars } from '../../model/DayBars.js';
import { monthOf } from '../../model/Day.js';
import { formatScore } from '../../model/Format.js';
import { defaultStepIndex } from '../../model/Zoom.js';
import { useElementWidth } from '../components/ElementWidth.js';
import { ScoreCharts } from '../components/ScoreCharts.jsx';
import { ChartsArea, PeriodBar, useBarTap, usePeriod } from '../components/Period.jsx';
import { ScoreCalendar } from '../components/ScoreCalendar.jsx';
import { WIDE_CONTENT } from '../components/Sizes.js';
import './MetricDetail.css';

/** @import { JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { DayBar } from '../../model/DayBars.js' */
/** @import { Metric } from '../../model/Metric.js' */

/**
 * The Score view: the score of each day over a period. Key numbers and charts over time, by weekday, by group and by
 * metric, and the Days card with the score of each day, read-only: the app calculates the scores. A tap on a bar of
 * "Average per day" shows its month in the Days card (see `useBarTap`).
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
  const { calendar, onBar } = useBarTap(period);
  const first = period.window.first;
  const bars = useMemo(() => dayBars(StripKind.SCORE, scores, new Map(), first, today), [scores, first, today]);
  return (
    <div ref={measure} class="metric-detail">
      <div class="metric-detail-header">
        <h2 class="metric-detail-title headline-small">{title}</h2>
      </div>
      <PeriodBar period={period} bars={bars} valueText={scoreText} wide={width >= WIDE_CONTENT} />
      <ChartsArea period={period}>
        <ScoreCharts window={period.window} values={scores} scoreMetrics={metrics} points={points} onBar={onBar} />
      </ChartsArea>
      <div ref={calendar} class="metric-detail-days">
        <ScoreCalendar
          scores={scores}
          today={today}
          month={period.month ?? monthOf(period.window.to)}
          onMonth={period.setMonth}
        />
      </div>
    </div>
  );
}

/**
 * The score of a bar of the day strip. Examples: "score 64.0%", "score 57.1% on average".
 * @param {DayBar} bar
 * @returns {string}
 */
function scoreText(bar) {
  const text = `score ${formatScore((bar.points ?? 0) * 100)}`;
  return bar.start === bar.end ? text : `${text} on average`;
}
