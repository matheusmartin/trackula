import { useLayoutEffect, useState } from 'preact/hooks';

/**
 * The width of an element in CSS pixels, and the ref function to give to the element. The width changes with the size
 * of the element. It is 0 before the first layout, and in a test without layout.
 *
 * The first width comes before the browser shows the element: there is no jump.
 * @returns {[(element: HTMLElement | null) => void, number]}
 */
export function useElementWidth() {
  const [element, setElement] = useState(/** @type {HTMLElement | null} */ (null));
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (element == null) return;
    setWidth(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setWidth(element.getBoundingClientRect().width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, width];
}
