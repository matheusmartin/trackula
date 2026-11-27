// The screen of the app, from the address of the browser tab. See `Route`.
import { createContext } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { Route } from '../model/Route.js';

/** @import { BrowserHistory } from './Platform.js' */

/**
 * Keeps the screen of the app and the address of the browser tab the same. The Back button of the browser, and the
 * back gesture of a phone, go to the screen before and do not leave the app.
 *
 * - {@link go} opens a screen on top: a detail screen, the metrics screen or a form. It adds a history entry.
 * - {@link show} changes the screen without an entry: the views of the navigation.
 * - {@link back} goes to the screen before. Without one, for example after a link to a metric, it shows the parent of
 *   the screen (see `Route.parent`).
 *
 * A screen can keep the user on it with a guard (see {@link useLeaveGuard}), for example a form with changes. When the
 * guard stops a Back of the browser, the entry of the screen comes back.
 */
export class Navigator {
  /** @param {BrowserHistory} history */
  constructor(history) {
    /** @private */
    this.history = history;
    /** The screen that the app shows. */
    this.route = Route.parse(history.hash());
    /**
     * The position of the current history entry: 0 for the first screen. Back stays in the app while it is above 0.
     * @private
     */
    this.index = history.index();
    /**
     * @private
     * @type {Set<(route: Route) => void>}
     */
    this.listeners = new Set();
    /**
     * The guard of the screen. It gives true to stay on the screen.
     * @private
     * @type {((to: Route) => boolean) | null}
     */
    this.guard = null;
    /**
     * True while a back runs that the guard must not stop: the close of a form after a save or a discard.
     * @private
     */
    this.forced = false;
    /**
     * True from a back of the app until the browser shows the entry before. A second back in that time does nothing,
     * so that two closes of one screen do not go back two screens.
     * @private
     */
    this.backing = false;
    history.onChange(() => this.changed());
  }

  /**
   * Calls `listener` after each change of the screen.
   * @param {(route: Route) => void} listener
   * @returns {() => void} The function that removes the listener.
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Opens the screen `route` on top of the current screen, with a new history entry.
   * @param {Route} route
   */
  go(route) {
    if (route.equals(this.route) || this.stays(route)) return;
    this.index++;
    this.history.push(route.hash, this.index);
    this.set(route);
  }

  /**
   * Shows the screen `route` in place of the current screen, without a new history entry.
   * @param {Route} route
   */
  show(route) {
    if (route.equals(this.route) || this.stays(route)) return;
    this.history.replace(route.hash, this.index);
    this.set(route);
  }

  /**
   * Goes to the screen before, as the Back button of the browser does. Without a screen before, shows the parent of the
   * screen, or the Today view.
   * @param {boolean} [force] True if the guard must not stop it. Example: the close of a form after a save.
   */
  back(force = false) {
    if (this.backing) return;
    if (this.index > 0) {
      this.forced = force;
      this.backing = true;
      this.history.back();
      return;
    }
    const parent = this.route.parent ?? Route.TODAY;
    if (parent.equals(this.route) || (!force && this.stays(parent))) return;
    this.history.replace(parent.hash, this.index);
    this.set(parent);
  }

  /**
   * Sets the guard of the current screen. It gets the next screen and gives true to stay.
   * @param {(to: Route) => boolean} guard
   * @returns {() => void} The function that removes the guard.
   */
  setGuard(guard) {
    this.guard = guard;
    return () => {
      if (this.guard === guard) this.guard = null;
    };
  }

  /**
   * True if the guard keeps the user on the screen instead of `to`.
   * @private
   * @param {Route} to
   * @returns {boolean}
   */
  stays(to) {
    return this.guard != null && this.guard(to);
  }

  /**
   * The browser went to another entry: the screen of its address shows, unless the guard stops it.
   * @private
   */
  changed() {
    const to = Route.parse(this.history.hash());
    const index = this.history.index();
    const forced = this.forced;
    this.forced = false;
    this.backing = false;
    if (!forced && !to.equals(this.route) && this.stays(to)) {
      // The entry of the current screen comes back.
      this.index = index + 1;
      this.history.push(this.route.hash, this.index);
      return;
    }
    this.index = index;
    this.set(to);
  }

  /**
   * @private
   * @param {Route} route
   */
  set(route) {
    this.route = route;
    for (const listener of this.listeners) listener(route);
  }
}

/** The {@link Navigator} of the App. Null without the App, for example in a test of one form. */
export const LocalNavigator = createContext(/** @type {Navigator | null} */ (null));

/**
 * The {@link Navigator} of the App. A screen that changes the screen needs it.
 * @returns {Navigator}
 */
export function useNavigator() {
  const navigator = useContext(LocalNavigator);
  if (navigator == null) throw new Error('No Navigator: put the screen in a LocalNavigator.Provider.');
  return navigator;
}

/**
 * The screen of `navigator`. The component renders again when it changes.
 * @param {Navigator} navigator
 * @returns {Route}
 */
export function useRoute(navigator) {
  const [route, setRoute] = useState(navigator.route);
  useEffect(() => {
    setRoute(navigator.route);
    return navigator.subscribe(setRoute);
  }, [navigator]);
  return route;
}

/**
 * While the screen shows, `stays` gets each next screen before it shows, and gives true to stay on this screen.
 * Example: a form with changes stays and asks if the user wants to discard them. Without a {@link Navigator}, it does
 * nothing.
 * @param {(to: Route) => boolean} stays
 */
export function useLeaveGuard(stays) {
  const navigator = useContext(LocalNavigator);
  // The latest function: the guard stays the same while the screen shows.
  const latest = useRef(stays);
  latest.current = stays;
  useEffect(() => {
    if (navigator == null) return;
    return navigator.setGuard((to) => latest.current(to));
  }, [navigator]);
}
