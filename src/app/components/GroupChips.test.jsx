import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { GroupChips, groupLabel } from './GroupChips.jsx';

afterEach(cleanup);

describe('GroupChips', () => {
  test('the label of a group has a capital first letter', () => {
    expect(groupLabel('habits')).toBe('Habits');
    expect(groupLabel('')).toBe('');
  });

  test('All and each group are chips, and a click selects a group', () => {
    /** @type {(string | null)[]} */
    const selected = [];
    render(<GroupChips groups={['health', 'habits']} selected="habits" onSelect={(g) => selected.push(g)} />);
    expect(screen.getByRole('button', { name: 'All', pressed: false })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Habits', pressed: true })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Health' }));
    fireEvent.click(screen.getByRole('button', { name: 'All' }));

    expect(selected).toEqual(['health', null]);
  });
});
