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
    awayTeam: 'Coventry City',
    competition: 'English Premier League',
    kickoff: 'Today 22:00 EAT',
    homeProb: 0.72,
    drawProb: 0.18,
    awayProb: 0.10,
  },
  {
    id: 'bm-2',
    homeTeam: 'Chelsea',
    awayTeam: 'Liverpool',
    competition: 'English Premier League',
    kickoff: 'Tomorrow 19:30 EAT',
    homeProb: 0.38,
    drawProb: 0.28,
    awayProb: 0.34,
  },
  {
    id: 'bm-3',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    competition: 'Spanish LALIGA',
    kickoff: 'Saturday 21:00 EAT',
    homeProb: 0.45,
    drawProb: 0.25,
    awayProb: 0.30,
  },
  {
    id: 'bm-4',
    homeTeam: 'Manchester City',
    awayTeam: 'Tottenham Hotspur',
    competition: 'English Premier League',
    kickoff: 'Saturday 17:00 EAT',
    homeProb: 0.65,
    drawProb: 0.20,
    awayProb: 0.15,
  },
  {
    id: 'bm-5',
    homeTeam: 'Bayern Munich',
    awayTeam: 'Borussia Dortmund',
    competition: 'German Bundesliga',
    kickoff: 'Saturday 19:30 EAT',
    homeProb: 0.58,
    drawProb: 0.22,
    awayProb: 0.20,
  },
  {
    id: 'bm-6',
    homeTeam: 'Inter Milan',
    awayTeam: 'AC Milan',
    competition: 'Italian Serie A',
    kickoff: 'Sunday 21:45 EAT',
    homeProb: 0.42,
    drawProb: 0.30,
    awayProb: 0.28,
  },
  {
    id: 'bm-7',
    homeTeam: 'Gor Mahia',
    awayTeam: 'AFC Leopards',
    competition: 'Kenyan Premier League',
    kickoff: 'Sunday 15:00 EAT',
    homeProb: 0.48,
    drawProb: 0.32,
    awayProb: 0.20,
  },
  {
    id: 'bm-8',
    homeTeam: 'Deportivo Alavés',
    awayTeam: 'Getafe',
    competition: 'Spanish LALIGA',
    kickoff: 'Today 19:00 EAT',
    homeProb: 0.45,
    drawProb: 0.32,
    awayProb: 0.23,
  },
  {
    id: 'bm-9',
    homeTeam: 'Sunderland',
    awayTeam: 'Leeds United',
    competition: 'English Championship',
    kickoff: 'Today 17:00 EAT',
    homeProb: 0.42,
    drawProb: 0.30,
    awayProb: 0.28,
  },
  {
    id: 'bm-10',
    homeTeam: 'Trabzonspor',
    awayTeam: 'Al Sadd',
    competition: 'International Club Friendly',
    kickoff: 'Today 20:00 EAT',
    homeProb: 0.52,
    drawProb: 0.26,
    awayProb: 0.22,
  },
];

export function getCombinedBuilderFixtures(): BuilderFixture[] {
  const freeSnap = getFreeMatchesSnapshot();
  const result: BuilderFixture[] = [...EXPANDED_BUILDER_FIXTURES];

  // Merge any free matches with real API bookmaker odds
  freeSnap.forEach((m) => {
    if (!result.some((existing) => existing.id === m.id || (existing.homeTeam === m.home && existing.awayTeam === m.away))) {
      const hOdds = m.homeOdds || 2.00;
      const dOdds = m.drawOdds || 3.30;
      const aOdds = m.awayOdds || 3.80;
      result.unshift({
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
        bookmaker: m.bookmaker,
        homeProb: 1 / hOdds,
        drawProb: 1 / dOdds,
        awayProb: 1 / aOdds,
      });
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
