// The key numbers and the charts of the score in the time window of the Score screen.
import { useMemo } from 'preact/hooks';
import { monthOf } from '../../model/Day.js';
import {
  formatNumber,
  formatPercent,
  formatScore,
  formatScoreChange,
  monthTitle,
  shortDay,
  shortMonth,
  weekdayNames,
} from '../../model/Format.js';
import { withoutFloatNoise } from '../../model/LogEntry.js';
import { groupOf } from '../../model/Metric.js';
import { groupParts, groupScores } from '../../model/Score.js';
import {
  COMPARED_MONTHS,
  COMPARED_WEEKS,
  groupWeekdayParts,
  halves,
  monthlyAverages,
  monthsUntil,
  weekMondays,
  weekdaysInRange,
  weeklyAverages,
} from '../../model/ScoreStats.js';
import { STRENGTH_WEIGHT, bestWeekday, countStats, strength } from '../../model/Stats.js';
import { Aggregate, BarUnit, barStart } from '../../model/Zoom.js';
import { ChartGrid, KeyNumbers } from './ChartParts.jsx';
import { BarChart, LineChart, StackedBarChart } from './Charts.jsx';
import { ChangeTable, RangeBarChart } from './CompareCharts.jsx';
import { groupLabel } from './GroupChips.jsx';
import { NoData, timeBarItem, unitName } from './MetricCharts.jsx';
import './MetricCharts.css';

/** @import { JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { Metric } from '../../model/Metric.js' */
/** @import { CountStats } from '../../model/Stats.js' */
/** @import { ZoomWindow } from '../../model/Zoom.js' */

/** No points of the groups: the score of fewer than 2 groups. */
const NO_POINTS = /** @type {Map<string, Map<Day, number>>} */ (new Map());

/**
 * The parts of the score in the week and month tables: the groups with 2 or more groups, else the metrics.
 */
class ScoreParts {
  /**
   * @param {string} noun "group" or "metric".
   * @param {Map<string, Map<Day, number>>} scores The score of each part by day, from 0 to 100, by part id.
   * @param {Map<string, string>} names The name of each part, by part id.
   */
  constructor(noun, scores, names) {
    this.noun = noun;
    this.scores = scores;
    this.names = names;
    Object.freeze(this);
  }

  /**
   * The name of the part `id`.
   * @param {string} id
   * @returns {string}
   */
  name(id) {
    return this.names.get(id) ?? id;
  }
}

/**
 * The score of each of `groups` if there are 2 or more, else the score of each metric of `metrics`: its `points` as a
 * percentage.
 * @param {Metric[]} metrics
 * @param {string[]} groups
 * @param {Map<string, Map<Day, number>>} points
 * @returns {ScoreParts}
 */
function scoreParts(metrics, groups, points) {
  if (groups.length >= 2) {
    return new ScoreParts(
      'group',
      groupScores(metrics, groups, points),
      new Map(groups.map((g) => [g, groupLabel(g)])),
    );
  }
  const scores = new Map(
    [...points].map(([id, byDay]) => [id, new Map([...byDay].map(([d, p]) => [d, withoutFloatNoise(100 * p)]))]),
  );
  return new ScoreParts('metric', scores, new Map(metrics.map((m) => [m.id, m.name])));
}

/**
 * The key numbers and the charts of the score in the time `window` of the Score view. See {@link ScoreContent}.
 * @param {object} props
 * @param {ZoomWindow} props.window
 * @param {Map<Day, number>} props.values The score of each day with a score.
 * @param {Metric[]} props.scoreMetrics The metrics of the score.
 * @param {Map<string, Map<Day, number>>} props.points The points of each metric by metric id. See `pointsByMetric`.
 * @returns {JSX.Element}
 */
export function ScoreCharts({ window, values, scoreMetrics, points }) {
  return (
    <div class="metric-charts">
      {values.size === 0 ? (
        <NoData score />
      ) : (
        <ScoreContent window={window} values={values} scoreMetrics={scoreMetrics} points={points} />
      )}
    </div>
  );
}

/**
 * A score with its unit. Example: 57 gives "57.0%".
 * @param {number} value
 * @returns {string}
 */
function scoreText(value) {
  return formatScore(value);
}

