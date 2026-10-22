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

interface TextItem {
  x: number;
  y: number;
  text: string;
}

/**
 * Native Zero-Dependency PDF Text Stream Extractor
 * Decompresses PDF FlateDecode streams using browser native DecompressionStream.
 * Handles UTF-16BE literals and groups text operators by (x, y) coordinates.
 */
export async function extractTextFromPdfBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(arrayBuffer);
  const textDecoder = new TextDecoder('latin1');
  const pdfString = textDecoder.decode(bytes);

  const pageLines: string[] = [];

  let pos = 0;
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
            pageLines.push(pageText.trim());
          }
        }
      }
    }

    pos = endPos + 9;
  }

  return pageLines.join('\n');
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

    const tjMatch = /\(([\s\S]*?)\)\s*(?:Tj|'|")/.exec(block);
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
  let s = str;
  if (s.startsWith('\xFE\xFF') || (s.length >= 2 && s.charCodeAt(0) === 0xfe && s.charCodeAt(1) === 0xff)) {
    s = s.slice(2);
  }

  if (s.includes('\0') || (s.length >= 2 && s.length % 2 === 0 && s.charCodeAt(0) === 0)) {
    let decoded = '';
    for (let i = 0; i < s.length; i += 2) {
      const code = (s.charCodeAt(i) << 8) | (i + 1 < s.length ? s.charCodeAt(i + 1) : 0);
      if (code >= 32 && code <= 126) {
        decoded += String.fromCharCode(code);
      } else if (code === 10 || code === 13 || code === 9) {
        decoded += ' ';
      }
    }
    return decoded.trim();
  }

  return s
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .trim();
}

function decodeHexPdfString(hex: string): string {
  const clean = hex.replace(/\s+/g, '');
  if (clean.length >= 4 && clean.length % 4 === 0) {
    let isUtf16 = true;
    let decoded = '';
    for (let i = 0; i < clean.length; i += 4) {
      const code = parseInt(clean.slice(i, i + 4), 16);
      if (isNaN(code) || (code > 0 && code < 32 && code !== 9 && code !== 10 && code !== 13)) {
        isUtf16 = false;
        break;
      }
      decoded += String.fromCharCode(code);
    }
    if (isUtf16 && decoded.trim()) return decoded.trim();
  }

  let result = '';
  for (let i = 0; i < clean.length; i += 2) {
    const code = parseInt(clean.slice(i, i + 2), 16);
    if (!isNaN(code) && code >= 32 && code <= 126) {
      result += String.fromCharCode(code);
    }
  }
  return result.trim();
}

export function isBinaryGarbage(text: string): boolean {
  if (!text || text.length === 0) return true;
  const nonAsciiCount = (text.match(/[^\x20-\x7E\t\r\n]/g) || []).length;
  return nonAsciiCount / text.length > 0.30;
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

  // Exact EAT ISO string (+03:00) so sorting and timestamp calculations are exact
  const iso = `${y}-${mmPadded}-${ddPadded}T${hhPadded}:${minPadded}:00+03:00`;
  // Formatted verbatim using exact date and time strings without any timezone shifts: "DD/MM HH:mm"
  const formatted = `${ddPadded}/${mmPadded} ${hhPadded}:${minPadded}`;

  return { iso, formatted };
}

/**
 * Splits remaining text tokens into Home and Away team names.
 * Uses club suffixes, prefixes, and balanced heuristic splitting.
 */
