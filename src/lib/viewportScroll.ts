/**
 * Viewport-aware scroll helper for mobile-first interaction.
 * Intelligently scrolls an element into view only if it is not already
 * fully visible in the active viewport (taking sticky header and bottom nav into account).
 */

export function scrollIntoViewIfNeeded(
  element: HTMLElement | null,
  options: {
    offsetTop?: number;
    offsetBottom?: number;
    behavior?: ScrollBehavior;
    delayMs?: number;
  } = {}
) {
  if (!element || typeof window === 'undefined') return;

  const {
    offsetTop = 74, // Mobile header (64px) + comfortable breathing space
    offsetBottom = 74, // Mobile bottom nav (52px) + breathing space
    behavior = 'smooth',
    delayMs = 60, // Allow Framer Motion / CSS expand transitions to begin
  } = options;

  setTimeout(() => {
    if (!element.isConnected) return;

    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;

    const isAbove = rect.top < offsetTop;
    const isBelow = rect.bottom > windowHeight - offsetBottom;

    // Only scroll if the element is actually clipped or offscreen
    if (isAbove || isBelow) {
      const scrollY = window.scrollY || window.pageYOffset;
      const targetTop = scrollY + rect.top - offsetTop;

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior,
      });
    }
  }, delayMs);
}
