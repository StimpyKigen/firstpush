/**
 * MshindiRoom Theme System
 * Supports seamless switching between Light (Ivory #FFFFF0) and Dark (#202522) modes,
 * with persistence in localStorage, reactive listeners, and zero layout shift.
 */

import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'mshindi-theme';

// Listeners for external store synchronization
const listeners = new Set<() => void>();

function notifyThemeListeners() {
  listeners.forEach((listener) => listener());
}

/**
 * Reads initial theme from localStorage or system preference
 */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    // Fallback to light mode by default unless user has explicit dark mode preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {}
  return 'light';
}

let currentTheme: Theme = getStoredTheme();

/**
 * Applies the given theme to document.documentElement and meta tags
 */
export function applyTheme(theme: Theme) {
  currentTheme = theme;
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
    const targetColor = theme === 'dark' ? '#202522' : '#FFFFF0';

    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }

    // If splash is not active, sync status bar and (on Android) system chrome & root background
    if (root.dataset.splash !== 'active') {
      document.querySelectorAll('meta[name="theme-color"]').forEach((el) => {
        el.setAttribute('content', targetColor);
      });
      if (isAndroid) {
        root.style.backgroundColor = targetColor;
        if (document.body) {
          document.body.style.backgroundColor = targetColor;
        }
      }
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }
  notifyThemeListeners();
}

/**
 * Toggles between light and dark themes
 */
export function toggleTheme() {
  const nextTheme: Theme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
}

/**
 * External store snapshot & subscription
 */
export function getThemeSnapshot(): Theme {
  return currentTheme;
}

export function subscribeToTheme(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * React hook to consume and update theme state
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => 'light' as Theme);
  const isDark = theme === 'dark';

  return {
    theme,
    isDark,
    toggleTheme,
    setTheme: applyTheme,
  };
}

/**
 * Initializes theme on startup
 */
export function initTheme() {
  const theme = getStoredTheme();
  applyTheme(theme);
}

// Backward-compatibility aliases
export const enforceLightMode = () => applyTheme('light');
export const applyThemeClass = (theme?: string) => applyTheme((theme === 'dark' ? 'dark' : 'light'));
