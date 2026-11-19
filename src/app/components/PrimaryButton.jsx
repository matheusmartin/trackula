import { Symbol } from './Symbol.jsx';
import './PrimaryButton.css';

/** @import { JSX } from 'preact' */

/**
 * The main button of a screen, for example Save or Sign in. Enabled: the darker logo gradient with white text, in both
 * themes. Disabled: a quiet grey button with readable text. Use one on a screen. Give it the width with `class`, for
 * example `fill-width` (see theme.css).
 * @param {object} props
 * @param {string} props.text
 * @param {() => void} props.onClick
 * @param {boolean} [props.enabled] Default: true.
 * @param {string | null} [props.icon] A Material Symbols name before the text. Null: no icon.
 * @param {string | null} [props.description] The name for screen readers and tests, when it says more than `text`.
 *   Example: "Save: Water".
 * @param {string} [props.class] More CSS classes.
 * @returns {JSX.Element}
 */
export function PrimaryButton({ text, onClick, enabled = true, icon = null, description = null, class: className }) {
  return (
    <button
      type="button"
      class={className ? `primary-button ${className}` : 'primary-button'}
      disabled={!enabled}
      aria-label={description ?? undefined}
      onClick={() => onClick()}
    >
      {icon != null && <Symbol name={icon} size={20} />}
      <span class="primary-button-text">{text}</span>
    </button>
  );
}
