import { useEffect, useRef, useState } from 'preact/hooks';
import { errorText } from '../Errors.js';
import { Notice, NoticeKind } from '../components/Notice.jsx';
import { Button } from '../components/Button.jsx';
import './SignInPage.css';

/** @import { JSX } from 'preact' */
/** @import { Platform, Session } from '../Platform.js' */

/**
 * The full-screen sign-in page: the logo, the app name and a short text in the middle, and the Google sign-in button
 * at the bottom. Sizes use the smaller of the width and the height, so the page fits portrait and landscape screens.
 * If the screen is too small for all parts, for example a phone in landscape, the page scrolls.
 *
 * While the Google window is open, the button is disabled and a progress circle shows.
 * @param {object} props
 * @param {Platform} props.platform
 * @param {boolean} props.expired True if the user was signed out because the 1-hour token expired.
 * @param {(session: Session) => void} props.onSignedIn
 * @returns {JSX.Element}
 */
export function SignInPage({ platform, expired, onSignedIn }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const mounted = useMounted();

  // The latest props: the sign-in can end after a new render.
  const latest = useRef({ expired, onSignedIn });
  latest.current = { expired, onSignedIn };

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const session = await platform.signIn(!latest.current.expired);
      if (mounted.current) latest.current.onSignedIn(session);
    } catch (e) {
      if (mounted.current) setError(`Sign-in failed: ${errorText(e)}`);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <main class="sign-in-page">
      {/* An empty first part: then the logo part is in the middle of the page. */}
      <div />
      <div class="sign-in-logo">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />
        <h1 class="sign-in-title">Trackula</h1>
      </div>
      <div class="sign-in-actions">
        {expired && <Notice text="Google access lasts 1 hour. Sign in again to continue." />}
        {error != null && <Notice text={error} kind={NoticeKind.ERROR} />}
        {busy && <Progress text="Continue in the Google window." />}
        <Button
          variant="main"
          text="Sign in with Google"
          onClick={() => void signIn()}
          enabled={!busy}
          icon="login"
          class="fill-width"
        />
        <p class="sign-in-note body-small">Your data stays in your own Google Sheet. The app has no server.</p>
      </div>
    </main>
  );
}

/**
 * A progress circle and a `text` that tells what the app waits for.
 * @param {object} props
 * @param {string} props.text
 * @returns {JSX.Element}
 */
export function Progress({ text }) {
  return (
    <div class="progress-row" role="status">
      <progress class="circle" aria-hidden="true" />
      <span class="body-medium">{text}</span>
    </div>
  );
}

/**
 * True while the component shows. A sign-in or a Picker can end after the user left the page.
 * @returns {{ current: boolean }}
 */
export function useMounted() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
