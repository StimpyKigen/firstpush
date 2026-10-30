/**
 * MshindiRoom Theme System - Abolished dark mode, enforcing pristine Light/Ivory theme.
 */

export type Theme = 'light';

export function enforceLightMode() {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
    // Don't override the green status bar while the PWA loading screen is active
    if (root.dataset.splash !== 'active') {
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#FFFFF0');
    }
    try {
      localStorage.removeItem('mshindi-theme');
    } catch {}
  }
}

export function applyThemeClass(_theme?: string) {
  enforceLightMode();
}

export const useTheme = () => ({
  theme: 'light' as const,
  toggleTheme: () => {},
  setTheme: () => {},
});
