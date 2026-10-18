/**
 * MshindiRoom Theme System - Abolished dark mode, enforcing pristine Light/Ivory theme.
 */

export type Theme = 'light';

export function enforceLightMode() {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#FFFFF0');
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
