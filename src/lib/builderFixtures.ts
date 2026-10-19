import { getFreeMatchesSnapshot } from './freeMatches';

export interface BuilderFixture {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoff: string;
  status?: 'pre' | 'in' | 'post';
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
}

export function getCombinedBuilderFixtures(): BuilderFixture[] {
  const freeSnap = getFreeMatchesSnapshot();
  return freeSnap.map((m) => {
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
      homeProb: +(1 / hOdds).toFixed(2),
      drawProb: +(1 / dOdds).toFixed(2),
      awayProb: +(1 / aOdds).toFixed(2),
    };
  });
}

// Calculate realistic odds for various markets based on real bookmaker odds or probabilities
export function generateOddsForFixture(f: BuilderFixture) {
  const homeOdds = f.homeOdds || +(1.08 / f.homeProb).toFixed(2);
  const drawOdds = f.drawOdds || +(1.08 / f.drawProb).toFixed(2);
  const awayOdds = f.awayOdds || +(1.08 / f.awayProb).toFixed(2);

  const hProb = 1 / homeOdds;
  const dProb = 1 / drawOdds;
  const aProb = 1 / awayOdds;

  return {
    matchResult: [
      { label: `${f.homeTeam} (1)`, code: '1', odds: homeOdds },
      { label: `Draw (X)`, code: 'X', odds: drawOdds },
      { label: `${f.awayTeam} (2)`, code: '2', odds: awayOdds },
    ],
    doubleChance: [
      { label: 'Home or Draw', code: '1X', odds: +(1 / (hProb + dProb) * 1.05).toFixed(2) },
      { label: 'Draw or Away', code: 'X2', odds: +(1 / (dProb + aProb) * 1.05).toFixed(2) },
      { label: 'Home or Away', code: '12', odds: +(1 / (hProb + aProb) * 1.05).toFixed(2) },
    ],
    overUnderGoals: [
      { label: 'Over 1.5 Goals', code: 'O1.5', odds: 1.25 },
      { label: 'Under 1.5 Goals', code: 'U1.5', odds: 3.60 },
      { label: 'Over 2.5 Goals', code: 'O2.5', odds: 1.85 },
      { label: 'Under 2.5 Goals', code: 'U2.5', odds: 1.95 },
      { label: 'Over 3.5 Goals', code: 'O3.5', odds: 3.10 },
      { label: 'Under 3.5 Goals', code: 'U3.5', odds: 1.32 },
    ],
    btts: [
      { label: 'GG (Both Teams to Score)', code: 'GG', odds: 1.75 },
      { label: 'NG (No BTTS)', code: 'NG', odds: 2.05 },
    ],
    handicap: [
      { label: 'Home (-1.5)', code: 'H1.5', odds: +(homeOdds * 1.6).toFixed(2) },
      { label: 'Away (+1.5)', code: 'A1.5', odds: +(awayOdds * 0.65).toFixed(2) },
      { label: 'Home (-0.5)', code: 'H0.5', odds: homeOdds },
      { label: 'Away (+0.5)', code: 'A0.5', odds: +(1 / (dProb + aProb) * 1.05).toFixed(2) },
    ],
    correctScore: [
      { label: '1 - 0', code: '1-0', odds: 6.50 },
      { label: '2 - 0', code: '2-0', odds: 7.20 },
      { label: '2 - 1', code: '2-1', odds: 8.50 },
      { label: '1 - 1', code: '1-1', odds: 6.00 },
      { label: '0 - 0', code: '0-0', odds: 9.00 },
      { label: '0 - 1', code: '0-1', odds: 11.00 },
      { label: '1 - 2', code: '1-2', odds: 12.00 },
    ],
  };
}
