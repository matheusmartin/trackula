// STUB until the Today page port (docs/js-port.md, phase 4). The props and ReloadHandle are final. The stub only loads
// the store, connects the reload button and shows a short text.
import { useEffect, useRef, useState } from 'preact/hooks';

/** @import { JSX } from 'preact' */
/** @import { Day } from '../../model/Day.js' */
/** @import { MainView } from '../../model/MainView.js' */
/** @import { Store } from '../../sheets/Store.js' */

/** The reload button in the app bar calls `run`. The Today page sets it. */
export class ReloadHandle {
  constructor() {
    /** @type {(() => void) | null} */
    this.run = null;
  }
}

/**
 * The main page: the metrics in Today tiles, a table or calendars, where the user records entries, or the score only.
 * @param {object} props
 * @param {Store} props.store The store of the sheet, or of demo mode. The page keeps the first one.
 * @param {Day} props.today
 * @param {() => boolean} props.expired True after the Google sign-in expired. Then `onExpired` runs instead of a store
 *   call.
 * @param {() => void} props.onExpired
 * @param {MainView} props.view The view of the navigation. The App owns it, and `onView` changes it.
 * @param {(view: MainView) => void} props.onView
 * @param {ReloadHandle} props.reload The reload button in the app bar calls it. The page sets it.
 * @param {(busy: boolean) => void} props.onBusy Called when a load or a write starts and ends.
 * @param {(open: boolean) => void} props.onDetail Called when a metric detail screen opens (true) or closes.
 * @param {(key: string) => string | null} props.readPref
 * @param {(key: string, value: string | null) => void} props.writePref
 * @param {boolean} [props.managing] True if the page shows the metrics screen. The App owns it, and `onManaging`
 *   changes it.
 * @param {(managing: boolean) => void} [props.onManaging]
 * @param {boolean} [props.hasMouse] True if the device has a mouse.
 * @returns {JSX.Element}
 */
export function TodayPage({ store, expired, onExpired, view, reload, onBusy, managing = false }) {
  const [loads, setLoads] = useState(0);
  const latest = useRef({ expired, onExpired, onBusy });
  latest.current = { expired, onExpired, onBusy };

  useEffect(() => {
    const load = async () => {
      if (latest.current.expired()) {
        latest.current.onExpired();
        return;
      }
      latest.current.onBusy(true);
      try {
        await store.load();
        setLoads((n) => n + 1);
      } finally {
        latest.current.onBusy(false);
      }
    };
    const handle = () => void load();
    reload.run = handle;
    void load();
    return () => {
      if (reload.run === handle) reload.run = null;
    };
  }, [store, reload]);

  if (loads === 0) return <p>Loading your data…</p>;
  return <p>Today page stub: {managing ? 'metrics screen' : view.name}</p>;
}
