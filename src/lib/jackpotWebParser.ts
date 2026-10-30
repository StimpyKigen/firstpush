/**
 * Intelligent, Bookmaker-Independent Football Jackpot Fixture Text Parser
 *
 * Staged Pipeline Architecture:
 * 1. Input Normalization & Line Categorization
 * 2. Context-Aware Noise & Odds Filtering
 * 3. Date & Time Extraction (with application timezone Africa/Nairobi)
 * 4. Country & League Recognition with Context Inheritance
 * 5. Team Identification (supporting prefixes, numbers, accents, hyphens)
 * 6. Fixture Boundary Detection & Original Order Preservation
 * 7. Multi-Strategy Adapters (Numbered Cards, Section Headings, Inline, Table)
 * 8. Comprehensive Validation & Confidence Scoring
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type ValidationStatus = 'valid' | 'requires_review' | 'invalid';

export interface JackpotFixtureResult {
  fixtureNumber: number | null;
  originalOrder: number;
  kickoffDate: string; // YYYY-MM-DD
  kickoffTime: string; // HH:mm (24h)
  country: string | null;
  leagueName: string | null;
  homeTeam: string;
  awayTeam: string;
  sourceFormat: string;
  confidence: ConfidenceLevel;
  validationStatus: ValidationStatus;
  validationIssues?: string[];

  // Backward-compatibility fields for Mshindi UI & storage:
  home: string;
  away: string;
  competition: string;
  kickoff: string;
  homePct: number;
  drawPct: number;
  awayPct?: number;
}

export interface ParserDiagnostics {
  detectedFormat: string;
  totalLines: number;
  totalCandidateBlocks: number;
  ignoredNoiseLinesCount: number;
  parseDurationMs: number;
  contextSwitches: number;
}

export interface JackpotParseReport {
  success: boolean;
  totalDetected: number;
  totalValid: number;
  totalNeedsReview: number;
  fixtures: JackpotFixtureResult[];
  errors: string[];
  warnings: string[];
  diagnostics: ParserDiagnostics;
}

export interface JackpotParserOptions {
  referenceDate?: Date | string; // Reference date for relative terms like Today/Tomorrow (default: now in EAT)
  timezone?: string; // Timezone (default: 'Africa/Nairobi' / UTC+3)
  targetLegs?: number; // Optional target count (no hard cap)
  bookmakerHint?: string; // Optional bookmaker hint
}

// =========================================================================
// RECOGNIZED COUNTRIES & LEAGUES
// =========================================================================

export const KNOWN_COUNTRIES = new Set([
  'England', 'France', 'Spain', 'Italy', 'Germany', 'Portugal', 'Netherlands',
  'Scotland', 'Belgium', 'Turkey', 'Saudi Arabia', 'Brazil', 'Argentina',
  'Norway', 'Greece', 'Switzerland', 'Croatia', 'Sweden', 'Denmark', 'Poland',
  'Czech Republic', 'Austria', 'USA', 'United States', 'Mexico', 'Japan',
  'South Korea', 'Egypt', 'South Africa', 'Morocco', 'Kenya', 'Uganda',
  'Tanzania', 'Nigeria', 'Ghana', 'Algeria', 'Tunisia', 'Australia', 'Ireland',
  'Romania', 'Hungary', 'Slovakia', 'Ukraine', 'Russia', 'Chile', 'Colombia',
  'Uruguay', 'Paraguay', 'Ecuador', 'Peru', 'Wales', 'Northern Ireland',
  'Finland', 'Iceland', 'Bulgaria', 'Serbia', 'Slovenia', 'Cyprus', 'Israel'
]);

export const KNOWN_LEAGUES = [
  'Premier League', 'Championship', 'League One', 'League Two', 'FA Cup', 'EFL Cup', 'Carabao Cup',
  'La Liga', 'LaLiga', 'Primera Division', 'Segunda Division', 'Copa del Rey',
  'Serie A', 'Serie B', 'Coppa Italia',
  'Bundesliga', '2. Bundesliga', 'DFB Pokal',
  'Ligue 1', 'Ligue 2', 'Coupe de France',
  'Primeira Liga', 'Taca de Portugal',
  'Eredivisie', 'KNVB Beker',
  'Super League', 'Super Lig', 'Superliga', 'Pro League', 'Premiership',
  'MLS', 'Major League Soccer', 'Saudi Pro League', 'Brasileirao', 'Primera Division',
  'UEFA Champions League', 'Champions League', 'UEFA Europa League', 'Europa League',
  'UEFA Conference League', 'Conference League', 'CAF Champions League', 'CAF Confederation Cup',
  'CAF Confed Cup', 'AFCON', 'Copa Libertadores', 'Copa Sudamericana'
];

// Regex for pure noise lines: odds, betting markets, navigation, labels
const PURE_BETTING_NOISE = new RegExp(
  '^(?:' +
  [
    'home', 'draw', 'away',
    '1', 'x', '2', '1x', '12', 'x2',
    'over', 'under', 'over\\s*\\d+(?:\\.\\d+)?', 'under\\s*\\d+(?:\\.\\d+)?',
    'both teams to score', 'btts', 'gg', 'ng', 'yes', 'no',
    'min stake', 'max payout', 'odds', 'payout', 'jackpot',
    'mega jackpot', 'midweek jackpot', 'super grand', 'grand pro', 'toto',
    'login', 'log in', 'register', 'sign up', 'deposit', 'withdraw',
    'betslip', 'bet slip', 'share', 'print', 'download', 'auto pick', 'clear all',
    'rules', 'terms', 'privacy', 'help', 'faq', 'support', 'live chat',
    'menu', 'search', 'results', 'standings', 'promotions', 'bonus',
    'cookie', 'all rights reserved', 'licence', 'bclb', '18\\+', 'gamble responsibly'
  ].join('|') +
  ')$',
  'i'
);

// Decimal odds (e.g. 3.10, 2.37, 1.85)
const DECIMAL_ODDS_REGEX = /^\d{1,2}\.\d{2}$/;
// Fractional odds (e.g. 5/2, 11/10)
const FRACTIONAL_ODDS_REGEX = /^\d+\/\d+$/;
// American odds (e.g. +150, -200)
const AMERICAN_ODDS_REGEX = /^[+-]\d{3,}$/;

// Relative day prefixes
const RELATIVE_DAYS = ['today', 'tomorrow', 'yesterday'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12
};

// =========================================================================
// HELPER UTILITIES: TIMEZONE & DATE PARSING
// =========================================================================

export function getApplicationNow(ref?: Date | string, tz = 'Africa/Nairobi'): Date {
  if (ref) {
    if (ref instanceof Date) return new Date(ref.getTime());
    const parsed = new Date(ref);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  // Current time in Africa/Nairobi
  const now = new Date();
  try {
    const tzString = now.toLocaleString('en-US', { timeZone: tz });
    return new Date(tzString);
  } catch {
    return now;
  }
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatDateYMD(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export interface ParsedDateTime {
  dateStr: string | null; // YYYY-MM-DD
  timeStr: string | null; // HH:mm
  relativeLabel?: string;
  hasWeekdayMismatch?: boolean;
  rawText: string;
  matchedSnippets: string[];
}

/**
 * Intelligent Date & Time extractor supporting:
 * - "Today 30/10/26 - 21:00"
 * - "Tomorrow 31/10/26 - 18:00"
 * - "Sunday 01/11/26 - 16:00"
 * - "31/10/2026 18:00"
 * - "2026-10-31 18:00"
 * - "31 Oct 2026, 18:00"
 * - "Oct 31, 2026 6:00 PM"
 * - "18:00" / "6:00 PM"
 */
