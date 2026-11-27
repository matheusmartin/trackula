import { Symbol } from './Symbol.jsx';
import './Button.css';

/** @import { JSX } from 'preact' */

/**
 * The look of a {@link Button}.
 * - `main`: the main action of a screen, for example Save or Sign in. The darker logo gradient with white text, in both
 *   themes. Use one on a screen.
 * - `filled`: an action that a screen needs, for example "Add metric" on an empty screen. The theme color.
 * - `outlined`: an action that is not the usual next step, for example Delete or Fix.
 * - `text`: a small or a second action, for example Cancel, Close or Undo.
 * @typedef {'main' | 'filled' | 'outlined' | 'text'} ButtonVariant
 */

/**
 * The color of the text of a {@link Button} (and of the outline of an `outlined` button). Not for `main` and `filled`.
 * - `primary`: the theme color. The default of a `text` button.
 * - `error`: an action that deletes or clears data.
 * - `neutral`: the color of secondary text. The default of an `outlined` button.
 * - `inverse`: the theme color for a dark surface in the light theme, for example in a snackbar.
 * - `inherit`: the color of the text around the button, for example in a notice.
 * @typedef {'primary' | 'error' | 'neutral' | 'inverse' | 'inherit'} ButtonTone
 */

/**
 * A button of Material 3 with a `text` and, if given, an `icon` before it. A `main` button is 52 px high or more. The
 * other buttons are 40 px high (`medium`) or 48 px high (`large`). A medium button needs a space of 4 px above and below
 * it, for a touch target of 48 px: the screen gives this space.
 * @param {object} props
 * @param {string} props.text
 * @param {() => void} props.onClick
 * @param {ButtonVariant} [props.variant] Default: `text`.
 * @param {'medium' | 'large'} [props.size] Default: `medium`, or `large` for an `outlined` button. Not for `main`.
 * @param {ButtonTone | null} [props.tone] Null: the default of the variant.
 * @param {boolean} [props.enabled] Default: true.
 * @param {string | null} [props.icon] A Material Symbols name before the text. Null: no icon.
 * @param {string | null} [props.description] The name for screen readers and tests, when it says more than `text`.
 *   Example: "Save: Water".
 * @param {string | null} [props.tooltip] The text that shows when the mouse is on the button. Null: no tooltip.
 * @param {string | null} [props.describedBy] The id of an element that tells more about the action, for screen
 *   readers (`aria-describedby`). Null: none.
 * @param {string} [props.class] More CSS classes, for example `fill-width` (see theme.css) or a class for the place of
 *   the button on its screen.
 * @returns {JSX.Element}
 */
export function Button({
  text,
  onClick,
  variant = 'text',
  size,
  tone = null,
  enabled = true,
  icon = null,
  description = null,
  tooltip = null,
  describedBy = null,
  class: className,
}) {
  const classes = ['button', `button-${variant}`];
  if (variant !== 'main') {
    classes.push(`button-${size ?? (variant === 'outlined' ? 'large' : 'medium')}`);
    classes.push(`button-tone-${tone ?? (variant === 'outlined' ? 'neutral' : 'primary')}`);
  }
  if (icon != null) classes.push('button-with-icon');
  if (className) classes.push(className);
  return (
    <button
      type="button"
      class={classes.join(' ')}
      disabled={!enabled}
      aria-label={description ?? undefined}
      title={tooltip ?? undefined}
      aria-describedby={describedBy ?? undefined}
      onClick={() => onClick()}
    >
      {icon != null && <Symbol name={icon} size={20} />}
      <span class="button-label">{text}</span>
    </button>
  );
}
