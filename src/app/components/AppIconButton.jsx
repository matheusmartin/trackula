import { Symbol } from './Symbol.jsx';
import './AppIconButton.css';

/** @import { ButtonHTMLAttributes, JSX } from 'preact' */

/**
 * The properties of {@link AppIconButton}. Other properties, for example `aria-expanded`, go to the `<button>`.
 * @typedef {object} AppIconButtonProps
 * @property {string} icon A Material Symbols name, for example `refresh`.
 * @property {string} title The name for screen readers and tests, and the text of the tooltip.
 * @property {() => void} onClick
 * @property {boolean} [enabled] Default: true.
 * @property {boolean} [small] Default: false.
 * @property {string} [class] More CSS classes.
 */

/**
 * A round, transparent button with the Material Symbols `icon`. `title` is its name for screen readers and tests
 * (`aria-label`), and the text of its tooltip (`title`): the tooltip shows when the mouse is on the button.
 *
 * The button is 48 px: the size of a touch target. Its highlight is a circle of 40 px, as in Compose. `small` is a
 * button of 32 px with an icon of 20 px, for the tool bars of the detail screen.
 * @param {AppIconButtonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof AppIconButtonProps>} props
 * @returns {JSX.Element}
 */
export function AppIconButton({
  icon,
  title,
  onClick,
  enabled = true,
  small = false,
  class: className,
  ...attributes
}) {
  const classes = ['app-icon-button', small ? 'app-icon-button-small' : null, className].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      class={classes}
      title={title}
      aria-label={title}
      disabled={!enabled}
      onClick={() => onClick()}
      {...attributes}
    >
      <Symbol name={icon} size={small ? 20 : 24} />
    </button>
  );
}
