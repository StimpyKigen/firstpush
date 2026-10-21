import { BUNDLED_SPORTS_CATALOGUE } from '../src/data/bundledSportsCatalogue';
import { resolveCanonicalCompetition } from '../src/lib/canonicalCompetitions';

export const DIRECTORY_CONFIG = [
  // Major European football countries
  { id: 'england', label: 'England', country: 'England', kind: 'senior' },
  { id: 'spain', label: 'Spain', country: 'Spain', kind: 'senior' },
  { id: 'italy', label: 'Italy', country: 'Italy', kind: 'senior' },
  { id: 'germany', label: 'Germany', country: 'Germany', kind: 'senior' },
  { id: 'france', label: 'France', country: 'France', kind: 'senior' },
  { id: 'scotland', label: 'Scotland', country: 'Scotland', kind: 'senior' },
  { id: 'portugal', label: 'Portugal', country: 'Portugal', kind: 'senior' },
  { id: 'netherlands', label: 'Netherlands', country: 'Netherlands', kind: 'senior' },

  // International competitions
  { id: 'international_clubs', label: 'International Clubs', kind: 'international_clubs' },
  { id: 'international', label: 'International', kind: 'international' },
  { id: 'international_youth', label: 'International Youth', kind: 'international_youth' },

  // Remaining country and specialized directories
  { id: 'argentina', label: 'Argentina', country: 'Argentina' },
  { id: 'armenia', label: 'Armenia', country: 'Armenia' },
  { id: 'australia', label: 'Australia', country: 'Australia' },
  { id: 'austria', label: 'Austria', country: 'Austria', kind: 'senior' },
  { id: 'austria_amateur', label: 'Austria Amateur', country: 'Austria', kind: 'amateur' },
  { id: 'azerbaijan', label: 'Azerbaijan', country: 'Azerbaijan' },
  { id: 'bahrain', label: 'Bahrain', country: 'Bahrain' },
  { id: 'belarus', label: 'Belarus', country: 'Belarus' },
  { id: 'belgium', label: 'Belgium', country: 'Belgium' },
  { id: 'bolivia', label: 'Bolivia', country: 'Bolivia' },
  { id: 'bosnia_and_herzegovina', label: 'Bosnia and Herzegovina', country: 'Bosnia and Herzegovina' },
  { id: 'brazil', label: 'Brazil', country: 'Brazil' },
  { id: 'bulgaria', label: 'Bulgaria', country: 'Bulgaria' },
  { id: 'cameroon', label: 'Cameroon', country: 'Cameroon' },
  { id: 'canada', label: 'Canada', country: 'Canada' },
  { id: 'chile', label: 'Chile', country: 'Chile' },
  { id: 'china', label: 'China', country: 'China' },
  { id: 'colombia', label: 'Colombia', country: 'Colombia' },
  { id: 'costa_rica', label: 'Costa Rica', country: 'Costa Rica' },
  { id: 'croatia', label: 'Croatia', country: 'Croatia' },
  { id: 'cyprus', label: 'Cyprus', country: 'Cyprus' },
  { id: 'czechia', label: 'Czechia', country: 'Czechia' },
  { id: 'denmark', label: 'Denmark', country: 'Denmark' },
  { id: 'ecuador', label: 'Ecuador', country: 'Ecuador' },
  { id: 'egypt', label: 'Egypt', country: 'Egypt' },
  { id: 'el_salvador', label: 'El Salvador', country: 'El Salvador' },
  { id: 'england_amateur', label: 'England Amateur', country: 'England', kind: 'amateur' },
  { id: 'estonia', label: 'Estonia', country: 'Estonia' },
  { id: 'faroe_islands', label: 'Faroe Islands', country: 'Faroe Islands' },
  { id: 'finland', label: 'Finland', country: 'Finland' },
  { id: 'georgia', label: 'Georgia', country: 'Georgia' },
  { id: 'greece', label: 'Greece', country: 'Greece' },
  { id: 'guatemala', label: 'Guatemala', country: 'Guatemala' },
  { id: 'hungary', label: 'Hungary', country: 'Hungary' },
  { id: 'iceland', label: 'Iceland', country: 'Iceland' },
  { id: 'india', label: 'India', country: 'India' },
  { id: 'iran', label: 'Iran', country: 'Iran' },
  { id: 'iraq', label: 'Iraq', country: 'Iraq' },
  { id: 'ireland', label: 'Ireland', country: 'Ireland' },
  { id: 'israel', label: 'Israel', country: 'Israel' },
  { id: 'japan', label: 'Japan', country: 'Japan' },
  { id: 'jordan', label: 'Jordan', country: 'Jordan' },
  { id: 'kazakhstan', label: 'Kazakhstan', country: 'Kazakhstan' },
  { id: 'kosovo', label: 'KOSOVO', country: 'Kosovo' },
  { id: 'latvia', label: 'Latvia', country: 'Latvia' },
  { id: 'lithuania', label: 'Lithuania', country: 'Lithuania' },
  { id: 'luxembourg', label: 'Luxembourg', country: 'Luxembourg' },
  { id: 'malta', label: 'Malta', country: 'Malta' },
  { id: 'mexico', label: 'Mexico', country: 'Mexico' },
  { id: 'montenegro', label: 'Montenegro', country: 'Montenegro' },
  { id: 'northern_ireland', label: 'Northern Ireland', country: 'Northern Ireland' },
  { id: 'norway', label: 'Norway', country: 'Norway' },
  { id: 'panama', label: 'Panama', country: 'Panama' },
  { id: 'paraguay', label: 'Paraguay', country: 'Paraguay' },
  { id: 'peru', label: 'Peru', country: 'Peru' },
  { id: 'poland', label: 'Poland', country: 'Poland' },
  { id: 'qatar', label: 'Qatar', country: 'Qatar' },
  { id: 'republic_of_korea', label: 'Republic of Korea', country: 'South Korea' },
  { id: 'romania', label: 'Romania', country: 'Romania' },
  { id: 'russia', label: 'Russia', country: 'Russia' },
  { id: 'rwanda', label: 'Rwanda', country: 'Rwanda' },
  { id: 'saudi_arabia', label: 'Saudi Arabia', country: 'Saudi Arabia' },
  { id: 'serbia', label: 'Serbia', country: 'Serbia' },
  { id: 'singapore', label: 'Singapore', country: 'Singapore' },
  { id: 'slovakia', label: 'Slovakia', country: 'Slovakia' },
  { id: 'slovenia', label: 'Slovenia', country: 'Slovenia' },
  { id: 'spain_amateur', label: 'Spain Amateur', country: 'Spain', kind: 'amateur' },
  { id: 'sweden', label: 'Sweden', country: 'Sweden', kind: 'senior' },
  { id: 'sweden_amateur', label: 'Sweden Amateur', country: 'Sweden', kind: 'amateur' },
  { id: 'switzerland', label: 'Switzerland', country: 'Switzerland' },
  { id: 'turkiye', label: 'Turkiye', country: 'Turkey' },
  { id: 'ukraine', label: 'Ukraine', country: 'Ukraine' },
  { id: 'united_arab_emirates', label: 'United Arab Emirates', country: 'United Arab Emirates' },
  { id: 'uruguay', label: 'Uruguay', country: 'Uruguay' },
  { id: 'usa', label: 'USA', country: 'United States' },
  { id: 'uzbekistan', label: 'Uzbekistan', country: 'Uzbekistan' },
  { id: 'venezuela', label: 'Venezuela', country: 'Venezuela' },
  { id: 'vietnam', label: 'Vietnam', country: 'Vietnam' },
  { id: 'wales', label: 'Wales', country: 'Wales' },
];

