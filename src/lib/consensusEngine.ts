import type { GamblerPick, MatchConsensus } from './types';

const usernames = [
  'MjengoMoneyMan', 'BetKingKisumu', 'BundaMathematician', 'PunterWaEastlando',
  'JackpotJuma', 'CoachOtieno_Tips', 'SlipDoctorKE', 'MamaMbogaMillions',
  'RiskItForBiskit', 'TenBobTycoon', 'NairobiNostradamus', 'FormGuideFred',
  'HustlerOdds', 'ChezaKamaWewe', 'BankerOnly254', 'DoubleChanceDan',
  'GoalRushGathoni', 'LigiSokaLegend', 'KetepaKelvin', 'MtaaAnalyst',
  'ZaoStatsZone', 'PunditPatuma', 'OverUnderOscar', 'HomeAdvantageHilda',
];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

const reasoningsHome = [
  "Home form is unbeatable right now: 6 wins in their last 7 at this ground. Their striker has 9 goals in 8 games. Easy banker.",
  "Away side just sold their best defender in the window, plus they're missing 2 starters through injury. Home wins this comfortably.",
  "Head to head favors the home side massively: they haven't lost this fixture in 5 years. Riding the trend.",
  "Home team has revenge motivation after a heavy loss last time out. Expect them to come out firing from minute one.",
  "The away side is on a brutal losing streak and conceding goals like it's going out of fashion. Home all day.",
  "Weather conditions and pitch favor the home side's physical style. Their manager always sets up perfectly for these.",
  "Home crowd is electric for this one and they haven't dropped points at this ground all season.",
];

const reasoningsDraw = [
  "Both teams have identical away/home records this season: genuinely can't split them. Draw protects the slip.",
  "Neither side has anything major to play for right now, expect a cagey affair. Low-scoring draw is the smart pick here.",
  "Last 4 meetings have all ended level. Statistically this is the value pick everyone's sleeping on.",
  "Both managers are notoriously defensive tacticians: this screams 0-0 or 1-1 from a mile away.",
  "Key player suspended for the home side balances things out perfectly. I'm taking the draw here.",
  "This is a dead rubber / early-stage tie, both sides likely to rotate and play it safe.",
];

const reasoningsAway = [
  "Away side has the better attacking metrics by a wide margin: xG says this isn't close. Fading the home crowd hype.",
  "Home team's keeper has been shaky lately, conceding soft goals. Away's wingers will exploit that flank all day.",
  "This is a classic trap game: public is on the home side but sharp money is flowing to the away win.",
  "Away side just hired a new manager and the bounce is real: big turnaround since he took over.",
  "Home side rotating heavily for a bigger game coming up, fatigue will show. Taking the away value here.",
  "Away team have the individual quality to punish mistakes on the counter: I'm backing the upset.",
];

export function buildPicks(matchId: string, seed: number, homeLean: number, drawLean: number): GamblerPick[] {
  const count = 6 + (seed % 5);
  const picks: GamblerPick[] = [];
  const shuffledNames = [...usernames].sort(() => 0.5 - ((seed * 37) % 97) / 97);
  for (let i = 0; i < count; i++) {
    const r = (seed * 13 + i * 29) % 100;
    let outcome: '1' | 'X' | '2';
    let reasonPool: string[];
    if (r < homeLean) {
      outcome = '1'; reasonPool = reasoningsHome;
    } else if (r < homeLean + drawLean) {
      outcome = 'X'; reasonPool = reasoningsDraw;
    } else {
      outcome = '2'; reasonPool = reasoningsAway;
    }
    const conviction = i % 3 === 0 ? 'Banker' : i % 3 === 1 ? 'Value Pick' : 'Long Shot';
    picks.push({
      id: `${matchId}-p${i}`,
      username: shuffledNames[i % shuffledNames.length],
      pick: outcome,
      reasoning: pick(reasonPool, seed + i * 7),
      conviction,
      likes: (seed * 3 + i * 11) % 48,
      timeAgo: `${1 + ((seed + i) % 22)}h ago`,
      colorSeed: (seed + i * 5) % 8,
    });
  }
  return picks;
}

// homePct/drawPct are the *real* crowd-prediction split synced from live
// jackpot / match prediction feeds (percentage of tipsters/punters leaning
// 1 / X / 2 on that exact fixture right now).
export function buildConsensus(matchId: string, seed: number, homePct: number, drawPct: number): MatchConsensus {
  const awayPct = Math.max(1, 100 - homePct - drawPct);
  return {
    matchId,
    homePct,
    drawPct,
    awayPct,
    totalVotes: 180 + (seed * 23) % 900,
    picks: buildPicks(matchId, seed, homePct, drawPct),
  };
}
