import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { Day } from '../../model/Day.js';
import { YesNoMetric } from '../../model/Metric.js';
import { ZoomStep, ZoomWindow } from '../../model/Zoom.js';
import { MetricCharts, ScoreCharts } from './MetricCharts.jsx';

afterEach(cleanup);

const today = Day.of(2026, 10, 3);

// The case of MetricCharts in the Kotlin ChartsTest.
describe('MetricCharts', () => {
  test('the charts of a metric without values say what to do', () => {
    render(
      <MetricCharts
        metric={new YesNoMetric({ id: 'read', name: 'Read', icon: 'menu_book' })}
        window={new ZoomWindow(ZoomStep.entries[0], today, today)}
        values={new Map()}
        states={new Map()}
      />,
    );
    expect(screen.getByText('No values yet')).toBeTruthy();
    expect(screen.queryByText('Yes rate')).toBeNull();
  });

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

  test('the charts of a yes/no metric show its key numbers and its charts', () => {
    const states = new Map([
      [Day.of(2026, 10, 1), true],
      [Day.of(2026, 10, 2), false],
      [today, true],
    ]);
    render(
      <MetricCharts
        metric={new YesNoMetric({ id: 'read', name: 'Read', icon: 'menu_book' })}
        window={new ZoomWindow(ZoomStep.WEEK1, Day.of(2026, 10, 1), today)}
        values={new Map([...states].map(([d, yes]) => [d, yes ? 1 : 0]))}
        states={states}
      />,
    );
    expect(screen.getByTitle('done days: 2')).toBeTruthy();
    expect(screen.getByTitle('current streak: 1 d')).toBeTruthy();
    for (const title of [
      'Yes rate',
      'Habit strength (%)',
      'Yes, no and no entry',
      'Weekday pattern',
      'Streak lengths',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
    }
  });
});
