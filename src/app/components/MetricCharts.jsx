// The key numbers and the charts of one metric in the time window of the detail screen. See MetricCharts.kt.
import { useMemo } from 'preact/hooks';
import { withoutFloatNoise } from '../../model/LogEntry.js';
import { YesNoMetric, groupOf } from '../../model/Metric.js';
import { monthOf } from '../../model/Day.js';
import {
  formatNumber,
  formatPercent,
  formatSigned,
  monthTitle,
  shortDay,
  shortMonth,
  weekdayNames,
  withUnit,
} from '../../model/Format.js';
import { roundHalfAwayFromZero } from '../../model/Numbers.js';
import { groupParts, groupScores, isScore } from '../../model/Score.js';
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
import {
  STRENGTH_WEIGHT,
  bestWeekday,
  countStats,
  numberStats,
  streakLengths,
  streakRanges,
  strength,
  yesNoStats,
} from '../../model/Stats.js';
import { Aggregate, BarUnit, barStart, zoomBars } from '../../model/Zoom.js';
import { BarChart, ChartGrid, DonutChart, KeyNumbers, LineChart, StackedBarChart, TimeBars } from './Charts.jsx';
import { ChangeTable, MAX_FILL, RangeBarChart, cellFill } from './CompareCharts.jsx';
import { groupLabel } from './GroupChips.jsx';
import { Symbol } from './Symbol.jsx';
import './MetricCharts.css';

/** @import { JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { Metric, NumberMetric } from '../../model/Metric.js' */
/** @import { CountStats, DayValue, NumberStats, YesNoStats } from '../../model/Stats.js' */
/** @import { ZoomWindow } from '../../model/Zoom.js' */
/** @import { ChartItem } from './Charts.jsx' */

/** The metrics of the score of a metric that is not the score. */
const NO_METRICS = /** @type {Metric[]} */ ([]);

/** The points of a metric that is not the score. */
const NO_POINTS = /** @type {Map<string, Map<Day, number>>} */ (new Map());

/**
 * The key numbers and the charts of one metric in the time `window` of the detail screen. The score has its own
 * numbers and charts: see {@link ScoreCharts}.
 *
 * - `values`: the value of each day with a value. For yes/no metrics: 1 for yes and 0 for no, as the rate bars expect.
 * - `states`: the yes/no states of a yes/no metric: true for `yes`, false for `no`. Empty for other metrics.
 * - `scoreMetrics`, `points`: for the score, the metrics of the score, and the points of each metric by metric id (see
 *   `pointsByMetric`). Empty for other metrics.
 * @param {object} props
 * @param {Metric} props.metric
 * @param {ZoomWindow} props.window
 * @param {Map<Day, number>} props.values
 * @param {Map<Day, boolean>} props.states
 * @param {Metric[]} [props.scoreMetrics] Default: no metrics.
 * @param {Map<string, Map<Day, number>>} [props.points] Default: no points.
 * @returns {JSX.Element}
 */
export function MetricCharts({ metric, window, values, states, scoreMetrics = NO_METRICS, points = NO_POINTS }) {
  /** @type {JSX.Element} */
  let content;
  if (values.size === 0) {
    // No value on any day: one card that tells what to do, not many empty charts.
    content = <NoData score={isScore(metric)} />;
  } else if (metric instanceof YesNoMetric) {
    content = <YesNoCharts window={window} values={values} stats={yesNoStats(states, window.days, window.to)} />;
  } else if (isScore(metric)) {
    content = (
      <ScoreCharts metric={metric} window={window} values={values} scoreMetrics={scoreMetrics} points={points} />
    );
  } else if (metric.isCount) {
    content = <CountCharts metric={metric} window={window} values={values} stats={countStats(values, window.days)} />;
  } else {
    content = <NumberCharts metric={metric} window={window} values={values} stats={numberStats(values, window.days)} />;
  }
  return <div class="metric-charts">{content}</div>;
}

