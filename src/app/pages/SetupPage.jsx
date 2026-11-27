import { useRef, useState } from 'preact/hooks';
import { errorText } from '../Errors.js';
import { AppCard } from '../components/AppCard.jsx';
import { Notice, NoticeKind } from '../components/Notice.jsx';
import { Button } from '../components/Button.jsx';
import { Progress, useMounted } from './SignInPage.jsx';
import './SetupPage.css';

/** @import { JSX } from 'preact' */
/** @import { Session } from '../Platform.js' */

/**
 * The page where the user picks a spreadsheet from their Drive with the Google Picker. Wide screens: the card is at
 * most `FORM_WIDTH` wide and centered. While the Picker is open or the app prepares the sheet, the button is disabled
 * and a progress circle shows.
 * @param {object} props
 * @param {Session} props.session
 * @param {(spreadsheetId: string) => void} props.onConnected
 * @returns {JSX.Element}
 */
export function SetupPage({ session, onConnected }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const mounted = useMounted();

  // The latest props: the Picker can close after a new render.
  const latest = useRef({ session, onConnected });
  latest.current = { session, onConnected };

  async function choose() {
    setBusy(true);
    setError(null);
    try {
      const spreadsheetId = await latest.current.session.pickSpreadsheet();
      if (spreadsheetId == null || !mounted.current) return;
      await latest.current.session.prepare(spreadsheetId);
      if (mounted.current) latest.current.onConnected(spreadsheetId);
    } catch (e) {
      if (mounted.current) setError(errorText(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <div class="setup-page">
      <AppCard class="setup-card">
        <h2 class="headline-small">Choose a sheet</h2>
        <p class="body-large">
          Pick a Google Sheet from your Drive. If it has no "Metrics" and "Log" tabs, the app adds them, with example
          metrics. Other tabs do not change.
        </p>
        {error != null && <Notice text={error} kind={NoticeKind.ERROR} />}
        {busy && <Progress text="Pick a sheet in the Google window. Then the app prepares it." />}
        <Button
          variant="main"
          text="Choose sheet"
          onClick={() => void choose()}
          enabled={!busy}
          icon="folder_open"
          class="fill-width"
        />
      </AppCard>
    </div>
  );
}
