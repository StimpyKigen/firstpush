export interface JackpotFeedItem {
  id: string;
  bookie: 'SportPesa' | 'Betika' | 'Odibets' | 'Mozzart';
  name: string;
  type: 'midweek' | 'mega';
  url: string;
  status: 'open' | 'locked' | 'settled';
  entryFee: number;
  prizePool: string;
  deadline: string;
  participants: number;
  matches: Array<{
    home: string;
    away: string;
    competition: string;
    kickoff: string;
  }>;
  syncedAt: string;
}

export const jackpotFeedTargets = [
  {
    "id": "sportpesa-midweek",
    "name": "SportPesa Midweek Jackpot",
    "bookie": "SportPesa",
    "type": "midweek",
    "url": "https://www.sportpesa.com/kenya/midweek-jackpot"
  },
  {
    "id": "sportpesa-mega",
    "name": "SportPesa Mega Jackpot",
    "bookie": "SportPesa",
    "type": "mega",
    "url": "https://www.sportpesa.com/kenya/mega-jackpot"
  },
  {
    "id": "betika-midweek",
    "name": "Betika Midweek Jackpot",
    "bookie": "Betika",
    "type": "midweek",
    "url": "https://www.betika.com/kenya/midweek-jackpot"
  },
  {
    "id": "betika-mega",
    "name": "Betika Mega Jackpot",
    "bookie": "Betika",
    "type": "mega",
    "url": "https://www.betika.com/kenya/mega-jackpot"
  },
  {
    "id": "odibets-midweek",
    "name": "Odibets Midweek Jackpot",
    "bookie": "Odibets",
    "type": "midweek",
    "url": "https://www.odibets.com/kenya/jackpot"
  },
  {
    "id": "mozzart-midweek",
    "name": "Mozzart Midweek Jackpot",
    "bookie": "Mozzart",
    "type": "midweek",
    "url": "https://www.mozzartbet.com/kenya/jackpot"
  }
];

export const jackpotFeedSeed: JackpotFeedItem[] = [
  {
    id: 'sportpesa-midweek',
    bookie: 'SportPesa',
    name: 'SportPesa Midweek Jackpot',
    type: 'midweek',
    url: 'https://www.sportpesa.com/kenya/midweek-jackpot',
    status: 'open',
    entryFee: 10,
    prizePool: 'Ksh 15,000,000',
    deadline: 'Midweek kickoffs',
    participants: 9840,
    matches: [
      { home: 'FC Orenburg', away: 'FC Rostov', competition: 'Russia Premier League', kickoff: 'Sun 11:30' },
      { home: 'Aarhus', away: 'Brondby', competition: 'Danish Superliga', kickoff: 'Sat 16:00' },
      { home: 'Servette FC', away: 'FC Basel 1893', competition: 'Swiss Super League', kickoff: 'Sat 16:00' },
    ],
    syncedAt: 'Seeded locally: no live scrape available yet',
  },
  {
    id: 'sportpesa-mega',
    bookie: 'SportPesa',
    name: 'SportPesa Mega Jackpot',
    type: 'mega',
    url: 'https://www.sportpesa.com/kenya/mega-jackpot',
    status: 'open',
    entryFee: 10,
    prizePool: 'Ksh 349,000,000',
    deadline: 'Weekend kickoffs',
    participants: 12480,
    matches: [
      { home: 'Sepsi OSK', away: 'Universitatea Cluj', competition: 'Romania Liga 1', kickoff: 'Sun 14:30' },
      { home: 'Ružomberok', away: 'Dunajska Streda', competition: 'Slovakia Super Liga', kickoff: 'Sun 15:00' },
      { home: 'Kaspiy', away: 'Zhenys', competition: 'Kazakhstan Premier League', kickoff: 'Sun 15:00' },
    ],
    syncedAt: 'Seeded locally: no live scrape available yet',
  },
];
