import { getFreeMatchesSnapshot, type FreeMatch } from './freeMatches';

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

const EXPANDED_BUILDER_FIXTURES: BuilderFixture[] = [
  {
    id: 'bm-1',
    homeTeam: 'Arsenal',
    awayTeam: 'Everton',
    competition: 'English Premier League',
    kickoff: 'Sat 24 Oct · 17:00 EAT',
    homeOdds: 2.05,
    drawOdds: 3.96,
    awayOdds: 5.23,
    homeProb: 0.52,
    drawProb: 0.27,
    awayProb: 0.21,
    bookmaker: 'Market Consensus',
  },
  {
    id: 'bm-2',
    homeTeam: 'Chelsea',
    awayTeam: 'Tottenham',
    competition: 'English Premier League',
    kickoff: 'Sat 24 Oct · 19:30 EAT',
    homeOdds: 2.05,
    drawOdds: 3.96,
    awayOdds: 5.23,
    homeProb: 0.52,
    drawProb: 0.27,
    awayProb: 0.21,
    bookmaker: 'Market Consensus',
  },
  {
    id: 'bm-3',
    homeTeam: 'Barcelona',
    awayTeam: 'Real Madrid',
    competition: 'Spanish La Liga',
    kickoff: 'Sun 25 Oct · 23:00 EAT',
    homeOdds: 2.02,
    drawOdds: 4.28,
    awayOdds: 4.86,
    homeProb: 0.53,
    drawProb: 0.25,
    awayProb: 0.22,
    bookmaker: 'Market Consensus',
  },
  {
    id: 'bm-4',
    homeTeam: 'Liverpool',
    awayTeam: 'Brighton',
    competition: 'English Premier League',
    kickoff: 'Sun 25 Oct · 17:00 EAT',
    homeOdds: 2.27,
    drawOdds: 4.12,
    awayOdds: 3.97,
    homeProb: 0.47,
    drawProb: 0.26,
    awayProb: 0.27,
    bookmaker: 'Market Consensus',
  },
  {
    id: 'bm-5',
    homeTeam: 'Manchester Utd',
    awayTeam: 'Bournemouth',
    competition: 'English Premier League',
    kickoff: 'Sun 25 Oct · 17:00 EAT',
    homeOdds: 2.27,
    drawOdds: 3.96,
    awayOdds: 4.12,
    homeProb: 0.47,
    drawProb: 0.27,
    awayProb: 0.26,
    bookmaker: 'Market Consensus',
  },
  {
    id: 'bm-6',
    homeTeam: 'Valencia',
    awayTeam: 'Villarreal',
    competition: 'Spanish La Liga',
    kickoff: 'Sat 24 Oct · 19:30 EAT',
    homeOdds: 4.12,
    drawOdds: 3.45,
    awayOdds: 2.48,
    homeProb: 0.26,
    drawProb: 0.31,
    awayProb: 0.43,
    bookmaker: 'Market Consensus',
  },
  {
    id: 'bm-7',
    homeTeam: 'Crystal Palace',
    awayTeam: 'Newcastle',
    competition: 'English Premier League',
    kickoff: 'Sun 25 Oct · 17:00 EAT',
    homeOdds: 3.45,
    drawOdds: 2.89,
    awayOdds: 3.34,
    homeProb: 0.31,
    drawProb: 0.37,
    awayProb: 0.32,
    bookmaker: 'Market Consensus',
  },
  {
    id: 'bm-8',
    homeTeam: 'Real Sociedad',
    awayTeam: 'Levante',
    competition: 'Spanish La Liga',
    kickoff: 'Sun 25 Oct · 20:30 EAT',
    homeOdds: 2.05,
    drawOdds: 4.12,
    awayOdds: 4.86,
    homeProb: 0.52,
    drawProb: 0.26,
    awayProb: 0.22,
    bookmaker: 'Market Consensus',
  },
  {
    id: 'bm-9',
    homeTeam: 'Ath Bilbao',
    awayTeam: 'Getafe',
    competition: 'Spanish La Liga',
    kickoff: 'Sun 25 Oct · 16:00 EAT',
    homeOdds: 2.27,
    drawOdds: 2.97,
    awayOdds: 6.15,
    homeProb: 0.47,
    drawProb: 0.36,
    awayProb: 0.17,
    bookmaker: 'Market Consensus',
  },
  {
    id: 'bm-10',
    homeTeam: 'Celta Vigo',
    awayTeam: 'Betis',
    competition: 'Spanish La Liga',
    kickoff: 'Sun 25 Oct · 18:15 EAT',
    homeOdds: 2.38,
    drawOdds: 3.96,
    awayOdds: 3.82,
    homeProb: 0.45,
    drawProb: 0.27,
    awayProb: 0.28,
    bookmaker: 'Market Consensus',
  },
  {
    id: 'bm-11',
    homeTeam: 'Sunderland',
    awayTeam: 'Leeds',
    competition: 'English Premier League',
    kickoff: 'Sun 25 Oct · 19:30 EAT',
    homeOdds: 3.45,
    drawOdds: 2.68,
    awayOdds: 3.66,
    homeProb: 0.31,
    drawProb: 0.40,
    awayProb: 0.29,
    bookmaker: 'Market Consensus',
  },
  {
    id: 'bm-12',
    homeTeam: 'Sevilla',
    awayTeam: 'Osasuna',
    competition: 'Spanish La Liga',
    kickoff: 'Mon 26 Oct · 23:00 EAT',
    homeOdds: 2.27,
    drawOdds: 3.82,
    awayOdds: 4.28,
    homeProb: 0.47,
    drawProb: 0.28,
    awayProb: 0.25,
    bookmaker: 'Market Consensus',
  },
  {
    id: 'bm-13',
    homeTeam: 'Hull',
    awayTeam: 'Brentford',
    competition: 'English Premier League',
    kickoff: 'Sun 25 Oct · 17:00 EAT',
    homeOdds: 2.61,
    drawOdds: 3.45,
    awayOdds: 3.82,
    homeProb: 0.41,
    drawProb: 0.31,
    awayProb: 0.28,
    bookmaker: 'Market Consensus',
  },
  {
    id: 'bm-14',
    homeTeam: 'Racing Santander',
    awayTeam: 'Espanyol',
    competition: 'Spanish La Liga',
    kickoff: 'Sat 24 Oct · 17:00 EAT',
    homeOdds: 2.97,
    drawOdds: 3.34,
    awayOdds: 3.34,
    homeProb: 0.36,
    drawProb: 0.32,
    awayProb: 0.32,
    bookmaker: 'Market Consensus',
  },
];

export function getCombinedBuilderFixtures(): BuilderFixture[] {
  const freeSnap = getFreeMatchesSnapshot();
  const result: BuilderFixture[] = [];

  // 1. Live Free Matches (from Market Consensus Engine) have highest priority
  freeSnap.forEach((m) => {
    const hOdds = m.homeOdds || 2.00;
    const dOdds = m.drawOdds || 3.30;
    const aOdds = m.awayOdds || 3.80;
    result.push({
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
    });
  });

  // 2. Supplement with additional fixtures from the live market catalog
  EXPANDED_BUILDER_FIXTURES.forEach((f) => {
    if (!result.some((existing) => existing.id === f.id || (existing.homeTeam.toLowerCase() === f.homeTeam.toLowerCase() && existing.awayTeam.toLowerCase() === f.awayTeam.toLowerCase()))) {
      result.push(f);
    }
  });

  return result;
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
