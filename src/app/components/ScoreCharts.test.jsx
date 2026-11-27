import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { Day } from '../../model/Day.js';
import { ZoomStep, ZoomWindow } from '../../model/Zoom.js';
import { ScoreCharts } from './ScoreCharts.jsx';

afterEach(cleanup);

const today = Day.of(2026, 10, 3);

describe('ScoreCharts', () => {
  test('the score without values says that the Today page records the days', () => {
    render(
      <ScoreCharts
        window={new ZoomWindow(ZoomStep.entries[0], today, today)}
        values={new Map()}
        scoreMetrics={[]}
        points={new Map()}
      />,
    );
    expect(screen.getByText('No score yet')).toBeTruthy();
    expect(screen.getByText('Record a day on the Today page. Then the score and its charts show here.')).toBeTruthy();
  });
});
