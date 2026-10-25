import { getFreeMatchesSnapshot } from './freeMatches';
import type { MatchStatus } from './matchStatus';

export interface BuilderFixture {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoff: string;
  status?: MatchStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  homeOdds?: number;
  drawOdds?: number;
  awayOdds?: number;
  bookmaker?: string;
  // Probabilities for market odds generation
  homeProb: number;
  drawProb: number;
  awayProb: number;
  bttsYesPct?: number;
  over15Pct?: number;
  over25Pct?: number;
  over35Pct?: number;
}

export function getCombinedBuilderFixtures(): BuilderFixture[] {
  const freeSnap = getFreeMatchesSnapshot();
  // Keep betting interface focused on eligible upcoming and live events (filter out completed)
  return freeSnap
    .filter((m) => m.status !== 'post')
    .map((m) => {
      const hOdds = m.homeOdds || 2.00;
      const dOdds = m.drawOdds || 3.30;
      const aOdds = m.awayOdds || 3.80;
      return {
        id: m.id,
        homeTeam: m.home,
        awayTeam: m.away,
        competition: m.competition,
        kickoff: m.kickoff,
        status: m.status,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        homeOdds: hOdds,
        drawOdds: dOdds,
        awayOdds: aOdds,
        bookmaker: m.bookmaker || 'Market Consensus',
        homeProb: m.homePct ? +(m.homePct / 100).toFixed(2) : +(1 / hOdds).toFixed(2),
        drawProb: m.drawPct ? +(m.drawPct / 100).toFixed(2) : +(1 / dOdds).toFixed(2),
        awayProb: m.awayPct ? +(m.awayPct / 100).toFixed(2) : +(1 / aOdds).toFixed(2),
        bttsYesPct: m.bttsYesPct,
        over15Pct: m.over15Pct,
        over25Pct: m.over25Pct,
        over35Pct: m.over35Pct,
      };
    });
}

// Calculate realistic odds for various markets based on real bookmaker odds or model probabilities
export function generateOddsForFixture(f: BuilderFixture) {
  const homeOdds = f.homeOdds || +(1.07 / f.homeProb).toFixed(2);
  const drawOdds = f.drawOdds || +(1.07 / f.drawProb).toFixed(2);
  const awayOdds = f.awayOdds || +(1.07 / f.awayProb).toFixed(2);

  const hProb = Math.max(0.05, 1 / homeOdds);
  const dProb = Math.max(0.05, 1 / drawOdds);
  const aProb = Math.max(0.05, 1 / awayOdds);

  // Over/Under probabilities
  const o15Prob = f.over15Pct ? f.over15Pct / 100 : Math.min(0.88, Math.max(0.65, 0.72 + (hProb - aProb) * 0.1));
  const u15Prob = Math.max(0.05, 1 - o15Prob);

  const o25Prob = f.over25Pct ? f.over25Pct / 100 : Math.min(0.75, Math.max(0.35, 0.50 + (hProb - 0.45) * 0.2));
  const u25Prob = Math.max(0.05, 1 - o25Prob);

  const o35Prob = f.over35Pct ? f.over35Pct / 100 : Math.min(0.55, Math.max(0.18, o25Prob * 0.6));
  const u35Prob = Math.max(0.05, 1 - o35Prob);

  // BTTS probabilities
  const ggProb = f.bttsYesPct ? f.bttsYesPct / 100 : Math.min(0.72, Math.max(0.40, 0.52 + (1 - Math.abs(hProb - aProb)) * 0.08));
  const ngProb = Math.max(0.05, 1 - ggProb);

  return {
    matchResult: [
      { label: `${f.homeTeam} (1)`, code: '1', odds: homeOdds },
      { label: `Draw (X)`, code: 'X', odds: drawOdds },
      { label: `${f.awayTeam} (2)`, code: '2', odds: awayOdds },
    ],
    doubleChance: [
      { label: 'Home or Draw', code: '1X', odds: +(1 / Math.min(0.96, hProb + dProb) * 1.05).toFixed(2) },
      { label: 'Draw or Away', code: 'X2', odds: +(1 / Math.min(0.96, dProb + aProb) * 1.05).toFixed(2) },
      { label: 'Home or Away', code: '12', odds: +(1 / Math.min(0.96, hProb + aProb) * 1.05).toFixed(2) },
    ],
    overUnderGoals: [
      { label: 'Over 1.5 Goals', code: 'O1.5', odds: +Math.max(1.05, 1.07 / o15Prob).toFixed(2) },
      { label: 'Under 1.5 Goals', code: 'U1.5', odds: +Math.max(1.05, 1.07 / u15Prob).toFixed(2) },
      { label: 'Over 2.5 Goals', code: 'O2.5', odds: +Math.max(1.05, 1.07 / o25Prob).toFixed(2) },
      { label: 'Under 2.5 Goals', code: 'U2.5', odds: +Math.max(1.05, 1.07 / u25Prob).toFixed(2) },
      { label: 'Over 3.5 Goals', code: 'O3.5', odds: +Math.max(1.05, 1.07 / o35Prob).toFixed(2) },
      { label: 'Under 3.5 Goals', code: 'U3.5', odds: +Math.max(1.05, 1.07 / u35Prob).toFixed(2) },
    ],
    btts: [
      { label: 'GG (Both Teams to Score)', code: 'GG', odds: +Math.max(1.05, 1.07 / ggProb).toFixed(2) },
      { label: 'NG (No BTTS)', code: 'NG', odds: +Math.max(1.05, 1.07 / ngProb).toFixed(2) },
    ],
    handicap: [
      { label: 'Home (-1.5)', code: 'H1.5', odds: +(homeOdds * 1.6).toFixed(2) },
      { label: 'Away (+1.5)', code: 'A1.5', odds: +(awayOdds * 0.65).toFixed(2) },
      { label: 'Home (-0.5)', code: 'H0.5', odds: homeOdds },
      { label: 'Away (+0.5)', code: 'A0.5', odds: +(1 / Math.min(0.96, dProb + aProb) * 1.05).toFixed(2) },
    ],
    correctScore: [
      { label: '1 - 0', code: '1-0', odds: +(Math.max(4.5, 3.8 + (1 / hProb) * 1.5)).toFixed(2) },
      { label: '2 - 0', code: '2-0', odds: +(Math.max(5.5, 4.2 + (1 / hProb) * 2.0)).toFixed(2) },
      { label: '2 - 1', code: '2-1', odds: +(Math.max(6.5, 5.0 + (1 / hProb) * 2.2)).toFixed(2) },
      { label: '1 - 1', code: '1-1', odds: +(Math.max(5.0, 4.0 + (1 / dProb) * 1.8)).toFixed(2) },
      { label: '0 - 0', code: '0-0', odds: +(Math.max(6.5, 5.5 + (1 / dProb) * 2.2)).toFixed(2) },
      { label: '0 - 1', code: '0-1', odds: +(Math.max(5.5, 4.2 + (1 / aProb) * 1.6)).toFixed(2) },
      { label: '1 - 2', code: '1-2', odds: +(Math.max(7.5, 5.8 + (1 / aProb) * 2.4)).toFixed(2) },
    ],
  };
}
