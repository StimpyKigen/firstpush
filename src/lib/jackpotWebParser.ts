export interface ParsedWebMatch {
  home: string;
  away: string;
  competition: string;
  kickoff: string;
  homePct: number;
  drawPct: number;
  awayPct?: number;
}

const COMMON_LEAGUES = [
  'English Premier League', 'Premier League', 'EPL', 'Championship', 'League One', 'League Two', 'FA Cup',
  'Spanish La Liga', 'La Liga', 'Primera Division', 'Copa del Rey', 'Segunda Division',
  'Italian Serie A', 'Serie A', 'Coppa Italia', 'Serie B',
  'German Bundesliga', 'Bundesliga', 'DFB Pokal', '2. Bundesliga',
  'French Ligue 1', 'Ligue 1', 'Coupe de France',
  'UEFA Champions League', 'Champions League', 'Europa League', 'Conference League',
  'CAF Champions League', 'CAF Confed Cup', 'African Nations Championship', 'AFCON',
  'Netherlands Eredivisie', 'Eredivisie', 'Portugal Primeira Liga', 'Primeira Liga',
  'Turkey Super Lig', 'Super Lig', 'MLS', 'Major League Soccer', 'Saudi Pro League',
  'Brazil Serie A', 'Brasileirao', 'Argentine Primera', 'Belgian Pro League',
  'Scottish Premiership', 'Swiss Super League', 'Austrian Bundesliga',
];

const NOISE_WORDS = new RegExp(
  '^(' +
  [
    'login', 'log in', 'register', 'sign up', 'deposit', 'withdraw', 'betslip', 'bet slip',
    'jackpot', 'mega jackpot', 'midweek jackpot', 'super grand', 'grand jackpot', 'toto',
    'rules', 'terms', 'privacy', 'help', 'faq', 'support', 'live chat', 'casino', 'virtuals',
    'promotions', 'bonus', 'menu', 'navigation', 'search', 'results', 'standings', 'home',
    'draw', 'away', 'odds', 'min stake', 'max payout', 'ksh', 'kes', 'ugx', 'tzs', 'usd',
    'pick your', 'select all', 'auto pick', 'clear all', 'share', 'print', 'download',
    'cookie', 'all rights reserved', 'licence', 'bclb', '18\\+', 'gamble responsibly'
  ].join('|') +
  ')(?:[\\s\\d:._-]*)$',
  'i'
);

function cleanTeamName(name: string): string {
  return name
    .replace(/^(\d+[\.\)\-:]\s*)/, '') // remove leading leg numbers like 1. or 1)
    .replace(/\b(\d+\.\d{2})\b/g, '') // remove decimal odds like 1.95
    .replace(/[\[\]\(\)\{\}]/g, '') // strip brackets
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKickoff(str: string, fallback: string): string {
  // Matches e.g. "2026-10-24 17:00", "24/10/2026 17:00", "24/10 17:00", "24-10 17:00", "Sat 17:00"
  const datePattern = /(?:(?:(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/.](?:\d{1,2}|[a-zA-Z]{3})(?:[-/.]\d{2,4})?)|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*)\s*[,·-]?\s*)?(\d{1,2}:\d{2}(?:\s*(?:AM|PM|EAT|UTC))?)/i;
  const match = str.match(datePattern);
  if (match) {
    return match[0].trim();
  }
  return fallback;
}

