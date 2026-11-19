import { Symbol } from './Symbol.jsx';
import './GroupChips.css';

/** @import { JSX } from 'preact' */

/**
 * The label of a group chip: the group with a capital first letter. Example: "habits" → "Habits".
 * @param {string} group
 * @returns {string}
 */
export function groupLabel(group) {
  return group.charAt(0).toUpperCase() + group.slice(1);
}

/**
 * The group filter: All, and one chip for each of `groups`, in one row that scrolls sideways. The selected chip has a
 * check mark.
 * @param {object} props
 * @param {string[]} props.groups
 * @param {string | null} props.selected The selected group. Null for All.
 * @param {(group: string | null) => void} props.onSelect Called with the group of the chip, or null for All.
 * @returns {JSX.Element}
 */
export function GroupChips({ groups, selected, onSelect }) {
  return (
    <div class="group-chips" role="group" aria-label="Groups">
      <FilterChip label="All" selected={selected == null} onClick={() => onSelect(null)} />
      {groups.map((g) => (
        <FilterChip key={g} label={groupLabel(g)} selected={g === selected} onClick={() => onSelect(g)} />
      ))}
    </div>
  );
}

/**
 * The FilterChip of Compose Material 3: the chips of the group filter, and the choices of the metrics form.
 * @param {object} props
 * @param {string} props.label
 * @param {boolean} props.selected
 * @param {() => void} props.onClick
 * @param {boolean} [props.enabled] Default: true.
 * @returns {JSX.Element}
 */
export function FilterChip({ label, selected, onClick, enabled = true }) {
  return (
    <button
      type="button"
      class={selected ? 'group-chip group-chip-selected label-large' : 'group-chip label-large'}
      aria-pressed={selected}
      disabled={!enabled}
      onClick={onClick}
    >
      {selected && <Symbol name="done" size={18} />}
      {label}
    </button>
  );
}
