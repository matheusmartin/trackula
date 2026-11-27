import { Symbol } from './Symbol.jsx';
import './SegmentedButtons.css';

/** @import { JSX } from 'preact' */

/**
 * One choice of {@link SegmentedButtons}.
 * @typedef {object} Segment
 * @property {string} value
 * @property {string} label
 * @property {string} icon The Material Symbols icon before the label.
 */

/**
 * A row of buttons that selects one of a few choices, as the segmented buttons of Material Design 3. The selected
 * button has the selected color and `aria-pressed`. Example: the Table and Calendars layouts of the Days view.
 * @param {object} props
 * @param {string} props.label The name of the group, for screen readers.
 * @param {Segment[]} props.segments
 * @param {string} props.selected The value of the selected segment.
 * @param {(value: string) => void} props.onSelect
 * @returns {JSX.Element}
 */
export function SegmentedButtons({ label, segments, selected, onSelect }) {
  return (
    <div class="segmented-buttons" role="group" aria-label={label}>
      {segments.map((s) => (
        <button
          key={s.value}
          type="button"
          class={s.value === selected ? 'segmented-button segmented-button-selected' : 'segmented-button'}
          aria-pressed={s.value === selected}
          onClick={() => onSelect(s.value)}
        >
          <Symbol name={s.value === selected ? 'check' : s.icon} size={18} />
          <span class="label-large">{s.label}</span>
        </button>
      ))}
    </div>
  );
}
