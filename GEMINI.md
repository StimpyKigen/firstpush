# Workspace Instructions & Permanent Invariants

As mandated by the user, **always use and adhere to these two systems from now henceforth**:

---

## 1. GSD Core (`open-gsd/gsd-core`) [STATUS: DISABLED]
> **DISABLED PER USER MANDATE**: Do NOT use GSD Core or any of the installed `gsd-*` skills under `.agents/skills/` for this project from now on. Maintain clean, direct software engineering without GSD meta-prompting or GSD planning overhead.

---

## 2. Microsoft Playwright MCP & CLI (`microsoft/playwright-mcp`, `playwright-cli`) [STATUS: PAUSED]
> **PAUSED PER USER MANDATE**: Do NOT use Playwright MCP or Playwright CLI for testing, UI validation, scraping, or browser automation under any circumstances until the user explicitly instructs to activate it again. Rely exclusively on automated terminal checks (`npx tsc --noEmit`, `npm run build`), unit/integration testing, and code review.

---

## 3. Git Branching & Merging Policy [STATUS: ACTIVE]
> **MANDATE PER USER**: All changes must be committed and pushed strictly to branch `firstpush-changes-v1.0`. **NEVER** merge into `main` (or any other branch) unless the user explicitly instructs to merge.


