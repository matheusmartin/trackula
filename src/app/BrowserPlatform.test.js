import { afterEach, describe, expect, test, vi } from 'vitest';
import { AccessToken } from '../services/AccessToken.js';
import { pickSpreadsheet } from '../services/Picker.js';
import { Session } from '../services/Session.js';
import { SheetsStore } from '../sheets/SheetsStore.js';
import { browserPlatform } from './BrowserPlatform.js';

// happy-dom cannot open the Google Picker.
vi.mock('../services/Picker.js', () => ({ pickSpreadsheet: vi.fn(async () => 'sheet-1') }));

describe('browserPlatform', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  test('isDemo is true if the URL has the parameter demo', async () => {
    expect(browserPlatform.isDemo).toBe(false);
    window.history.replaceState(null, '', '/?demo');
    vi.resetModules();
    const { browserPlatform: demoPlatform } = await import('./BrowserPlatform.js');
    expect(demoPlatform.isDemo).toBe(true);
  });

  test('hasMouse is the media query pointer: fine', async () => {
    const coarse = /** @type {MediaQueryList} */ ({ matches: false });
    const matchMedia = vi.spyOn(window, 'matchMedia').mockReturnValue(coarse);
    vi.resetModules();
    const { browserPlatform: phonePlatform } = await import('./BrowserPlatform.js');
    expect(matchMedia).toHaveBeenCalledWith('(pointer: fine)');
    expect(phonePlatform.hasMouse).toBe(false);
  });

  test('the session of the sign-in uses the Google session', async () => {
    const google = new Session(new AccessToken('token-1', 3600_000));
    const signIn = vi.spyOn(Session, 'signIn').mockResolvedValue(google);
    const ensureTabs = vi.spyOn(SheetsStore.prototype, 'ensureTabs').mockResolvedValue();

    const session = await browserPlatform.signIn(false);
    expect(signIn).toHaveBeenCalledWith(false, browserPlatform.config);
    expect(session.expired).toBe(false);
    expect(await session.pickSpreadsheet()).toBe('sheet-1');
    expect(pickSpreadsheet).toHaveBeenCalledWith('token-1');
    expect(session.store('sheet-1')).toBeInstanceOf(SheetsStore);
    await session.prepare('sheet-1');
    expect(ensureTabs).toHaveBeenCalledOnce();
  });
});
