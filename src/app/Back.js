// The Back button of the browser and the back gesture of a phone.
import { createContext } from 'preact';
import { useContext, useEffect, useRef } from 'preact/hooks';

/** @import { BrowserHistory } from './Platform.js' */

/**
 * Sends the Back button of the browser to the screen on top: a detail screen, the metrics screen or a form. Without
 * it, Back leaves the app, also from a detail screen of the installed app on a phone.
 *
 * Each screen that can close adds a handler while it shows (see {@link useOnBack}). Each handler has one entry in the
 * browser history. Back removes the entry of the newest handler: the dispatcher adds the entry again and calls the
 * handler. If the handler closes its screen, the screen removes the handler, and the dispatcher removes the entry. If
 * the handler keeps its screen open, for example to ask about unsaved changes, the entry stays for the next Back.
 */
export class BackDispatcher {
  /** @param {BrowserHistory} history */
  constructor(history) {
    /** @private */
    this.history = history;
    /**
     * @private
     * @type {(() => void)[]}
     */
    this.handlers = [];
    /**
     * The number of backs that the dispatcher started itself. Their events do not call a handler.
     * @private
     */
    this.ownBacks = 0;
    history.onBack(() => {
      if (this.ownBacks > 0) {
        this.ownBacks--;
      } else if (this.handlers.length > 0) {
        history.push();
        this.handlers[this.handlers.length - 1]();
      }
    });
  }

  /**
   * Adds `handler` as the newest handler. Back calls only the newest handler.
   * @param {() => void} handler
   */
  add(handler) {
    this.handlers.push(handler);
    this.history.push();
  }

  /**
   * Removes `handler` and its history entry. Call it when the screen closes.
   * @param {() => void} handler
   */
  remove(handler) {
    const index = this.handlers.indexOf(handler);
    if (index < 0) return;
    this.handlers.splice(index, 1);
    this.ownBacks++;
    this.history.back();
  }
}

/** The {@link BackDispatcher} of the App. Null without the App, for example in a test of one page. */
export const LocalBackDispatcher = createContext(/** @type {BackDispatcher | null} */ (null));

/**
 * While `enabled`, the Back button of the browser calls `onBack` and does not leave the app. Use it on a screen that
 * has its own back or close button, with the same function.
 * @param {boolean} enabled
 * @param {() => void} onBack
 */
export function useOnBack(enabled, onBack) {
  const dispatcher = useContext(LocalBackDispatcher);
  // The latest function: the handler stays the same while the screen shows.
  const current = useRef(onBack);
  current.current = onBack;
  useEffect(() => {
    if (dispatcher == null || !enabled) return;
    const handler = () => current.current();
    dispatcher.add(handler);
    return () => dispatcher.remove(handler);
  }, [dispatcher, enabled]);
}