function isYouthOrAmateur(compName: string, leagueCode: string = '', compType: string = ''): boolean {
  if (compType === 'reserve_amateur' || compType === 'youth') return true;
  const lower = `${compName} ${leagueCode}`.toLowerCase();
  return (
    /\b(u17|u18|u19|u20|u21|u23|youth|amateur|reserve|development|tercera|premier league 2)\b/i.test(lower)
  );
}

function resolveDirectoryCategoryId(f: any): string {
  const canon = resolveCanonicalCompetition({
    competition: f.competition,
    country: f.country,
    leagueCode: f.leagueCode,
    providerId: f.providerId || f.id,
  });

  const cName = canon.countryName || canon.country || f.country || '';
  const compName = canon.name || f.competition || '';
  const compType = canon.competitionType || canon.type || '';

  // 1. International club competitions (Champions League, Europa League, Conference League, CAF CL, etc.)
  if (compType === 'continental_club' || canon.continent === 'european_competitions') {
    return 'international_clubs';
  }

  // 2. International national-team competitions (World Cup, Euros, Nations League, friendlies, qualifiers)
  if (compType === 'international' || cName.toLowerCase() === 'international' || cName.toLowerCase() === 'world' || cName.toLowerCase() === 'europe') {
    if (isYouthOrAmateur(compName, f.leagueCode, compType)) {
      return 'international_youth';
    }
    return 'international';
  }

  // 3. Countries with separate amateur categories
  const cNorm = cName.toLowerCase().trim();
  const isAmateur = isYouthOrAmateur(compName, f.leagueCode, compType);

  if (cNorm === 'england') {
    return isAmateur ? 'england_amateur' : 'england';
  }
  if (cNorm === 'spain') {
    return isAmateur ? 'spain_amateur' : 'spain';
  }
  if (cNorm === 'austria') {
    return isAmateur ? 'austria_amateur' : 'austria';
  }
  if (cNorm === 'sweden') {
    return isAmateur ? 'sweden_amateur' : 'sweden';
  }

  // 4. Aliases and remaining countries
  if (cNorm === 'united states' || cNorm === 'usa') return 'usa';
  if (cNorm === 'turkey' || cNorm === 'turkiye') return 'turkiye';
  if (cNorm === 'kosovo') return 'kosovo';
  if (cNorm === 'south korea' || cNorm === 'korea republic' || cNorm === 'republic of korea') return 'republic_of_korea';
  if (cNorm === 'czech republic' || cNorm === 'czechia') return 'czechia';

  // Match directly against remaining directory entries by country
  const matched = DIRECTORY_CONFIG.find((entry) => entry.country?.toLowerCase() === cNorm);
  if (matched) return matched.id;

  return 'other';
}