export function extractDateTimeFromLine(
  line: string,
  baseDate: Date
): ParsedDateTime | null {
  const clean = line.trim();
  if (!clean) return null;

  let timeStr: string | null = null;
  let dateStr: string | null = null;
  let relativeLabel: string | undefined;
  let hasWeekdayMismatch = false;
  const matchedSnippets: string[] = [];

  // 1. Time extraction: HH:mm or h:mm AM/PM
  const time12Match = clean.match(/\b(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)\b/i);
  if (time12Match) {
    let hours = parseInt(time12Match[1], 10);
    const mins = time12Match[2];
    const ampm = time12Match[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    timeStr = `${pad2(hours)}:${mins}`;
    matchedSnippets.push(time12Match[0]);
  } else {
    // 24-hour time HH:mm (must not be preceded by decimal dot like 1.95 or followed by dot)
    const time24Match = clean.match(/(?<![\.\d])([01]?\d|2[0-3]):([0-5]\d)(?![\.\d])/);
    if (time24Match) {
      const h = parseInt(time24Match[1], 10);
      const m = time24Match[2];
      timeStr = `${pad2(h)}:${m}`;
      matchedSnippets.push(time24Match[0]);
    }
  }

  // 2. Relative date words: Today / Tomorrow
  const lower = clean.toLowerCase();
  const todayMatch = clean.match(/\btoday\b/i);
  if (todayMatch) {
    dateStr = formatDateYMD(baseDate);
    relativeLabel = 'Today';
    matchedSnippets.push(todayMatch[0]);
  } else {
    const tomMatch = clean.match(/\btomorrow\b/i);
    if (tomMatch) {
      const tom = new Date(baseDate.getTime() + 86400000);
      dateStr = formatDateYMD(tom);
      relativeLabel = 'Tomorrow';
      matchedSnippets.push(tomMatch[0]);
    }
  }

  // 3. Explicit date patterns
  // Pattern A: DD/MM/YYYY or DD/MM/YY or DD-MM-YYYY or DD-MM-YY or DD.MM.YY
  const dmyMatch = clean.match(/\b(0?[1-9]|[12]\d|3[01])[\/\-\.](0?[1-9]|1[0-2])[\/\-\.](\d{2,4})\b/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    dateStr = `${year}-${pad2(month)}-${pad2(day)}`;
    matchedSnippets.push(dmyMatch[0]);
  }

  // Pattern B: YYYY-MM-DD
  const ymdMatch = clean.match(/\b(\d{4})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/);
  if (ymdMatch) {
    dateStr = `${ymdMatch[1]}-${pad2(parseInt(ymdMatch[2], 10))}-${pad2(parseInt(ymdMatch[3], 10))}`;
    matchedSnippets.push(ymdMatch[0]);
  }

  // Pattern C: "31 October 2026" or "31 Oct 2026" or "October 31, 2026"
  const monthRegex = /\b(?:(0?[1-9]|[12]\d|3[01])\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)|(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(0?[1-9]|[12]\d|3[01]))(?:[,\s]+(\d{4}))?\b/i;
  const monthNameMatch = clean.match(monthRegex);
  if (monthNameMatch) {
    const rawM = (monthNameMatch[2] || monthNameMatch[3]).toLowerCase();
    const mKey = Object.keys(MONTH_NAMES).find((k) => rawM.startsWith(k));
    if (mKey) {
      const month = MONTH_NAMES[mKey];
      const day = parseInt(monthNameMatch[1] || monthNameMatch[4], 10);
      const year = monthNameMatch[5] ? parseInt(monthNameMatch[5], 10) : baseDate.getFullYear();
      dateStr = `${year}-${pad2(month)}-${pad2(day)}`;
      matchedSnippets.push(monthNameMatch[0]);
    }
  }

  // 4. Weekday conflict verification
  // If a weekday word appears alongside explicit date (e.g. "Sunday 01/11/26")
  if (dateStr) {
    for (let w = 0; w < WEEKDAYS.length; w++) {
      const wd = WEEKDAYS[w];
      const wdMatch = clean.match(new RegExp(`\\b${wd}\\b`, 'i'));
      if (wdMatch) {
        matchedSnippets.push(wdMatch[0]);
        const checkDate = new Date(`${dateStr}T12:00:00Z`);
        const actualDayIdx = checkDate.getUTCDay();
        if (actualDayIdx !== w) {
          hasWeekdayMismatch = true;
        }
        break;
      }
    }
  }

  if (!dateStr && !timeStr) return null;

  return {
    dateStr,
    timeStr,
    relativeLabel,
    hasWeekdayMismatch,
    rawText: clean,
    matchedSnippets,
  };
}

// =========================================================================
// STAGE 1 & 2: INPUT NORMALIZATION & LINE SANITIZATION
// =========================================================================

export interface NormalizedLine {
  text: string;
  originalLineNumber: number;
  isNoise: boolean;
  isOdds: boolean;
}

export function normalizeInputLines(rawText: string): NormalizedLine[] {
  // Normalize line endings and strip control chars (preserving newlines & tabs)
  const sanitized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');

  const rawLines = sanitized.split('\n');
  const result: NormalizedLine[] = [];

  for (let idx = 0; idx < rawLines.length; idx++) {
    const raw = rawLines[idx];
    const trimmed = raw.trim().replace(/\s+/g, ' ');
    if (!trimmed) continue;

    const isOdds = DECIMAL_ODDS_REGEX.test(trimmed) ||
      FRACTIONAL_ODDS_REGEX.test(trimmed) ||
      AMERICAN_ODDS_REGEX.test(trimmed);

    const isNoise = isOdds || PURE_BETTING_NOISE.test(trimmed);

    result.push({
      text: trimmed,
      originalLineNumber: idx + 1,
      isNoise,
      isOdds,
    });
  }

  return result;
}

// =========================================================================
// STAGE 4: COUNTRY & LEAGUE RECOGNITION
// =========================================================================

export interface CountryLeagueContext {
  country: string | null;
  leagueName: string | null;
  rawHeading?: string;
}

export function detectCountryOrLeagueHeading(line: string): CountryLeagueContext | null {
  const clean = line.trim();
  if (!clean || clean.length > 80) return null;

  // Check combined: "Country - League" (e.g. "England - Premier League", "Spain - La Liga")
  const dashMatch = clean.match(/^([A-Za-z\s]+?)\s*[-–—:]\s*([A-Za-z0-9\s\.\-_]+)$/);
  if (dashMatch) {
    const cCandidate = dashMatch[1].trim();
    const lCandidate = dashMatch[2].trim();
    const matchedCountry = Array.from(KNOWN_COUNTRIES).find(
      (c) => c.toLowerCase() === cCandidate.toLowerCase()
    );
    if (matchedCountry) {
      return {
        country: matchedCountry,
        leagueName: lCandidate,
        rawHeading: clean,
      };
    }
  }

  // Check exact country match
  const exactCountry = Array.from(KNOWN_COUNTRIES).find(
    (c) => c.toLowerCase() === clean.toLowerCase()
  );
  if (exactCountry) {
    return {
      country: exactCountry,
      leagueName: null,
      rawHeading: clean,
    };
  }

  // Check exact league match
  const exactLeague = KNOWN_LEAGUES.find(
    (l) => l.toLowerCase() === clean.toLowerCase()
  );
  if (exactLeague) {
    return {
      country: null,
      leagueName: exactLeague,
      rawHeading: clean,
    };
  }

  return null;
}

// =========================================================================
// STAGE 5: TEAM NAME CLEANING & VALIDATION
// =========================================================================

export function cleanTeamString(raw: string): string {
  let s = raw.trim();

  // If line starts with a fixture number followed by a numbered club name like "1. 1. FC Cologne"
  s = s.replace(/^(\d+[\.\)\-:]\s*)(?=\d+\.\s*(?:FC|FSV|SC|AC|FFC|VfB)\b)/i, '');

  // If it does NOT start with a club prefix like "1. FC", strip leading fixture number like "1." or "1)" or "1 -"
  if (!/^\d+\.\s*(?:FC|FSV|SC|AC|FFC|VfB)\b/i.test(s)) {
    s = s.replace(/^(\d+[\.\)\-:]\s*)/, '');
  }

  return s
    .replace(/\b(\d+\.\d{2})\b/g, '') // remove decimal odds inside line
    .replace(/^(home|away|draw)\s+/i, '') // remove stray market prefixes
    .replace(/[\[\]\{\}]/g, '') // strip brackets but keep parenthesis and hyphens in names
    .replace(/\s+/g, ' ')
    .trim();
}

