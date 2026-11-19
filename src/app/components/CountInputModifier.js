// The browser events of a count cell or tile. See CountInput in src/services/.
import { useEffect, useMemo } from 'preact/hooks';
import { CountInput } from '../../services/CountInput.js';

/** @import { JSX } from 'preact' */

/** The time after which a touch press is a long press, in milliseconds, as in Compose. A long press does nothing. */
const LONG_PRESS_MILLIS = 500;

/**
 * The last press of an input.
 * @typedef {object} Press
 * @property {string} type The pointer type: `mouse`, `touch` or `pen`.
 * @property {number} time The time of the press, in milliseconds.
 * @property {boolean} menu True after the context menu event of the press.
 */

/**
 * The last press of each input. The click after the press reads it.
 * @type {WeakMap<CountInput<any>, Press>}
 */
const presses = new WeakMap();

/**
 * A {@link CountInput} for the count cells or tiles of one component. It drops a waiting touch tap when the component
 * goes away.
 * @template K
 * @returns {CountInput<K>}
 */
export function useCountInput() {
  const input = useMemo(() => /** @type {CountInput<K>} */ (new CountInput()), []);
  useEffect(() => () => input.dispose(), [input]);
  return input;
}

/**
 * The event handlers of a count cell or tile `key`. They send the presses, clicks and keys to `input`. `add` gets +1
 * or −1. Give the handlers to a `<button>`. See {@link CountInput}.
 *
 * - A click adds a step. A touch tap adds after the double-tap wait, and a touch double-tap subtracts.
 * - A right-click subtracts at once. The browser menu does not open.
 * - A touch press that is longer than the long-press time does nothing, as a long press on Android. A touch press that
 *   becomes a scroll also does nothing.
 * - Enter and Space click the button. `+`, `=` and `-` add and subtract.
 *
 * A touch tap runs `add` after a wait: `add` must read the latest values when it runs.
 * @template K
 * @param {CountInput<K>} input
 * @param {K} key
 * @param {(sign: number) => void} add
 * @returns {Pick<JSX.HTMLAttributes<HTMLElement>, 'onPointerDown' | 'onPointerCancel' | 'onClick' | 'onContextMenu' | 'onKeyDown'>}
 */
export function countInputProps(input, key, add) {
  return {
    onPointerDown: (event) => {
      input.pointerDown(event.pointerType);
      presses.set(input, { type: event.pointerType, time: event.timeStamp, menu: false });
    },
    onPointerCancel: (event) => {
      presses.delete(input);
      // A touch press that became a scroll: no tap.
      if (event.pointerType !== 'mouse') input.contextMenu(add);
    },
    onClick: (event) => {
      // A click of the keyboard or of a screen reader has no detail: it comes after no press.
      const press = event.detail === 0 ? null : presses.get(input);
      presses.delete(input);
      // The context menu event of this press did the input already.
      if (press?.menu) return;
      if (press != null && press.type !== 'mouse' && event.timeStamp - press.time > LONG_PRESS_MILLIS) {
        // A long touch press is a context menu, as on Android: it does nothing.
        input.contextMenu(add);
        return;
      }
      input.click(key, add);
    },
    onContextMenu: (event) => {
      event.preventDefault();
      // A touch long press can have a click after it. A right-click has none.
      const press = presses.get(input);
      if (press?.type === 'mouse') presses.delete(input);
      else if (press != null) press.menu = true;
      input.contextMenu(add);
    },
    onKeyDown: (event) => {
      if (input.keyDown(event.key, add)) event.preventDefault();
    },
  };
}
