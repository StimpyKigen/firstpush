/**
 * PWA Zoom Prevention Utility
 * 
 * Prevents pinch-to-zoom (fingers) and mouse/trackpad wheel-zoom (Ctrl/Cmd + Wheel)
 * in installed PWA and web environments to provide an authentic, locked app experience.
 */

export function initPwaZoomPrevention(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  // 1. Prevent Safari iOS gesture zoom events (pinch in/out)
  const handleGesture = (e: Event) => {
    e.preventDefault();
  };

  document.addEventListener('gesturestart', handleGesture, { passive: false });
  document.addEventListener('gesturechange', handleGesture, { passive: false });
  document.addEventListener('gestureend', handleGesture, { passive: false });

  // 2. Prevent multi-touch pinch gestures on touchmove while preserving smooth single-touch scrolling
  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  };

  document.addEventListener('touchmove', handleTouchMove, { passive: false });

  // 3. Prevent external mouse & trackpad zoom (Ctrl/Cmd + Mouse Wheel)
  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
    }
  };

  window.addEventListener('wheel', handleWheel, { passive: false });

  // 4. Prevent keyboard zoom shortcuts (Ctrl/Cmd + '+', '-', '=', '0')
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (['+', '-', '=', '0'].includes(e.key)) {
        e.preventDefault();
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);

  // Return cleanup function if needed
  return () => {
    document.removeEventListener('gesturestart', handleGesture);
    document.removeEventListener('gesturechange', handleGesture);
    document.removeEventListener('gestureend', handleGesture);
    document.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('wheel', handleWheel);
    window.removeEventListener('keydown', handleKeyDown);
  };
}