export function isValidTeamCandidate(str: string): boolean {
  const s = cleanTeamString(str);
  if (!s || s.length < 2 || s.length > 55) return false;

  // Reject pure numbers
  if (/^\d+$/.test(s)) return false;

  // Reject pure odds
  if (DECIMAL_ODDS_REGEX.test(s) || FRACTIONAL_ODDS_REGEX.test(s) || AMERICAN_ODDS_REGEX.test(s)) return false;

  // Reject pure betting noise
  if (PURE_BETTING_NOISE.test(s)) return false;

  // Reject pure date/time strings
  if (/^\d{1,2}:\d{2}$/.test(s) || /^\d{1,2}[\/\-\.]\d{1,2}/.test(s)) return false;

  return true;
}

// =========================================================================
// MULTI-STRATEGY ADAPTERS
// =========================================================================

/**
 * Strategy A: Numbered Fixture Cards with Odds (Format A)
 * Example:
 * 1
 * Tomorrow 31/10/26 - 18:00
 * England
 * Coventry City
 * Sunderland AFC
 * home
 * 3.10
 * draw
 * 3.40
 * away
 * 2.37
 */
export function parseFormatANumberedCards(
  lines: NormalizedLine[],
  baseDate: Date
): JackpotFixtureResult[] | null {
  // Check if text has pattern of standalone sequential digits (1, 2, 3...)
  const numIndices: { num: number; lineIndex: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].text;
    if (/^\d{1,3}$/.test(t)) {
      const n = parseInt(t, 10);
      if (numIndices.length === 0 && (n === 1 || n === 0)) {
        numIndices.push({ num: n, lineIndex: i });
      } else if (numIndices.length > 0 && n === numIndices[numIndices.length - 1].num + 1) {
        numIndices.push({ num: n, lineIndex: i });
      }
    }
  }

  // Process at least 1 numbered card
  if (numIndices.length < 1) return null;

  const fixtures: JackpotFixtureResult[] = [];

  for (let k = 0; k < numIndices.length; k++) {
    const cardStart = numIndices[k].lineIndex + 1;
    const cardEnd = k + 1 < numIndices.length ? numIndices[k + 1].lineIndex : lines.length;
    const cardLines = lines.slice(cardStart, cardEnd);

    let kickoffDate: string | null = null;
    let kickoffTime: string | null = null;
    let country: string | null = null;
    let leagueName: string | null = null;
    let hasWeekdayMismatch = false;
    const teamCandidates: string[] = [];
    const oddsValues: number[] = [];

    for (let c = 0; c < cardLines.length; c++) {
      const line = cardLines[c];

      // Record odds if present
      if (line.isOdds && DECIMAL_ODDS_REGEX.test(line.text)) {
        oddsValues.push(parseFloat(line.text));
        continue;
      }
      if (line.isNoise) continue;

      // Check date/time
      const dt = extractDateTimeFromLine(line.text, baseDate);
      if (dt && (dt.dateStr || dt.timeStr)) {
        if (dt.dateStr) kickoffDate = dt.dateStr;
        if (dt.timeStr) kickoffTime = dt.timeStr;
        if (dt.hasWeekdayMismatch) hasWeekdayMismatch = true;
        continue;
      }

      // Check Country / League
      const cl = detectCountryOrLeagueHeading(line.text);
      if (cl) {
        if (cl.country) country = cl.country;
        if (cl.leagueName) leagueName = cl.leagueName;
        continue;
      }

      // Valid team candidate
      if (isValidTeamCandidate(line.text)) {
        teamCandidates.push(cleanTeamString(line.text));
      }
    }

    if (teamCandidates.length >= 2) {
      const homeTeam = teamCandidates[0];
      const awayTeam = teamCandidates[1];

      // Calculate odds percentage if 3 odds found
      let homePct = 45;
      let drawPct = 30;
      let awayPct = 25;
      if (oddsValues.length >= 3) {
        const [h, d, a] = oddsValues;
        if (h > 0 && d > 0 && a > 0) {
          const invH = 1 / h;
          const invD = 1 / d;
          const invA = 1 / a;
          const sum = invH + invD + invA;
          homePct = Math.round((invH / sum) * 100);
          drawPct = Math.round((invD / sum) * 100);
          awayPct = 100 - homePct - drawPct;
        }
      }

      const order = fixtures.length + 1;
      const compStr = leagueName
        ? (country ? `${country} - ${leagueName}` : leagueName)
        : (country || 'Football League');

      const kDate = kickoffDate || formatDateYMD(baseDate);
      const kTime = kickoffTime || '17:00';

      fixtures.push({
        fixtureNumber: numIndices[k].num,
        originalOrder: order,
        kickoffDate: kDate,
        kickoffTime: kTime,
        country,
        leagueName,
        homeTeam,
        awayTeam,
        sourceFormat: 'Numbered Cards (Format A)',
        confidence: hasWeekdayMismatch ? 'low' : 'high',
        validationStatus: hasWeekdayMismatch ? 'requires_review' : 'valid',
        validationIssues: hasWeekdayMismatch ? ['Weekday stated conflicts with calendar date'] : undefined,
        home: homeTeam,
        away: awayTeam,
        competition: compStr,
        kickoff: `${kDate} · ${kTime} EAT`,
        homePct,
        drawPct,
        awayPct,
      });
    } else if (teamCandidates.length === 1) {
      // Incomplete fixture (missing away team)
      const order = fixtures.length + 1;
      const kDate = kickoffDate || formatDateYMD(baseDate);
      const kTime = kickoffTime || '17:00';
      fixtures.push({
        fixtureNumber: numIndices[k].num,
        originalOrder: order,
        kickoffDate: kDate,
        kickoffTime: kTime,
        country,
        leagueName,
        homeTeam: teamCandidates[0],
        awayTeam: '',
        sourceFormat: 'Numbered Cards (Format A)',
        confidence: 'low',
        validationStatus: 'requires_review',
        validationIssues: ['Missing away team candidate'],
        home: teamCandidates[0],
        away: '',
        competition: country || 'Football League',
        kickoff: `${kDate} · ${kTime} EAT`,
        homePct: 45,
        drawPct: 30,
        awayPct: 25,
      });
    }
  }

  return fixtures.length > 0 ? fixtures : null;
}

