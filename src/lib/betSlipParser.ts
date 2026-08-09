export interface ParsedSlipSelection {
  fixture: string;
  pick: string;
}

export interface ParsedSlip {
  id: string;
  bookmaker: string;
  title: string;
  sourceUrl: string;
  summary: string;
  selections: ParsedSlipSelection[];
  note?: string;
  fetchedAt: string;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function sanitizeText(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripScriptsAndStyles(html: string) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
}

function isNoiseLine(line: string) {
  const normalized = normalizeText(line).toLowerCase();
  return /^(cookie|privacy|terms|login|sign in|register|bet slip|coupon|odds|stake|bonus|deposit|withdraw|help|faq|live)$/i.test(normalized);
}

function collectVisibleLines(html: string) {
  const cleaned = stripScriptsAndStyles(html);

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(cleaned, 'text/html');
    const nodes = Array.from(doc.querySelectorAll('p, li, div, span, h1, h2, h3, button, strong, b, td, tr, th, label, option'));
    const lines = nodes
      .map((node) => normalizeText(node.textContent ?? ''))
      .filter((value): value is string => Boolean(value && value.length > 1))
      .filter((line) => !isNoiseLine(line));

    return Array.from(new Set(lines));
  }

  const withoutTags = cleaned
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n')
    .replace(/<h[1-6][^>]*>/gi, '\n')
    .replace(/<section[^>]*>/gi, '\n')
    .replace(/<article[^>]*>/gi, '\n');

  return sanitizeText(withoutTags)
    .replace(/\s*\n\s*/g, '\n')
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .filter((line) => !isNoiseLine(line));
}

function extractTitle(html: string, fallback: string) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) return sanitizeText(titleMatch[1]);

  const metaMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)['"]/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)['"][^>]+name=["']title["']/i);

  if (metaMatch?.[1]) return sanitizeText(metaMatch[1]);

  return fallback;
}

function extractBookmaker(url: string, content: string) {
  const combined = `${url} ${content}`.toLowerCase();
  if (combined.includes('betika')) return 'Betika';
  if (combined.includes('sportpesa')) return 'SportPesa';
  if (combined.includes('odibets')) return 'Odibets';
  if (combined.includes('mozzart')) return 'Mozzart';
  return 'Bookmaker';
}

function inferPickLabel(line: string) {
  const normalized = normalizeText(line).toLowerCase();

  if (/(double chance|1x|x2|12)/.test(normalized)) return 'Double chance';
  if (/\bhome win\b/.test(normalized)) return 'Home win';
  if (/\baway win\b/.test(normalized)) return 'Away win';
  if (/draw no bet|dnb/.test(normalized)) return 'Draw no bet';
  if (/(btts|both teams to score|both teams)/.test(normalized)) return 'Both teams to score';
  if (/over\s*(\d+(?:\.\d+)?)/.test(normalized)) return `Over ${normalized.match(/over\s*(\d+(?:\.\d+)?)/)?.[1] ?? ''}`.trim();
  if (/under\s*(\d+(?:\.\d+)?)/.test(normalized)) return `Under ${normalized.match(/under\s*(\d+(?:\.\d+)?)/)?.[1] ?? ''}`.trim();
  if (/\bdraw\b/.test(normalized) && !/(double chance|1x|x2|12|home win|away win)/.test(normalized)) return 'Draw';
  if (/(^|\s)(yes|no)(\s|$)/.test(normalized) && /btts|both teams to score/.test(normalized)) return 'No BTTS';

  return null;
}

