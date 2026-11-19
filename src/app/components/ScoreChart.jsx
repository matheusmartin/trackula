import { AppCard } from './AppCard.jsx';
import { outset } from './Outset.js';
import { Symbol } from './Symbol.jsx';
import { TrendChart } from './TrendChart.jsx';
import './ScoreChart.css';

/** @import { JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { NumberMetric } from '../../model/Metric.js' */

/** The largest number of days that show the value above each bar. Longer periods have too little space. */
const MAX_DAYS_WITH_VALUES = 7;

/**
 * The score of `days` as green bars from 0, one for each day, at the top of the 5-day table and of the 31-day
 * calendars. Short periods show the value above each bar. A tap on the title opens the Score view with `onOpen`.
 *
 * The score is green, not the theme red.
 * @param {object} props
 * @param {NumberMetric} props.score `scoreMetric`, or a `groupScoreMetric` with a group filter. Its name is the title.
 * @param {Day[]} props.days
 * @param {Map<Day, number>} props.scores The score of each day. See `dayScores`.
 * @param {() => void} props.onOpen
 * @returns {JSX.Element}
 */
export function ScoreChart({ score, days, scores, onOpen }) {
  return (
    <AppCard class="score-chart">
      {/* The arrow shows that the title opens the Score view. */}
      <button
        type="button"
        class="score-chart-title"
        style={outset(8, 4)}
        title="Show the score only"
        aria-label="Show the score only"
        onClick={() => onOpen()}
      >
        <span class="title-medium">{score.name}</span>
        <Symbol name="chevron_right" size={20} color="var(--on-surface-variant)" />
      </button>
      {days.some((d) => scores.has(d)) ? (
        // Room above the chart for the value labels.
        <div class="score-chart-chart">
          <TrendChart
            days={days}
            values={scores}
            unit={score.unit}
            showsBars
            showsValues={days.length <= MAX_DAYS_WITH_VALUES}
            color="var(--done)"
          />
        </div>
      ) : (
        <p class="score-chart-empty body-medium">No score in these days.</p>
      )}
    </AppCard>
  );
}