/**
 * Strategy B: Section Headings (Date and/or Country - League Heading applied to subsequent teams)
 * Example:
 * ENGLAND - PREMIER LEAGUE
 * Saturday 31 October 2026
 * Manchester City
 * Liverpool
 * 17:30
 */
export function parseFormatBSectionHeadings(
  lines: NormalizedLine[],
  baseDate: Date
): JackpotFixtureResult[] | null {
  const fixtures: JackpotFixtureResult[] = [];

  let activeDate: string | null = null;
  let activeCountry: string | null = null;
  let activeLeague: string | null = null;
  let activeKickoffTime: string | null = null;
  let pendingHomeTeam: string | null = null;
  let pendingTime: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.isNoise) continue;

    // 1. Check Date / Time
    const vsPattern = /\s+(?:vs\.?|versus|v\.?|@|–|—|\s-\s)\s+/i;
    const dt = extractDateTimeFromLine(line.text, baseDate);
    if (dt && dt.dateStr && !line.text.match(vsPattern)) {
      activeDate = dt.dateStr;
      if (dt.timeStr) activeKickoffTime = dt.timeStr;
      continue;
    }

    // 2. Check Country / League Heading
    const cl = detectCountryOrLeagueHeading(line.text);
    if (cl) {
      activeCountry = cl.country;
      activeLeague = cl.leagueName;
      continue;
    }

    // 3. Check time-only line (e.g. "17:30")
    if (dt && dt.timeStr && !dt.dateStr && pendingHomeTeam) {
      pendingTime = dt.timeStr;
      continue;
    }

    // 4. Team line candidates
    if (isValidTeamCandidate(line.text)) {
      if (!pendingHomeTeam) {
        pendingHomeTeam = cleanTeamString(line.text);
      } else {
        const awayTeam = cleanTeamString(line.text);

        // Check if next line has a time
        let timeForFixture = pendingTime || activeKickoffTime || '17:00';
        if (i + 1 < lines.length) {
          const nextDt = extractDateTimeFromLine(lines[i + 1].text, baseDate);
          if (nextDt && nextDt.timeStr && !nextDt.dateStr) {
            timeForFixture = nextDt.timeStr;
            i++; // consume time line
          }
        }

        const order = fixtures.length + 1;
        const compStr = activeLeague
          ? (activeCountry ? `${activeCountry} - ${activeLeague}` : activeLeague)
          : (activeCountry || 'Football League');

        const kDate = activeDate || formatDateYMD(baseDate);

        fixtures.push({
          fixtureNumber: order,
          originalOrder: order,
          kickoffDate: kDate,
          kickoffTime: timeForFixture,
          country: activeCountry,
          leagueName: activeLeague,
          homeTeam: pendingHomeTeam,
          awayTeam,
          sourceFormat: 'Section Headings (Format B/C)',
          confidence: activeDate && activeCountry ? 'high' : 'medium',
          validationStatus: 'valid',
          home: pendingHomeTeam,
          away: awayTeam,
          competition: compStr,
          kickoff: `${kDate} · ${timeForFixture} EAT`,
          homePct: 45,
          drawPct: 30,
          awayPct: 25,
        });

        pendingHomeTeam = null;
        pendingTime = null;
      }
    }
  }

  // Flush remaining single team as incomplete fixture
  if (pendingHomeTeam) {
    const order = fixtures.length + 1;
    const kDate = activeDate || formatDateYMD(baseDate);
    const kTime = pendingTime || activeKickoffTime || '17:00';
    fixtures.push({
      fixtureNumber: order,
      originalOrder: order,
      kickoffDate: kDate,
      kickoffTime: kTime,
      country: activeCountry,
      leagueName: activeLeague,
      homeTeam: pendingHomeTeam,
      awayTeam: '',
      sourceFormat: 'Section Headings (Format B/C)',
      confidence: 'low',
      validationStatus: 'requires_review',
      validationIssues: ['Missing away team candidate'],
      home: pendingHomeTeam,
      away: '',
      competition: activeCountry || 'Football League',
      kickoff: `${kDate} · ${kTime} EAT`,
      homePct: 45,
      drawPct: 30,
      awayPct: 25,
    });
  }

  return fixtures.length > 0 ? fixtures : null;
}

