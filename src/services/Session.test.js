import { afterEach, describe, expect, test, vi } from 'vitest';
import { SheetsStore } from '../sheets/SheetsStore.js';
import { AccessToken } from './AccessToken.js';
import { Config } from './Config.js';
import { loadScript } from './Scripts.js';
import { Session, SignInException } from './Session.js';

/** @import { OAuth2Api, TokenClientConfig, TokenResponse } from './Session.js' */

// Node.js cannot load the script of the sign-in: the test puts a fake token client in its place.
vi.mock('./Scripts.js', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  loadScript: vi.fn(async () => {}),
}));

const config = new Config('123456-abc.apps.googleusercontent.com', 'key');

/**
 * Puts a fake `google.accounts.oauth2` in place. Its token client calls `answer` with the settings of the client.
 * @param {(client: TokenClientConfig) => void} answer
 * @returns {TokenClientConfig[]} The settings of each token client.
 */
function fakeTokenClient(answer) {
  /** @type {TokenClientConfig[]} */
  const clients = [];
  /** @type {OAuth2Api} */
  const oauth2 = {
    initTokenClient: (client) => {
      clients.push(client);
      return { requestAccessToken: () => answer(client) };
    },
  };
  vi.stubGlobal('google', { accounts: { oauth2 } });
  return clients;
}

/**
 * Signs in with a token client that gives `response`.
 * @param {TokenResponse} response
 * @returns {Promise<Session>}
 */
function signInWith(response) {
  fakeTokenClient((client) => client.callback(response));
  return Session.signIn(true, config);
}

describe('Session', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('the sign-in asks for the drive.file scope and gives a session with the token', async () => {
    const clients = fakeTokenClient((client) => client.callback({ access_token: 'token-1', expires_in: 3599 }));
    const session = await Session.signIn(true, config);
    expect(loadScript).toHaveBeenCalledWith(
      'https://accounts.google.com/gsi/client',
      'Cannot load the Google sign-in.',
    );
    expect(session.accessToken).toBe('token-1');
    expect(session.expired).toBe(false);
    expect(clients).toEqual([
      expect.objectContaining({
        client_id: '123456-abc.apps.googleusercontent.com',
        scope: 'https://www.googleapis.com/auth/drive.file',
        prompt: 'select_account',
      }),
    ]);
  });

  test('without selectAccount the sign-in does not ask for the account', async () => {
    const clients = fakeTokenClient((client) => client.callback({ access_token: 'token-1' }));
    await Session.signIn(false, config);
    expect(clients[0].prompt).toBe('');
  });

  test('the lifetime of the token is a number or a text, else 1 hour', async () => {
    // 15 seconds is less than the margin of AccessToken: the token is expired at once.
    expect((await signInWith({ access_token: 't', expires_in: '15' })).expired).toBe(true);
    expect((await signInWith({ access_token: 't', expires_in: 15 })).expired).toBe(true);
    expect((await signInWith({ access_token: 't' })).expired).toBe(false);
    expect((await signInWith({ access_token: 't', expires_in: 'soon' })).expired).toBe(false);
  });

  test('an answer without a token fails with the error description, else the error', async () => {
    const denied = signInWith({ error: 'access_denied', error_description: 'The user denied access.' });
    await expect(denied).rejects.toBeInstanceOf(SignInException);
    await expect(denied).rejects.toThrow('Google sign-in failed: The user denied access.');
    await expect(signInWith({ error: 'access_denied' })).rejects.toThrow('Google sign-in failed: access_denied');
    await expect(signInWith({})).rejects.toThrow('Google sign-in failed: No access token.');
  });

  test('a popup error fails with its type', async () => {
    fakeTokenClient((client) => client.error_callback({ type: 'popup_closed' }));
    await expect(Session.signIn(true, config)).rejects.toThrow(
      new SignInException('Google sign-in failed: popup_closed'),
    );
  });

  test('the text of the exception is the message only', () => {
    expect(String(new SignInException('Google sign-in failed: popup_closed'))).toBe(
      'Google sign-in failed: popup_closed',
    );
  });

  test('authorizedFetch sends the access token and keeps the other parts of the request', async () => {
    const fetch = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetch);
    const session = new Session(new AccessToken('token-1', 3600_000));
    await session.authorizedFetch('https://sheets.googleapis.com/v4/spreadsheets/sheet-1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    await session.authorizedFetch('https://sheets.googleapis.com/v4/spreadsheets/sheet-1');

    const [[url, init], [, plainInit]] = /** @type {[string, RequestInit][]} */ (
      /** @type {unknown} */ (fetch.mock.calls)
    );
    expect(url).toBe('https://sheets.googleapis.com/v4/spreadsheets/sheet-1');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{}');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer token-1');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(new Headers(plainInit.headers).get('Authorization')).toBe('Bearer token-1');
  });

  test('store gives the store of the spreadsheet', () => {
    const session = new Session(new AccessToken('token-1', 3600_000));
    expect(session.store('sheet-1')).toBeInstanceOf(SheetsStore);
  });
});
