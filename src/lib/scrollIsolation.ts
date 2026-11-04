import { useEffect, useRef } from 'react';

/**
 * Attaches scroll boundary isolation to a DOM element.
 * 
 * Ensures that when a user scrolls with a mousewheel, trackpad, or touch gesture
 * and reaches the top or bottom of the scroll container, the scrolling is trapped
 * and NEVER propagates or chains to the window, body, or surrounding site.
 * 
 * Fully compatible with Desktop (Windows, macOS, Linux), iOS Safari, Android Chrome, and PWA.
 */
export function isolateScroll(element: HTMLElement | null): (() => void) | void {
  if (!element) return;

  // Apply containment styling directly to ensure inline precedence
  element.style.overscrollBehavior = 'contain';
  element.style.overscrollBehaviorY = 'contain';
  element.style.scrollbarWidth = 'none';
  // @ts-expect-error - msOverflowStyle is standard on IE/Legacy Edge
  element.style.msOverflowStyle = 'none';

  let touchStartY = 0;

  // Intercept wheel events on desktop / laptop trackpads & mice
  const onWheel = (e: WheelEvent) => {
    const { scrollTop, scrollHeight, clientHeight } = element;
    const deltaY = e.deltaY;

    // Upward scrolling while at or beyond the top boundary
    if (deltaY < 0 && scrollTop <= 0) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Downward scrolling while at or beyond the bottom boundary
    // 1px tolerance protects against high-DPI subpixel rounding
    if (deltaY > 0 && scrollTop + clientHeight >= scrollHeight - 1) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  };

  // Intercept touch drag events on iOS Safari, Android, and PWAs
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const currentY = e.touches[0].clientY;
    const deltaY = touchStartY - currentY; // > 0 is scrolling down, < 0 is scrolling up
    const { scrollTop, scrollHeight, clientHeight } = element;

    // Pulling down while at the top
    if (deltaY < 0 && scrollTop <= 0) {
      if (e.cancelable) {
        e.preventDefault();
      }
      e.stopPropagation();
      return;
    }

    // Pushing up while at the bottom
    if (deltaY > 0 && scrollTop + clientHeight >= scrollHeight - 1) {
      if (e.cancelable) {
        e.preventDefault();
      }
      e.stopPropagation();
      return;
    }
  };

  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('touchstart', onTouchStart, { passive: true });
  element.addEventListener('touchmove', onTouchMove, { passive: false });

  return () => {
    element.removeEventListener('wheel', onWheel);
    element.removeEventListener('touchstart', onTouchStart);
    element.removeEventListener('touchmove', onTouchMove);
  };
}

/**
 * React hook to attach scroll isolation to an existing ref or return a newly managed ref.
 */
export function useScrollIsolation<T extends HTMLElement = HTMLDivElement>(
  existingRef?: React.RefObject<T | null>
) {
  const internalRef = useRef<T>(null);
  const ref = existingRef || internalRef;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return isolateScroll(el);
  }, [ref]);

  return ref;
}
