import { render } from '@testing-library/preact';
import { useRef } from 'preact/hooks';
import { afterEach, expect, test, vi } from 'vitest';
import { useStickyHeight } from './StickyHeight.js';

afterEach(() => vi.unstubAllGlobals());

/** @returns {import("preact").JSX.Element} A bar that keeps its height in the page. */
function Bar() {
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null));
  useStickyHeight(ref);
  return <div ref={ref}>Bar</div>;
}

test('the bar sets its height while it shows, and removes it when it closes', () => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  const root = document.documentElement;
  const { unmount } = render(<Bar />);
  expect(root.style.getPropertyValue('--app-sticky-height')).toMatch(/^\d+px$/);
  unmount();
  expect(root.style.getPropertyValue('--app-sticky-height')).toBe('');
});
