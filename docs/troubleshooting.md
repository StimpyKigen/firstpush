# Troubleshooting Knowledge Base

This document serves as a self-maintaining knowledge base for technical issues, root cause analyses, and solutions.

---

## Issue Log

### Issue 001: React Runtime Error - `Cannot read properties of null (reading 'useState' / 'useRef')`

- **Problem**: Opening the `/betslip`, `/p2p`, or `/create-bet` route caused an `Invalid hook call` runtime error crashing the app via `ErrorBoundary`.
- **Root Cause**: Early conditional return statements (e.g. `if (!currentUser) return <Navigate to="/auth" />;`) were executed *before* React hook calls (`useMemo`, `useEffect`). Violation of the Rules of Hooks.
- **Solution**: Reordered component declarations so that all React hooks (`useMemo`, `useEffect`, `useRef`) are invoked unconditionally at the very top of the functional component body, prior to any conditional `return` statements.
- **Files Affected**:
  - `src/pages/BetSlipRoom.tsx`
  - `src/pages/CreateBet.tsx`
  - `src/pages/P2PBets.tsx`

---

### Issue 002: Infinite Re-render Loop with `useSyncExternalStore`

- **Problem**: Continuous re-rendering and high CPU usage in avatar picker components.
- **Root Cause**: The `getSnapshot` callback passed to `useSyncExternalStore` returned a newly instantiated object on every invocation, breaking object reference equality.
- **Solution**: Implemented cached snapshot state variables in `avatarStore.ts` that update reference pointers only when underlying values mutate.
- **Files Affected**:
  - `src/lib/avatarStore.ts`

---

### Issue 003: Duplicate React Package Resolution

- **Problem**: Intermittent `Invalid hook call` errors when mixing third-party UI packages.
- **Root Cause**: Multiple copies of `react` and `react-dom` were bundled into node_modules by sub-dependencies.
- **Solution**: Added explicit deduplication aliases in `vite.config.ts`:
  ```typescript
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom', 'zustand']
  }
  ```
- **Files Affected**:
  - `vite.config.ts`

---

### Issue 004: Missing `GEMINI_API_KEY` Environment Variable

- **Problem**: Ava Support Chat returns error: `"GEMINI_API_KEY is missing"`.
- **Root Cause**: The environment variable `GEMINI_API_KEY` was not injected into the runtime environment.
- **Solution**: Configure `GEMINI_API_KEY` in the AI Studio Secrets panel or `.env` file.
- **Files Affected**:
  - `.env`
  - `server.ts`
