// STUB until the metrics screen port (docs/js-port.md, phase 4). The props are final. The stub shows only the heading
// and the back button.
import { AppIconButton } from '../components/AppIconButton.jsx';

/** @import { JSX } from 'preact' */
/** @import { MetricsTable } from '../../model/MetricsTable.js' */
/** @import { MetricsWrite } from '../../model/MetricsWrite.js' */
/** @import { Snapshot } from '../../sheets/Store.js' */

/**
 * The metrics screen: the metrics in the order of the app, and a form for each. See `MetricsPage.kt`.
 * @param {object} props
 * @param {Snapshot} props.data
 * @param {boolean} props.busy
 * @param {string | null} props.error
 * @param {(plan: (table: MetricsTable) => MetricsWrite[], onDone: () => void) => void} props.onWrite Writes a change
 *   to the `Metrics` tab. `onDone` runs after a write without an error.
 * @param {() => void} props.onClose
 * @param {boolean} [props.hasMouse] True if the device has a mouse. Then a drag moves a metric, not arrow buttons.
 * @returns {JSX.Element}
 */
export function MetricsPage({ onClose }) {
  return (
    <section>
      <AppIconButton icon="arrow_back" title="Back" onClick={onClose} />
      <h2 class="headline-small">Metrics</h2>
    </section>
  );
}
