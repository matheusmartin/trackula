import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { Header } from './Header.jsx';

afterEach(cleanup);

describe('Header', () => {
  test('without actions, the bar has only the app name', () => {
    render(<Header />);
    expect(screen.getByRole('heading', { name: 'Trackula' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('while busy, a progress circle shows in place of the reload button', () => {
    render(<Header onReload={() => {}} busy />);
    expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull();
  });

  test('each icon button has a tooltip and a name', () => {
    render(<Header onReload={() => {}} onMetrics={() => {}} />);
    for (const name of ['Reload', 'Metrics']) {
      expect(screen.getByRole('button', { name }).getAttribute('title')).toBe(name);
    }
  });

  test('the More menu has Change sheet and Sign out, and an item closes it', () => {
    /** @type {string[]} */
    const calls = [];
    render(<Header onDisconnect={() => calls.push('disconnect')} onSignOut={() => calls.push('sign out')} />);
    const more = screen.getByRole('button', { name: 'More' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(more);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(calls).toEqual(['sign out']);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  test('the keys move the focus in the menu, and Escape closes it', () => {
    render(<Header onDisconnect={() => {}} onSignOut={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const changeSheet = screen.getByRole('menuitem', { name: 'Change sheet' });
    const signOut = screen.getByRole('menuitem', { name: 'Sign out' });
    expect(document.activeElement).toBe(changeSheet);

    fireEvent.keyDown(changeSheet, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(signOut);
    fireEvent.keyDown(signOut, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(changeSheet);
    fireEvent.keyDown(changeSheet, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'More' }));
  });

  test('a click out of the menu closes it', () => {
    render(<Header onSignOut={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('menu')).toBeNull();
  });
});
