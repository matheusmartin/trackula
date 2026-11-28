import { Symbol } from './Symbol.jsx';
import './EmptyState.css';

/** @import { ComponentChildren, JSX } from 'preact' */

/**
 * A screen without content: an icon, a title, one or two sentences that tell what to do, and an action below them.
 * Example: the Today screen of a sheet without metrics.
 * @param {object} props
 * @param {string} props.icon The Material Symbols icon.
 * @param {string} props.title
 * @param {string} props.text
 * @param {ComponentChildren} [props.children] The action, for example a button.
 * @returns {JSX.Element}
 */
export function EmptyState({ icon, title, text, children }) {
  return (
    <div class="empty-state">
      <Symbol name={icon} size={40} color="var(--on-surface-variant)" />
      <h2 class="empty-state-title title-large">{title}</h2>
      <p class="empty-state-text body-medium">{text}</p>
      {children}
    </div>
  );
}