function splitTeamTokens(tokens: string[]): { homeTeam: string; awayTeam: string } {
  if (tokens.length === 0) return { homeTeam: '', awayTeam: '' };
  if (tokens.length === 1) return { homeTeam: tokens[0], awayTeam: '' };
  if (tokens.length === 2) return { homeTeam: tokens[0], awayTeam: tokens[1] };

  // 3-token matchups:
  // e.g. "Olympiakos Sparta Prague" -> "Olympiakos" vs "Sparta Prague"
  // e.g. "Celtic Celta Vigo" -> "Celtic" vs "Celta Vigo"
  // e.g. "Besiktas Crystal Palace" -> "Besiktas" vs "Crystal Palace"
  // e.g. "Lillestrom Real Sociedad" -> "Lillestrom" vs "Real Sociedad"
  // e.g. "Bournemouth AC Milan" -> "Bournemouth" vs "AC Milan"
  // e.g. "Monaco SC Freiburg" -> "Monaco" vs "SC Freiburg"
  // e.g. "Flamengo Estudiantes LP" -> "Flamengo" vs "Estudiantes LP"
  // e.g. "Getafe FC Lugano" -> "Getafe" vs "FC Lugano"
  // e.g. "Kairat Almaty Panathinaikos" -> "Kairat Almaty" vs "Panathinaikos"
  // e.g. "Lech Poznan Sunderland" -> "Lech Poznan" vs "Sunderland"
  // e.g. "Sturm Graz Marseille" -> "Sturm Graz" vs "Marseille"
  // e.g. "Baumit Jablonec Brighton" -> "Baumit Jablonec" vs "Brighton"
  if (tokens.length === 3) {
    if (
      /^(Sparta|Celta|Crystal|Real|AC|SC|FK|CD|LD|Estudiantes|Academia|Gzira|Slavia|Aston|Borussia|Sporting|Rapid|Dynamo|Dinamo|Young|Saint|San|Deportivo|Racing|River|Boca|Monte|New|Los|Inter|Atletico)$/i.test(
        tokens[1]
      ) ||
      (/^FC$/i.test(tokens[1]) && /^(copenhagen|lugano|porto|basel|zurich|barcelona|bayern)$/i.test(tokens[2]))
    ) {
      return { homeTeam: tokens[0], awayTeam: `${tokens[1]} ${tokens[2]}` };
    }
    return { homeTeam: `${tokens[0]} ${tokens[1]}`, awayTeam: tokens[2] };
  }

  const fullText = tokens.join(' ');
  // 1. Explicit vs / v / @ separator
  const vsMatch = fullText.match(/(.+?)\s+(?:vs\.?|v\.?|@)\s+(.+)/i);
  if (vsMatch) {
    return { homeTeam: vsMatch[1].trim(), awayTeam: vsMatch[2].trim() };
  }

  // 2. Check for club suffix in tokens that indicates the END of Home Team
  // Suffix MUST start at k = 1 (cannot be index 0!)
  // Handles compound suffixes: "RJ U20", "SP U20", "FC RJ W", "MG U20"
  const homeEndSuffixes = /^(FC|SC|TC|AC|RJ|SP|MG|W|MU|DG|U20|Club|\(KSA\))$/i;
  for (let k = 1; k < tokens.length - 1; k++) {
    if (homeEndSuffixes.test(tokens[k])) {
      // Don't split inside compound suffixes like "RJ U20", "SP U20", "FC RJ W", "Inter Club dEscaldes"
      if (/^(RJ|SP|MG|PE|BA|CE|FC)$/i.test(tokens[k]) && /^(U20|W|AM|RJ|SP|MG)$/i.test(tokens[k + 1])) {
        continue;
      }
      if (/^Club$/i.test(tokens[k]) && /^(dEscaldes|de|du|da|del|Olimpia|Sando|Atletico)$/i.test(tokens[k + 1])) {
        continue;
      }
      // Disambiguation: if token is FC and followed by known FC-prefixed club like Copenhagen or Lugano
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

  // 3. Check for club prefix in tokens that indicates the START of Away Team
  // e.g. "Bournemouth AC Milan", "Ferencvaros TC SCU Torreense"
  // e.g. "Inter Club dEscaldes CS U Craiova", "Telecom Egypt Baladiyyat AL Mehalla"
  // e.g. "AL Talaba Quwa Al Jawiya", "Club Deportivo Cuenca Juniors Atletico Rojiblanco"
  // e.g. "Borac Banja Luka KuPS Kuopio", "Club Olimpia Cruzeiro EC MG W", "Lincoln FC Twente"
  const awayStartPrefixes = /^(FC|FK|AC|SC|CD|LD|CS|MS|AS|NEC|AZ|SCU|KAA|RB|SL|CSKA|Audax|Ittihad|Ajman|Sanat|Mash|Ramthar|Union|Panathinaikos|DAR|Persib|The|Baladiyyat|Kahroba|Sahl|Tanta|Scolar|Bayer|Hapoel|Rennes|Brighton|Sunderland|Marseille|Hearts|Brann|Quwa|Atletico|Gzira|KuPS|Cruzeiro|Boliviar|Bolivar|Twente|Academia|Nacional)$/i;
  for (let k = 1; k < tokens.length; k++) {
    if (awayStartPrefixes.test(tokens[k])) {
      if (/^FC$/i.test(tokens[k]) && k < 2 && !/^(copenhagen|lugano|porto|basel|zurich)$/i.test(tokens[k + 1])) {
        continue;
      }
      // If prefix is "Club", check if followed by Nacional (Club Nacional Montevideo)
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

  // 4. Check for "Al" / "El" / "EL" as start of away team if home team doesn't start with it
  // or if home team already has 2+ words (e.g. "Al Nasr Cairo El Daklyeh", "Dayrout EL Sekka EL Hadid")
  for (let k = 1; k < tokens.length - 1; k++) {
    if (/^(Al|El|EL)$/i.test(tokens[k])) {
      const homeWords = tokens.slice(0, k);
      const awayWords = tokens.slice(k);
      if (homeWords.length >= 1 && awayWords.length >= 2) {
        // If home already starts with Al (e.g. Al Nasr Cairo), k=3 is the second Al/El
        if (!/^(Al|El|EL)$/i.test(tokens[0]) || homeWords.length >= 2) {
          return { homeTeam: homeWords.join(' '), awayTeam: awayWords.join(' ') };
        }
      }
    }
  }

  // 5. If the line ends with FC / SC / TC / AC / W and has 5-7 tokens (e.g. "Cong Anh Nhan Dan Thanh Hoa FC")
  // Away team is the last 2 or 3 tokens:
  if (/^(FC|SC|TC|AC|W)$/i.test(tokens[tokens.length - 1])) {
    if (tokens.length === 5) {
      // 2 home, 3 away or 3 home, 2 away (e.g. Gia Dinh [2] PHO Hien FC [3], Mega Sport Belqas [3] Tanta FC [2])
      // If word 2 is uppercase like PHO or foreign, or default to 2 + 3
      return {
        homeTeam: tokens.slice(0, 2).join(' '),
        awayTeam: tokens.slice(2).join(' '),
      };
    }
    if (tokens.length === 7) {
      // e.g. "Cong Anh Nhan Dan Thanh Hoa FC" -> 4 home, 3 away
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
 * Robust token-based row parser
 */
function parseSingleFixtureLine(
  line: string,
  defaultCountry: string,
  defaultLeague: string
): ParsedFixtureRow | null {
  // 1. Direct tab-delimited format (from coordinate-based parser)
  if (line.includes('\t')) {
    const cols = line.split('\t').map((c) => c.trim()).filter(Boolean);
    if (cols.length >= 7 && /^\d{3,8}$/.test(cols[0]) && /\d{1,2}:\d{2}/.test(cols[1])) {
      const dateTimeRaw = cols[1];
      const homeTeam = cols[2];
      const awayTeam = cols[3];
      const oddsTokens = cols.slice(4).map(Number).filter((n) => !isNaN(n) && n >= 1.01 && n <= 99.0);

      if (homeTeam && awayTeam && oddsTokens.length >= 3) {
        let dateStr = '';
        let timeStr = '';
        // Match patterns like "22-10-2026 - 14:00", "22/10/2026 14:00", "2026-10-22 14:00", "22-10 14:00"
        const dtMatch = dateTimeRaw.match(/^([0-9\/-]+?)\s*(?:-\s*|\s+)([0-2]?[0-9]:[0-5][0-9])$/);
        if (dtMatch) {
          dateStr = dtMatch[1].trim();
          timeStr = dtMatch[2].trim();
        } else {
          const parts = dateTimeRaw.replace(/\s*-\s*/g, ' ').trim().split(/\s+/);
          dateStr = parts[0] || new Date().toISOString().slice(0, 10);
          timeStr = parts[1] || '18:00';
        }
        const { iso, formatted } = buildEatIso(dateStr, timeStr);

        let country = defaultCountry || 'General';
        let competition = defaultLeague || 'Top League';
        const canon = resolveCanonicalCompetition({
          competition: defaultLeague,
          country: defaultCountry,
        });
        if (canon) {
          if (defaultCountry && !['general', 'other', 'international', ''].includes(defaultCountry.toLowerCase())) {
            country = defaultCountry;
            const canonCountry = (canon.countryName || canon.country || '').toLowerCase();
            if (canonCountry === defaultCountry.toLowerCase() || canon.continent === 'international' || canon.continent === 'european_competitions') {
              competition = canon.name || defaultLeague;
            } else {
              competition = defaultLeague;
            }
          } else {
            country = canon.countryName || canon.country || defaultCountry || 'General';
            competition = canon.name || defaultLeague || 'Top League';
          }
        }
        const directoryId = resolveSportScoreDirectoryId({
          competition,
          country,
        });

        const homeOdds = oddsTokens[0];
        const drawOdds = oddsTokens[1];
        const awayOdds = oddsTokens[2];
        const doubleChance1X = oddsTokens[3];
        const doubleChanceX2 = oddsTokens[4];
        const doubleChance12 = oddsTokens[5];
        let over25Odds = oddsTokens[6];
        let under25Odds = oddsTokens[7];
        let bttsYesOdds = oddsTokens[8];
        let bttsNoOdds = oddsTokens[9];

        if (!over25Odds || !under25Odds) {
          over25Odds = +(1.60 + (homeOdds + awayOdds) * 0.08).toFixed(2);
          under25Odds = +(1 / (1 - 1 / over25Odds) * 0.95).toFixed(2);
        }
        if (!bttsYesOdds || !bttsNoOdds) {
          bttsYesOdds = +(1.65 + Math.abs(homeOdds - awayOdds) * 0.05).toFixed(2);
          bttsNoOdds = +(1 / (1 - 1 / bttsYesOdds) * 0.95).toFixed(2);
        }

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
    }
  }

  // 2. Token-based fallback for freeform / pasted text
  // Normalize pipe and tab delimiters
  let cleanLine = line.replace(/[|\t]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanLine) return null;

  // Normalize "DD-MM-YYYY - HH:mm" into unified "DD-MM-YYYY HH:mm"
  cleanLine = cleanLine.replace(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s*-\s*([012]?\d:[0-5]\d)/, '$1 $2');

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

  // Check if first token is a numeric match ID (e.g. 4729, 5821, #1004) or code
  // Mandate: IGNORE MATCH ID COMPLETELY!
  if (remainingTokens.length > 0 && /^(#?\d{3,8}|MID-\d+)$/i.test(remainingTokens[0])) {
    remainingTokens = remainingTokens.slice(1);
  }

  // Check for date and time
  let dateStr = new Date().toISOString().slice(0, 10);
  let timeStr = '18:00';

  if (remainingTokens.length > 0) {
    if (/^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)$/.test(remainingTokens[0])) {
      dateStr = remainingTokens[0];
      remainingTokens = remainingTokens.slice(1);
    }
  }

  // Discard isolated hyphen if present between date and time
  if (remainingTokens.length > 0 && remainingTokens[0] === '-') {
    remainingTokens = remainingTokens.slice(1);
  }

  if (remainingTokens.length > 0) {
    if (/^([012]?\d:[0-5]\d)$/.test(remainingTokens[0])) {
      timeStr = remainingTokens[0];
      remainingTokens = remainingTokens.slice(1);
    }
  }

  // Teams splitting
  const { homeTeam, awayTeam } = splitTeamTokens(remainingTokens);

  if (!homeTeam || !awayTeam || homeTeam.length < 2 || awayTeam.length < 2) {
    return null;
  }

  // Map odds according to SportPesa columns:
  // [0..2]: 3-WAY (1, X, 2)
  const homeOdds = oddsTokens[0];
  const drawOdds = oddsTokens[1];
  const awayOdds = oddsTokens[2];

  // [3..5]: DOUBLE CHANCE (1X, X2, 12)
  let doubleChance1X = oddsTokens[3];
  let doubleChanceX2 = oddsTokens[4];
  let doubleChance12 = oddsTokens[5];

  if (!doubleChance1X) {
    doubleChance1X = +(1 / (1 / homeOdds + 1 / drawOdds) * 1.05).toFixed(2);
  }
  if (!doubleChanceX2) {
    doubleChanceX2 = +(1 / (1 / drawOdds + 1 / awayOdds) * 1.05).toFixed(2);
  }
  if (!doubleChance12) {
    doubleChance12 = +(1 / (1 / homeOdds + 1 / awayOdds) * 1.05).toFixed(2);
  }

  // [6..7]: OVER / UNDER 2.50
  let over25Odds = oddsTokens.length >= 8 ? oddsTokens[6] : undefined;
  let under25Odds = oddsTokens.length >= 8 ? oddsTokens[7] : undefined;

  // [8..9]: BOTH TEAMS TO SCORE (Yes, No)
  let bttsYesOdds = oddsTokens.length >= 10 ? oddsTokens[8] : undefined;
  let bttsNoOdds = oddsTokens.length >= 10 ? oddsTokens[9] : undefined;

  // Smart fallback if Over/Under or BTTS were omitted in sparse printouts
  if (!over25Odds || !under25Odds) {
    over25Odds = +(1.60 + (homeOdds + awayOdds) * 0.08).toFixed(2);
    under25Odds = +(1 / (1 - 1 / over25Odds) * 0.95).toFixed(2);
  }
  if (!bttsYesOdds || !bttsNoOdds) {
    bttsYesOdds = +(1.65 + Math.abs(homeOdds - awayOdds) * 0.05).toFixed(2);
    bttsNoOdds = +(1 / (1 - 1 / bttsYesOdds) * 0.95).toFixed(2);
  }

  let country = defaultCountry || 'General';
  let competition = defaultLeague || 'Top League';

  const canon = resolveCanonicalCompetition({
    competition: defaultLeague,
    country: defaultCountry,
  });

  if (canon) {
    if (defaultCountry && !['general', 'other', 'international', ''].includes(defaultCountry.toLowerCase())) {
      country = defaultCountry;
      const canonCountry = (canon.countryName || canon.country || '').toLowerCase();
      if (canonCountry === defaultCountry.toLowerCase() || canon.continent === 'international' || canon.continent === 'european_competitions') {
        competition = canon.name || defaultLeague;
      } else {
        competition = defaultLeague;
      }
    } else {
      country = canon.countryName || canon.country || defaultCountry || 'General';
      competition = canon.name || defaultLeague || 'Top League';
    }
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

/**
 * Detects whether a line represents a competition header (e.g. "Vietnam - V-League 2")
 */
function detectCompetitionHeader(line: string): { country: string; league: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Skip match lines (start with digits like 4729 or dates)
  if (/^\d{2,8}\b/.test(trimmed)) return null;

  // Skip document titles, pagination, headers, paybill numbers, and footers
  if (
    /^(sports betting|upcoming games|ke\.sportpesa|sportpesa|page \d|id\s+date|home\s+draw|paybill|safaricom|airtel|legal and compliance|licence|the operator|p\.o\.box|https?:|mailto:)/i.test(
      trimmed
    )
  ) {
    return null;
  }

  // Skip column header lines
  if (/\b(3 way|double chance|over\/under|both teams to score)\b/i.test(trimmed)) {
    return null;
  }

  // 1. Dash or Colon delimiter: "Country - League Name" or "Country: League Name"
  const delimiterMatch = trimmed.match(/^([A-Za-z\s.'&()]+?)\s*[-–—:]\s*([A-Za-z0-9\s.'&(),]+)$/);
  if (delimiterMatch) {
    const country = delimiterMatch[1].trim();
    const league = delimiterMatch[2].trim();
    if (country.length >= 2 && league.length >= 2 && !/\d{2,}/.test(country)) {
      return { country, league };
    }
  }

  // 2. Standard SportPesa delimiter: "Country - League Name"
  const hyphenIdx = trimmed.indexOf(' - ');
  if (hyphenIdx > 1) {
    const country = trimmed.slice(0, hyphenIdx).trim();
    const league = trimmed.slice(hyphenIdx + 3).trim();
    if (country.length >= 2 && league.length >= 2 && !/\d{2,}/.test(country)) {
      return { country, league };
    }
  }

  // 3. Colon delimiter: "Country: League Name"
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx > 1) {
    const country = trimmed.slice(0, colonIdx).trim();
    const league = trimmed.slice(colonIdx + 1).trim();
    if (country.length >= 2 && league.length >= 2 && !/\d{2,}/.test(country)) {
      return { country, league };
    }
  }

  // 4. Country-only line
  const countryOnlyRegex = /^(ENGLAND|SPAIN|ITALY|GERMANY|FRANCE|NETHERLANDS|PORTUGAL|SCOTLAND|TURKEY|BELGIUM|KENYA|SOUTH AFRICA|BRAZIL|ARGENTINA|USA|INTERNATIONAL|UEFA|BAHRAIN|JORDAN|VIETNAM|MONTENEGRO|PANAMA|ESTONIA|QATAR|SAUDI ARABIA)$/i;
  if (countryOnlyRegex.test(trimmed)) {
    return { country: trimmed, league: 'Top League' };
  }

  return null;
}

export function parseFixturesText(rawText: string): ParseFixturesResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const parsedRows: ParsedFixtureRow[] = [];
  const warnings: string[] = [];

  let currentCountry = 'General';
  let currentLeague = 'Top League';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const compHeader = detectCompetitionHeader(line);
    if (compHeader) {
      currentCountry = compHeader.country;
      currentLeague = compHeader.league;
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
