import { useEffect, useRef } from 'react';

/**
 * Custom hook that automatically collapses an expanded market dropdown or match card when:
 * 1. The user scrolls down or up outside/away beyond a threshold (default 70px)
 * 2. The user clicks or taps outside the open markets container
 */
export function useAutoCollapse<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  onCollapse: () => void,
  scrollThreshold = 70
) {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const initialScrollY = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;
      const diff = Math.abs(currentY - initialScrollY);
      if (diff > scrollThreshold) {
        onCollapse();
      }
    };

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCollapse();
      }
    };

    // Listen to scroll and outside clicks
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onCollapse, scrollThreshold]);

  return containerRef;
}
