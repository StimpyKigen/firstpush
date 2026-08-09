import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

// Dark is the original/default MshindiRoom look. Light is a new alternate
// palette that reuses the same semantic color tokens (see index.css `.light`
// overrides) so every existing bg-ink / text-cream / border-line class works
// unmodified in both themes.
export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'mshindi-theme' }
  )
);

export function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'light') root.classList.add('light');
  else root.classList.remove('light');
}
