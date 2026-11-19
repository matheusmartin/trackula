// The width of an element, as BoxWithConstraints of Compose gives it.
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

/** @import { RefObject } from 'preact' */

/**
 * The width of an element in CSS pixels, and the ref to give to the element. The width changes with the size of the
 * element. It is 0 before the first layout, and in a test without layout.
 *
 * The first width comes before the browser shows the element: there is no jump.
 * @template {HTMLElement} E
 * @returns {[RefObject<E>, number]}
 */
export function useElementWidth() {
  const ref = useRef(/** @type {E | null} */ (null));
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element == null) return;
    setWidth(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      setWidth(entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [/** @type {RefObject<E>} */ (ref), width];
}
