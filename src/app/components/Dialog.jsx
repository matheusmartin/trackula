import { useId, useLayoutEffect, useRef } from 'preact/hooks';
import { Button } from './Button.jsx';
import './Dialog.css';

/** @import { JSX } from 'preact' */

/**
 * A Material 3 alert dialog that asks to confirm an action: a modal dialog with a `title`, a `text`, and two buttons
 * at the end. The confirm button is the last one, in the error color. Escape and a click out of the dialog call `onDismiss`.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.text
 * @param {string} props.confirm The text of the confirm button.
 * @param {string} props.dismiss The text of the dismiss button.
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onDismiss
 * @returns {JSX.Element}
 */
export function ConfirmDialog({ title, text, confirm, dismiss, onConfirm, onDismiss }) {
  const dialog = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const id = useId();
  useLayoutEffect(() => {
    const element = dialog.current;
    if (element != null && !element.open) element.showModal();
    // The browser puts the focus back on the button that opened the dialog.
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      class="alert-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-text`}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onClick={(event) => {
        // A click on the backdrop: the target is the dialog, not its content.
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div class="alert-dialog-content">
        <h2 id={`${id}-title`} class="alert-dialog-title headline-small">
          {title}
        </h2>
        <p id={`${id}-text`} class="alert-dialog-text body-medium">
          {text}
        </p>
        <div class="alert-dialog-buttons">
          <Button text={dismiss} onClick={onDismiss} />
          <Button text={confirm} tone="error" onClick={onConfirm} />
        </div>
      </div>
    </dialog>
  );
}
