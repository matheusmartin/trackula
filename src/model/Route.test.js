import { describe, expect, test } from 'vitest';
import { MainView } from './MainView.js';
import { Route, Screen } from './Route.js';

describe('Route', () => {
  test('each screen has an address, and the address gives the same screen', () => {
    const routes = [
      Route.TODAY,
      Route.DAYS,
      Route.SCORE,
      Route.metric('weight'),
      Route.METRICS,
      Route.NEW_METRIC,
      Route.editMetric('weight'),
      Route.fixRow(7),
      Route.restoreMetric('old_id'),
    ];
    expect(routes.map((r) => r.hash)).toEqual([
      '#/today',
      '#/days',
      '#/score',
      '#/metric/weight',
      '#/metrics',
      '#/metrics/new',
      '#/metrics/edit/weight',
      '#/metrics/fix/7',
      '#/metrics/restore/old_id',
    ]);
    for (const r of routes) expect(Route.parse(r.hash).equals(r)).toBe(true);
  });

  test('a metric with the id "new" has its own edit address', () => {
    expect(Route.parse('#/metrics/edit/new').equals(Route.editMetric('new'))).toBe(true);
    expect(Route.parse('#/metrics/new').equals(Route.NEW_METRIC)).toBe(true);
  });

  test('a deleted column with spaces keeps its name', () => {
    const route = Route.restoreMetric('Old metric');
    expect(route.hash).toBe('#/metrics/restore/Old%20metric');
    expect(Route.parse(route.hash).param).toBe('Old metric');
  });

  test('an empty or unknown address gives the Today view', () => {
    for (const hash of [
      '',
      '#',
      '#/',
      'nothing',
      '#/days/2',
      '#/metric',
      '#/metric/',
      '#/metrics/edit',
      '#/metrics/fix/x',
    ]) {
      expect(Route.parse(hash).equals(Route.TODAY)).toBe(true);
    }
    expect(Route.parse('#/metrics/fix/0').equals(Route.TODAY)).toBe(true);
    expect(Route.parse('#/metric/%E0').param).toBe('%E0');
  });

  test('the view, the metrics screens and the parent', () => {
    expect(Route.DAYS.view).toBe(MainView.DAYS);
    expect(Route.metric('weight').view).toBeNull();
    expect(Route.ofView(MainView.SCORE).screen).toBe(Screen.SCORE);

    expect(Route.METRICS.isMetrics).toBe(true);
    expect(Route.METRICS.isForm).toBe(false);
    expect(Route.fixRow(3).isForm).toBe(true);
    expect(Route.DAYS.isMetrics).toBe(false);

    expect(Route.TODAY.parent).toBeNull();
    expect(Route.metric('weight').parent).toBe(Route.DAYS);
    expect(Route.METRICS.parent).toBe(Route.TODAY);
    expect(Route.editMetric('weight').parent).toBe(Route.METRICS);
  });
});
