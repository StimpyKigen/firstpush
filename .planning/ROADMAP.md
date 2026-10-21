# Mshindi Football Directory Rebuild — GSD Roadmap

## Vision
Rebuild Mshindi's football competition directory and resolution engine using SportScore as the single source of truth. Ensure that every fixture maps accurately to its verified competition and country, eliminating mismatches such as Iranian teams appearing under Belgian Pro League, while preserving all existing site features (Highlights, Live, Upcoming, date filtering, odds, and Bet Builder).

---

## Phases Overview

### Phase 1 — Comprehensive Audit (Status: COMPLETED ✅)
- [x] Audit SportScore API endpoints, schemas, and identifiers.
- [x] Trace fixture normalization pipeline from upstream API to UI card.
- [x] Pinpoint concrete root cause of Iranian-team / Belgian-league mismatch.
- [x] Inventory database seed scripts, disk caches, and environment parity.
- [x] Produce documented audit report in `.planning/AUDIT.md`.

### Phase 2 — Establish Canonical Competition Registry (Status: IN PROGRESS 🔄)
- [ ] Design canonical competition model aligned with SportScore's structure:
  - `provider: 'SportScore'`
  - `providerSlug`: stable slug (e.g. `'iran-pro-league'`, `'belgian-pro-league'`)
  - `providerId`: SportScore ID if available
  - `name`: canonical name
  - `countryCode`, `countryName`: accurate domestic country or `'International'`
  - `continent`: continent identifier
  - `competitionType`: `'domestic_league'`, `'lower_division'`, `'domestic_cup'`, `'super_cup'`, `'continental_club'`, `'international'`, `'women'`, `'youth'`, `'reserve_amateur'`, `'other'`
  - `displayPriority`: ranking score
  - `isFeatured`: whether featured in Highlights
- [ ] Expand registry to cover all active provider competitions (Iran, Belgium, Malaysia, Uzbekistan, etc.) without false collisions.

### Phase 3 — Rebuild Directory Hierarchy
- [ ] Structure directory by hierarchy:
  - Featured competitions (UCL, UEL, UECL, Premier League, La Liga, etc.)
  - International & Continental club competitions (World / Continents)
  - Continents / Regions -> Countries -> Competitions
- [ ] Categorize competitions within each country into their actual types (top flight, lower division, cups, women, youth).
- [ ] Guarantee international competitions are never attributed to a single country.

### Phase 4 — Fix Root Cause of Mismatched Fixtures
- [ ] Re-engineer `resolveCanonicalCompetition`:
  - Priority 1: Exact `providerSlug` or `leagueCode` match against canonical registry.
  - Priority 2: Verified country + competition name match.
  - Strict negative bounds: NEVER match `"pro league"` generically to Belgian Pro League; never match `"premier"` foreign leagues to English Premier League.
  - Never infer competition country from team nationality.
  - If unmapped, retain fixture with safe `unclassified_${slug}` marked with provider slug and unverified status.
  - Log unmapped provider competitions.

### Phase 5 — Repair Existing Data Safely
- [ ] Build a non-destructive dry-run repair script (`scripts/dry-run-competition-repair.ts`).
- [ ] Audit and output diff for all 772 bundled catalogue fixtures and cached fixtures.
- [ ] Verify corrections for Iranian, Uzbek, Malaysian, Costa Rican, and Mexican fixtures.
- [ ] Apply verified repairs to `src/data/bundledSportsCatalogue.ts` and clear stale `.cache` files.

### Phase 6 — Rebuild Leagues Dropdown UI
- [ ] Enhance Leagues dropdown in `src/pages/FreeMatches.tsx`:
  - Search competitions by name within dropdown.
  - Clear grouping: Featured / International & Continental / Continents -> Countries -> Competitions.
  - Country flags shown only where verified.
  - Competition type indicators (Cup, Women, Youth, etc.).
  - "All Competitions" option.
  - Retain Apple-inspired clean styling and exact sync with fixture filters.

### Phase 7 — Preserve Display Priority & Status Logic
- [ ] Verify Highlights priority ordering is strictly decoupled from competition classification.
- [ ] Ensure Upcoming tab uses user's device clock and sorts strictly chronologically.
- [ ] Ensure Live tab and match score handling remain intact.

### Phase 8 — Validation & Automated Regression Tests
- [ ] Implement automated test suite covering all 13 required test cases in specification.
- [ ] Validate type safety (`npx tsc --noEmit`) and production bundle (`npm run build`).
- [ ] Verify clean test execution and zero regression.
