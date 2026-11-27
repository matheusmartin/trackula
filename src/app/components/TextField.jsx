import { useId, useRef } from 'preact/hooks';
import './TextField.css';

/** @import { JSX } from 'preact' */

/**
 * An outlined text field with a `label`, and its `error` below it. `isNumber` shows the number keyboard on a phone.
 * The Enter key goes to the next text field in the closest element with the attribute `data-text-fields`. On the last
 * field (`isLast`), it closes the keyboard.
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.value
 * @param {string | null} [props.error] Null: no error.
 * @param {boolean} [props.isNumber] Default: false.
 * @param {boolean} [props.isLast] Default: false.
 * @param {(value: string) => void} props.onChange
 * @returns {JSX.Element}
 */
export function TextField({ label, value, error = null, isNumber = false, isLast = false, onChange }) {
  const id = useId();
  const input = useRef(/** @type {HTMLInputElement | null} */ (null));

  /** @param {JSX.TargetedKeyboardEvent<HTMLInputElement>} event */
  function onKeyDown(event) {
    if (event.key !== 'Enter' || input.current == null) return;
    event.preventDefault();
    if (isLast) {
      input.current.blur();
      return;
    }
    const fields = [...(input.current.closest('[data-text-fields]')?.querySelectorAll('input[type="text"]') ?? [])];
    const next = fields[fields.indexOf(input.current) + 1];
    if (next instanceof HTMLElement) next.focus();
  }

  return (
    <div class={error != null ? 'text-field text-field-invalid' : 'text-field'}>
      <input
        ref={input}
        id={id}
        type="text"
        inputMode={isNumber ? 'decimal' : 'text'}
        enterKeyHint={isLast ? 'done' : 'next'}
        autoComplete="off"
        // The label goes to the border when the placeholder does not show: when the field has a value.
        placeholder=" "
        value={value}
        aria-invalid={error != null}
        aria-describedby={error != null ? `${id}-error` : undefined}
        onInput={(event) => onChange(event.currentTarget.value)}
        onKeyDown={onKeyDown}
      />
      <label for={id}>{label}</label>
      {error != null && <output id={`${id}-error`}>{error}</output>}
    </div>
  );
}
