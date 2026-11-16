/** @import { JSX } from 'preact' */

/**
 * The Material Symbols icon `name` of the app buttons, for example `refresh`. The font has all icons: see theme.css.
 * The icon is decoration only: the button gives the name for screen readers.
 * @param {object} props
 * @param {string} props.name
 * @param {number} [props.size] The size in CSS pixels. Default: 24.
 * @param {string | null} [props.color] A CSS color, for example `var(--primary)`. Null: the color of the text.
 * @param {string} [props.class] More CSS classes.
 * @returns {JSX.Element}
 */
export function Symbol({ name, size = 24, color = null, class: className }) {
  return (
    <i
      class={className ? `symbol ${className}` : 'symbol'}
      aria-hidden="true"
      style={{ '--_size': `${size}px`, color }}
    >
      {name}
    </i>
  );
}
