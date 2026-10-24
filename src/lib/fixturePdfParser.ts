/**
 * Sports Fixture PDF & Tabular Text Parser
 * 
 * Extracts football fixtures, kickoff schedules, and odds matrices from uploaded PDF documents
 * or tabular text. Categorizes matches by country and sectored leagues using the canonical
 * competition directory.
 * 
 * Features:
 * - Full multi-page support with page break awareness
 * - Per-page context reset (never carry stale league context across page boundaries)
 * - Heading-based context detection with qualifier preservation (groups, gender, age, rounds, amateur)
 * - Reliable Match ID, date, time, home team, and away team extraction
 * - Optional betting odds (missing odds do not invalidate fixtures)
 * - Positive fixture row validation and non-fixture content exclusion (headers, footers, licensing)
 * - Idempotent parsing with comprehensive stats (detected, accepted, rejected, review_required, duplicates)
 */

import { resolveCanonicalCompetition } from './canonicalCompetitions';
import { PDF_LITERAL_STRING_SOURCE, decodePdfLiteralBody, decodePdfHexBody } from './pdfTextDecode';
import { resolveSportScoreDirectoryId } from './leagueDirectory';
import type { MarketFixture } from './sportsFeedService';

export interface ParsedFixtureOdds {
  homeOdds?: number;
  drawOdds?: number;
  awayOdds?: number;
  doubleChance1X?: number;
  doubleChance12?: number;
  doubleChanceX2?: number;
  over25Odds?: number;
  under25Odds?: number;
  bttsYesOdds?: number;
  bttsNoOdds?: number;
}

export interface ParsedFixtureRow {
  matchId?: string;
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
  rawCountry?: string;
  rawCompetition?: string;
  rawHeading?: string;
  odds?: ParsedFixtureOdds;
  rawLine?: string;
  pageNumber?: number;
  status?: 'accepted' | 'review_required';
  reviewReason?: string;
}

export interface ParseFixturesResult {
  fixtures: ParsedFixtureRow[];
  marketFixtures: MarketFixture[];
  warnings: string[];
  sectoredLeagues: Record<string, { country: string; league: string; count: number }>;
  stats: {
    totalPages: number;
    totalLines: number;
    detectedRows: number;
    acceptedCount: number;
    rejectedCount: number;
    reviewRequiredCount: number;
    duplicateCount: number;
  };
  rejectedRows: Array<{ line: string; reason: string }>;
  reviewRequiredRows: Array<{ row: ParsedFixtureRow; reason: string }>;
}

export interface ExtractedPdfPageItem {
  pageNumber: number;
  text: string;
  lines: string[];
}

interface TextItem {
  x: number;
  y: number;
  text: string;
}

/**
 * Native Zero-Dependency PDF Text Stream Extractor (Client-side)
 * Decompresses PDF FlateDecode streams using browser native DecompressionStream.
 * Handles UTF-16BE literals and groups text operators by (x, y) coordinates.
 * Inserts explicit page breaks between pages.
 */
export async function extractPdfPagesFromBuffer(arrayBuffer: ArrayBuffer): Promise<ExtractedPdfPageItem[]> {
  const bytes = new Uint8Array(arrayBuffer);
  const textDecoder = new TextDecoder('latin1');
  const pdfString = textDecoder.decode(bytes);

  const pages: ExtractedPdfPageItem[] = [];

  let pos = 0;
  let pageIndex = 1;
  while ((pos = pdfString.indexOf('stream', pos)) !== -1) {
    if (pos > 0 && !/[\r\n>]/.test(pdfString[pos - 1])) {
      pos += 6;
      continue;
    }

    const dictStart = pdfString.lastIndexOf('<<', pos);
    const dict = dictStart !== -1 ? pdfString.slice(dictStart, pos) : '';

    // Skip font streams (/Length1 TrueType fonts)
    if (dict.includes('/Length1')) {
      const skipEnd = pdfString.indexOf('endstream', pos);
      pos = skipEnd !== -1 ? skipEnd + 9 : pos + 6;
      continue;
    }

    let streamStart = pos + 6;
    if (streamStart < pdfString.length && pdfString[streamStart] === '\r') streamStart++;
    if (streamStart < pdfString.length && pdfString[streamStart] === '\n') streamStart++;

    const endPos = pdfString.indexOf('endstream', streamStart);
    if (endPos === -1) break;

    let streamEnd = endPos;
    while (streamEnd > streamStart && (pdfString[streamEnd - 1] === '\n' || pdfString[streamEnd - 1] === '\r')) {
      streamEnd--;
    }

    const rawStreamBytes = bytes.subarray(streamStart, streamEnd);
    if (rawStreamBytes.length > 0) {
      let decompressedBytes: Uint8Array | null = null;
      if (dict.includes('/FlateDecode') || (rawStreamBytes.length > 2 && rawStreamBytes[0] === 0x78)) {
        decompressedBytes = await decompressPdfStream(rawStreamBytes);
      } else {
        decompressedBytes = rawStreamBytes;
      }

      if (decompressedBytes) {
        const content = textDecoder.decode(decompressedBytes);
        if (content.includes('BT') && content.includes('ET')) {
          const pageText = parseCoordinateTextStream(content);
          if (pageText.trim()) {
            const lines = pageText
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean);
            pages.push({
              pageNumber: pageIndex++,
              text: pageText.trim(),
              lines,
            });
          }
        }
      }
    }

    pos = endPos + 9;
  }

  return pages;
}

