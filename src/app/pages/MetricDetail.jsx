// STUB until the detail screen port (docs/js-port.md, phase 5). The props are final. The stub shows only the metric
// name and the back button.
import { AppIconButton } from '../components/AppIconButton.jsx';

/** @import { JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { CountStep, LogTable, LogWrite, MetricDay } from '../../model/LogEntry.js' */
/** @import { Metric, NumberMetric } from '../../model/Metric.js' */

/**
 * All data of one metric: key numbers, charts and a day heatmap for one time window, and a month calendar to edit
 * days. See `MetricDetail.kt`.
 * @param {object} props
 * @param {Metric} props.metric
 * @param {LogTable} props.log
 * @param {Day} props.today
 * @param {boolean} props.busy
 * @param {(plan: (log: LogTable) => LogWrite | null) => void} props.onWrite
 * @param {Map<MetricDay, CountStep[]>} props.pending
 * @param {(metric: NumberMetric, day: Day, step: CountStep) => void} props.onCount
 * @param {Map<Day, number>} props.scores
 * @param {(() => void) | null} [props.onBack] Closes the screen. Null: the screen has no back button, for example the
 *   Score view.
 * @param {Metric[]} [props.scoreMetrics] The metrics of the score.
 * @param {Map<string, Map<Day, number>>} [props.points] The points of each metric of the score.
 * @returns {JSX.Element}
 */
export function MetricDetail({ metric, onBack = null }) {
  return (
    <section>
      {onBack != null && <AppIconButton icon="arrow_back" title="Back" onClick={onBack} />}
      <h2 class="headline-small">{metric.name}</h2>
    </section>
  );
}
