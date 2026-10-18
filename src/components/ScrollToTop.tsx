import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Cache scroll positions by route key/pathname for context-preserving back navigation
const scrollMap = new Map<string, number>();

export default function ScrollToTop() {
  const location = useLocation();
  const navType = useNavigationType();

  // Track scroll position before navigating away
  useEffect(() => {
    const handleScroll = () => {
      scrollMap.set(location.key, window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [location.key]);

  // Restore scroll on Back (POP), reset to top on new navigation (PUSH)
  useEffect(() => {
    if (navType === 'POP') {
      const savedY = scrollMap.get(location.key);
      if (typeof savedY === 'number') {
        // Allow DOM to paint before restoring scroll
        requestAnimationFrame(() => {
          window.scrollTo({ top: savedY, left: 0, behavior: 'instant' });
        });
        return;
      }
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [location.pathname, location.key, navType]);

  return null;
}
