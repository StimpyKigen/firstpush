# Coding Standards & Guidelines

## 1. Code Quality Philosophy

All code contributed to Mshindi Projo must maintain high standards of readability, performance, type safety, and maintainability.

---

## 2. React & Hooks Rules

### 2.1 Strict Top-Level Hook Invocations
- **Rule**: All React hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`, `useContext`) MUST be declared unconditionally at the very top of the component function body.
- **Forbidden**: Calling hooks after `if (...) return` statements or inside conditional blocks or loops.

```typescript
// ❌ WRONG: Hook called after early return
export function MyComponent({ user }) {
  if (!user) return <Redirect to="/login" />;
  const data = useMemo(() => computeData(user), [user]); // CRASH!
}

// ✅ CORRECT: Hook declared at top level
export function MyComponent({ user }) {
  const data = useMemo(() => (user ? computeData(user) : null), [user]);
  if (!user) return <Redirect to="/login" />;
  return <div>{data}</div>;
}
```

### 2.2 Standard JSX Rendering
- Components MUST be rendered as JSX elements (`<MyComponent />`), NEVER as direct function invocations (`MyComponent()`).

---

## 3. TypeScript Conventions

- **Strict Mode**: `tsconfig.json` enforces `strict: true`. Avoid using `any` types wherever possible.
- **Named Exports**: Prefer explicit named exports (`export function Card()`) over default exports for utility modules and components.
- **Interfaces**: Define global interfaces in `src/lib/types.ts` or route-specific type files.

---

## 4. Styling Conventions (Tailwind CSS)

- Use utility classes directly in `className`.
- Do NOT create separate `.css` files (except `src/index.css`).
- Use responsive prefixes (`sm:`, `md:`, `lg:`) for mobile-first adaptive layouts.
- Use Lucide icons exclusively (`import { Shield } from 'lucide-react'`).
