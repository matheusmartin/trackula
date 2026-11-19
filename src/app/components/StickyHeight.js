import { useEffect } from 'preact/hooks';

/**
 * Keeps the height of a bar that stays below the app bar (`position: sticky`) in the CSS variable
 * `--app-sticky-height` of the page, while the bar shows. `App.css` adds it to the scroll padding at the top, so the
 * browser does not put a focused element below the bar. Example: the window bar of the detail screen.
 * @param {{ current: HTMLElement | null }} ref The bar.
 */
export function useStickyHeight(ref) {
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const update = () => root.style.setProperty('--app-sticky-height', `${element.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--app-sticky-height');
    };
  }, [ref]);
}