/**
 * Strategy C: Inline Fixtures (Format D & E)
 * Handles:
 * "1. 31/10/2026 18:00 England Premier League Coventry City vs Sunderland AFC"
 * "Team A vs Team B" / "Team A v Team B" / "Team A - Team B" / "Team A @ Team B" / "Team A versus Team B"
 */
export function parseFormatCInline(
  lines: NormalizedLine[],
  baseDate: Date
): JackpotFixtureResult[] | null {
  const fixtures: JackpotFixtureResult[] = [];
  const vsPattern = /\s+(?:vs\.?|versus|v\.?|@|–|—|\s-\s)\s+/i;

  let inheritedDate: string | null = null;
  let inheritedCountry: string | null = null;
  let inheritedLeague: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].text;
    if (lines[i].isNoise) continue;

    // Check heading updates
    const cl = detectCountryOrLeagueHeading(rawLine);
    if (cl) {
      if (cl.country) inheritedCountry = cl.country;
      if (cl.leagueName) inheritedLeague = cl.leagueName;
      continue;
    }

    const dtOnly = extractDateTimeFromLine(rawLine, baseDate);
    if (dtOnly && dtOnly.dateStr && !rawLine.match(vsPattern)) {
      inheritedDate = dtOnly.dateStr;
      continue;
    }

    // Check inline match with separator
    if (rawLine.match(vsPattern)) {
      let line = rawLine;

      // Extract fixture number if leading (e.g. "1. " or "1) ")
      let fixNum: number | null = null;
      const numMatch = line.match(/^(\d{1,3})[\.\)\-:\s]+/);
      if (numMatch) {
        fixNum = parseInt(numMatch[1], 10);
        line = line.slice(numMatch[0].length).trim();
      }

      // Extract date and time
      const dt = extractDateTimeFromLine(line, baseDate);
      const kDate = dt?.dateStr || inheritedDate || formatDateYMD(baseDate);
      const kTime = dt?.timeStr || '17:00';

      // Remove date/time text from line to prevent interfering with team names
      if (dt?.matchedSnippets) {
        for (const snip of dt.matchedSnippets) {
          line = line.replace(snip, ' ');
        }
        line = line.trim();
      }

      // Check country / league inside line
      let country = inheritedCountry;
      let leagueName = inheritedLeague;
      for (const c of Array.from(KNOWN_COUNTRIES)) {
        if (new RegExp(`\\b${c}\\b`, 'i').test(line)) {
          country = c;
          line = line.replace(new RegExp(`\\b${c}\\b`, 'gi'), ' ').trim();
          break;
        }
      }
      for (const lg of KNOWN_LEAGUES) {
        if (new RegExp(`\\b${lg}\\b`, 'i').test(line)) {
          leagueName = lg;
          line = line.replace(new RegExp(`\\b${lg}\\b`, 'gi'), ' ').trim();
          break;
        }
      }

      // Clean multiple spaces
      line = line.replace(/\s+/g, ' ').trim();

      // Split teams on separator
      const parts = line.split(vsPattern);
      if (parts.length >= 2) {
        const homeCandidate = cleanTeamString(parts[0]);
        const awayCandidate = cleanTeamString(parts[1]);

        if (isValidTeamCandidate(homeCandidate) && isValidTeamCandidate(awayCandidate)) {
          const order = fixtures.length + 1;
          const compStr = leagueName
            ? (country ? `${country} - ${leagueName}` : leagueName)
            : (country || 'Football League');

          fixtures.push({
            fixtureNumber: fixNum || order,
            originalOrder: order,
            kickoffDate: kDate,
            kickoffTime: kTime,
            country,
            leagueName,
            homeTeam: homeCandidate,
            awayTeam: awayCandidate,
            sourceFormat: 'Inline Fixtures (Format D/E)',
            confidence: 'high',
            validationStatus: 'valid',
            home: homeCandidate,
            away: awayCandidate,
            competition: compStr,
            kickoff: `${kDate} · ${kTime} EAT`,
            homePct: 45,
            drawPct: 30,
            awayPct: 25,
          });
        }
      }
    }
  }

  return fixtures.length > 0 ? fixtures : null;
}

