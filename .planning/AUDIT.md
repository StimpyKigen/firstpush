# Phase 1 — Comprehensive Football Competition Directory & Fixture Mapping Audit

**Date**: 2026-10-21  
**Target Repository**: Mshindi Football Platform (Phase II)  
**Provider**: SportScore (`https://sportscore.com`)  

---

## 1. Executive Summary & Root Cause Confirmation

### The Iranian-Team / Belgian-League Mismatch
The issue where Iranian fixtures (and other foreign fixtures such as Malaysian and Uzbek fixtures) appear under the Belgian Pro League was pinpointed to a flaw in `src/lib/canonicalCompetitions.ts`:

```typescript
// Line 925 of src/lib/canonicalCompetitions.ts:
if (code === 'belgium1' || compLower.includes('pro league') || compLower.includes('belgian pro')) {
  return CANONICAL_COMPETITIONS.bel_pro_league;
}
```

#### Exact Step-by-Step Mechanism:
1. **Upstream SportScore Data**: When SportScore returns fixtures for Iran (e.g. from `/api/v1/fixtures/?sport=football&date=2026-10-23` or `/api/widget/matches/`), the competition name is `"Iran Pro League"` (the Persian Gulf Pro League), with slug `"iran-pro-league"`, country `"iran"`, and provider ID `"kjw2r09hln4rz84"`.
2. **Fixture Ingestion**: During `normalizeSportScoreMatch` or catalogue generation, the raw competition string `"Iran Pro League"` was passed to `resolveCanonicalCompetition({ competition: "Iran Pro League", ... })`.
3. **Overly Broad Substring Matching**: The function evaluated:
   `compLower.includes('pro league')`
   Because `"Iran Pro League"` contains the substring `"pro league"`, it evaluated to `true` **before** checking the country or verifying if it was actually in Belgium!
4. **Incorrect Belgian Identity Assigned**: It returned `CANONICAL_COMPETITIONS.bel_pro_league`, stamping the fixture with:
   - `competitionId: "bel_pro_league"`
   - `competition: "Belgian Pro League"`
   - `country: "Belgium"`
5. **Persistence in Bundled Catalogue & Disk Cache**: When `scripts/repair-sports-catalogue.ts` ran, it re-applied `resolveCanonicalCompetition` across all fixtures and baked this mismatch permanently into `src/data/bundledSportsCatalogue.ts` and `.cache/sports_fixtures.json`.
6. **Frontend Filtering & Display**: In `src/pages/FreeMatches.tsx`, the Leagues dropdown groups by Continent. Because `bel_pro_league` is assigned `continent: "europe"` and `country: "Belgium"`, all Iranian fixtures were shown under Belgium in Europe!

#### Concrete Examples Found in `src/data/bundledSportsCatalogue.ts`:
All 9 fixtures currently assigned to `"Belgian Pro League"` in the repository were verified to be mismatched foreign leagues:
1. `mkt-ss-chadormalu-sc-vs-esteghlal-tehran`: Chadormalu SC vs Esteghlal Tehran (`leagueCode: iran-pro-league`, Country: Iran -> mapped to Belgium / Belgian Pro League)
2. `mkt-ss-aluminium-arak-vs-zob-ahan`: Aluminium Arak FC vs Zob Ahan (`leagueCode: iran-pro-league`, Country: Iran -> mapped to Belgium / Belgian Pro League)
3. `mkt-ss-gol-gohar-fc-vs-kheybar-khorramabad`: Gol Gohar FC vs Kheybar Khorramabad (`leagueCode: iran-pro-league`, Country: Iran -> mapped to Belgium / Belgian Pro League)
4. `mkt-ss-sanat-naft-vs-tractor-sc`: Tractor S.C. vs Sanat-Naft (`leagueCode: iran-pro-league`, Country: Iran -> mapped to Belgium / Belgian Pro League)
5. `mkt-ss-yaypan-fk-vs-olympic-mobiuz`: Olympic MobiUz vs Yaypan FK (`leagueCode: uzbekistan-pro-league`, Country: Uzbekistan -> mapped to Belgium / Belgian Pro League)
6. `mkt-ss-respublika-fa-vs-pakhtakor-ii`: Respublika FA vs Pakhtakor II (`leagueCode: uzbekistan-pro-league`, Country: Uzbekistan -> mapped to Belgium / Belgian Pro League)
7. `mkt-ss-muft-vs-armed-forces-fc`: Armed Forces FC vs MUFT (`leagueCode: malaysia-a1-semi-pro-league`, Country: Malaysia -> mapped to Belgium / Belgian Pro League)
8. `mkt-ss-selangor-pkns-vs-aak-puncak-alam`: AAK Puncak Alam vs Selangor PKNS (`leagueCode: malaysia-a1-semi-pro-league`, Country: Malaysia -> mapped to Belgium / Belgian Pro League)
9. `mkt-ss-bunga-raya-vs-staf-usm-fc`: Staf USM FC vs Bunga Raya (`leagueCode: malaysia-a1-semi-pro-league`, Country: Malaysia -> mapped to Belgium / Belgian Pro League)