/**
 * The numbers and charts of the score. Each one answers one question: how the score changes over time, how strong the
 * habits are, how the week of the window end compares with the 4 weeks before (for each weekday, and for each group or
 * metric), how its month compares with the 3 months before (for each group or metric), and which weekdays are good.
 * The month calendar below the charts shows the score of each day (see `ScoreCalendar`). The score of a day is a
 * percentage from 0 to 100, so the charts show averages, not totals.
 *
 * - `values`: the score of each day. The change compares the first half of the window with the second half.
 * - `scoreMetrics`, `points`: the metrics of the score, and the points of each metric. With metrics of 2 or more
 *   groups, the week and month tables are by group, and the weekday bars show the part of each group. Else the tables
 *   are by metric.
 * @param {object} props
 * @param {ZoomWindow} props.window
 * @param {Map<Day, number>} props.values
 * @param {Metric[]} props.scoreMetrics
 * @param {Map<string, Map<Day, number>>} props.points
 * @returns {JSX.Element}
 */
function ScoreContent({ window, values, scoreMetrics, points }) {
  const stats = countStats(values, window.days);
  const [firstHalf, secondHalf] = halves(window.days);
  const average = countStats(values, secondHalf).average;
  const previous = countStats(values, firstHalf).average;
  const best = stats.best;
  const weekday = bestWeekday(stats.weekdayAverages);
  // The groups and the parts change only with the data, not when the window moves.
  const groups = useMemo(
    () => [...new Set(scoreMetrics.filter((m) => points.has(m.id)).map(groupOf))],
    [scoreMetrics, points],
  );
  const parts = useMemo(() => scoreParts(scoreMetrics, groups, points), [scoreMetrics, groups, points]);
  const partsOfGroups = useMemo(
    () => (groups.length >= 2 ? groupParts(scoreMetrics, groups, points) : NO_POINTS),
    [scoreMetrics, groups, points],
  );
  const perDay = stats.average;
  return (
    <>
      <KeyNumbers
        items={[
          ['per day', perDay == null ? '–' : scoreText(perDay)],
          ['change', average != null && previous != null ? formatScoreChange(average - previous) : '–'],
          ['best day', best == null ? '–' : `${scoreText(best.value)} · ${shortDay(best.day)}`],
          [
            'best weekday',
            weekday == null
              ? '–'
              : `${weekdayNames[weekday - 1]} · ${scoreText(/** @type {number} */ (stats.weekdayAverages[weekday - 1]))}`,
          ],
        ]}
      />
      <ChartGrid
        items={[
          timeBarItem(
            'Average per day',
            `The average score of the days with a score in each ${unitName(window)}.`,
            window,
            values,
            Aggregate.AVERAGE,
            { max: 100, format: (v) => formatPercent(v / 100) },
          ),
          {
            key: 'strength',
            wide: true,
            content: () => (
              <LineChart
                title="Strength (%)"
                description={
                  'It goes up on days with a high score and down on days with a low score. Each day with a score ' +
                  `moves it ${formatPercent(STRENGTH_WEIGHT)} of the way to that score.`
                }
                days={window.days}
                values={strength(new Map([...values].map(([d, v]) => [d, v / 100])), window.days).map((s) => s * 100)}
                dots={false}
                decimals={0}
                range={[0, 100]}
              />
            ),
          },
          { key: 'week', wide: true, content: () => <WeekInRange values={values} window={window} /> },
          { key: 'weekly', wide: false, content: () => <WeeklyScores parts={parts} window={window} /> },
          { key: 'monthly', wide: false, content: () => <MonthlyScores parts={parts} window={window} /> },
          {
            key: 'weekdays',
            wide: true,
            content: () => <WeekdayAverages values={values} window={window} stats={stats} groupParts={partsOfGroups} />,
          },
        ]}
      />
    </>
  );
}

/**
 * The week of the window end: "this week" if the window ends today, else for example "the week of Oct 5".
 * @param {ZoomWindow} window
 * @returns {string}
 */
function weekName(window) {
  return window.atEnd ? 'this week' : `the week of ${shortDay(barStart(window.to, BarUnit.WEEK))}`;
}

/**
 * `text` with a capital first letter. Example: "this week" → "This week".
 * @param {string} text
 * @returns {string}
 */
