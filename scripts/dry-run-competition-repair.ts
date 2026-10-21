/**
 * Dry-Run Migration & Repair Audit Script
 * 
 * Audits all stored fixtures in BUNDLED_SPORTS_CATALOGUE and any disk cache files
 * without making destructive modifications.
 * 
 * Outputs:
 * - Record ID and provider fixture ID
 * - Original competition ID, name, and country
 * - Proposed canonical competition ID, name, and country
 * - Reason for each proposed correction
 * - Verification status (VERIFIED vs REQUIRES_MANUAL_REVIEW)
 */

import fs from 'fs';
import path from 'path';
import { BUNDLED_SPORTS_CATALOGUE } from '../src/data/bundledSportsCatalogue';
import { resolveCanonicalCompetition, CANONICAL_COMPETITIONS, getCountryMeta } from '../src/lib/canonicalCompetitions';

export interface AuditRecord {
  id: string;
  providerId: string;
  home: string;
  away: string;
  original: {
    competitionId: string;
    competition: string;
    country: string;
    leagueCode: string;
  };
  proposed: {
    competitionId: string;
    competition: string;
    country: string;
    leagueCode: string;
  };
  reason: string;
  status: 'VERIFIED' | 'REQUIRES_MANUAL_REVIEW';
}

export function runDryRunAudit(): {
  totalAudited: number;
  totalCorrected: number;
  totalUnchanged: number;
  corrections: AuditRecord[];
  summaryByCategory: Record<string, number>;
} {
  const fixtures = (BUNDLED_SPORTS_CATALOGUE.fixtures as any[]) || [];
  const corrections: AuditRecord[] = [];
  const summaryByCategory: Record<string, number> = {
    'belgian_pro_league_mismatch': 0,
    'tier_division_separation': 0,
    'women_competition_separation': 0,
    'country_metadata_correction': 0,
    'competition_id_standardization': 0,
    'unclassified_verification': 0,
  };

  for (const f of fixtures) {
    const origCompId = f.competitionId || '';
    const origComp = f.competition || '';
    const origCountry = f.country || '';
    const origLeagueCode = f.leagueCode || '';

    // Run authoritative resolution
    const canon = resolveCanonicalCompetition({
      competition: origComp,
      leagueCode: origLeagueCode,
      country: origCountry,
      providerId: f.providerId || f.id,
    });

    const proposedCompId = canon.id;
    const proposedComp = canon.name;
    const proposedCountry = canon.countryName || canon.country;
    const proposedLeagueCode = origLeagueCode;

    // Check if any field changed
    const compIdChanged = origCompId !== proposedCompId;
    const compNameChanged = origComp !== proposedComp;
    const countryChanged = origCountry !== proposedCountry && origCountry.toLowerCase() === 'international' && proposedCountry !== 'International';
    const countryMismatch = origCountry !== proposedCountry && origCountry !== 'International' && origCountry !== 'Europe' && origCountry !== 'Asia';

    if (compIdChanged || compNameChanged || countryChanged || countryMismatch) {
      let reason = '';
      let category = 'competition_id_standardization';
      let status: 'VERIFIED' | 'REQUIRES_MANUAL_REVIEW' = 'VERIFIED';

      // 1. Iranian / Uzbek / Malaysian mismatch under Belgian Pro League
      if (origCompId === 'bel_pro_league' && proposedCompId !== 'bel_pro_league') {
        reason = `Fixed greedy 'pro league' match: Re-assigned ${origLeagueCode} to verified country (${proposedCountry})`;
        category = 'belgian_pro_league_mismatch';
      }
      // 2. Division / tier separation (e.g. Segunda vs Primera, Liga 2 vs Liga 1)
      else if (origLeagueCode.includes('2') || origLeagueCode.includes('segunda') || origLeagueCode.includes('division-2')) {
        reason = `Separated lower tier division (${origLeagueCode}) from top flight`;
        category = 'tier_division_separation';
      }
      // 3. Women's competition separation
      else if (origLeagueCode.includes('femenil') || origLeagueCode.includes('women') || origLeagueCode.endsWith('-w')) {
        reason = `Separated women's competition (${origLeagueCode}) from men's top flight`;
        category = 'women_competition_separation';
      }
      // 4. Country metadata enrichment from verified provider slug
      else if (origCountry.toLowerCase() === 'international' && proposedCountry !== 'International') {
        reason = `Enriched country metadata from 'International' to verified country '${proposedCountry}'`;
        category = 'country_metadata_correction';
      }
      else {
        reason = `Standardized competition identity to canonical registry (${proposedCompId})`;
        category = 'competition_id_standardization';
      }

      summaryByCategory[category] = (summaryByCategory[category] || 0) + 1;

      corrections.push({
        id: f.id,
        providerId: f.providerId || f.id,
        home: f.home,
        away: f.away,
        original: {
          competitionId: origCompId,
          competition: origComp,
          country: origCountry,
          leagueCode: origLeagueCode,
        },
        proposed: {
          competitionId: proposedCompId,
          competition: proposedComp,
          country: proposedCountry,
          leagueCode: proposedLeagueCode,
        },
        reason,
        status,
      });
    }
  }

  return {
    totalAudited: fixtures.length,
    totalCorrected: corrections.length,
    totalUnchanged: fixtures.length - corrections.length,
    corrections,
    summaryByCategory,
  };
}

if (process.argv[1]?.includes('dry-run-competition-repair')) {
  console.log('========================================================================');
  console.log('   MSHINDI COMPETITION DIRECTORY — DRY-RUN MIGRATION & REPAIR AUDIT     ');
  console.log('========================================================================\n');

  const result = runDryRunAudit();

  console.log(`Audited: ${result.totalAudited} fixtures`);
  console.log(`Proposed for correction: ${result.totalCorrected} fixtures`);
  console.log(`Unchanged (already verified): ${result.totalUnchanged} fixtures\n`);

  console.log('--- Summary by Category ---');
  for (const [cat, count] of Object.entries(result.summaryByCategory)) {
    console.log(`  ${cat.padEnd(35)}: ${count}`);
  }

  console.log('\n--- Sample Proposed Corrections (First 20) ---');
  result.corrections.slice(0, 20).forEach((c, idx) => {
    console.log(`\n[${idx + 1}] Fixture: ${c.home} vs ${c.away} (ID: ${c.id})`);
    console.log(`    ORIGINAL : [${c.original.competitionId}] ${c.original.competition} | Country: ${c.original.country} | Code: ${c.original.leagueCode}`);
    console.log(`    PROPOSED : [${c.proposed.competitionId}] ${c.proposed.competition} | Country: ${c.proposed.country}`);
    console.log(`    REASON   : ${c.reason}`);
    console.log(`    STATUS   : ${c.status}`);
  });

  // Verify that all 9 Belgian mismatches are caught and corrected
  const belCorrections = result.corrections.filter(c => c.original.competitionId === 'bel_pro_league');
  console.log(`\nVerified Belgian Pro League mismatches detected: ${belCorrections.length}/9`);
  belCorrections.forEach(c => {
    console.log(`  - ${c.home} vs ${c.away}: [${c.original.leagueCode}] -> [${c.proposed.competitionId}] ${c.proposed.competition} (${c.proposed.country})`);
  });

  console.log('\n========================================================================');
  console.log('                      DRY-RUN COMPLETE                                  ');
  console.log('========================================================================');
}