/**
 * The card of a metric with no value on any day.
 * @param {object} props
 * @param {boolean} props.score True for the score.
 * @returns {JSX.Element}
 */
function NoData({ score }) {
  return (
    <div class="metric-charts-no-data">
      <Symbol name="show_chart" size={32} color="var(--on-surface-variant)" />
      <h3 class="metric-charts-no-data-title title-medium">{score ? 'No score yet' : 'No values yet'}</h3>
      <p class="metric-charts-no-data-text body-medium">
        {score
          ? 'Record a day on the Today page. Then the score and its charts show here.'
          : 'Record a day in the calendar below. Then the numbers and the charts show here.'}
      </p>
    </div>
  );
}

/**
 * The name of a bar unit in a description, for example "week".
 * @param {ZoomWindow} window
 * @returns {string}
 */
function unitName(window) {
  return window.unit.toLowerCase();
}

/**
 * The options of {@link timeBarItem}.
 * @typedef {object} TimeBarOptions
 * @property {boolean} [fixedScale] True: the top of the scale comes from all bars, so that it does not change while
 *   the window moves. For sums. Default: false.
 * @property {boolean} [showsRange] Default: false.
 * @property {number | null} [max] Fixes the top of the scale, for example 100 for percentages. Default: null.
 * @property {(value: number) => string} [format] The text of a value. Default: at most 1 decimal.
 */

/**
 * The bars of the window, in a wide card.
 * @param {string} title
 * @param {string} description
 * @param {ZoomWindow} window
 * @param {Map<Day, number>} values
 * @param {Aggregate} aggregate
 * @param {TimeBarOptions} [options]
 * @returns {ChartItem}
 */
function timeBarItem(
  title,
  description,
  window,
  values,
  aggregate,
  { fixedScale = false, showsRange = false, max = null, format = (v) => formatNumber(v) } = {},
) {
  return {
    key: title,
    wide: true,
    content: () => {
      const bars = zoomBars(values, aggregate, window.allStarts, window.unit, window.first, window.today);
      const all = bars.flatMap((b) => (b.value == null ? [] : [b.value]));
      // A window without bars, for example with values only after today: the card says that there are no values.
      const starts = window.starts;
      const firstInView = starts.length === 0 ? -1 : window.allStarts.indexOf(starts[0]);
      return (
        <TimeBars
          title={title}
          description={description}
          bars={firstInView < 0 ? [] : bars.slice(firstInView, firstInView + starts.length)}
          barUnit={window.unit}
          format={format}
          max={max ?? (fixedScale && all.length > 0 ? Math.max(...all) : null)}
          showsRange={showsRange}
        />
      );
    },
  };
}

/**
 * @param {object} props
 * @param {ZoomWindow} props.window
 * @param {Map<Day, number>} props.values
 * @param {YesNoStats} props.stats
 * @returns {JSX.Element}
 */
