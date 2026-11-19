import { createContext } from 'preact';
import { createPortal } from 'preact/compat';
import { useContext } from 'preact/hooks';

/** @import { ComponentChildren, JSX } from 'preact' */

/**
 * The place of the main action of a page, for example the Save button of the Today tiles. The App shows the action
 * below the content and above the bottom navigation bar, so that the action stays in view while the page scrolls.
 * See {@link ActionBar}.
 */
export class ActionBarHost {
  /**
   * @param {HTMLElement | null} element The element of the App that shows the action. Null until the App shows it.
   */
  constructor(element) {
    this.element = element;
    Object.freeze(this);
  }
}

/** The {@link ActionBarHost} of the App. Null without the App, for example in a test of one page. */
export const LocalActionBarHost = createContext(/** @type {ActionBarHost | null} */ (null));

/**
 * Shows `children` as the main action of the page. With an {@link ActionBarHost}, it shows there, and here it shows
 * nothing. Without one, it shows here, in the page. When the component goes away, its action goes away too.
 * @param {object} props
 * @param {ComponentChildren} props.children
 * @returns {JSX.Element | null}
 */
export function ActionBar({ children }) {
  const host = useContext(LocalActionBarHost);
  if (host == null) return <>{children}</>;
  if (host.element == null) return null;
  return createPortal(<div class="action-bar-content">{children}</div>, host.element);
}
