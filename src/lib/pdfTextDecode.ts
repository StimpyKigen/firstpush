/**
 * Shared PDF text-string decoding helpers (used by both the browser and server extractors).
 *
 * Fixes three classes of corruption that previously produced names like "Sheeld Utd":
 *  1. Typographic ligature glyphs (U+FB00..FB06, e.g. "ﬀ" in "Sheffield") were dropped
 *     because only ASCII code points were kept.
 *  2. Escaped bytes inside literal strings (e.g. "\(", "\)", "\\") were not unescaped before
 *     UTF-16BE decoding, shifting byte pairs and mangling the rest of the string.
 *  3. Non-ASCII letters (accents) were dropped, and UTF-8 text that was double-encoded in the
 *     source ("LimpeÃ±o") was not repaired.
 */

/** Matches a PDF literal string `( ... )`, honouring backslash escapes. Group 1 is the raw body. */
export const PDF_LITERAL_STRING_SOURCE = '\\(((?:\\\\[\\s\\S]|[^\\\\)])*)\\)';

const LIGATURES: Record<number, string> = {
  0xfb00: 'ff',
  0xfb01: 'fi',
  0xfb02: 'fl',
  0xfb03: 'ffi',
  0xfb04: 'ffl',
  0xfb05: 'st',
  0xfb06: 'st',
};

/** Resolves PDF literal-string escapes into raw byte characters (one char per byte). */
export function unescapePdfLiteralBytes(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = raw[i + 1];
    if (next === undefined) break;
    if (next >= '0' && next <= '7') {
      let oct = next;
      let j = i + 2;
      while (j < raw.length && oct.length < 3 && raw[j] >= '0' && raw[j] <= '7') {
        oct += raw[j];
        j++;
      }
      out += String.fromCharCode(parseInt(oct, 8) & 0xff);
      i = j - 1;
      continue;
    }
    i++;
    switch (next) {
      case 'n': out += '\n'; break;
      case 'r': out += '\r'; break;
      case 't': out += '\t'; break;
      case 'b': out += '\b'; break;
      case 'f': out += '\f'; break;
      case '\r':
        if (raw[i + 1] === '\n') i++;
        break; // line continuation
      case '\n':
        break; // line continuation
      default: out += next; // \( \) \\ and unknown escapes
    }
  }
  return out;
}

/** Repairs UTF-8 text that was decoded as Latin-1 (e.g. "LimpeÃ±o" -> "Limpeño"). */
function repairMojibake(s: string): string {
  if (!/[\u00c2-\u00f4][\u0080-\u00bf]/.test(s)) return s;
  return s.replace(/[\u00c2-\u00f4][\u0080-\u00bf]{1,3}/g, (seq) => {
    try {
      const bytes = Uint8Array.from(Array.from(seq).map((c) => c.charCodeAt(0)));
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return seq;
    }
  });
}

/** Expands ligatures, normalises odd whitespace/quotes and repairs mojibake. */
export function normalizeExtractedText(input: string): string {
  let s = input;
  s = s.replace(/[\ufb00-\ufb06]/g, (c) => LIGATURES[c.charCodeAt(0)] ?? c);
  s = repairMojibake(s);
  s = s
    .replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
    .replace(/[\u200b-\u200d\u2060\ufeff\u00ad]/g, '')
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  return s.normalize('NFC');
}

/** Decodes a PDF literal-string body (the text between the parentheses). */
export function decodePdfLiteralBody(body: string): string {
  let s = unescapePdfLiteralBytes(body);
  if (s.length >= 2 && s.charCodeAt(0) === 0xfe && s.charCodeAt(1) === 0xff) {
    s = s.slice(2);
  }

  const looksUtf16 =
    s.includes('\0') || (s.length >= 2 && s.length % 2 === 0 && s.charCodeAt(0) === 0);
  if (looksUtf16) {
    let decoded = '';
    for (let i = 0; i < s.length; i += 2) {
      const code = (s.charCodeAt(i) << 8) | (i + 1 < s.length ? s.charCodeAt(i + 1) : 0);
      if (code === 10 || code === 13 || code === 9) decoded += ' ';
      else if (code >= 32) decoded += String.fromCharCode(code);
    }
    return normalizeExtractedText(decoded).trim();
  }

  // Single-byte string: prefer UTF-8 when it is valid, otherwise Latin-1.
  const bytes = Uint8Array.from(Array.from(s).map((c) => c.charCodeAt(0) & 0xff));
  let text = s;
  if (/[\u0080-\u00ff]/.test(s)) {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      text = s;
    }
  }
  return normalizeExtractedText(text.replace(/\r|\n|\t/g, ' ')).trim();
}

/** Decodes a PDF hex string body (the text between the angle brackets). */
export function decodePdfHexBody(hex: string): string {
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
    if (isUtf16 && decoded.trim()) return normalizeExtractedText(decoded).trim();
  }

  let result = '';
  for (let i = 0; i < clean.length; i += 2) {
    const code = parseInt(clean.slice(i, i + 2), 16);
    if (!isNaN(code) && code >= 32) result += String.fromCharCode(code);
  }
  return normalizeExtractedText(result).trim();
}

export interface PdfTextItem {
  x: number;
  y: number;
  text: string;
}

export const decodePdfLiteralString = decodePdfLiteralBody;
export const decodePdfHexString = decodePdfHexBody;

/**
 * Reconstructs logical lines/rows from a PDF BT...ET content stream using (x, y) coordinates.
 * Multi-column rows (>=4 cells) are tab-delimited to preserve tabular fixture structure.
 */
export function parseCoordinateTextStream(content: string): string {
  const btRegex = /BT([\s\S]*?)ET/g;
  let btMatch: RegExpExecArray | null;
  const items: PdfTextItem[] = [];

  while ((btMatch = btRegex.exec(content)) !== null) {
    const block = btMatch[1];
    const tdMatch = /(?:([\d.-]+)\s+([\d.-]+)\s+Td|[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+([\d.-]+)\s+([\d.-]+)\s+Tm)/.exec(block);
    const x = tdMatch ? parseFloat(tdMatch[1] ?? tdMatch[3] ?? '0') : 0;
    const y = tdMatch ? parseFloat(tdMatch[2] ?? tdMatch[4] ?? '0') : 0;

    const tjMatch = new RegExp(PDF_LITERAL_STRING_SOURCE + '\\s*(?:Tj|\'|")').exec(block);
    if (tjMatch) {
      const decoded = decodePdfLiteralBody(tjMatch[1]);
      if (decoded) {
        items.push({ x, y, text: decoded });
      }
      continue;
    }

    const hexMatch = /<([0-9a-fA-F\s]+)>\s*(?:Tj|'|")/.exec(block);
    if (hexMatch) {
      const decoded = decodePdfHexBody(hexMatch[1]);
      if (decoded) {
        items.push({ x, y, text: decoded });
      }
    }
  }

  if (items.length === 0) return '';

  items.sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: { y: number; items: PdfTextItem[] }[] = [];
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

export function isBinaryGarbage(text: string): boolean {
  if (!text || text.length === 0) return true;
  const nonAsciiCount = (text.match(/[^\x20-\x7E\t\r\n]/g) || []).length;
  return nonAsciiCount / text.length > 0.3;
}
