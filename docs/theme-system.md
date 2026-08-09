# Theme System & Design Tokens Specification

## 1. Overview

Mshindi Projo utilizes a high-contrast dark/light theme system optimized for high legibility under bright outdoor sunlight and low-light night conditions.

---

## 2. Theme State Engine (`src/lib/themeStore.ts`)

Theme state is persisted in `localStorage` and synchronized across browser tabs:

```typescript
export type ThemeMode = 'dark' | 'light' | 'system';

export interface ThemeStore {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}
```

When switching modes, the root `<html>` element toggles the `dark` CSS class, allowing Tailwind utility classes (`dark:bg-slate-900`) to re-render UI elements automatically.

---

## 3. Color Palette & Design Tokens

### Primary Theme Colors
- **Mshindi Emerald (Accent / Success)**: `#1fae6f` / `emerald-500` — Primary action buttons, winning outcomes (`1`).
- **Gold / Mshindi Crown**: `#f2b705` / `amber-400` — Leaderboard crowns, Draw outcomes (`X`), VIP badges.
- **Danger / Away Red**: `#ef5b5b` / `red-500` — Loss indicators, Away outcomes (`2`), error banners.
- **Surface Dark Canvas**: `#0b0f19` / `slate-950` — Dark mode background.
- **Surface Dark Card**: `#151c2e` / `slate-900` — Dark mode card background with 1px border `slate-800`.
- **Surface Light Canvas**: `#f8fafc` / `slate-50` — Light mode background.

---

## 4. Typography

- **Body & Controls**: Plus Jakarta Sans / Inter (`font-sans`)
- **Headings & Badges**: Playfair Display / Outfit (`font-display`)
- **Mono / Booking Codes**: JetBrains Mono (`font-mono`)
