import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, test } from 'vitest';
import { ActionBar, ActionBarHost, ActionBarContext } from './ActionBar.jsx';

afterEach(cleanup);

describe('ActionBar', () => {
  test('without a host, the action shows in the page', () => {
    const { container } = render(
      <div class="page">
        <ActionBar>
          <button type="button">Save</button>
        </ActionBar>
      </div>,
    );
    expect(container.querySelector('.page button')?.textContent).toBe('Save');
  });

  test('with a host, the action shows in the host and goes away with the page', () => {
    const element = document.createElement('div');
    document.body.append(element);
    /**
     * @param {{ shows: boolean }} props
     * @returns {import('preact').JSX.Element}
     */
    const Page = ({ shows }) => (
      <ActionBarContext.Provider value={new ActionBarHost(element)}>
        <div class="page">
          {shows && (
            <ActionBar>
              <button type="button">Save</button>
            </ActionBar>
          )}
        </div>
      </ActionBarContext.Provider>
    );
    const { container, rerender } = render(<Page shows />);
    expect(container.querySelector('.page button')).toBeNull();
    expect(element.textContent).toBe('Save');
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();

    rerender(<Page shows={false} />);

    expect(element.childElementCount).toBe(0);
    element.remove();
  });
});