function capitalized(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The score of each weekday of the week of the window end, in the range of that weekday in the 4 weeks before. See
 * `weekdaysInRange`.
 * @param {object} props
 * @param {Map<Day, number>} props.values
 * @param {ZoomWindow} props.window
 * @returns {JSX.Element}
 */
function WeekInRange({ values, window }) {
  const week = weekName(window);
  const weekdays = weekdaysInRange(values, window.to);
  const weeks = formatNumber(COMPARED_WEEKS);
  return (
    <RangeBarChart
      title={`${capitalized(week)} and the ${weeks} weeks before`}
      description={
        `For each weekday: the score of ${week} (diamond), and the lowest to the highest score of the ` +
        `${weeks} weeks before (bar), with their average (dot).`
      }
      labels={weekdayNames}
      ranges={weekdays.map((w) => w.range)}
      marks={weekdays.map((w) => w.score)}
      rangeLabel={`${weeks} weeks before`}
      markLabel={capitalized(week)}
    />
  );
}

/**
 * The average score of each part of the score in the week of the window end and in each of the 4 weeks before, on the
 * same weekdays. The color of a cell shows the change from the week before. See `weeklyAverages`.
 * @param {object} props
 * @param {ScoreParts} props.parts
 * @param {ZoomWindow} props.window
 * @returns {JSX.Element}
 */
function WeeklyScores({ parts, window }) {
  const weekly = weeklyAverages(parts.scores, window.to, COMPARED_WEEKS);
  return (
    <ChangeTable
      title={`Score by ${parts.noun} and week`}
      description={
        `The average score of each ${parts.noun} in ${weekName(window)} (last column) and in the ` +
        `${formatNumber(COMPARED_WEEKS)} weeks before, on the same weekdays. The color shows the change from the ` +
        'week before.'
      }
      columns={weekMondays(window.to, COMPARED_WEEKS).map(shortDay)}
      rows={[...weekly].map(([id, perWeek]) => [parts.name(id), perWeek])}
      upLabel="More than the week before"
      downLabel="Less than the week before"
    />
  );
}

/**
 * The average score of each part of the score in the month of the window end, up to the window end, and in each of
 * the 3 months before. The color of a cell shows the change from the month before. See `monthlyAverages`.
 * @param {object} props
 * @param {ScoreParts} props.parts
 * @param {ZoomWindow} props.window
 * @returns {JSX.Element}
 */
function MonthlyScores({ parts, window }) {
  const monthly = monthlyAverages(parts.scores, window.to, COMPARED_MONTHS);
  const month = window.atEnd ? 'this month' : monthTitle(monthOf(window.to));
  return (
    <ChangeTable
      title={`Score by ${parts.noun} and month`}
      description={
        `The average score of each ${parts.noun} in ${month} (last column, up to ${shortDay(window.to)}) and in ` +
        `the ${formatNumber(COMPARED_MONTHS)} months before. The color shows the change from the month before.`
      }
      columns={monthsUntil(window.to, COMPARED_MONTHS).map((m) => shortMonth(m.month))}
      rows={[...monthly].map(([id, perMonth]) => [parts.name(id), perMonth])}
      upLabel="More than the month before"
      downLabel="Less than the month before"
    />
  );
}

/**
 * The average score on each weekday. With 2 or more `groupParts` (see `groupParts`), each bar stacks the parts of the
 * groups, each in the color of its group with a soft tone, with a legend. See `groupWeekdayParts`.
 * @param {object} props
 * @param {Map<Day, number>} props.values
 * @param {ZoomWindow} props.window
 * @param {CountStats} props.stats
 * @param {Map<string, Map<Day, number>>} props.groupParts
 * @returns {JSX.Element}
 */
function WeekdayAverages({ values, window, stats, groupParts }) {
  const title = 'Weekday averages';
  if (groupParts.size < 2) {
    return (
      <BarChart
        title={title}
        description="The average score on each weekday, from the days with a score."
        bars={stats.weekdayAverages.map((average, i) => ({ label: weekdayNames[i], value: average }))}
      />
    );
  }
  const parts = [...groupWeekdayParts(values, groupParts, window.days)];
  return (
    <StackedBarChart
      title={title}
      description="The average score on each weekday, from the days with a score. Each tone is a group."
      labels={weekdayNames}
      parts={parts.map(([group, averages], i) => ({
        label: groupLabel(group),
        color: `var(--group-${(i % GROUP_COLORS) + 1})`,
        values: averages,
      }))}
    />
  );
}

/** The number of group colors of the theme: `--group-1` to `--group-4`, 4 tones of the data color. */
const GROUP_COLORS = 4;
