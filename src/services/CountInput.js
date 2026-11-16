import { DoubleTap } from './DoubleTap.js';

/**
 * The input handler of count cells and tiles. It turns clicks, keys and taps into steps: +1 adds the metric step, −1
 * subtracts it.
 *
 * - Mouse and keyboard: a click adds a step at once, so two quick clicks add two steps. A right-click subtracts.
 * - Touch: a tap adds a step after the double-tap wait, and a double-tap subtracts instead. See {@link DoubleTap}. A
 *   long-press also opens the context menu on Android: it does nothing.
 * - Keys on a focused cell: `+` adds, `-` subtracts.
 *
 * The UI sends the browser events of the cell to the functions of this class, and always prevents the browser menu on
 * a count cell. `K` identifies a cell, for example a text key of a metric id and a day. Two keys are the same key if
 * `===` is true.
 * @template K
 */
export class CountInput {
  /**
   * Touch taps: a tap waits for a second tap on the same cell.
   * @type {DoubleTap<K>}
   */
  #taps = new DoubleTap();

  /**
   * The pointer type of the last press: `mouse`, `touch` or `pen`. Null after the click, so a keyboard click (Enter or
   * Space) works like a mouse click.
   * @type {string | null}
   */
  #pressType = null;

  /**
   * Handles a `pointerdown` event with the `pointerType` of the event.
   * @param {string} pointerType
   */
  pointerDown(pointerType) {
    this.#pressType = pointerType;
  }

  /**
   * Handles a click on the cell `key`. `add` gets +1 or −1.
   * @param {K} key
   * @param {(sign: number) => void} add
   */
  click(key, add) {
    if (this.#takeTouchPress()) {
      this.#taps.tap(
        key,
        () => add(1),
        () => add(-1),
      );
    } else {
      this.#addNow(add, 1);
    }
  }

  /**
   * Handles a `contextmenu` event: a right-click subtracts. A touch long-press does nothing.
   * @param {(sign: number) => void} add
   */
  contextMenu(add) {
    if (!this.#takeTouchPress()) this.#addNow(add, -1);
  }

  /**
   * Handles a `keydown` event with the `key` of the event.
   * @param {string} key
   * @param {(sign: number) => void} add
   * @returns {boolean} True if the key is an input: then the UI prevents the default action of the key.
   */
  keyDown(key, add) {
    let sign;
    switch (key) {
      case '+':
      case '=':
        sign = 1;
        break;
      case '-':
        sign = -1;
        break;
      default:
        return false;
    }
    this.#addNow(add, sign);
    return true;
  }

  /** Drops a waiting touch tap. Call it when the input goes away. */
  dispose() {
    this.#taps.dispose();
  }

  /**
   * Adds at once. A waiting touch tap runs first, so the steps keep their order.
   * @param {(sign: number) => void} add
   * @param {number} sign
   */
  #addNow(add, sign) {
    this.#taps.flush();
    add(sign);
  }

  /** @returns {boolean} True if the last press was a touch or a pen. Clears the press. */
  #takeTouchPress() {
    const touch = this.#pressType === 'touch' || this.#pressType === 'pen';
    this.#pressType = null;
    return touch;
  }
}
