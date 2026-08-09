# Testing & Quality Assurance Guide

## 1. Overview

Mshindi Projo ensures application reliability through TypeScript strict type verification, linter checks, and production build verification.

---

## 2. Type Checking & Verification

### 2.1 Linter & TypeScript Check
Run TypeScript compilation check without emitting files:

```bash
npm run lint
```

This executes `tsc --noEmit`, verifying:
- Zero syntax or type errors across `.ts` and `.tsx` files.
- Strict React hook call ordering compliance.
- Interface contract adherence.

### 2.2 Production Build Verification
Before deploying code changes, verify the dual-target build:

```bash
npm run build
```

This compiles both the Vite client bundle (`dist/index.html`) and the esbuild backend script (`dist/server.cjs`).

---

## 3. Automated Validation Tools

The repository includes Node.js verification scripts under `scripts/` to validate:
- Top-level React hook execution ordering (ensuring no hooks are invoked after conditional early returns).
- Uniformity of `useSyncExternalStore` cached snapshot references.
- Schema conformity of `firebase-blueprint.json` and `firestore.rules`.
