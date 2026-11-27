import './AppCard.css';

/** @import { ComponentChildren, JSX } from 'preact' */

/**
 * A card: the surface-container-low color and a soft shadow. Not the
 * Material 3 card color: that is the color of an empty day cell, so empty cells do not show on it. The card has no
 * padding: its content gives the padding.
 * @param {object} props
 * @param {ComponentChildren} props.children
 * @param {string} [props.class] More CSS classes, for example to set the padding or the width.
 * @returns {JSX.Element}
 */
export function AppCard({ children, class: className }) {
  return <div class={className ? `app-card ${className}` : 'app-card'}>{children}</div>;
}
