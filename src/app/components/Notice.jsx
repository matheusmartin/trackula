import { Symbol } from './Symbol.jsx';
import './Notice.css';

/** @import { JSX } from 'preact' */

/**
 * The kind of a {@link Notice}. It selects the icon and the colors.
 * @enum {string}
 */
export const NoticeKind = Object.freeze({ INFO: 'INFO', WARNING: 'WARNING', ERROR: 'ERROR' });

/** The icon of each {@link NoticeKind}. */
const ICONS = Object.freeze({ INFO: 'info', WARNING: 'warning', ERROR: 'error' });

/**
 * A message for the user in a soft box with an icon: an error of a load or a save, a warning such as the problems of
 * the sheet, or a note such as demo mode. A screen reader says an error when it shows.
 * @param {object} props
 * @param {string} props.text
 * @param {NoticeKind} [props.kind] Default: {@link NoticeKind.INFO}.
 * @param {string | null} [props.action] The text of a button at the end, for example "Try again". Null: no button.
 * @param {(() => void) | null} [props.onAction] The function of the button. Null: no button.
 * @param {string} [props.class] More CSS classes, for example to set the width.
 * @returns {JSX.Element}
 */
export function Notice({ text, kind = NoticeKind.INFO, action = null, onAction = null, class: className }) {
  const isError = kind === NoticeKind.ERROR;
  const kindClass = kind === NoticeKind.INFO ? null : `notice-${kind.toLowerCase()}`;
  const classes = ['notice', kindClass, className].filter(Boolean).join(' ');
  return (
    <div class={classes} aria-live={isError ? 'polite' : undefined}>
      <Symbol name={ICONS[/** @type {'INFO' | 'WARNING' | 'ERROR'} */ (kind)]} size={20} />
      <p class="notice-text body-medium">{text}</p>
      {action != null && onAction != null ? (
        <button type="button" class="notice-action label-large" onClick={() => onAction()}>
          {action}
        </button>
      ) : (
        // The same space at the end as in the Kotlin code.
        <span class="notice-end" />
      )}
    </div>
  );
}
