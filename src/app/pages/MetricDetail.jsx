import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { monthOf } from '../../model/Day.js';
import { YesNoMetric } from '../../model/Metric.js';
import { detailSummary } from '../../model/MetricDraft.js';
import { yesNoStates } from '../../model/Stats.js';
import { dayValues } from '../../model/Summary.js';
import { Aggregate, barMonth, defaultStepIndex } from '../../model/Zoom.js';
import { AppIconButton } from '../components/AppIconButton.jsx';
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
/** @import { Metric, NumberMetric } from '../../model/Metric.js' */
/** @import { ZoomBar } from '../../model/Zoom.js' */

/** The yes/no states of a metric that is not a yes/no metric. */
const NO_STATES = /** @type {Map<Day, boolean>} */ (new Map());

/**
 * All data of one metric: key numbers and charts for one period, and the Days card to see and edit its days.
 *
 * - Title: the icon, the name, and a line with the kind, the unit and the goal.
 * - Period: see `usePeriod`. It opens at All for a metric of kind `number`, and at 3 months for the other kinds (see
 *   `defaultStepIndex`). All numbers and charts show the same period. The bar with the zoom buttons and the dates stays
 *   at the top while the page scrolls.
 * - Days: any month, with the same day cells and inputs as the Days screen. Its last month is the month of the period
 *   end, until the arrows, a swipe or a tap on a bar over time change it. A tap on a bar also scrolls to the card.
 *
 * The parent gives the screen the key of the metric id: another metric starts with its own period. The score has its
 * own screen: see `ScorePage`.
 * @param {object} props
 * @param {Metric} props.metric
 * @param {LogTable} props.log
 * @param {Day} props.today
 * @param {boolean} props.busy
 * @param {(metric: Metric, day: Day, value: number | null) => void} props.onRecord Sets the value of a day. See
 *   `useDayCells`.
 * @param {Map<MetricDay, CountStep[]>} props.pending
 * @param {(metric: NumberMetric, day: Day, step: CountStep) => void} props.onCount
 * @param {() => void} props.onBack Closes the screen.
 * @returns {JSX.Element}
 */
export function MetricDetail({ metric, log, today, busy, onRecord, pending, onCount, onBack }) {
  const [measure, width] = useElementWidth();
  const days = useRef(/** @type {HTMLDivElement | null} */ (null));
  // The number of bar taps. After each tap, the page scrolls to the Days card, when it shows the new months.
  const [barTaps, setBarTaps] = useState(0);
  const states = useMemo(() => (metric instanceof YesNoMetric ? yesNoStates(metric, log) : NO_STATES), [metric, log]);
  // For yes/no metrics: 1 for yes and 0 for no, as the rate bars expect.
  const values = useMemo(() => {
    if (metric instanceof YesNoMetric) return new Map([...states].map(([d, yes]) => [d, yes ? 1 : 0]));
    return dayValues(metric, log, pending);
  }, [metric, states, log, pending]);
  const period = usePeriod(values, today, (steps) => defaultStepIndex(metric, steps));
  const window = period.window;
  const month = period.month ?? monthOf(window.to);

  useEffect(() => {
    if (barTaps > 0) days.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [barTaps]);

  /**
   * Shows the month of `bar` in the Days card, and scrolls to the card.
   * @param {ZoomBar} bar
   */
  function showBar(bar) {
    period.setMonth(barMonth(bar.start, window.unit));
    setBarTaps((n) => n + 1);
  }

  // On wide screens, the chart grid has more columns, so that the cards keep their shape.
  return (
    <div ref={measure} class="metric-detail">
      <div class="metric-detail-header">
        <AppIconButton icon="arrow_back" title="Back" onClick={onBack} />
        <MetricIcon icon={metric.icon} large />
        <div class="metric-detail-titles">
          <h2 class="metric-detail-title headline-small">{metric.name}</h2>
          <p class="metric-detail-summary body-small">{detailSummary(metric)}</p>
        </div>
      </div>
      <PeriodBar
        period={period}
        values={values}
        aggregate={aggregateOf(metric)}
        fromZero={aggregateOf(metric) !== Aggregate.AVERAGE}
        wide={width >= WIDE_CONTENT}
      />
      <ChartsArea period={period}>
        <MetricCharts metric={metric} window={window} values={values} states={states} onBar={showBar} />
      </ChartsArea>
      <div ref={days} class="metric-detail-days">
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
