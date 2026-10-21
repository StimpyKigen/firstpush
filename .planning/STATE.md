# Current State — Football Competition Directory Rebuild

**Active Milestone**: Rebuild Football Competition Directory with SportScore  
**Current Phase**: Phase 8 — Validation & Regression Tests (COMPLETED)  
**Status**: COMPLETED & VERIFIED  

## Key Decisions & Established Invariants
1. **Root Cause Confirmed**: `compLower.includes('pro league')` in `src/lib/canonicalCompetitions.ts` was greedily mapping Iran Pro League, Malaysia A1 Semi-Pro League, and Uzbekistan Pro League to Belgian Pro League (`bel_pro_league`).
2. **Provider Key Invariant**: Use SportScore's actual stable competition slug (`leagueCode` / `providerSlug`) as the primary identity key.
3. **Hierarchy Separation**: Competition classification (Country, Continent, Type) is strictly decoupled from prestige ranking (`priorityRank` / `displayPriority`).
4. **Safety Invariant**: Unmatched fixtures must remain under `unclassified_${slug}` with their actual provider name and country, never guessed into a foreign domestic league.
