import { Symbol } from './Symbol.jsx';
import './MetricIcon.css';

/** @import { JSX } from 'preact' */

/** A Material Symbols name: lowercase letters, digits and `_`. */
const symbolName = /^[a-z0-9_]+$/;

/**
 * The icon of a metric in a chip: a Material Symbol for a lowercase name such as `water_drop`, else the text, such as
 * an emoji. For a metric, give `metric.icon`. `large` for the title of the detail screen.
 *
 * A white chip with a red icon: emojis keep their own colors, and Material Symbols have a contrast of 6:1. The thin
 * border keeps the chip visible on the card. The chip is decoration only: the name of the metric is next to it.
 * @param {object} props
 * @param {string} props.icon A Material Symbols name or a text such as an emoji.
 * @param {boolean} [props.large] Default: false.
 * @returns {JSX.Element}
 */
export function MetricIcon({ icon, large = false }) {
  return (
    <span class={large ? 'metric-icon metric-icon-large' : 'metric-icon'} aria-hidden="true">
      {symbolName.test(icon) ? (
        <Symbol name={icon} size={large ? 28 : 20} />
      ) : (
        <span class="metric-icon-text">{icon}</span>
      )}
    </span>
  );
}
