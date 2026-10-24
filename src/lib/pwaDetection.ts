/**
 * Platform check: strictly verifies that the app is running as an installed PWA
 * on a mobile device in standalone or fullscreen mode.
 *
 * Rules:
 * 1. Must be running in standalone/fullscreen display mode (installed PWA).
 * 2. Must be on a mobile device (touch + mobile user-agent or compact phone/tablet screen).
 * 3. Never returns true on normal mobile browsers (Chrome/Safari tabs).
 * 4. Never returns true on desktop browsers (standard browser window or desktop PWA).
 */
export function isInstalledMobilePWA(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Display-mode check: must be standalone or fullscreen (standard PWA or iOS standalone)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as any)?.standalone === true ||
    (navigator as any)?.standalone === true;

  if (!isStandalone) {
    return false;
  }

  // 2. Mobile platform check: exclude desktop browser standalone windows
  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const isMobileScreen = window.innerWidth <= 1024;

  return isMobileUA || (isCoarsePointer && isMobileScreen);
}
