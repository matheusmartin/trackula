import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { useState } from 'preact/hooks';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { pickEmoji } from '../testing/PickEmoji.js';
import { EmojiPicker } from './EmojiPicker.jsx';

/** @import { JSX } from 'preact' */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * The picker with the icon `initial`. A pick changes the icon, as in the form.
 * @param {object} props
 * @param {string} props.initial
 * @param {(icon: string) => void} props.onIcon Called with each new icon.
 * @returns {JSX.Element}
 */
function Picker({ initial, onIcon }) {
  const [icon, setIcon] = useState(initial);
  return (
    <EmojiPicker
      selected={icon}
      onPick={(emoji) => {
        setIcon(emoji);
        onIcon(emoji);
      }}
    />
  );
}

/**
 * Shows the picker with the icon `initial`.
 * @param {string} [initial]
 * @returns {string[]} The icons that the picker gave, in order.
 */
function showPicker(initial = '') {
  /** @type {string[]} */
  const icons = [];
  render(<Picker initial={initial} onIcon={(icon) => icons.push(icon)} />);
  return icons;
}

describe('EmojiPicker', () => {
  test('a click picks an emoji and it has a frame', async () => {
    const icons = showPicker();
    await pickEmoji('droplet');
    expect(icons).toEqual(['💧']);
    expect(screen.getByRole('button', { name: 'droplet', pressed: true })).toBeTruthy();
  });

  test('an emoji with skin tones has the default tone', async () => {
    const icons = showPicker();
    await pickEmoji('waving hand');
    expect(icons).toEqual(['👋']);
  });

  test('the grid opens at the selected emoji', async () => {
    // A layout of one column of 48 px, after the padding of 3 px.
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(
      /**
       * @this {HTMLElement}
       * @returns {number}
       */
      function () {
        const index = this.dataset.index;
        return index === undefined ? 0 : 3 + Number(index) * 48;
      },
    );
    // The chequered flag is the first flag, near the end of the list.
    showPicker('🏁');
    const grid = await screen.findByRole('group', { name: 'Emojis' });
    const flag = within(grid).getByRole('button', { name: 'chequered flag' });
    expect(flag.getAttribute('aria-pressed')).toBe('true');
    expect(grid.scrollTop).toBe(Number(flag.dataset.index) * 48);
    expect(grid.scrollTop).toBeGreaterThan(0);
  });

  test('the grid is one stop of the Tab key, and the arrow keys move the focus', async () => {
    showPicker('😃');
    const grid = await screen.findByRole('group', { name: 'Emojis' });
    const smiley = within(grid).getByRole('button', { name: 'grinning face with big eyes' });
    expect(
      within(grid)
        .getAllByRole('button')
        .filter((b) => b.tabIndex === 0),
    ).toEqual([smiley]);

    smiley.focus();
    fireEvent.keyDown(smiley, { key: 'ArrowRight' });

    const next = within(grid).getByRole('button', { name: 'grinning face with smiling eyes' });
    expect(document.activeElement).toBe(next);
    expect(next.tabIndex).toBe(0);
    expect(smiley.tabIndex).toBe(-1);
  });
});
