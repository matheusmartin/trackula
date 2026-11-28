import { useEffect, useState } from 'preact/hooks';
import { APP_BAR_HEIGHT } from './Sizes.js';

/**
 * True while the page has scrolled past the element of `ref`: the element is above the bottom of the app bar, out of
 * view. False before the first check, and in a browser without `IntersectionObserver`, for example in the tests.
 * @param {{ current: HTMLElement | null }} ref
 * @returns {boolean}
 */
export function useScrolledPast(ref) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (element == null || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        setPast(!entry.isIntersecting && entry.boundingClientRect.top < APP_BAR_HEIGHT);
      },
      { rootMargin: `-${APP_BAR_HEIGHT}px 0px 0px 0px` },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return past;
}