function looksLikeFixture(line: string) {
  const trimmed = normalizeText(line);
  if (!trimmed) return false;
  if (/^(home|away|draw|double chance|both teams to score|btts|draw no bet|over|under|1x|x2|12|1|x|2|yes|no)$/i.test(trimmed)) return false;
  if (/\bvs\b|\bv\b|\bv\.\b|\bagainst\b|\b-\b|\//.test(trimmed)) return true;
  if (trimmed.split(' ').length <= 12 && /[A-Za-z]{3,}/.test(trimmed)) return true;
  return false;
}

function cleanFixtureText(line: string, pick: string) {
  const withoutPick = normalizeText(line)
    .replace(new RegExp(pick.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
    .replace(/\b(home win|away win|draw no bet|double chance|both teams to score|btts|draw|over|under|1x|x2|12)\b/gi, '')
    .replace(/[:•-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return withoutPick && withoutPick.length < 140 ? withoutPick : normalizeText(line);
}

export function extractSelections(content: string) {
  const lines = content
    .split(/\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .filter((line) => !isNoiseLine(line));

  const matches: ParsedSlipSelection[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const previousLine = lines[index - 1] ?? '';
    const nextLine = lines[index + 1] ?? '';
    const pickFromLine = inferPickLabel(line);
    const pickFromNextLine = inferPickLabel(nextLine);

    if (pickFromLine && looksLikeFixture(previousLine)) {
      matches.push({ fixture: cleanFixtureText(previousLine, pickFromLine), pick: pickFromLine });
      continue;
    }

    if (pickFromLine && looksLikeFixture(line)) {
      matches.push({ fixture: cleanFixtureText(line, pickFromLine), pick: pickFromLine });
      continue;
    }

    if (looksLikeFixture(line) && pickFromNextLine) {
      matches.push({ fixture: cleanFixtureText(line, pickFromNextLine), pick: pickFromNextLine });
      index += 1;
    }
  }

  if (matches.length === 0) {
    return lines.slice(0, 6).map((line) => ({ fixture: line, pick: 'Visible pick' }));
  }

  return matches.slice(0, 6);
}

export function extractCleanUrl(input: string): {
  cleanUrl: string;
  extractedPrefix: string;
  isUrlMatch: boolean;
} {
  const trimmed = input.trim();
  if (!trimmed) {
    return { cleanUrl: '', extractedPrefix: '', isUrlMatch: false };
  }

  // 1. Check for standard https:// or http:// anywhere in the text
  const httpMatch = trimmed.match(/(https?:\/\/[^\s]+)/i);
  if (httpMatch && httpMatch.index !== undefined) {
    const cleanUrl = httpMatch[0];
    const prefix = trimmed.substring(0, httpMatch.index).replace(/[:,-]+$/, '').trim();
    return { cleanUrl, extractedPrefix: prefix, isUrlMatch: true };
  }

  // 2. Check for www. domain patterns anywhere in the text
  const wwwMatch = trimmed.match(/(www\.[^\s]+)/i);
  if (wwwMatch && wwwMatch.index !== undefined) {
    const cleanUrl = `https://${wwwMatch[0]}`;
    const prefix = trimmed.substring(0, wwwMatch.index).replace(/[:,-]+$/, '').trim();
    return { cleanUrl, extractedPrefix: prefix, isUrlMatch: true };
  }

  // 3. Check for common domain patterns like betika.com/..., sportpesa.com/..., 22bet.com/...
  const domainMatch = trimmed.match(/((?:[a-zA-Z0-9-]+\.)+(?:com|co\.ke|net|org|bet|app|site|io)\/[^\s]*)/i);
  if (domainMatch && domainMatch.index !== undefined) {
    const cleanUrl = `https://${domainMatch[0]}`;
    const prefix = trimmed.substring(0, domainMatch.index).replace(/[:,-]+$/, '').trim();
    return { cleanUrl, extractedPrefix: prefix, isUrlMatch: true };
  }

  return { cleanUrl: trimmed, extractedPrefix: '', isUrlMatch: false };
}

function normalizeUrl(rawUrl: string) {
  const { cleanUrl, isUrlMatch } = extractCleanUrl(rawUrl);
  if (!cleanUrl) throw new Error('Please paste a public slip link.');
  if (isUrlMatch && !/^https?:\/\//i.test(cleanUrl)) {
    return `https://${cleanUrl}`;
  }
  return cleanUrl;
}

function toProxyUrl(url: string) {
  const cleaned = url.trim();
  if (cleaned.startsWith('https://')) {
    return `https://r.jina.ai/http://https://${cleaned.replace(/^https:\/\//i, '')}`;
  }
  if (cleaned.startsWith('http://')) {
    return `https://r.jina.ai/http://${cleaned.replace(/^http:\/\//i, '')}`;
  }
  return `https://r.jina.ai/http://${cleaned}`;
}

export async function fetchBetSlip(url: string): Promise<ParsedSlip> {
  const normalized = normalizeUrl(url);
  const proxyUrl = toProxyUrl(normalized);

  const response = await fetch(proxyUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,text/plain',
    },
  });

  if (!response.ok) {
    throw new Error('The link could not be reached. Try a public Betika slip URL or a page that is not behind a login wall.');
  }

  const html = await response.text();
  const visibleText = collectVisibleLines(html).join('\n');
  const title = extractTitle(html, 'Bet slip preview');
  const bookmaker = extractBookmaker(normalized, visibleText);
  const selections = extractSelections(visibleText);
  const summary = selections.length > 0
    ? `${bookmaker} slip with ${selections.length} visible picks extracted from the linked page.`
    : `${bookmaker} slip was fetched, but the page did not expose enough visible pick data.`;

  return {
    id: `room-${Date.now().toString(36)}`,
    bookmaker,
    title,
    sourceUrl: normalized,
    summary,
    selections,
    note: visibleText.length > 320 ? `${visibleText.slice(0, 320)}…` : visibleText,
    fetchedAt: new Date().toLocaleString(),
  };
}