export function parseJackpotWebpageText(
  rawText: string,
  targetLegs = 17,
  defaultKickoff = 'Sat 17:00 EAT'
): ParsedWebMatch[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !NOISE_WORDS.test(l));

  const matches: ParsedWebMatch[] = [];

  // Strategy 1: Look for explicit "Home vs Away" or "Home - Away" or "Home v Away" lines
  const vsRegex = /^(?:(?:Leg|Game|Match|#)?\s*(\d{1,2})[\.\)\-:\s]*)?(.+?)\s+(?:vs\.?|v\.?|-|–|—)\s+(.+?)(?:\s+(?:1|X|2|\d+\.\d{2}).*)?$/i;

  let currentCompetition = 'Football League';
  let currentKickoff = defaultKickoff;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line indicates a competition/league
    const foundLeague = COMMON_LEAGUES.find((lg) =>
      new RegExp(`\\b${lg.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(line)
    );
    if (foundLeague) {
      currentCompetition = foundLeague;
    }

    // Check if line contains kickoff time
    const extractedTime = extractKickoff(line, '');
    if (extractedTime && !line.includes('vs') && !line.includes(' - ')) {
      currentKickoff = extractedTime;
    }

    // Check for match line
    const matchMatch = line.match(vsRegex);
    if (matchMatch) {
      const homeRaw = matchMatch[2];
      const awayRaw = matchMatch[3];

      const home = cleanTeamName(homeRaw);
      const away = cleanTeamName(awayRaw);

      // Validate they look like team names (at least 2 letters, not purely numbers or odds)
      if (
        home.length >= 2 &&
        away.length >= 2 &&
        !/^\d+$/.test(home) &&
        !/^\d+$/.test(away) &&
        !NOISE_WORDS.test(home) &&
        !NOISE_WORDS.test(away)
      ) {
        // Look for odds on same line or next line
        const oddsPattern = /(\d+\.\d{2})\s+(\d+\.\d{2})\s+(\d+\.\d{2})/;
        const lineWithOdds = [line, lines[i + 1] || ''].join(' ');
        const oddsMatch = lineWithOdds.match(oddsPattern);

        let homePct = 45;
        let drawPct = 30;
        let awayPct = 25;

        if (oddsMatch) {
          const hOdds = parseFloat(oddsMatch[1]);
          const dOdds = parseFloat(oddsMatch[2]);
          const aOdds = parseFloat(oddsMatch[3]);
          if (hOdds > 0 && dOdds > 0 && aOdds > 0) {
            const rawH = 1 / hOdds;
            const rawD = 1 / dOdds;
            const rawA = 1 / aOdds;
            const sum = rawH + rawD + rawA;
            homePct = Math.round((rawH / sum) * 100);
            drawPct = Math.round((rawD / sum) * 100);
            awayPct = 100 - homePct - drawPct;
          }
        }

        // Inline date check
        const inlineKickoff = extractKickoff(line, currentKickoff);

        matches.push({
          home,
          away,
          competition: currentCompetition,
          kickoff: inlineKickoff || currentKickoff,
          homePct,
          drawPct,
          awayPct,
        });

        if (matches.length >= targetLegs) break;
      }
    }
  }

  // Strategy 2: If Strategy 1 found fewer matches, check for consecutive multi-line table layouts:
  // e.g.:
  // Line 1: Team A
  // Line 2: Team B
  if (matches.length < targetLegs) {
    for (let i = 0; i < lines.length - 1; i++) {
      if (matches.length >= targetLegs) break;
      const l1 = cleanTeamName(lines[i]);
      const l2 = cleanTeamName(lines[i + 1]);

      if (
        l1.length >= 3 &&
        l2.length >= 3 &&
        !NOISE_WORDS.test(l1) &&
        !NOISE_WORDS.test(l2) &&
        !/^\d+$/.test(l1) &&
        !/^\d+$/.test(l2) &&
        !matches.some((m) => m.home === l1 && m.away === l2)
      ) {
        // Check if next line has a league or date
        const possibleMeta = lines[i + 2] || '';
        const comp = COMMON_LEAGUES.find((lg) => possibleMeta.toLowerCase().includes(lg.toLowerCase())) || currentCompetition;
        const kickoff = extractKickoff(possibleMeta, currentKickoff);

        matches.push({
          home: l1,
          away: l2,
          competition: comp,
          kickoff: kickoff || currentKickoff,
          homePct: 45,
          drawPct: 30,
          awayPct: 25,
        });
        i += 2; // skip forward
      }
    }
  }

  return matches.slice(0, targetLegs);
}

