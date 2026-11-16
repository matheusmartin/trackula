import { cleanup, render } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { MetricIcon } from './MetricIcon.jsx';

afterEach(cleanup);

describe('MetricIcon', () => {
  test('a lowercase name is a Material Symbol', () => {
    const { container } = render(<MetricIcon icon="water_drop" />);
    expect(container.querySelector('i.symbol')?.textContent).toBe('water_drop');
  });

  test('an emoji is text', () => {
    const { container } = render(<MetricIcon icon="💧" large />);
    expect(container.querySelector('i.symbol')).toBeNull();
    expect(container.querySelector('.metric-icon-large')?.textContent).toBe('💧');
  });

  test('the chip is hidden from screen readers', () => {
    const { container } = render(<MetricIcon icon="pill" />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });
});
