import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { Notice, NoticeKind } from './Notice.jsx';

afterEach(cleanup);

describe('Notice', () => {
  test('an error is in a live region and its button calls the action', () => {
    let tries = 0;
    const { container } = render(
      <Notice text="No network." kind={NoticeKind.ERROR} action="Try again" onAction={() => tries++} />,
    );
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toContain('No network.');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(tries).toBe(1);
  });

  test('a warning has the warning colors and its button', () => {
    let shows = 0;
    const { container } = render(
      <Notice text="2 problems in the sheet." kind={NoticeKind.WARNING} action="Show" onAction={() => shows++} />,
    );
    expect(container.querySelector('.notice-warning')).toBeTruthy();
    expect(container.querySelector('[aria-live]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(shows).toBe(1);
  });

  test('a note has no live region and no button', () => {
    const { container } = render(<Notice text="Demo mode." />);
    expect(screen.getByText('Demo mode.')).toBeTruthy();
    expect(container.querySelector('[aria-live]')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