function YesNoCharts({ window, values, stats }) {
  return (
    <>
      <KeyNumbers
        items={[
          ['done days', formatNumber(stats.yes)],
          ['rate', formatPercent(stats.rate)],
          ['missed (no)', formatNumber(stats.no)],
          ['no entry', formatNumber(stats.none)],
          [
            window.atEnd ? 'current streak' : `streak on ${shortDay(window.to)}`,
            `${formatNumber(stats.currentStreak)} d`,
          ],
          ['longest streak', `${formatNumber(stats.longestStreak)} d`],
        ]}
      />
      <ChartGrid
        items={[
          timeBarItem(
            'Yes rate',
            `The percentage of yes days in each ${unitName(window)}.`,
            window,
            values,
            Aggregate.RATE,
            { max: 1, format: formatPercent },
          ),
          {
            key: 'strength',
            wide: true,
            content: () => (
              <LineChart
                title="Habit strength (%)"
                description="It goes up on yes days and down on all other days."
                days={window.days}
                values={stats.strength.map((s) => s * 100)}
                dots={false}
                decimals={0}
                range={[0, 100]}
              />
            ),
          },
          {
            key: 'donut',
            wide: false,
            content: () => (
              <DonutChart
                title="Yes, no and no entry"
                description="The share of days with yes, with no and with no entry."
                center={formatPercent(stats.rate)}
                parts={[
                  { label: 'Yes', value: stats.yes, color: 'var(--cell)' },
                  { label: 'No', value: stats.no, color: 'var(--tertiary)' },
                  { label: 'No entry', value: stats.none, color: 'var(--cell-empty)' },
                ]}
              />
            ),
          },
          {
            key: 'weekdays',
            wide: false,
            content: () => (
              <BarChart
                title="Weekday pattern"
                description="The percentage of yes days on each weekday."
                bars={stats.weekdayRates.map((rate, i) => ({
                  label: weekdayNames[i].substring(0, 1),
                  value: rate == null ? null : rate * 100,
                }))}
                max={100}
                format={(v) => `${formatNumber(roundHalfAwayFromZero(v), 0)}%`}
              />
            ),
          },
          {
            key: 'streaks',
            wide: true,
            content: () => (
              <BarChart
                title="Streak lengths"
                description="The number of runs of yes days in a row, for each length in days."
                bars={streakLengths(stats.streaks).map((count, i) => {
                  const { from, to } = streakRanges[i];
                  const label =
                    to == null
                      ? `${formatNumber(from)}+`
                      : from === to
                        ? formatNumber(from)
                        : `${formatNumber(from)}–${formatNumber(to)}`;
                  return { label, value: count };
                })}
              />
            ),
          },
        ]}
      />
    </>
  );
}

/**
 * `value` with at most `decimals` decimals and the unit of `metric`. Example: "82.1 kg".
 * @param {number} value
 * @param {NumberMetric} metric
 * @param {number} [decimals] Default: 1.
 * @returns {string}
 */
function withMetricUnit(value, metric, decimals = 1) {
  return withUnit(formatNumber(value, decimals), metric.unit);
}

/**
 * @param {object} props
 * @param {NumberMetric} props.metric
 * @param {ZoomWindow} props.window
 * @param {Map<Day, number>} props.values
 * @param {CountStats} props.stats
 * @returns {JSX.Element}
 */
function CountCharts({ metric, window, values, stats }) {
  const best = stats.best;
  const average = stats.average;
  return (
    <>
      <KeyNumbers
        items={[
          ['total', withMetricUnit(stats.total, metric)],
          ['per day', average == null ? '–' : withMetricUnit(average, metric)],
          ['best day', best == null ? '–' : `${formatNumber(best.value)} · ${shortDay(best.day)}`],
          ['days logged', formatNumber(stats.logged)],
        ]}
      />
      <ChartGrid
        items={[
          timeBarItem('Totals', `The total of each ${unitName(window)}.`, window, values, Aggregate.SUM, {
            fixedScale: true,
          }),
          {
            key: 'running',
            wide: true,
            content: () => (
              <LineChart
                title="Running total"
                description="The sum of all values from the start of the window."
                days={window.days}
                values={stats.running}
                dots={false}
                decimals={0}
                range={[0, stats.total]}
              />
            ),
          },
          {
            key: 'weekdays',
            wide: false,
            content: () => (
              <BarChart
                title="Weekday averages"
                description="The average on each weekday, from the days with a value."
                bars={stats.weekdayAverages.map((average, i) => ({
                  label: weekdayNames[i].substring(0, 1),
                  value: average,
                }))}
              />
            ),
          },
          {
            key: 'distribution',
            wide: false,
            content: () => (
              <BarChart
                title="Distribution (days)"
                description="The number of days with each value."
                bars={stats.distribution.map((d) => ({ label: formatNumber(d.value), value: d.days }))}
              />
            ),
          },
        ]}
      />
    </>
  );
}

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
 * @param {NumberMetric} props.metric
 * @param {ZoomWindow} props.window
 * @param {Map<Day, number>} props.values
 * @param {Metric[]} props.scoreMetrics
 * @param {Map<string, Map<Day, number>>} props.points
 * @returns {JSX.Element}
 */
