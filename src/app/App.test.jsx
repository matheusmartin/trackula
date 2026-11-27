import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { Config } from '../services/Config.js';
import { App } from './App.jsx';
import { FakePlatform } from './testing/FakePlatform.js';

/** The longest wait for the UI in a test. */
const TIMEOUT = 5000;

/** The text of the expired session on the sign-in page. */
const EXPIRED_TEXT = 'Google access lasts 1 hour. Sign in again to continue.';

afterEach(cleanup);

/** Waits until the Today page shows the data of the sheet: the metric "Weight". */
async function waitForTodayPage() {
  await screen.findAllByText('Weight', {}, { timeout: TIMEOUT });
}

/**
 * Clicks the button with the name `name`.
 * @param {string} name
 */
function click(name) {
  fireEvent.click(screen.getByRole('button', { name }));
}

/**
 * Signs in and waits until the Today page shows.
 * @param {FakePlatform} platform
 */
async function signInToTodayPage(platform) {
  render(<App platform={platform} />);
  click('Sign in with Google');
  await waitForTodayPage();
}

describe('App', () => {
  test('without the Google values, the app asks for them', () => {
    render(<App platform={new FakePlatform({ config: new Config('', '') })} />);
    expect(screen.getByText('Set GOOGLE_CLIENT_ID and GOOGLE_API_KEY in config.env. See README.md.')).toBeTruthy();
    expect(screen.queryByText('Sign in with Google')).toBeNull();
  });

  test('sign in, then choose a sheet, then the Today page', async () => {
    const platform = new FakePlatform();
    render(<App platform={platform} />);

    click('Sign in with Google');
    await screen.findByRole('heading', { name: 'Choose a sheet' });
    expect(platform.signIns).toEqual([true]);
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();

    click('Choose sheet');
    await waitFor(() => expect(platform.readPref('spreadsheetId')).toBe('sheet-1'), { timeout: TIMEOUT });
    expect(platform.session.prepared).toEqual(['sheet-1']);
    await waitForTodayPage();
    expect(screen.getByText('Days')).toBeTruthy();
    click('More');
    expect(screen.getByRole('menuitem', { name: 'Change sheet' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeTruthy();
  });

  test('the Metrics button opens the metrics screen without the navigation', async () => {
    const platform = new FakePlatform({ savedSpreadsheetId: 'sheet-1' });
    await signInToTodayPage(platform);

    click('Metrics');
    await screen.findByRole('button', { name: 'Add metric' });
    expect(screen.queryByText('Days')).toBeNull();
    expect(platform.history.depth).toBe(1);
    expect(platform.history.hash()).toBe('#/metrics');

    click('Back');

    await screen.findByText('Days');
    expect(screen.queryByRole('heading', { name: 'Metrics' })).toBeNull();
  });

  test('the Back button of the browser closes the metrics screen', async () => {
    const platform = new FakePlatform({ savedSpreadsheetId: 'sheet-1' });
    await signInToTodayPage(platform);
    click('Metrics');
    await screen.findByRole('heading', { name: 'Metrics' });
    expect(platform.history.depth).toBe(1);
    expect(platform.history.hash()).toBe('#/metrics');

    platform.history.userBack();

    await screen.findByText('Days');
    expect(screen.queryByRole('heading', { name: 'Metrics' })).toBeNull();
    await waitFor(() => expect(platform.history.depth).toBe(0));
  });

  test('the address opens its screen after the sign-in, and Back without a screen before shows its parent', async () => {
    const platform = new FakePlatform({ savedSpreadsheetId: 'sheet-1', hash: '#/metric/weight' });
    render(<App platform={platform} />);
    click('Sign in with Google');
    await screen.findByText('Edit days', {}, { timeout: TIMEOUT });
    expect(screen.queryByRole('navigation', { name: 'Views' })).toBeNull();

    click('Back');

    await screen.findByText('Days');
    expect(platform.history.hash()).toBe('#/days');
    expect(platform.history.depth).toBe(0);
  });

  test('a view of the navigation changes the address without a new history entry', async () => {
    const platform = new FakePlatform({ isDemo: true });
    render(<App platform={platform} />);
    await waitForTodayPage();
    click('Score');
    await waitFor(() => expect(platform.history.hash()).toBe('#/score'));
    expect(platform.history.depth).toBe(0);
  });

  test('a saved sheet opens after the sign-in, and Change sheet forgets it', async () => {
    const platform = new FakePlatform({ savedSpreadsheetId: 'sheet-1' });
    await signInToTodayPage(platform);

    click('More');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Change sheet' }));

    await screen.findByRole('heading', { name: 'Choose a sheet' });
    expect(platform.readPref('spreadsheetId')).toBeNull();
  });

  test('an expired session shows the sign-in page with the reason', async () => {
    const platform = new FakePlatform({ savedSpreadsheetId: 'sheet-1' });
    await signInToTodayPage(platform);

    platform.session.expired = true;
    click('Reload');
    await screen.findByText(EXPIRED_TEXT);

    // The second sign-in keeps the account: no account selection. It gives a new token.
    platform.session.expired = false;
    click('Sign in with Google');
    await waitForTodayPage();
    expect(platform.signIns).toEqual([true, false]);
  });

  test('sign out shows the sign-in page without the expiry text', async () => {
    const platform = new FakePlatform({ savedSpreadsheetId: 'sheet-1' });
    await signInToTodayPage(platform);

    click('More');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    await screen.findByRole('button', { name: 'Sign in with Google' });
    expect(screen.queryByText(EXPIRED_TEXT)).toBeNull();
    expect(platform.readPref('spreadsheetId')).toBe('sheet-1');
  });

  test('the reload button loads the data again', async () => {
    const platform = new FakePlatform({ savedSpreadsheetId: 'sheet-1' });
    await signInToTodayPage(platform);
    await screen.findByRole('button', { name: 'Reload' });
    const loads = platform.session.countingStore.loads;

    click('Reload');

    await waitFor(() => expect(platform.session.countingStore.loads).toBe(loads + 1), { timeout: TIMEOUT });
    await screen.findByRole('button', { name: 'Reload' });
  });

  test('demo mode shows the data without sign-in, and the views', async () => {
    render(<App platform={new FakePlatform({ isDemo: true })} />);
    expect(screen.queryByText('Sign in with Google')).toBeNull();
    await waitForTodayPage();
    for (const label of ['Today', 'Days', 'Score']) expect(screen.getAllByText(label)).toHaveLength(1);
  });

  test('a view of the navigation is the current page after a click', async () => {
    render(<App platform={new FakePlatform({ isDemo: true })} />);
    const views = screen.getByRole('navigation', { name: 'Views' });
    expect(views.querySelector('[aria-current="page"]')?.textContent).toContain('Today');

    click('Days');

    await waitFor(() => expect(views.querySelector('[aria-current="page"]')?.textContent).toContain('Days'));
  });

  test('the app bar shows a progress circle in place of the reload button while the data loads', async () => {
    render(<App platform={new FakePlatform({ isDemo: true })} />);
    await screen.findByRole('progressbar', { name: 'Loading' });
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
    await screen.findByRole('button', { name: 'Reload' }, { timeout: TIMEOUT });
  });
});
