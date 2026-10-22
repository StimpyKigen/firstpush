/**
 * Sports Fixture PDF & Tabular Text Parser
 * 
 * Extracts football fixtures, kickoff schedules, and odds matrices from uploaded PDF documents
 * or tabular text. Categorizes matches by country and sectored leagues using the canonical
 * competition directory.
 * 
 * Explicit requirement: Match ID column is ignored and not used.
 */

import { resolveCanonicalCompetition } from './canonicalCompetitions';
import { resolveSportScoreDirectoryId } from './leagueDirectory';
import type { MarketFixture } from './sportsFeedService';

export interface ParsedFixtureOdds {
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  doubleChance1X?: number;
  doubleChance12?: number;
  doubleChanceX2?: number;
  over25Odds?: number;
  under25Odds?: number;
  bttsYesOdds?: number;
  bttsNoOdds?: number;
}

export interface ParsedFixtureRow {
  homeTeam: string;
  awayTeam: string;
  kickoffDate: string; // YYYY-MM-DD
  kickoffTime: string; // HH:mm
  kickoffIso: string;  // Full ISO string in EAT
  kickoffDisplay: string;
  country: string;
  competition: string;
  competitionId: string;
  directoryId: string;
  odds: ParsedFixtureOdds;
  rawLine?: string;
}

export interface ParseFixturesResult {
  fixtures: ParsedFixtureRow[];
  marketFixtures: MarketFixture[];
  warnings: string[];
  sectoredLeagues: Record<string, { country: string; league: string; count: number }>;
}

/**
 * Native Zero-Dependency PDF Text Stream Extractor
 * Decompresses PDF FlateDecode streams using browser / Node native DecompressionStream.
 */
export async function extractTextFromPdfBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(arrayBuffer);
  const textDecoder = new TextDecoder('latin1');
  const pdfString = textDecoder.decode(bytes);

  const extractedLines: string[] = [];

  // Locate all stream...endstream blocks
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(pdfString)) !== null) {
    const streamStartIndex = match.index;
    const headerSlice = pdfString.slice(Math.max(0, streamStartIndex - 400), streamStartIndex);
    const isFlate = headerSlice.includes('/FlateDecode') || headerSlice.includes('/Fl');

    const streamContentStart = match.index + match[0].indexOf('\n') + 1;
    const streamContentEnd = match.index + match[0].lastIndexOf('endstream');
    const rawStreamBytes = bytes.slice(streamContentStart, streamContentEnd);

    let decodedStreamText = '';

    if (isFlate) {
      try {
        const ds = new DecompressionStream('deflate');
        const writer = ds.writable.getWriter();
        writer.write(rawStreamBytes);
        writer.close();
        const reader = ds.readable.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
        const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
        const merged = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }
        decodedStreamText = new TextDecoder('utf-8', { fatal: false }).decode(merged);
      } catch {
        try {
          const ds = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(rawStreamBytes);
          writer.close();
          const reader = ds.readable.getReader();
          const chunks: Uint8Array[] = [];
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
          }
          const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
          const merged = new Uint8Array(totalLen);
          let offset = 0;
          for (const c of chunks) {
            merged.set(c, offset);
            offset += c.length;
          }
          decodedStreamText = new TextDecoder('utf-8', { fatal: false }).decode(merged);
        } catch {
          // Non-fatal
        }
      }
    } else {
      decodedStreamText = new TextDecoder('latin1').decode(rawStreamBytes);
    }

    if (decodedStreamText) {
      const extracted = parsePdfTextOperators(decodedStreamText);
      if (extracted.trim()) {
        extractedLines.push(extracted);
      }
    }
  }

  if (extractedLines.length === 0) {
    const directText = parsePdfTextOperators(pdfString);
    if (directText.trim()) {
      extractedLines.push(directText);
    }
  }

  return extractedLines.join('\n');
}

