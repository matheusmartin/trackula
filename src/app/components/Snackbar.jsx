import './Snackbar.css';

/** @import { JSX } from 'preact' */

/**
 * A short message at the bottom of the screen with one action, for example "Water: 3 glasses on Nov 26." and Undo. It
 * is a status: a screen reader says it, and it does not take the focus. The parent shows it in the action bar of the
 * App, above the bottom navigation bar, and removes it after some seconds. See `ActionBar`.
 * @param {object} props
 * @param {string} props.text
 * @param {string} props.action The text of the button, for example "Undo".
 * @param {() => void} props.onAction
 * @returns {JSX.Element}
 */
export function Snackbar({ text, action, onAction }) {
  return (
    <div class="app-snackbar" role="status">
      <p class="app-snackbar-text body-medium">{text}</p>
      <button type="button" class="app-snackbar-action label-large" onClick={() => onAction()}>
        {action}
      </button>
    </div>
  );
}
