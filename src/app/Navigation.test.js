import { describe, expect, test } from 'vitest';
import { Route } from '../model/Route.js';
import { Navigator } from './Navigation.js';
import { FakeHistory } from './testing/FakePlatform.js';

/** Waits until the history calls its function of `onChange`, as the browser does after a back. */
async function afterBack() {
  await Promise.resolve();
}

describe('Navigator', () => {
  test('starts on the screen of the address', () => {
    expect(new Navigator(new FakeHistory('#/metric/weight')).route.equals(Route.metric('weight'))).toBe(true);
    expect(new Navigator(new FakeHistory('')).route).toBe(Route.TODAY);
  });

  test('go adds an entry, and the Back button of the browser goes to the screen before', async () => {
    const history = new FakeHistory('#/days');
    const navigator = new Navigator(history);
    /** @type {string[]} */
    const shown = [];
    navigator.subscribe((r) => shown.push(r.hash));

    navigator.go(Route.metric('weight'));
    expect(history.hash()).toBe('#/metric/weight');
    expect(history.depth).toBe(1);

    history.userBack();
    await afterBack();
    expect(navigator.route.equals(Route.DAYS)).toBe(true);
    expect(shown).toEqual(['#/metric/weight', '#/days']);
  });

  test('show changes the screen without an entry', () => {
    const history = new FakeHistory('#/today');
    const navigator = new Navigator(history);
    navigator.show(Route.SCORE);
    expect(history.hash()).toBe('#/score');
    expect(history.depth).toBe(0);
    expect(navigator.route.equals(Route.SCORE)).toBe(true);
  });

  test('back without a screen before shows the parent and stays in the app', () => {
    const history = new FakeHistory('#/metrics/edit/weight');
    const navigator = new Navigator(history);
    navigator.back();
    expect(navigator.route).toBe(Route.METRICS);
    navigator.back();
    expect(navigator.route).toBe(Route.TODAY);
    expect(history.hash()).toBe('#/today');
    expect(history.depth).toBe(0);
  });

  test('a second back before the browser shows the entry before does nothing', async () => {
    const history = new FakeHistory('#/metrics');
    const navigator = new Navigator(history);
    navigator.go(Route.editMetric('water'));
    navigator.back(true);
    navigator.back(true);
    await afterBack();
    expect(navigator.route.equals(Route.METRICS)).toBe(true);
    navigator.back();
    expect(navigator.route).toBe(Route.TODAY);
  });

  test('a guard keeps the screen and its entry after a Back of the browser', async () => {
    const history = new FakeHistory('#/metrics');
    const navigator = new Navigator(history);
    navigator.go(Route.NEW_METRIC);
    /** @type {Route[]} */
    const asked = [];
    const remove = navigator.setGuard((to) => {
      asked.push(to);
      return true;
    });

    history.userBack();
    await afterBack();
    expect(navigator.route).toBe(Route.NEW_METRIC);
    expect(history.hash()).toBe('#/metrics/new');
    expect(history.depth).toBe(1);
    expect(asked.map((r) => r.hash)).toEqual(['#/metrics']);

    navigator.go(Route.TODAY);
    expect(navigator.route).toBe(Route.NEW_METRIC);

    remove();
    history.userBack();
    await afterBack();
    expect(navigator.route.equals(Route.METRICS)).toBe(true);
  });

  test('a forced back passes the guard', async () => {
    const history = new FakeHistory('#/metrics');
    const navigator = new Navigator(history);
    navigator.go(Route.NEW_METRIC);
    navigator.setGuard(() => true);

    navigator.back(true);
    await afterBack();
    expect(navigator.route.equals(Route.METRICS)).toBe(true);
  });
});