---

## 2. Repository & Architectural Inventory

### 1. SportScore API Endpoints & Response Schema
- **Endpoints**:
  - `https://sportscore.com/api/v1/fixtures/?sport=football&date=YYYY-MM-DD`: Daily fixtures slate.
  - `https://sportscore.com/api/v1/fixtures/?sport=football&status=live`: Live in-play fixtures.
  - `https://sportscore.com/api/v1/fixtures/?sport=football&competition={slug}`: Fixtures for a specific competition.
  - `https://sportscore.com/api/v1/search/?q={query}&sport=football`: Competition, team, and player search.
  - `https://sportscore.com/api/widget/matches/?sport=football&limit={n}`: Widget match list.
  - `https://sportscore.com/api/widget/match/?sport=football&slug={slug}`: Match lineups, timeline events, scores.
  - `https://sportscore.com/api/widget/standings/?sport=football&slug={slug}`: League table.
- **Provider Identity Schema**:
  - SportScore encodes canonical hierarchy in entity URLs:
    `/football/competition/{country}/{slug}/{providerId}/`
    - International / Continental: Country is `"world"` (e.g. `/football/competition/world/uefa-europa-conference-league/p4jwq2gh754m0ve/`).
    - Domestic: Country is the lowercased country name (e.g. `/football/competition/iran/iran-pro-league/kjw2r09hln4rz84/`, `/football/competition/belgium/belgian-pro-league/9vjxm8gh22r6odg/`).

### 2. Fixture Normalization & Transformation
- `src/lib/sportsFeedService.ts`:
  - `normalizeSportScoreMatch`: Maps SportScore raw match object to `MarketFixture`.
  - Computes crowd consensus percentages and 7% overround odds.
  - Calls `resolveCanonicalCompetition({ competition, country, leagueCode, providerId })`.
- `src/lib/footballApi.ts`:
  - `mapBundledToHighlights()`: Ingests `BUNDLED_SPORTS_CATALOGUE` on startup.
  - Calls `resolveCanonicalCompetition` again to set `competitionId`, `competition`, and `country`.

### 3. Registry & Directory Data
- `src/lib/canonicalCompetitions.ts`: Primary registry dictionary (`CANONICAL_COMPETITIONS`), containing ~50 predefined competitions with tier, continent, priorityRank, and providerSlugs.
- `src/lib/leagueDirectory.ts`: Grouping metadata (`CONTINENTS` and `getLeagueMetadata`).
- `src/data/bundledSportsCatalogue.ts`: Static snapshot with 772 fixtures and hundreds of league records.

### 4. How Competition IDs, Names, Countries, Flags & Types Are Assigned
- If `CANONICAL_COMPETITIONS[competitionId]` exists, it is used.
- Otherwise, `resolveCanonicalCompetition` attempts heuristic matching against provider code, regexes, and name substrings.
- If no match succeeds, `getUnclassifiedCompetition` creates an `unclassified_${slug}` record with continent inferred from keywords, and default `country: "International"`.

### 5. Flaws in Current Matching & Fallbacks
1. `compLower.includes('pro league')` erroneously matches any league containing "Pro League".
2. `country` in `normalizeSportScoreMatch` defaulted to `'International'` for all non-UEFA/CAF/AFC/CONMEBOL matches because SportScore fixture summaries omit country on the match root object.
3. Domestic secondary competitions (e.g. Costa Rica 2nd division `costa-rica-2-liga`, Liga MX Femenil, Copa Libertadores Femenino) collapsed into the men's top flight because country or partial tournament name was matched before competition type and division.
4. Fallback matching guessed competitions based on partial keywords instead of verifying the provider slug or country.

### 6. Leagues Dropdown & Filtering Logic
- `src/pages/FreeMatches.tsx`:
  - Builds `groupedContinents` using `getLeagueMetadata`.
  - Filters by `leagueFilter`: `'all'`, `'continent:{id}'`, or `'league:{id}'`.
  - Currently only supports Continent -> Competition list. Does not provide Continent -> Country -> Competition hierarchy or search within the dropdown.

### 7. Synchronization & Data Version Parity
- Development (`vite.config.ts`), standalone production (`server.ts`), and serverless (`api/sports/*.ts`) all import `sportsFeedService.ts` and use the same data pipeline.