function parsePdfTextOperators(content: string): string {
  const lines: string[] = [];
  let currentLine = '';

  const btBlocks = content.match(/BT[\s\S]*?ET/g) || [content];

  for (const block of btBlocks) {
    const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
    let tjMatch: RegExpExecArray | null;
    while ((tjMatch = tjArrayRegex.exec(block)) !== null) {
      const inner = tjMatch[1];
      const strParts = inner.match(/\((.*?)\)/g);
      if (strParts) {
        const assembled = strParts.map((s) => s.slice(1, -1)).join('');
        currentLine += ' ' + cleanPdfEscapes(assembled);
      }
    }

    const tjSingleRegex = /\((.*?)\)\s*(?:Tj|'|")/g;
    let singleMatch: RegExpExecArray | null;
    while ((singleMatch = tjSingleRegex.exec(block)) !== null) {
      const str = cleanPdfEscapes(singleMatch[1]);
      currentLine += ' ' + str;
    }

    if (block.includes('T*') || /T[dD]\s+[\d.-]+\s+-[1-9]/.test(block) || currentLine.length > 80) {
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
      currentLine = '';
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines.join('\n');
}

function cleanPdfEscapes(str: string): string {
  return str
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

function buildEatIso(dateStr: string, timeStr: string): { iso: string; formatted: string } {
  let y = new Date().getFullYear();
  let m = new Date().getMonth() + 1;
  let d = new Date().getDate();

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
    const parts = dateStr.split('-').map(Number);
    y = parts[0];
    m = parts[1];
    d = parts[2];
  } else if (/^\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?$/.test(dateStr)) {
    const parts = dateStr.split(/[/-]/).map(Number);
    d = parts[0];
    m = parts[1];
    if (parts[2]) {
      y = parts[2] < 100 ? 2000 + parts[2] : parts[2];
    }
  }

  let hh = 18;
  let mm = 0;
  if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
    const parts = timeStr.split(':').map(Number);
    hh = parts[0];
    mm = parts[1];
  }

  const mmPadded = String(m).padStart(2, '0');
  const ddPadded = String(d).padStart(2, '0');
  const hhPadded = String(hh).padStart(2, '0');
  const minPadded = String(mm).padStart(2, '0');

  const iso = `${y}-${mmPadded}-${ddPadded}T${hhPadded}:${minPadded}:00+03:00`;

  const dObj = new Date(iso);
  const formatted = new Intl.DateTimeFormat('en-KE', {
    timeZone: 'Africa/Nairobi',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(dObj) + ' EAT';

  return { iso, formatted };
}

/**
 * Robust token-based row parser
 */
function parseSingleFixtureLine(
  line: string,
  defaultCountry: string,
  defaultLeague: string
): ParsedFixtureRow | null {
  // Normalize pipe and tab delimiters
  const cleanLine = line.replace(/[|\t]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanLine) return null;

  const rawTokens = cleanLine.split(' ').map((t) => t.trim()).filter(Boolean);
  if (rawTokens.length < 5) return null;

  // 1. Scan from right to extract all odds numbers
  // Odds are floats/decimals like 1.85, 3.40, 2.10
  const oddsTokens: number[] = [];
  let oddsStartIndex = rawTokens.length;

  for (let i = rawTokens.length - 1; i >= 0; i--) {
    const token = rawTokens[i];
    if (/^\d{1,2}\.\d{1,2}$/.test(token)) {
      const val = parseFloat(token);
      if (val >= 1.01 && val <= 99.0) {
        oddsTokens.unshift(val);
        oddsStartIndex = i;
        continue;
      }
    }
    // If not an odds number, stop scanning odds from the right
    break;
  }

  if (oddsTokens.length < 3) {
    return null; // A valid row requires at least 3-way odds (1, X, 2)
  }

  // 2. Head tokens (0 to oddsStartIndex - 1) contain:
  // [Match ID?] [Date?] [Time?] [Home Team] [Away Team]
  let remainingTokens = rawTokens.slice(0, oddsStartIndex);

  // Check if first token is a numeric match ID (e.g. 5821, #1004) or code
  if (remainingTokens.length > 0 && /^(#?\d{3,8}|MID-\d+)$/i.test(remainingTokens[0])) {
    remainingTokens = remainingTokens.slice(1); // IGNORE MATCH ID!
  }

  // Check for date and time
  let dateStr = new Date().toISOString().slice(0, 10);
  let timeStr = '18:00';

  if (remainingTokens.length > 0) {
    // Check if token 0 or 1 matches date format
    if (/^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)$/.test(remainingTokens[0])) {
      dateStr = remainingTokens[0];
      remainingTokens = remainingTokens.slice(1);
    }
  }

  if (remainingTokens.length > 0) {
    // Check if token matches time format HH:mm
    if (/^([012]?\d:[0-5]\d)$/.test(remainingTokens[0])) {
      timeStr = remainingTokens[0];
      remainingTokens = remainingTokens.slice(1);
    }
  }

  // Remaining tokens are the teams!
  const teamText = remainingTokens.join(' ');
  let homeTeam = '';
  let awayTeam = '';

  const vsMatch = teamText.match(/(.+?)\s+(?:vs\.?|v\.?|-|@)\s+(.+)/i);
  if (vsMatch) {
    homeTeam = vsMatch[1].trim();
    awayTeam = vsMatch[2].trim();
  } else if (remainingTokens.length >= 2) {
    const mid = Math.ceil(remainingTokens.length / 2);
    homeTeam = remainingTokens.slice(0, mid).join(' ');
    awayTeam = remainingTokens.slice(mid).join(' ');
  }

  if (!homeTeam || !awayTeam || homeTeam.length < 2 || awayTeam.length < 2) {
    return null;
  }

  // Map odds
  const homeOdds = oddsTokens[0];
  const drawOdds = oddsTokens[1];
  const awayOdds = oddsTokens[2];

  const doubleChance1X = oddsTokens[3] || +(1 / (1 / homeOdds + 1 / drawOdds) * 1.05).toFixed(2);
  const doubleChance12 = oddsTokens[4] || +(1 / (1 / homeOdds + 1 / awayOdds) * 1.05).toFixed(2);
  const doubleChanceX2 = oddsTokens[5] || +(1 / (1 / drawOdds + 1 / awayOdds) * 1.05).toFixed(2);

  const over25Odds = oddsTokens[6] || 1.85;
  const under25Odds = oddsTokens[7] || 1.95;

  const bttsYesOdds = oddsTokens[8] || 1.75;
  const bttsNoOdds = oddsTokens[9] || 2.05;

  let country = defaultCountry;
  let competition = defaultLeague;

  const canon = resolveCanonicalCompetition({
    competition: defaultLeague,
    country: defaultCountry,
  });

  if (canon) {
    country = canon.countryName || canon.country || defaultCountry;
    competition = canon.name || defaultLeague;
  }

  const directoryId = resolveSportScoreDirectoryId({
    competition,
    country,
  });

  const { iso, formatted } = buildEatIso(dateStr, timeStr);

  return {
    homeTeam,
    awayTeam,
    kickoffDate: dateStr,
    kickoffTime: timeStr,
    kickoffIso: iso,
    kickoffDisplay: formatted,
    country,
    competition,
    competitionId: canon?.id || slugify(competition),
    directoryId,
    odds: {
      homeOdds,
      drawOdds,
      awayOdds,
      doubleChance1X,
      doubleChance12,
      doubleChanceX2,
      over25Odds,
      under25Odds,
      bttsYesOdds,
      bttsNoOdds,
    },
    rawLine: line,
  };
}

export function parseFixturesText(rawText: string): ParseFixturesResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const parsedRows: ParsedFixtureRow[] = [];
  const warnings: string[] = [];

  let currentCountry = 'England';
  let currentLeague = 'Premier League';

  const headerRegex = /^([A-Za-z\s]{3,20})\s*[:-]\s*([A-Za-z0-9\s]{3,35})$/i;
  const countryOnlyRegex = /^(ENGLAND|SPAIN|ITALY|GERMANY|FRANCE|NETHERLANDS|PORTUGAL|SCOTLAND|TURKEY|BELGIUM|KENYA|SOUTH AFRICA|BRAZIL|ARGENTINA|USA|INTERNATIONAL|UEFA)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const hMatch = line.match(headerRegex);
    if (hMatch) {
      currentCountry = hMatch[1].trim();
      currentLeague = hMatch[2].trim();
      continue;
    }

    const cMatch = line.match(countryOnlyRegex);
    if (cMatch) {
      currentCountry = cMatch[1].trim();
      if (lines[i + 1] && lines[i + 1].length < 35 && !/\d/.test(lines[i + 1])) {
        currentLeague = lines[i + 1].trim();
        i++;
      }
      continue;
    }

    if (
      /\b(match\s*id|home\s*team|away\s*team|double\s*chance|over\s*\/?\s*under|btts|1x2)\b/i.test(line) &&
      !line.includes('vs') &&
      !line.includes(' - ')
    ) {
      continue;
    }

    const parsed = parseSingleFixtureLine(line, currentCountry, currentLeague);
    if (parsed) {
      parsedRows.push(parsed);
    }
  }

  const sectoredLeagues: Record<string, { country: string; league: string; count: number }> = {};
  const marketFixtures: MarketFixture[] = [];
  const nowIso = new Date().toISOString();

  for (const row of parsedRows) {
    const key = `${row.country}__${row.competition}`;
    if (!sectoredLeagues[key]) {
      sectoredLeagues[key] = {
        country: row.country,
        league: row.competition,
        count: 0,
      };
    }
    sectoredLeagues[key].count++;

    const hOdds = row.odds.homeOdds;
    const dOdds = row.odds.drawOdds;
    const aOdds = row.odds.awayOdds;

    const hProb = Math.max(0.05, 1 / hOdds);
    const dProb = Math.max(0.05, 1 / dOdds);
    const aProb = Math.max(0.05, 1 / aOdds);
    const sumProb = hProb + dProb + aProb;

    const homePct = Math.round((hProb / sumProb) * 100);
    const awayPct = Math.round((aProb / sumProb) * 100);
    const drawPct = Math.max(0, 100 - homePct - awayPct);

    const over25Pct = row.odds.over25Odds
      ? Math.round((1 / row.odds.over25Odds) * 100)
      : Math.min(80, Math.max(25, Math.round(homePct * 0.6 + awayPct * 0.5)));
    const bttsYesPct = row.odds.bttsYesOdds
      ? Math.round((1 / row.odds.bttsYesOdds) * 100)
      : Math.min(75, Math.max(30, Math.round(50 + (100 - drawPct) * 0.2)));

    const fid = `fix-${row.country.toLowerCase()}-${slugify(row.homeTeam)}-vs-${slugify(row.awayTeam)}`;

    marketFixtures.push({
      id: fid,
      providerId: fid,
      home: row.homeTeam,
      away: row.awayTeam,
      competition: row.competition,
      competitionId: row.competitionId,
      leagueCode: slugify(row.competition),
      country: row.country,
      kickoff: row.kickoffDisplay,
      kickoffIso: row.kickoffIso,
      status: 'pre',
      homeOdds: hOdds,
      drawOdds: dOdds,
      awayOdds: aOdds,
      homePct,
      drawPct,
      awayPct,
      bttsYesPct,
      over25Pct,
      bookmaker: 'Uploaded Market Consensus',
      syncedAt: nowIso,
      lastSyncTime: nowIso,
      recordUpdateTime: nowIso,
    });
  }

  return {
    fixtures: parsedRows,
    marketFixtures,
    warnings,
    sectoredLeagues,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