export async function extractTextFromPdfBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  const pages = await extractPdfPagesFromBuffer(arrayBuffer);
  return pages.map((p) => p.text).join('\n--- PAGE BREAK ---\n');
}

async function decompressPdfStream(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const totalLen = chunks.reduce((a, b) => a + b.length, 0);
    const merged = new Uint8Array(totalLen);
    let off = 0;
    for (const c of chunks) {
      merged.set(c, off);
      off += c.length;
    }
    return merged;
  } catch {
    try {
      let rawBytes = bytes;
      if (bytes.length > 6 && bytes[0] === 0x78) {
        rawBytes = bytes.subarray(2, bytes.length - 4);
      }
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(rawBytes);
      writer.close();
      const reader = ds.readable.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const totalLen = chunks.reduce((a, b) => a + b.length, 0);
      const merged = new Uint8Array(totalLen);
      let off = 0;
      for (const c of chunks) {
        merged.set(c, off);
        off += c.length;
      }
      return merged;
    } catch {
      return null;
    }
  }
}

function parseCoordinateTextStream(content: string): string {
  const btRegex = /BT([\s\S]*?)ET/g;
  let btMatch: RegExpExecArray | null;
  const items: TextItem[] = [];

  while ((btMatch = btRegex.exec(content)) !== null) {
    const block = btMatch[1];
    const tdMatch = /(?:([\d.-]+)\s+([\d.-]+)\s+Td|[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+([\d.-]+)\s+([\d.-]+)\s+Tm)/.exec(block);
    const x = tdMatch ? parseFloat(tdMatch[1] ?? tdMatch[3] ?? '0') : 0;
    const y = tdMatch ? parseFloat(tdMatch[2] ?? tdMatch[4] ?? '0') : 0;

    const tjMatch = new RegExp(PDF_LITERAL_STRING_SOURCE + '\\s*(?:Tj|\'|")').exec(block);
    if (tjMatch) {
      const decoded = decodePdfLiteralString(tjMatch[1]);
      if (decoded) {
        items.push({ x, y, text: decoded });
      }
      continue;
    }

    const hexMatch = /<([0-9a-fA-F\s]+)>\s*(?:Tj|'|")/.exec(block);
    if (hexMatch) {
      const decoded = decodeHexPdfString(hexMatch[1]);
      if (decoded) {
        items.push({ x, y, text: decoded });
      }
    }
  }

  if (items.length === 0) return '';

  items.sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: { y: number; items: TextItem[] }[] = [];
  for (const item of items) {
    const existingRow = rows.find((r) => Math.abs(r.y - item.y) <= 2.5);
    if (existingRow) {
      existingRow.items.push(item);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  const lines: string[] = [];
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    const isMultiColumn = row.items.length >= 4;
    const rowText = row.items.map((it) => it.text).join(isMultiColumn ? '\t' : ' ');
    if (rowText.trim()) {
      lines.push(rowText.trim());
    }
  }

  return lines.join('\n');
}

export function decodePdfLiteralString(str: string): string {
  return decodePdfLiteralBody(str);
}

function decodeHexPdfString(hex: string): string {
  return decodePdfHexBody(hex);
}

export function isBinaryGarbage(text: string): boolean {
  if (!text || text.length === 0) return true;
  const nonAsciiCount = (text.match(/[^\x20-\x7E\t\r\n]/g) || []).length;
  return nonAsciiCount / text.length > 0.30;
}

function buildEatIso(dateStr: string, timeStr: string): { iso: string; formatted: string; normalizedDate: string; normalizedTime: string } {
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

  const normalizedDate = `${y}-${mmPadded}-${ddPadded}`;
  const normalizedTime = `${hhPadded}:${minPadded}`;
  const iso = `${normalizedDate}T${normalizedTime}:00+03:00`;
  const formatted = `${ddPadded}/${mmPadded} ${normalizedTime}`;

  return { iso, formatted, normalizedDate, normalizedTime };
}

/**
 * Positive filter for non-fixture lines to ignore.
 * Excludes headers, column titles, page numbers, footers, paybills, legal/licensing, URLs, emails.
 */
export function isNonFixtureLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;

  // Page numbers & delimiters
  if (/^--- PAGE BREAK ---$/i.test(trimmed)) return true;
  if (/(?:ke\.sportpesa\.com\s+)?page\s+\d+\s+of\s+\d+/i.test(trimmed)) return true;
  if (/^page\s+\d+$/i.test(trimmed)) return true;

  // Document & site branding headers
  if (/sports betting homepage/i.test(trimmed)) return true;
  if (/upcoming games/i.test(trimmed)) return true;
  if (/^sportpesa$/i.test(trimmed)) return true;
  if (/^ke\.sportpesa\.com$/i.test(trimmed)) return true;

  // Column header lines
  if (/id\s+date\s+team/i.test(trimmed)) return true;
  if (/home\s+draw\s+away/i.test(trimmed)) return true;
  if (/\b3\s*way\b/i.test(trimmed)) return true;
  if (/\bboth teams to\b/i.test(trimmed)) return true;
  if (/\bdouble chance\b/i.test(trimmed)) return true;
  if (/\bover\/under\b/i.test(trimmed)) return true;
  if (/^(1\s*or\s*x|x\s*or\s*2|1\s*or\s*2)\b/i.test(trimmed)) return true;
  if (/^(over|under|yes|no)\b/i.test(trimmed)) return true;
  if (/^score$/i.test(trimmed)) return true;

  // Footers, paybill numbers, licensing, legal text, contacts, social media
  if (/\b(paybill|safaricom|airtel)\b/i.test(trimmed)) return true;
  if (/\b(need help|contact us|gambling may have|adverse effects|is duly licensed|licen[sc]e|the operator of|standard global|p\.o\.box|casino products)\b/i.test(trimmed)) return true;
  if (/\b(legal and compliance|compliance licence|terms and conditions|copyright|all rights reserved)\b/i.test(trimmed)) return true;
  if (/(mailto:|https?:\/\/)/i.test(trimmed)) return true;
  if (/\b(facebook\.com|twitter\.com|youtube\.com|instagram\.com|tiktok\.com|traffic\.sussdigital\.com)\b/i.test(trimmed)) return true;

  return false;
}

/**
 * Splits remaining text tokens into Home and Away team names.
 * Uses club suffixes, prefixes, and balanced heuristic splitting.
 */
export function splitTeamTokens(tokens: string[]): { homeTeam: string; awayTeam: string } {
  if (tokens.length === 0) return { homeTeam: '', awayTeam: '' };
  if (tokens.length === 1) return { homeTeam: tokens[0], awayTeam: '' };
  if (tokens.length === 2) return { homeTeam: tokens[0], awayTeam: tokens[1] };

  if (tokens.length === 3) {
    if (
      /^(Sparta|Celta|Crystal|Real|AC|SC|FK|CD|LD|Estudiantes|Academia|Gzira|Slavia|Aston|Borussia|Sporting|Rapid|Dynamo|Dinamo|Young|Saint|San|Deportivo|Racing|River|Boca|Monte|New|Los|Inter|Atletico|Manchester|West|Sheffield|Preston|Rayo|Paris|Red)$/i.test(
        tokens[1]
      ) ||
      (/^(United|City|Town|Albion|Rovers|Wanderers|County|Hotspur|Wednesday|Athletic|Argyle)$/i.test(tokens[2]) && !/^(United|City|Town|Albion|Rovers|Wanderers|County)$/i.test(tokens[1])) ||
      (/^FC$/i.test(tokens[1]) && /^(copenhagen|lugano|porto|basel|zurich|barcelona|bayern)$/i.test(tokens[2]))
    ) {
      return { homeTeam: tokens[0], awayTeam: `${tokens[1]} ${tokens[2]}` };
    }
    return { homeTeam: `${tokens[0]} ${tokens[1]}`, awayTeam: tokens[2] };
  }

  const fullText = tokens.join(' ');
  // 1. Explicit separator
  const vsMatch = fullText.match(/(.+?)\s+(?:vs\.?|v\.?|@)\s+(.+)/i);
  if (vsMatch) {
    return { homeTeam: vsMatch[1].trim(), awayTeam: vsMatch[2].trim() };
  }

  // 2. Club suffix in tokens that indicates END of Home Team
  const homeEndSuffixes = /^(FC|SC|TC|AC|RJ|SP|MG|W|MU|DG|U20|Club|\(KSA\))$/i;
  for (let k = 1; k < tokens.length - 1; k++) {
    if (homeEndSuffixes.test(tokens[k])) {
      if (/^(RJ|SP|MG|PE|BA|CE|FC)$/i.test(tokens[k]) && /^(U20|W|AM|RJ|SP|MG)$/i.test(tokens[k + 1])) {
        continue;
      }
      if (/^Club$/i.test(tokens[k]) && /^(dEscaldes|de|du|da|del|Olimpia|Sando|Atletico)$/i.test(tokens[k + 1])) {
        continue;
      }
      if (/^FC$/i.test(tokens[k]) && k === tokens.length - 2 && /^(copenhagen|lugano|porto|basel|zurich|barcelona|bayern)$/i.test(tokens[k + 1])) {
        const home = tokens.slice(0, k).join(' ');
        const away = tokens.slice(k).join(' ');
        if (home.length >= 2 && away.length >= 2) {
          return { homeTeam: home, awayTeam: away };
        }
      }
      const home = tokens.slice(0, k + 1).join(' ');
      const away = tokens.slice(k + 1).join(' ');
      if (home.length >= 3 && away.length >= 2 && k + 1 < tokens.length) {
        return { homeTeam: home, awayTeam: away };
      }
    }
  }

  // 3. Club prefix in tokens that indicates START of Away Team
  const awayStartPrefixes = /^(FC|FK|AC|SC|CD|LD|CS|MS|AS|NEC|AZ|SCU|KAA|RB|SL|CSKA|Audax|Ittihad|Ajman|Sanat|Mash|Ramthar|Union|Panathinaikos|DAR|Persib|The|Baladiyyat|Kahroba|Sahl|Tanta|Scolar|Bayer|Hapoel|Rennes|Brighton|Sunderland|Marseille|Hearts|Brann|Quwa|Atletico|Gzira|KuPS|Cruzeiro|Boliviar|Bolivar|Twente|Academia|Nacional)$/i;
  for (let k = 1; k < tokens.length; k++) {
    if (awayStartPrefixes.test(tokens[k])) {
      if (/^FC$/i.test(tokens[k]) && k < 2 && !/^(copenhagen|lugano|porto|basel|zurich)$/i.test(tokens[k + 1])) {
        continue;
      }
      if (/^Club$/i.test(tokens[k]) && !/^Nacional$/i.test(tokens[k + 1])) {
        continue;
      }
      const home = tokens.slice(0, k).join(' ');
      const away = tokens.slice(k).join(' ');
      if (home.length >= 2 && away.length >= 2) {
        return { homeTeam: home, awayTeam: away };
      }
    }
  }

  // 4. Check for "Al" / "El" / "EL"
  for (let k = 1; k < tokens.length - 1; k++) {
    if (/^(Al|El|EL)$/i.test(tokens[k])) {
      const homeWords = tokens.slice(0, k);
      const awayWords = tokens.slice(k);
      if (homeWords.length >= 1 && awayWords.length >= 2) {
        if (!/^(Al|El|EL)$/i.test(tokens[0]) || homeWords.length >= 2) {
          return { homeTeam: homeWords.join(' '), awayTeam: awayWords.join(' ') };
        }
      }
    }
  }

  // 5. Special token count rules
  if (/^(FC|SC|TC|AC|W)$/i.test(tokens[tokens.length - 1])) {
    if (tokens.length === 5) {
      return {
        homeTeam: tokens.slice(0, 2).join(' '),
        awayTeam: tokens.slice(2).join(' '),
      };
    }
    if (tokens.length === 7) {
      return {
        homeTeam: tokens.slice(0, 4).join(' '),
        awayTeam: tokens.slice(4).join(' '),
      };
    }
  }

  // 6. Default: balanced split
  const mid = tokens.length % 2 === 0 ? tokens.length / 2 : Math.floor(tokens.length / 2);
  const home = tokens.slice(0, mid).join(' ');
  const away = tokens.slice(mid).join(' ');
  return { homeTeam: home, awayTeam: away };
}

/**
 * Detects whether a line represents a competition header.
 * Preserves qualifiers such as groups, gender, age categories, rounds, amateur.
 * Keeps international competitions separate from domestic leagues.
 */
export function detectCompetitionHeader(line: string): { country: string; league: string; rawHeading: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Skip match lines (start with digits or date patterns)
  if (/^\d{2,8}\b/.test(trimmed)) return null;

  // Skip non-fixture lines (branding, table column headings, footers, etc.)
  if (isNonFixtureLine(trimmed)) {
    return null;
  }

  // 1. Dash or Colon delimiter: "Country - League Name" or "Country: League Name"
  const delimiterMatch = trimmed.match(/^([A-Za-z\s.'&()]+?)\s*[-–—:]\s*([A-Za-z0-9\s.'&(),]+)$/);
  if (delimiterMatch) {
    const country = delimiterMatch[1].trim();
    const league = delimiterMatch[2].trim();
    if (country.length >= 2 && league.length >= 2 && !/\d{2,}/.test(country)) {
      return { country, league, rawHeading: trimmed };
    }
  }

  // 2. Standard SportPesa delimiter: "Country - League Name"
  const hyphenIdx = trimmed.indexOf(' - ');
  if (hyphenIdx > 1) {
    const country = trimmed.slice(0, hyphenIdx).trim();
    const league = trimmed.slice(hyphenIdx + 3).trim();
    if (country.length >= 2 && league.length >= 2 && !/\d{2,}/.test(country)) {
      return { country, league, rawHeading: trimmed };
    }
  }

  // 3. Colon delimiter: "Country: League Name"
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx > 1) {
    const country = trimmed.slice(0, colonIdx).trim();
    const league = trimmed.slice(colonIdx + 1).trim();
    if (country.length >= 2 && league.length >= 2 && !/\d{2,}/.test(country)) {
      return { country, league, rawHeading: trimmed };
    }
  }

  // 4. Standalone Country-only line
  const countryOnlyRegex = /^(ENGLAND|SPAIN|ITALY|GERMANY|FRANCE|NETHERLANDS|PORTUGAL|SCOTLAND|TURKEY|BELGIUM|KENYA|SOUTH AFRICA|BRAZIL|ARGENTINA|USA|INTERNATIONAL|INTERNATIONAL CLUBS|UEFA|BAHRAIN|JORDAN|VIETNAM|MONTENEGRO|PANAMA|ESTONIA|QATAR|SAUDI ARABIA)$/i;
  if (countryOnlyRegex.test(trimmed)) {
    return { country: trimmed, league: 'Top League', rawHeading: trimmed };
  }

  return null;
}

/**
 * Robust token-based row parser.
 * Reliably extracts match ID, date, time, home team, away team.
 * Betting odds are optional; missing odds do NOT drop the fixture.
 */
export function parseSingleFixtureLine(
  line: string,
  defaultCountry: string,
  defaultLeague: string,
  pageNumber?: number
): ParsedFixtureRow | null {
  if (isNonFixtureLine(line)) return null;

  let matchId = '';
  let dateStr = '';
  let timeStr = '';
  let homeTeam = '';
  let awayTeam = '';
  let oddsTokens: number[] = [];

  // 1. Direct tab-delimited format (from coordinate-based PDF extractor)
  if (line.includes('\t')) {
    const cols = line.split('\t').map((c) => c.trim()).filter(Boolean);

    // Tab row with matchId in column 0: [matchId, dateTime, homeTeam, awayTeam, ...odds]
    if (cols.length >= 4 && (/^\d{2,8}$/.test(cols[0]) || /^#?\w+$/.test(cols[0])) && /\d{1,2}:\d{2}/.test(cols[1])) {
      matchId = cols[0].replace(/^#/, '');
      const dateTimeRaw = cols[1];
      homeTeam = cols[2];
      awayTeam = cols[3];
      oddsTokens = cols.slice(4).map(Number).filter((n) => !isNaN(n) && n >= 1.01 && n <= 99.0);

      const dtMatch = dateTimeRaw.match(/^([0-9\/-]+?)\s*(?:-\s*|\s+)([0-2]?[0-9]:[0-5][0-9])$/);
      if (dtMatch) {
        dateStr = dtMatch[1].trim();
        timeStr = dtMatch[2].trim();
      } else {
        const parts = dateTimeRaw.replace(/\s*-\s*/g, ' ').trim().split(/\s+/);
        dateStr = parts[0] || new Date().toISOString().slice(0, 10);
        timeStr = parts[1] || '18:00';
      }
    } else if (cols.length >= 3 && /\d{1,2}:\d{2}/.test(cols[0])) {
      // Tab row without matchId: [dateTime, homeTeam, awayTeam, ...odds]
      const dateTimeRaw = cols[0];
      homeTeam = cols[1];
      awayTeam = cols[2];
      oddsTokens = cols.slice(3).map(Number).filter((n) => !isNaN(n) && n >= 1.01 && n <= 99.0);

      const dtMatch = dateTimeRaw.match(/^([0-9\/-]+?)\s*(?:-\s*|\s+)([0-2]?[0-9]:[0-5][0-9])$/);
      if (dtMatch) {
        dateStr = dtMatch[1].trim();
        timeStr = dtMatch[2].trim();
      } else {
        const parts = dateTimeRaw.replace(/\s*-\s*/g, ' ').trim().split(/\s+/);
        dateStr = parts[0] || new Date().toISOString().slice(0, 10);
        timeStr = parts[1] || '18:00';
      }
    }
  }

  // 2. Space-delimited fallback for freeform / pasted text or non-tab OCR
  if (!homeTeam || !awayTeam) {
    let cleanLine = line.replace(/[|\t]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanLine || isNonFixtureLine(cleanLine)) return null;

    cleanLine = cleanLine.replace(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s*-\s*([012]?\d:[0-5]\d)/, '$1 $2');
    const rawTokens = cleanLine.split(' ').map((t) => t.trim()).filter(Boolean);
    if (rawTokens.length < 3) return null;

    // Scan odds numbers from right (optional!)
    const parsedOdds: number[] = [];
    let oddsStartIndex = rawTokens.length;
    for (let i = rawTokens.length - 1; i >= 0; i--) {
      const token = rawTokens[i];
      if (/^\d{1,2}\.\d{1,2}$/.test(token)) {
        const val = parseFloat(token);
        if (val >= 1.01 && val <= 99.0) {
          parsedOdds.unshift(val);
          oddsStartIndex = i;
          continue;
        }
      }
      break;
    }
    oddsTokens = parsedOdds;

    let remainingTokens = rawTokens.slice(0, oddsStartIndex);

    let hasExplicitMatchId = false;
    let hasExplicitDate = false;
    let hasExplicitTime = false;
    const hasExplicitVs = /\b(?:vs\.?|v\.?|@)\b/i.test(cleanLine);

    // Identify match ID if first token is numeric or code
    if (remainingTokens.length > 0 && /^(#?\d{2,8}|MID-\d+)$/i.test(remainingTokens[0])) {
      matchId = remainingTokens[0].replace(/^#/, '');
      hasExplicitMatchId = true;
      remainingTokens = remainingTokens.slice(1);
    }

    // Identify date
    dateStr = new Date().toISOString().slice(0, 10);
    timeStr = '18:00';
    if (remainingTokens.length > 0 && /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)$/.test(remainingTokens[0])) {
      dateStr = remainingTokens[0];
      hasExplicitDate = true;
      remainingTokens = remainingTokens.slice(1);
    }

    // Discard isolated hyphen if present between date and time
    if (remainingTokens.length > 0 && remainingTokens[0] === '-') {
      remainingTokens = remainingTokens.slice(1);
    }

    // Identify time
    if (remainingTokens.length > 0 && /^([012]?\d:[0-5]\d)$/.test(remainingTokens[0])) {
      timeStr = remainingTokens[0];
      hasExplicitTime = true;
      remainingTokens = remainingTokens.slice(1);
    }

    // Positive fixture-row validation for unstructured lines:
    // A valid fixture MUST have at least one structured anchor:
    // (1) explicit match ID, (2) explicit time, (3) explicit date, (4) explicit vs separator, or (5) valid odds tokens
    if (!hasExplicitMatchId && !hasExplicitTime && !hasExplicitDate && !hasExplicitVs && oddsTokens.length < 3) {
      return null;
    }

    // Split remaining tokens into Home and Away
    const split = splitTeamTokens(remainingTokens);
    homeTeam = split.homeTeam;
    awayTeam = split.awayTeam;
  }

  // Validate positive fixture-row requirements:
  // Must have home and away team names with >= 2 characters containing letters
  if (!homeTeam || !awayTeam || homeTeam.length < 2 || awayTeam.length < 2) {
    return null;
  }
  if (!/[a-zA-Z]/.test(homeTeam) || !/[a-zA-Z]/.test(awayTeam)) {
    return null;
  }

  // Build exact EAT timestamp
  const { iso, formatted, normalizedDate, normalizedTime } = buildEatIso(dateStr, timeStr);

  // Parse odds if 3 or more odds numbers are present; otherwise leave undefined
  let odds: ParsedFixtureOdds | undefined = undefined;
  if (oddsTokens.length >= 3) {
    const homeOdds = oddsTokens[0];
    const drawOdds = oddsTokens[1];
    const awayOdds = oddsTokens[2];
    const doubleChance1X = oddsTokens[3] || +(1 / (1 / homeOdds + 1 / drawOdds) * 1.05).toFixed(2);
    const doubleChanceX2 = oddsTokens[4] || +(1 / (1 / drawOdds + 1 / awayOdds) * 1.05).toFixed(2);
    const doubleChance12 = oddsTokens[5] || +(1 / (1 / homeOdds + 1 / awayOdds) * 1.05).toFixed(2);

    let over25Odds = oddsTokens.length >= 8 ? oddsTokens[6] : undefined;
    let under25Odds = oddsTokens.length >= 8 ? oddsTokens[7] : undefined;
    let bttsYesOdds = oddsTokens.length >= 10 ? oddsTokens[8] : undefined;
    let bttsNoOdds = oddsTokens.length >= 10 ? oddsTokens[9] : undefined;

    if (!over25Odds || !under25Odds) {
      over25Odds = +(1.60 + (homeOdds + awayOdds) * 0.08).toFixed(2);
      under25Odds = +(1 / (1 - 1 / over25Odds) * 0.95).toFixed(2);
    }
    if (!bttsYesOdds || !bttsNoOdds) {
      bttsYesOdds = +(1.65 + Math.abs(homeOdds - awayOdds) * 0.05).toFixed(2);
      bttsNoOdds = +(1 / (1 - 1 / bttsYesOdds) * 0.95).toFixed(2);
    }

    odds = {
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
    };
  }

  // Country and Competition Resolution:
  // Invariant: Preserve exact source qualifiers (groups, gender, age, rounds, amateur).
  // Never overwrite lower division, youth, women, or amateur leagues with tier-1 names!
  let country = defaultCountry || 'General';
  let competition = defaultLeague || 'Top League';
  const rawCountry = defaultCountry;
  const rawCompetition = defaultLeague;

  const hasQualifiers =
    /\b(u1[5-9]|u2[0-3]|youth|sub-?\d+|women|w\b|femenin|femenil|amateur|group|division|div\b|serie [b-z]|serie a[2-9]|round|playoffs?|promotion|relegation|cup|super cup)\b/i.test(
      defaultLeague
    );

  const canon = resolveCanonicalCompetition({
    competition: defaultLeague,
    country: defaultCountry,
  });

  let competitionId = '';
  if (canon && !hasQualifiers) {
    const canonCountry = (canon.countryName || canon.country || '').toLowerCase();
    const isContinentalOrInternational =
      canon.competitionType === 'continental_club' ||
      canon.competitionType === 'international' ||
      canon.continent === 'international' ||
      canon.continent === 'european_competitions' ||
      defaultCountry.toLowerCase().includes('international');

    if (
      defaultCountry &&
      (canonCountry === defaultCountry.toLowerCase() || isContinentalOrInternational)
    ) {
      country = defaultCountry;
      competition = defaultLeague || canon.name;
      competitionId = canon.id;
    } else if (!defaultCountry) {
      country = canon.countryName || canon.country || 'General';
      competition = defaultLeague || canon.name || 'Top League';
      competitionId = canon.id;
    } else {
      competition = defaultLeague || 'Top League';
      country = defaultCountry || 'General';
      competitionId = slugify(`${country}-${competition}`);
    }
  } else {
    // Preserve verbatim qualifiers in competition name!
    competition = defaultLeague || 'Top League';
    country = defaultCountry || 'General';
    competitionId = slugify(`${country}-${competition}`);
  }

  const directoryId = resolveSportScoreDirectoryId({
    competition,
    country,
  });

  return {
    matchId: matchId || undefined,
    homeTeam,
    awayTeam,
    kickoffDate: normalizedDate,
    kickoffTime: normalizedTime,
    kickoffIso: iso,
    kickoffDisplay: formatted,
    country,
    competition,
    competitionId,
    directoryId,
    rawCountry,
    rawCompetition,
    odds,
    rawLine: line,
    pageNumber,
  };
}

/**
 * Parses fixtures across all pages of a PDF or text document.
 * 
 * Invariants:
 * 1. Parse every page with no hardcoded limits.
 * 2. Heading-based context: reset on each page; never carry stale league context across page boundaries.
 * 3. Accurately identify country and competition, preserving all qualifiers.
 * 4. Reliably extract match ID, date, time, home team, away team; odds are optional.
 * 5. Ignore non-fixture content positively.
 * 6. Idempotent import with full diagnostic statistics.
 */
export function parseFixturesText(
  rawInput: string | ExtractedPdfPageItem[] | Array<{ pageNumber: number; lines: string[] }>
): ParseFixturesResult {
  let pages: Array<{ pageNumber: number; lines: string[] }> = [];

  if (Array.isArray(rawInput)) {
    pages = rawInput.map((p, idx) => ({
      pageNumber: p.pageNumber ?? idx + 1,
      lines: p.lines ?? (p as any).text?.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean) ?? [],
    }));
  } else {
    const text = String(rawInput || '');
    if (text.includes('--- PAGE BREAK ---')) {
      const pageTexts = text.split('--- PAGE BREAK ---');
      pages = pageTexts.map((pt, idx) => ({
        pageNumber: idx + 1,
        lines: pt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
      }));
    } else if (text.includes('\f')) {
      const pageTexts = text.split('\f');
      pages = pageTexts.map((pt, idx) => ({
        pageNumber: idx + 1,
        lines: pt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
      }));
    } else {
      const allLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const pageChunks: string[][] = [];
      let currentChunk: string[] = [];

      for (const line of allLines) {
        currentChunk.push(line);
        if (/^(ke\.sportpesa\.com\s+)?page\s+\d+\s+of\s+\d+/i.test(line)) {
          pageChunks.push(currentChunk);
          currentChunk = [];
        }
      }
      if (currentChunk.length > 0) {
        pageChunks.push(currentChunk);
      }

      if (pageChunks.length > 1) {
        pages = pageChunks.map((chunk, idx) => ({
          pageNumber: idx + 1,
          lines: chunk,
        }));
      } else {
        pages = [{ pageNumber: 1, lines: allLines }];
      }
    }
  }

  const parsedRows: ParsedFixtureRow[] = [];
  const warnings: string[] = [];
  const rejectedRows: Array<{ line: string; reason: string }> = [];
  const reviewRequiredRows: Array<{ row: ParsedFixtureRow; reason: string }> = [];
  const seenKeys = new Set<string>();

  let totalLines = 0;
  let detectedRows = 0;
  let duplicateCount = 0;

  let unconsumedHeading: { country: string; league: string; rawHeading: string } | null = null;

  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const page = pages[pIdx];
    totalLines += page.lines.length;

    // Reset heading context on each page! Never carry stale league context across page boundaries.
    // Exception: If the previous page ended with an unconsumed heading (0 fixtures under it on previous page),
    // it was split by the page boundary and continues onto this page.
    let currentHeading: { country: string; league: string; rawHeading: string } | null = null;
    let fixturesUnderCurrentHeading = 0;

    if (unconsumedHeading) {
      currentHeading = unconsumedHeading;
      unconsumedHeading = null;
    }

    for (let i = 0; i < page.lines.length; i++) {
      const line = page.lines[i];

      // Exclude non-fixture content (headers, column titles, page numbers, footers)
      if (isNonFixtureLine(line)) {
        continue;
      }

      // Check if it's a competition header
      const compHeader = detectCompetitionHeader(line);
      if (compHeader) {
        currentHeading = {
          country: compHeader.country,
          league: compHeader.league,
          rawHeading: line.trim(),
        };
        fixturesUnderCurrentHeading = 0;
        continue;
      }

      // Parse fixture row with positive validation
      const parsed = parseSingleFixtureLine(
        line,
        currentHeading?.country || '',
        currentHeading?.league || '',
        page.pageNumber
      );

      if (parsed) {
        detectedRows++;

        if (!currentHeading) {
          // No competition heading established on this page!
          // Mark for review rather than guessing stale league context
          parsed.status = 'review_required';
          parsed.reviewReason = 'Missing competition heading on page; context reset at page boundary';
          reviewRequiredRows.push({ row: parsed, reason: parsed.reviewReason });
          warnings.push(`Page ${page.pageNumber}: Fixture "${parsed.homeTeam} vs ${parsed.awayTeam}" has no competition heading on this page.`);
        } else {
          parsed.status = 'accepted';
          parsed.rawHeading = currentHeading.rawHeading;
          fixturesUnderCurrentHeading++;
        }

        // Idempotent deduplication
        const dedupeKey = parsed.matchId
          ? `mid_${parsed.matchId}`
          : `${slugify(parsed.homeTeam)}___${slugify(parsed.awayTeam)}___${parsed.kickoffDate}`;

        if (seenKeys.has(dedupeKey)) {
          duplicateCount++;
          // Update existing row with latest data instead of duplicating
          const prevIdx = parsedRows.findIndex((r) =>
            r.matchId ? r.matchId === parsed.matchId :
            `${slugify(r.homeTeam)}___${slugify(r.awayTeam)}___${r.kickoffDate}` === dedupeKey
          );
          if (prevIdx !== -1) {
            parsedRows[prevIdx] = { ...parsedRows[prevIdx], ...parsed };
          }
          continue;
        }

        seenKeys.add(dedupeKey);
        parsedRows.push(parsed);
      } else {
        // Line looked like a fixture candidate but was malformed
        if (/^\d{2,8}\b/.test(line) || /\d{1,2}:\d{2}/.test(line)) {
          rejectedRows.push({ line, reason: 'Malformed fixture row or missing required team names' });
        }
      }
    }

    // At end of page: check if currentHeading was unconsumed
    if (currentHeading && fixturesUnderCurrentHeading === 0) {
      unconsumedHeading = currentHeading;
    } else {
      unconsumedHeading = null; // Do NOT carry stale heading across page boundary!
    }
  }

  // Aggregate sectored leagues and create MarketFixture models
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

    // Calculate probabilities & odds
    let hOdds = row.odds?.homeOdds ?? 2.50;
    let dOdds = row.odds?.drawOdds ?? 3.10;
    let aOdds = row.odds?.awayOdds ?? 2.50;

    const hProb = Math.max(0.05, 1 / hOdds);
    const dProb = Math.max(0.05, 1 / dOdds);
    const aProb = Math.max(0.05, 1 / aOdds);
    const sumProb = hProb + dProb + aProb;

    const homePct = Math.round((hProb / sumProb) * 100);
    const awayPct = Math.round((aProb / sumProb) * 100);
    const drawPct = Math.max(0, 100 - homePct - awayPct);

    const over25Pct = row.odds?.over25Odds
      ? Math.round((1 / row.odds.over25Odds) * 100)
      : Math.min(80, Math.max(25, Math.round(homePct * 0.6 + awayPct * 0.5)));
    const bttsYesPct = row.odds?.bttsYesOdds
      ? Math.round((1 / row.odds.bttsYesOdds) * 100)
      : Math.min(75, Math.max(30, Math.round(50 + (100 - drawPct) * 0.2)));

    const fid = row.matchId
      ? `fix-${row.matchId}`
      : `fix-${row.country.toLowerCase()}-${slugify(row.homeTeam)}-vs-${slugify(row.awayTeam)}`;

    marketFixtures.push({
      id: fid,
      providerId: fid,
      matchId: row.matchId,
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
      bookmaker: row.odds ? 'Uploaded Market Consensus' : 'Uploaded Fixture Slate',
      syncedAt: nowIso,
      lastSyncTime: nowIso,
      recordUpdateTime: nowIso,
    });
  }

  const acceptedCount = parsedRows.filter((r) => r.status !== 'review_required').length;
  const reviewRequiredCount = reviewRequiredRows.length;

  return {
    fixtures: parsedRows,
    marketFixtures,
    warnings,
    sectoredLeagues,
    stats: {
      totalPages: pages.length,
      totalLines,
      detectedRows,
      acceptedCount,
      rejectedCount: rejectedRows.length,
      reviewRequiredCount,
      duplicateCount,
    },
    rejectedRows,
    reviewRequiredRows,
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