function run() {
  const fixtures = BUNDLED_SPORTS_CATALOGUE.fixtures as any[];
  console.log(`Total fixtures in bundled catalogue: ${fixtures.length}`);

  const counts: Record<string, number> = {};
  const sampleMap: Record<string, string[]> = {};
  let otherCount = 0;
  const otherSamples: string[] = [];

  for (const f of fixtures) {
    const catId = resolveDirectoryCategoryId(f);
    counts[catId] = (counts[catId] || 0) + 1;
    if (!sampleMap[catId]) sampleMap[catId] = [];
    if (sampleMap[catId].length < 2) {
      sampleMap[catId].push(`${f.competition}: ${f.home} vs ${f.away}`);
    }
    if (catId === 'other') {
      otherCount++;
      if (otherSamples.length < 5) otherSamples.push(`${f.country || 'NoCountry'} - ${f.competition}`);
    }
  }

  console.log('\n=== SportScore-Aligned Directory Breakdown ===');
  DIRECTORY_CONFIG.forEach((entry) => {
    const c = counts[entry.id] || 0;
    if (c > 0) {
      console.log(`${entry.label.padEnd(28)} : ${c}`);
      sampleMap[entry.id]?.forEach((s) => console.log(`   -> ${s}`));
    }
  });

  console.log(`\nUnmatched "other" count: ${otherCount}`);
  otherSamples.forEach((s) => console.log('  ' + s));
}

run();