// =========================================================================
// STAGE 7: COMPREHENSIVE VALIDATION PIPELINE
// =========================================================================

export function validateJackpotFixture(fix: JackpotFixtureResult): JackpotFixtureResult {
  const issues: string[] = [...(fix.validationIssues || [])];

  // Team validation
  if (!fix.homeTeam || !fix.homeTeam.trim()) {
    issues.push('Missing home team name');
  }
  if (!fix.awayTeam || !fix.awayTeam.trim()) {
    issues.push('Missing away team name');
  }
  if (
    fix.homeTeam &&
    fix.awayTeam &&
    fix.homeTeam.trim().toLowerCase() === fix.awayTeam.trim().toLowerCase()
  ) {
    issues.push('Home and away teams cannot be identical');
  }

  // Date validation
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fix.kickoffDate)) {
    issues.push(`Invalid kickoff date format: ${fix.kickoffDate}`);
  } else {
    const dObj = new Date(`${fix.kickoffDate}T12:00:00Z`);
    if (isNaN(dObj.getTime())) {
      issues.push(`Invalid calendar date: ${fix.kickoffDate}`);
    }
  }

  // Time validation
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(fix.kickoffTime)) {
    issues.push(`Invalid kickoff time format: ${fix.kickoffTime}`);
  }

  // Determine status and confidence
  if (issues.length > 0) {
    fix.validationStatus = 'requires_review';
    fix.confidence = 'low';
    fix.validationIssues = issues;
  } else {
    fix.validationStatus = 'valid';
    if (!fix.country && !fix.leagueName) {
      fix.confidence = 'medium';
    } else {
      fix.confidence = 'high';
    }
  }

  return fix;
}

