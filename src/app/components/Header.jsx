import { useEffect, useRef, useState } from 'preact/hooks';
import { AppIconButton } from './AppIconButton.jsx';
import { Symbol } from './Symbol.jsx';
import './Header.css';

/** @import { JSX } from 'preact' */

/**
 * The top app bar with the logo, the app name and the actions, on the header gradient in both themes. It stays at the
 * top while the page scrolls.
 * @param {object} props
 * @param {(() => void) | null} [props.onReload] Reloads the sheet data. Null: no reload button, for example before the
 *   user chooses a sheet.
 * @param {boolean} [props.busy] True while data loads or saves: a progress circle shows instead of the reload button.
 * @param {(() => void) | null} [props.onMetrics] Opens the metrics screen. Its back button closes it. Null: no metrics
 *   button.
 * @param {(() => void) | null} [props.onSignOut] Signs out. It is in the "More" menu.
 * @param {(() => void) | null} [props.onDisconnect] Change sheet. It is in the "More" menu. If both are null: no menu.
 * @returns {JSX.Element}
 */
export function Header({ onReload = null, busy = false, onMetrics = null, onSignOut = null, onDisconnect = null }) {
  return (
    <header class="app-bar">
      <img class="app-bar-logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width="32" height="32" />
      <h1 class="app-bar-title">Trackula</h1>
      {onReload != null &&
        (busy ? (
          // The size of an icon button, so that the other buttons do not move.
          <span class="app-bar-progress">
            <progress class="circle" aria-label="Loading" />
          </span>
        ) : (
          <AppIconButton icon="refresh" title="Reload" onClick={onReload} />
        ))}
      {onMetrics != null && <AppIconButton icon="tune" title="Metrics" onClick={onMetrics} />}
      {(onDisconnect != null || onSignOut != null) && <AccountMenu onDisconnect={onDisconnect} onSignOut={onSignOut} />}
    </header>
  );
}

/**
 * The "More" button with the menu of the actions that the user needs seldom: Change sheet and Sign out. They are not
 * buttons in the bar, so that a wrong tap does not sign the user out.
 *
 * The menu closes after a click outside it, with Escape or when the focus goes out of it. The arrow keys move the
 * focus between the items.
 * @param {object} props
 * @param {(() => void) | null} props.onDisconnect
 * @param {(() => void) | null} props.onSignOut
 * @returns {JSX.Element}
 */
function AccountMenu({ onDisconnect, onSignOut }) {
  const [open, setOpen] = useState(false);
  const root = useRef(/** @type {HTMLDivElement | null} */ (null));

  useEffect(() => {
    if (!open) return;
    const first = root.current?.querySelector('[role="menuitem"]');
    if (first instanceof HTMLElement) first.focus();
    /** @param {PointerEvent} event */
    const onPointerDown = (event) => {
      if (!root.current?.contains(/** @type {Node} */ (event.target))) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  /** Closes the menu and puts the focus on the More button again. */
  function close() {
    setOpen(false);
    root.current?.querySelector('button')?.focus();
  }

  /** @param {JSX.TargetedKeyboardEvent<HTMLDivElement>} event */
  function onKeyDown(event) {
    if (!open) return;
    const items = [...(root.current?.querySelectorAll('[role="menuitem"]') ?? [])].map(
      (item) => /** @type {HTMLElement} */ (item),
    );
    const index = items.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    }
  }

  /**
   * Closes the menu when the focus goes to an element out of it, for example with Tab. Not when the focus goes to no
   * element: Safari does that before the click on a menu item.
   * @param {JSX.TargetedFocusEvent<HTMLDivElement>} event
   */
  function onFocusOut(event) {
    const target = event.relatedTarget;
    if (target instanceof Node && !root.current?.contains(target)) setOpen(false);
  }

  /**
   * @param {() => void} action
   * @returns {() => void} The click function of a menu item: it closes the menu and runs `action`.
   */
  const choose = (action) => () => {
    setOpen(false);
    action();
  };

  return (
    <div class="account-menu" ref={root} onKeyDown={onKeyDown} onFocusOut={onFocusOut}>
      <AppIconButton
        icon="more_vert"
        title="More"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
      />
      {open && (
        <div class="app-menu" role="menu" aria-label="More">
          {onDisconnect != null && <MenuItem icon="swap_horiz" text="Change sheet" onClick={choose(onDisconnect)} />}
          {onSignOut != null && <MenuItem icon="logout" text="Sign out" onClick={choose(onSignOut)} />}
        </div>
      )}
    </div>
  );
}

/**
 * An item of a Material 3 menu, with a leading icon.
 * @param {object} props
 * @param {string} props.icon
 * @param {string} props.text
 * @param {() => void} props.onClick
 * @returns {JSX.Element}
 */
function MenuItem({ icon, text, onClick }) {
  return (
    <button type="button" role="menuitem" class="app-menu-item" onClick={onClick}>
      <Symbol name={icon} />
      <span class="label-large">{text}</span>
    </button>
  );
}
