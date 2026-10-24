/**
 * Server-side Zero-Dependency PDF Stream Extractor
 * Uses Node.js native built-in 'zlib' to decompress content streams,
 * decode UTF-16BE text literals, and reconstruct tabular rows using (x, y) coordinates.
 */

import zlib from 'zlib';
import {
  PDF_LITERAL_STRING_SOURCE,
  decodePdfLiteralBody,
  decodePdfHexBody,
} from './pdfTextDecode';

interface TextItem {
  x: number;
  y: number;
  text: string;
}

export interface ExtractedPdfPage {
  pageNumber: number;
  text: string;
  lines: string[];
}

export function extractPdfPagesServer(pdfBuffer: Buffer): ExtractedPdfPage[] {
  const latin1 = pdfBuffer.toString('latin1');
  const pages: ExtractedPdfPage[] = [];

  let pos = 0;
  let pageIndex = 1;
  while ((pos = latin1.indexOf('stream', pos)) !== -1) {
    // Ensure 'stream' is an actual keyword (preceded by \n, \r, or >)
    if (pos > 0 && !/[\r\n>]/.test(latin1[pos - 1])) {
      pos += 6;
      continue;
    }

    const dictStart = latin1.lastIndexOf('<<', pos);
    const dict = dictStart !== -1 ? latin1.slice(dictStart, pos) : '';

    // Skip font streams (e.g. /Length1 TrueType binary fonts)
    if (dict.includes('/Length1')) {
      const skipEnd = latin1.indexOf('endstream', pos);
      pos = skipEnd !== -1 ? skipEnd + 9 : pos + 6;
      continue;
    }

    // Skip past stream keyword and trailing newline (\r\n or \n)
    let streamStart = pos + 6;
    if (streamStart < latin1.length && latin1[streamStart] === '\r') streamStart++;
    if (streamStart < latin1.length && latin1[streamStart] === '\n') streamStart++;

    // Locate matching 'endstream'
    const endPos = latin1.indexOf('endstream', streamStart);
    if (endPos === -1) break;

    let streamEnd = endPos;
    while (streamEnd > streamStart && (latin1[streamEnd - 1] === '\n' || latin1[streamEnd - 1] === '\r')) {
      streamEnd--;
    }

    const streamBytes = pdfBuffer.subarray(streamStart, streamEnd);
    if (streamBytes.length > 0) {
      let decompressed: Buffer | null = null;
      try {
        decompressed = zlib.inflateSync(streamBytes);
      } catch {
        try {
          decompressed = zlib.inflateRawSync(streamBytes);
        } catch {
          // Stream might be uncompressed
          if (!dict.includes('/FlateDecode')) {
            decompressed = streamBytes;
          }
        }
      }

      if (decompressed) {
        const content = decompressed.toString('latin1');
        if (content.includes('BT') && content.includes('ET')) {
          const pageText = parseCoordinateTextStream(content);
          if (pageText.trim()) {
            const pageLines = pageText
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean);
            pages.push({
              pageNumber: pageIndex++,
              text: pageText.trim(),
              lines: pageLines,
            });
          }
        }
      }
    }

    pos = endPos + 9;
  }

  return pages;
}

export function extractPdfTextServer(pdfBuffer: Buffer): string {
  const pages = extractPdfPagesServer(pdfBuffer);
  return pages.map((p) => p.text).join('\n--- PAGE BREAK ---\n');
}

/**
 * Extracts and reconstructs text lines grouped by y-coordinate and ordered by x-coordinate.
 * Uses tab delimiter between distinct columns to preserve table layout.
 */
function parseCoordinateTextStream(content: string): string {
  const btRegex = /BT([\s\S]*?)ET/g;
  let btMatch: RegExpExecArray | null;
  const items: TextItem[] = [];

  while ((btMatch = btRegex.exec(content)) !== null) {
    const block = btMatch[1];
    const tdMatch = /(?:([\d.-]+)\s+([\d.-]+)\s+Td|[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+([\d.-]+)\s+([\d.-]+)\s+Tm)/.exec(block);
    const x = tdMatch ? parseFloat(tdMatch[1] ?? tdMatch[3] ?? '0') : 0;
    const y = tdMatch ? parseFloat(tdMatch[2] ?? tdMatch[4] ?? '0') : 0;

    // Match ( ... ) Tj or < ... > Tj
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

  // Sort top-to-bottom (descending y), then left-to-right (ascending x)
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
    // If it looks like a match row with multiple columns, join with tabs
    const isMultiColumn = row.items.length >= 4;
    const rowText = row.items.map((it) => it.text).join(isMultiColumn ? '\t' : ' ');
    if (rowText.trim()) {
      lines.push(rowText.trim());
    }
  }

  return lines.join('\n');
}

/**
 * Decodes PDF literal string, handling UTF-16BE (with or without BOM) and standard ASCII escapes.
 */
export function decodePdfLiteralString(str: string): string {
  return decodePdfLiteralBody(str);
}

export function decodeHexPdfString(hex: string): string {
  return decodePdfHexBody(hex);
}

export function isBinaryGarbage(text: string): boolean {
  if (!text || text.length === 0) return true;
  const nonAsciiCount = (text.match(/[^\x20-\x7E\t\r\n]/g) || []).length;
  return nonAsciiCount / text.length > 0.3;
}