// =========================================================================
// MAIN ENTRY POINT: parseJackpotFixtureText
// =========================================================================

export function parseJackpotFixtureText(
  rawText: string,
  options?: JackpotParserOptions
): JackpotParseReport {
  const startTime = Date.now();
  const baseDate = getApplicationNow(options?.referenceDate, options?.timezone);

  if (!rawText || !rawText.trim()) {
    return {
      success: false,
      totalDetected: 0,
      totalValid: 0,
      totalNeedsReview: 0,
      fixtures: [],
      errors: ['No raw text provided for jackpot parsing.'],
      warnings: [],
      diagnostics: {
        detectedFormat: 'Empty Input',
        totalLines: 0,
        totalCandidateBlocks: 0,
        ignoredNoiseLinesCount: 0,
        parseDurationMs: 0,
        contextSwitches: 0,
      },
    };
  }

  // Stage 1 & 2: Normalization
  const lines = normalizeInputLines(rawText);
  const noiseCount = lines.filter((l) => l.isNoise).length;

  let fixtures: JackpotFixtureResult[] | null = null;
  let detectedFormat = 'Unknown';

  // Strategy 1: Numbered Cards (Format A)
  const formatAFixtures = parseFormatANumberedCards(lines, baseDate);
  if (formatAFixtures && formatAFixtures.length > 0) {
    fixtures = formatAFixtures;
    detectedFormat = 'Numbered Cards with Odds (Format A)';
  }

  // Check if text predominantly contains inline fixture patterns (e.g. "Team A vs Team B")
  const vsPattern = /\s+(?:vs\.?|versus|v\.?|@|–|—|\s-\s)\s+/i;
  const hasInlinePatterns = lines.some((l) => vsPattern.test(l.text));

  // If text has inline patterns, try Inline strategy first
  if (!fixtures && hasInlinePatterns) {
    const formatCFixtures = parseFormatCInline(lines, baseDate);
    if (formatCFixtures && formatCFixtures.length > 0) {
      fixtures = formatCFixtures;
      detectedFormat = 'Inline Separator-Based (Format D/E)';
    }
  }

  // Strategy 2: Section Headings (Format B & C)
  if (!fixtures) {
    const formatBFixtures = parseFormatBSectionHeadings(lines, baseDate);
    if (formatBFixtures && formatBFixtures.length > 0) {
      fixtures = formatBFixtures;
      detectedFormat = 'Section Headings with Carry-Forward Context (Format B/C)';
    }
  }

  // Strategy 3: Inline Fixtures fallback (if not tried yet)
  if (!fixtures) {
    const formatCFixtures = parseFormatCInline(lines, baseDate);
    if (formatCFixtures && formatCFixtures.length > 0) {
      fixtures = formatCFixtures;
      detectedFormat = 'Inline Separator-Based (Format D/E)';
    }
  }

  // Fallback: If still nothing, run Section Headings with relaxed checks
  if (!fixtures || fixtures.length === 0) {
    const fallbackFixtures = parseFormatBSectionHeadings(lines, baseDate) || [];
    fixtures = fallbackFixtures;
    detectedFormat = 'General Structural Fallback';
  }

  // Stage 7: Validation on all extracted fixtures
  const validatedFixtures = fixtures.map((f, idx) => {
    f.originalOrder = idx + 1;
    return validateJackpotFixture(f);
  });

  const totalDetected = validatedFixtures.length;
  const totalValid = validatedFixtures.filter((f) => f.validationStatus === 'valid').length;
  const totalNeedsReview = validatedFixtures.filter((f) => f.validationStatus !== 'valid').length;

  const warnings: string[] = [];
  const errors: string[] = [];

  if (totalNeedsReview > 0) {
    warnings.push(`${totalNeedsReview} fixture(s) require review before publishing.`);
  }

  if (totalDetected === 0) {
    errors.push('No football match fixtures could be reliably identified in the pasted text.');
  }

  const durationMs = Date.now() - startTime;

  return {
    success: totalDetected > 0 && totalValid > 0,
    totalDetected,
    totalValid,
    totalNeedsReview,
    fixtures: validatedFixtures,
    errors,
    warnings,
    diagnostics: {
      detectedFormat,
      totalLines: lines.length,
      totalCandidateBlocks: totalDetected,
      ignoredNoiseLinesCount: noiseCount,
      parseDurationMs: durationMs,
      contextSwitches: 0,
    },
  };
}

// Backwards-compatible alias for existing imports
export const parseJackpotWebpageText = (
  rawText: string,
  targetLegs = 17,
  defaultKickoff = 'Sat 17:00 EAT'
) => {
  const report = parseJackpotFixtureText(rawText);
  return report.fixtures.slice(0, targetLegs).map((f) => ({
    home: f.homeTeam,
    away: f.awayTeam,
    competition: f.competition,
    kickoff: f.kickoff || defaultKickoff,
    homePct: f.homePct,
    drawPct: f.drawPct,
    awayPct: f.awayPct,
  }));
};
