// The key numbers and the charts of one metric in the time window of the detail screen.
import { YesNoMetric } from '../../model/Metric.js';
import {
  formatDays,
  formatFixed,
  formatNumber,
  formatPercent,
  formatValue,
  formatValueChange,
  shortDay,
  weekdayNames,
  withUnit,
} from '../../model/Format.js';
import { stepDecimals } from '../../model/NumberInput.js';
import { roundHalfAwayFromZero } from '../../model/Numbers.js';
import { countStats, numberStats, streakLengths, streakRanges, yesNoStats } from '../../model/Stats.js';
import { Aggregate, zoomBars } from '../../model/Zoom.js';
import { ChartGrid, KeyNumbers } from './ChartParts.jsx';
import { BarChart, DonutChart, LineChart, TimeBars } from './Charts.jsx';
import { Symbol } from './Symbol.jsx';
import './MetricCharts.css';

/** @import { JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { Metric, NumberMetric } from '../../model/Metric.js' */
/** @import { CountStats, DayValue, NumberStats, YesNoStats } from '../../model/Stats.js' */
/** @import { ZoomWindow } from '../../model/Zoom.js' */
/** @import { ChartItem } from './ChartParts.jsx' */

/**
 * The key numbers and the charts of one metric in the time `window` of the detail screen. The score has its own
 * numbers and charts: see `ScoreCharts`.
 *
 * - `values`: the value of each day with a value. For yes/no metrics: 1 for yes and 0 for no, as the rate bars expect.
 * - `states`: the yes/no states of a yes/no metric: true for `yes`, false for `no`. Empty for other metrics.
 * @param {object} props
 * @param {Metric} props.metric
 * @param {ZoomWindow} props.window
 * @param {Map<Day, number>} props.values
 * @param {Map<Day, boolean>} props.states
 * @returns {JSX.Element}
 */
export function MetricCharts({ metric, window, values, states }) {
  /** @type {JSX.Element} */
  let content;
  if (values.size === 0) {
    // No value on any day: one card that tells what to do, not many empty charts.
    content = <NoData score={false} />;
  } else if (metric instanceof YesNoMetric) {
    content = <YesNoCharts window={window} values={values} stats={yesNoStats(states, window.days, window.to)} />;
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
export function NoData({ score }) {
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
export function unitName(window) {
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
export function timeBarItem(
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
          ['no value', formatNumber(stats.none)],
          [window.atEnd ? 'current streak' : `streak on ${shortDay(window.to)}`, formatDays(stats.currentStreak)],
          ['longest streak', formatDays(stats.longestStreak)],
        ]}
      />
      <ChartGrid
        items={[
          timeBarItem(
            'Done rate',
            `The percentage of done days in each ${unitName(window)}.`,
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
                title="Strength (%)"
                description="It goes up on done days and down on all other days."
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
                title="Yes, no and no value"
                description="The share of days with yes, with no and with no value."
                center={formatPercent(stats.rate)}
                parts={[
                  { label: 'Yes', value: stats.yes, color: 'var(--cell)' },
                  { label: 'No', value: stats.no, color: 'var(--tertiary)' },
                  { label: 'No value', value: stats.none, color: 'var(--cell-empty)' },
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
                description="The percentage of done days on each weekday."
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
                description="The number of runs of done days in a row, for each length in days."
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
          ['total', formatValue(stats.total, metric.step, metric.unit)],
          ['per day', average == null ? '–' : withMetricUnit(average, metric)],
          [
            'best day',
            best == null ? '–' : `${formatFixed(best.value, stepDecimals(metric.step))} · ${shortDay(best.day)}`,
          ],
          ['days recorded', formatNumber(stats.logged)],
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
                description="The sum of all values from the start of the period."
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
 * The value of `dayValue` with the unit of `metric`, or "–" if there is no value.
 * @param {DayValue | null} dayValue
 * @param {NumberMetric} metric
 * @returns {string}
 */
function dayValue(dayValue, metric) {
  return dayValue == null ? '–' : formatValue(dayValue.value, metric.step, metric.unit);
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
          ['change', stats.change == null ? '–' : formatValueChange(stats.change, metric.step, metric.unit)],
          [dayLabel('lowest', stats.low), dayValue(stats.low, metric)],
          [dayLabel('highest', stats.high), dayValue(stats.high, metric)],
          ['average', average == null ? '–' : withMetricUnit(average, metric, 2)],
          ['days recorded', formatNumber(stats.logged)],
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
                title="Values and trend"
                description="Dots are the values. The line is the trend: it ignores small daily changes."
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
