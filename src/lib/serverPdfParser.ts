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

export const MAX_PDF_BASE64_CHARS = 14 * 1024 * 1024;
export const MAX_PDF_INPUT_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_STREAMS = 500;
export const MAX_DECOMPRESSED_STREAM_BYTES = 2 * 1024 * 1024;
export const MAX_TOTAL_DECOMPRESSED_BYTES = 10 * 1024 * 1024;
export const MAX_EXTRACTED_TEXT_CHARS = 500_000;

export class PdfParseSecurityError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'PdfParseSecurityError';
    this.statusCode = statusCode;
  }
}

export function decodePdfBase64Payload(base64: unknown): Buffer {
  if (typeof base64 !== 'string' || !base64.trim()) {
    throw new PdfParseSecurityError('base64 PDF data is required.');
  }
  const normalized = base64.replace(/^data:application\/pdf;base64,/i, '').trim();
  if (!normalized) {
    throw new PdfParseSecurityError('base64 PDF data is required.');
  }
  if (normalized.length > MAX_PDF_BASE64_CHARS) {
    throw new PdfParseSecurityError('PDF upload exceeds maximum allowed payload size (10 MB).');
  }
  const buffer = Buffer.from(normalized, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_PDF_INPUT_BYTES) {
    throw new PdfParseSecurityError('PDF payload exceeds maximum allowed size (10 MB) or is empty.');
  }
  return buffer;
}

function isZlibLimitError(err: any): boolean {
  return Boolean(
    err &&
      (err.code === 'ERR_BUFFER_TOO_LARGE' ||
        err.code === 'ERR_ZLIB_INITIALIZATION_FAILED' ||
        /Cannot create a Buffer larger than|maxOutputLength/i.test(String(err.message || '')))
  );
}

function decompressPdfStream(streamBytes: Buffer, isFlate: boolean): Buffer | null {
  try {
    return zlib.inflateSync(streamBytes, { maxOutputLength: MAX_DECOMPRESSED_STREAM_BYTES });
  } catch (inflateErr: any) {
    if (isZlibLimitError(inflateErr)) {
      throw new PdfParseSecurityError('PDF stream exceeds maximum decompressed size limit.');
    }
    try {
      return zlib.inflateRawSync(streamBytes, { maxOutputLength: MAX_DECOMPRESSED_STREAM_BYTES });
    } catch (rawErr: any) {
      if (isZlibLimitError(rawErr)) {
        throw new PdfParseSecurityError('PDF stream exceeds maximum decompressed size limit.');
      }
      if (!isFlate) {
        if (streamBytes.length > MAX_DECOMPRESSED_STREAM_BYTES) {
          throw new PdfParseSecurityError('Uncompressed PDF stream exceeds maximum size limit.');
        }
        return streamBytes;
      }
      return null;
    }
  }
}

export function extractPdfPagesServer(pdfBuffer: Buffer): ExtractedPdfPage[] {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new PdfParseSecurityError('Empty or invalid PDF buffer.');
  }
  if (pdfBuffer.length > MAX_PDF_INPUT_BYTES) {
    throw new PdfParseSecurityError('PDF exceeds maximum allowed input size (10 MB).');
  }
  const headerSlice = pdfBuffer.subarray(0, Math.min(pdfBuffer.length, 1024)).toString('latin1');
  if (!headerSlice.includes('%PDF-')) {
    throw new PdfParseSecurityError('Invalid file signature: missing %PDF- header.');
  }

  const latin1 = pdfBuffer.toString('latin1');
  const pages: ExtractedPdfPage[] = [];

  let pos = 0;
  let pageIndex = 1;
  let streamCount = 0;
  let totalDecompressedBytes = 0;
  let totalExtractedChars = 0;

  while ((pos = latin1.indexOf('stream', pos)) !== -1) {
    // Ensure 'stream' is an actual keyword (preceded by \n, \r, or >)
    if (pos > 0 && !/[\r\n>]/.test(latin1[pos - 1])) {
      pos += 6;
      continue;
    }

    streamCount += 1;
    if (streamCount > MAX_PDF_STREAMS) {
      throw new PdfParseSecurityError('PDF exceeds maximum allowed stream count.');
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
      const decompressed = decompressPdfStream(streamBytes, dict.includes('/FlateDecode'));

      if (decompressed) {
        totalDecompressedBytes += decompressed.length;
        if (totalDecompressedBytes > MAX_TOTAL_DECOMPRESSED_BYTES) {
          throw new PdfParseSecurityError('PDF exceeds cumulative decompression byte budget.');
        }

        const content = decompressed.toString('latin1');
        if (content.includes('BT') && content.includes('ET')) {
          const pageText = parseCoordinateTextStream(content);
          if (pageText.trim()) {
            totalExtractedChars += pageText.length;
            if (totalExtractedChars > MAX_EXTRACTED_TEXT_CHARS) {
              throw new PdfParseSecurityError('Extracted PDF text exceeds maximum allowed length.');
            }
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
