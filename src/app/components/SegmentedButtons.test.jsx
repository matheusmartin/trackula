import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { SegmentedButtons } from './SegmentedButtons.jsx';

afterEach(cleanup);

const segments = [
  { value: 'TABLE', label: 'Table', icon: 'table_rows' },
  { value: 'CALENDARS', label: 'Calendars', icon: 'calendar_month' },
];

describe('SegmentedButtons', () => {
  test('marks the selected button and gives the value of a clicked button', () => {
    /** @type {string[]} */
    const picked = [];
    render(<SegmentedButtons label="Layout" segments={segments} selected="TABLE" onSelect={(v) => picked.push(v)} />);

    expect(screen.getByRole('group', { name: 'Layout' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Table' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Calendars' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Calendars' }));
    expect(picked).toEqual(['CALENDARS']);
  });
});