function ScoreCharts({ metric, window, values, scoreMetrics, points }) {
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
          ['per day', perDay == null ? '–' : withMetricUnit(perDay, metric)],
          ['change', average != null && previous != null ? formatSigned(average - previous, metric.unit) : '–'],
          ['best day', best == null ? '–' : `${withMetricUnit(best.value, metric)} · ${shortDay(best.day)}`],
          [
            'best weekday',
            weekday == null
              ? '–'
              : `${weekdayNames[weekday - 1]} · ${withMetricUnit(/** @type {number} */ (stats.weekdayAverages[weekday - 1]), metric)}`,
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
      description="The average score on each weekday, from the days with a score. Each color is a group."
      labels={weekdayNames}
      parts={parts.map(([group, averages], i) => ({
        label: groupLabel(group),
        // The soft tone of the strongest table and calendar cells, so that the colors match the other charts.
        color: cellFill(`var(--group-${(i % GROUP_COLORS) + 1})`, MAX_FILL),
        values: averages,
      }))}
    />
  );
}

/** The number of group colors of the theme: `--group-1` to `--group-8`. */
const GROUP_COLORS = 8;

/**
 * The value of `dayValue` with the unit of `metric`, or "–" if there is no value.
 * @param {DayValue | null} dayValue
 * @param {NumberMetric} metric
 * @returns {string}
 */
function dayValue(dayValue, metric) {
  return dayValue == null ? '–' : withMetricUnit(dayValue.value, metric, 2);
}

/**
 * `label` and the day of `dayValue`. Example: "latest · Oct 10".
 * @param {string} label
 * @param {DayValue | null} dayValue
 * @returns {string}
 */
function dayLabel(label, dayValue) {
  return `${label} · ${dayValue == null ? '' : shortDay(dayValue.day)}`;
}

/**
 * @param {object} props
 * @param {NumberMetric} props.metric
 * @param {ZoomWindow} props.window
 * @param {Map<Day, number>} props.values
 * @param {NumberStats} props.stats
 * @returns {JSX.Element}
 */
function NumberCharts({ metric, window, values, stats }) {
  const average = stats.average;
  return (
    <>
      <KeyNumbers
        items={[
          [dayLabel('latest', stats.latest), dayValue(stats.latest, metric)],
          ['change', stats.change == null ? '–' : formatSigned(stats.change, metric.unit)],
          [dayLabel('lowest', stats.low), dayValue(stats.low, metric)],
          [dayLabel('highest', stats.high), dayValue(stats.high, metric)],
          ['average', average == null ? '–' : withMetricUnit(average, metric, 2)],
          ['days logged', formatNumber(stats.logged)],
        ]}
      />
      <ChartGrid
        items={[
          timeBarItem(
            'Averages and range',
            `Each bar goes from the lowest to the highest value of a ${unitName(window)}. The dot is the average.`,
            window,
            values,
            Aggregate.AVERAGE,
            { showsRange: true },
          ),
          {
            key: 'values',
            wide: true,
            content: () => (
              <LineChart
                title="Values and 7-day trend"
                description="Dots are the values. The line is a smooth average that ignores small daily changes."
                days={window.days}
                values={stats.values}
                trend={stats.trend}
              />
            ),
          },
          {
            key: 'distribution',
            wide: true,
            content: () => (
              <BarChart
                title="Distribution (days)"
                description="The number of days in each value range. The label is the start of the range."
                bars={stats.histogram.map((bin) => ({ label: formatNumber(bin.from), value: bin.days }))}
              />
            ),
          },
        ]}
      />
    </>
  );
}
