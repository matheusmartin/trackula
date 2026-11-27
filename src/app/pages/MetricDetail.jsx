import { useMemo } from 'preact/hooks';
import { monthOf } from '../../model/Day.js';
import { formatNumber, shortDay, withUnit } from '../../model/Format.js';
import { NumberMetric, YesNoMetric } from '../../model/Metric.js';
import { yesNoStates } from '../../model/Stats.js';
import { dayValues } from '../../model/Summary.js';
import { Aggregate, defaultStepIndex } from '../../model/Zoom.js';
import { AppIconButton } from '../components/AppIconButton.jsx';
import { DayHeatmap } from '../components/DayHeatmap.jsx';
import { useElementWidth } from '../components/ElementWidth.js';
import { MetricCharts } from '../components/MetricCharts.jsx';
import { MetricIcon } from '../components/MetricIcon.jsx';
import { MonthCalendar } from '../components/MonthCalendar.jsx';
import { ChartsArea, PeriodBar, usePeriod } from '../components/Period.jsx';
import { WIDE_CONTENT } from '../components/Sizes.js';
import './MetricDetail.css';

/** @import { JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { CountStep, LogTable, MetricDay } from '../../model/LogEntry.js' */
/** @import { Metric } from '../../model/Metric.js' */

/** The yes/no states of a metric that is not a yes/no metric. */
const NO_STATES = /** @type {Map<Day, boolean>} */ (new Map());

/**
 * All data of one metric: key numbers, charts and a day heatmap for one period, and a month calendar to edit days.
 *
 * - Period: see `usePeriod`. It opens at All for a metric of kind `number`, and at 3 months for the other kinds (see
 *   `defaultStepIndex`). All numbers and charts show the same period. The bar with the zoom buttons and the dates stays
 *   at the top while the page scrolls.
 * - Day heatmap: the days of the period. A tap on a day shows its month in the calendar.
 * - Edit days: any month, with the same day cells and inputs as the Today page. It shows the month of the period end
 *   until the arrows, a swipe or a heatmap tap change it. Wide screens also show the month before.
 *
 * The parent gives the screen the key of the metric id: another metric starts with its own period. The score has its
 * own screen: see `ScorePage`.
 * @param {object} props
 * @param {Metric} props.metric
 * @param {LogTable} props.log
 * @param {Day} props.today
 * @param {boolean} props.busy
 * @param {(metric: Metric, day: Day, value: number | null) => void} props.onRecord Sets the value of a day. See
 *   `HabitTable`.
 * @param {Map<MetricDay, CountStep[]>} props.pending
 * @param {(metric: NumberMetric, day: Day, step: CountStep) => void} props.onCount
 * @param {() => void} props.onBack Closes the screen.
 * @returns {JSX.Element}
 */
export function MetricDetail({ metric, log, today, busy, onRecord, pending, onCount, onBack }) {
  const [measure, width] = useElementWidth();
  const states = useMemo(() => (metric instanceof YesNoMetric ? yesNoStates(metric, log) : NO_STATES), [metric, log]);
  // For yes/no metrics: 1 for yes and 0 for no, as the rate bars expect.
  const values = useMemo(() => {
    if (metric instanceof YesNoMetric) return new Map([...states].map(([d, yes]) => [d, yes ? 1 : 0]));
    return dayValues(metric, log, pending);
  }, [metric, states, log, pending]);
  const period = usePeriod(values, today, (steps) => defaultStepIndex(metric, steps));
  const window = period.window;
  const month = period.month ?? monthOf(window.to);

  /**
   * The tooltip of a heatmap day. Examples: "Oct 3: yes", "Oct 3: 82.5 kg", "Oct 3: no value".
   * @param {Day} d
   * @returns {string}
   */
  function dayTitle(d) {
    if (metric instanceof YesNoMetric) {
      const state = states.get(d);
      return `${shortDay(d)}: ${state == null ? 'no entry' : state ? 'yes' : 'no'}`;
    }
    const value = values.get(d);
    const unit = metric instanceof NumberMetric ? metric.unit : null;
    return `${shortDay(d)}: ${value == null ? 'no value' : withUnit(formatNumber(value, 2), unit)}`;
  }

  // On wide screens, the chart grid has more columns, so that the cards keep their shape.
  return (
    <div ref={measure} class="metric-detail">
      <div class="metric-detail-header">
        <AppIconButton icon="arrow_back" title="Back" onClick={onBack} />
        <MetricIcon icon={metric.icon} large />
        <h2 class="metric-detail-title headline-small">{metric.name}</h2>
      </div>
      <PeriodBar
        period={period}
        values={values}
        aggregate={aggregateOf(metric)}
        fromZero={aggregateOf(metric) !== Aggregate.AVERAGE}
        wide={width >= WIDE_CONTENT}
      />
      <ChartsArea period={period}>
        <MetricCharts metric={metric} window={window} values={values} states={states} />
        <DayHeatmap
          title={metric instanceof YesNoMetric ? 'Yes days' : 'Days with a value'}
          from={window.from}
          to={window.to}
          today={today}
          filled={(d) => (metric instanceof YesNoMetric ? states.get(d) === true : values.has(d))}
          onDay={(d) => period.setMonth(monthOf(d))}
          dayTitle={dayTitle}
        />
      </ChartsArea>
      <MonthCalendar
        metric={metric}
        log={log}
        today={today}
        busy={busy}
        onRecord={onRecord}
        pending={pending}
        onCount={onCount}
        month={month}
        onMonth={period.setMonth}
      />
    </div>
  );
}

/**
 * How the overview makes one bar of the days of a week: the rate of yes days, the sum of a count, or the average of a
 * number.
 * @param {Metric} metric
 * @returns {Aggregate}
 */
function aggregateOf(metric) {
  if (metric instanceof YesNoMetric) return Aggregate.RATE;
  return metric.isCount ? Aggregate.SUM : Aggregate.AVERAGE;
}
