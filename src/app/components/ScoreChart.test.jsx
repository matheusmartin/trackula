import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { Day, daysBetween } from '../../model/Day.js';
import { scoreMetric } from '../../model/Score.js';
import { ScoreChart } from './ScoreChart.jsx';

afterEach(cleanup);

// The cases of the ScoreChart in the Kotlin ChartsTest.
const days = daysBetween(Day.of(2026, 9, 29), Day.of(2026, 10, 3));

describe('ScoreChart', () => {
  test('the score chart opens the score view and says when there is no score', () => {
    let opens = 0;
    render(<ScoreChart score={scoreMetric} days={days} scores={new Map()} onOpen={() => opens++} />);
    expect(screen.getByText('No score in these days.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Show the score only' }));

    expect(opens).toBe(1);
  });

  test('the score chart goes from zero in percent', () => {
    const scores = new Map([
      [days[0], 30],
      [days[4], 50],
    ]);
    render(<ScoreChart score={scoreMetric} days={days} scores={scores} onOpen={() => {}} />);
    expect(screen.getByRole('img', { name: 'Values from 0 to 50%, Sep 29 to Oct 3' })).toBeTruthy();
  });
});
