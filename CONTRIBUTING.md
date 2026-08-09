# Contributing to Mshindi Projo 🇰🇪

Thank you for your interest in contributing to **Mshindi Projo**! We welcome bug reports, feature suggestions, documentation improvements, and code contributions.

Please read this document carefully before contributing to ensure a smooth collaboration process.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher (or **bun**)
- **Git**

### Local Setup

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/mshindi-projo.git
   cd mshindi-projo
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env
   ```
   Add your `GEMINI_API_KEY` to `.env`.

4. **Verify Build & Linting**:
   ```bash
   npm run lint
   npm run build
   ```

5. **Start Dev Server**:
   ```bash
   npm run dev
   ```

---

## 📐 Coding Standards

We enforce strict TypeScript type safety and React best practices.

### 1. React & Hooks Rules
- **Top-Level Hooks**: Never call hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, etc.) after conditional early `return` statements or inside loops/conditions.
- **Functional Components**: Use standard React functional components. Always render components with JSX syntax (`<Component />`), never as raw function calls (`Component()`).
- **Imports**: Always import React hooks directly from `"react"`.

### 2. Styling Standards
- Use **Tailwind CSS** utility classes directly.
- Use Lucide icons (`import { Shield } from 'lucide-react'`). Do not write inline custom SVGs.
- Respect accessibility guidelines (WCAG AA contrast ratios).

### 3. State & Stores
- Global application state is managed via **Zustand** stores (`src/lib/*.ts`) or `useSyncExternalStore`.
- Keep store snapshots immutable and cached to prevent infinite re-renders.

---

## 🌿 Git & Branching Workflow

We follow a feature-branch workflow:

- `main`: Production-ready code.
- `develop`: Staging and active integration branch.
- Feature branches: `feature/description-of-feature`
- Bug fix branches: `fix/description-of-fix`
- Documentation branches: `docs/description-of-update`

### Commit Message Conventions

We follow Conventional Commits format:

- `feat: add new M-Pesa withdrawal confirmation modal`
- `fix: resolve hook call order error in BetSlipRoom`
- `docs: update API reference for Gemini support endpoint`
- `style: refine dark mode contrast for jackpot cards`
- `refactor: optimize consensus engine snapshot cache`

---

## 🧪 Verification & Pull Request Process

Before submitting a Pull Request (PR):

1. **Run Linter**:
   ```bash
   npm run lint
   ```
   Ensure zero TypeScript compilation errors (`tsc --noEmit`).

2. **Run Production Build**:
   ```bash
   npm run build
   ```
   Verify both Vite client build and esbuild server bundle succeed without warnings.

3. **Open a Pull Request**:
   - Provide a clear title and summary of changes.
   - Reference any related issues (e.g., `Fixes #42`).
   - Include screenshots for visual UI changes.

---

## ❓ Questions & Support

For questions or security concerns, reach out to `support@mshindiroom.co.ke` or open a discussion thread on GitHub.
