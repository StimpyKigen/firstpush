import { parseFixturesText } from '../src/lib/fixturePdfParser';

const sample = `
ENGLAND: Premier League
5821 | 24/10/2026 14:30 | Arsenal | Chelsea | 1.95 | 3.60 | 3.80 | 1.25 | 1.28 | 1.80 | 1.75 | 2.05 | 1.70 | 2.10
5822	24-10-2026 17:00	Aston Villa - Newcastle	2.40	3.40	2.90	1.40	1.30	1.55	1.80	2.00	1.65	2.20

ENGLAND - CHAMPIONSHIP
5901  24/10 15:00  Leeds United vs Sunderland  1.80  3.50  4.20  1.20  1.28  1.95  1.90  1.90  1.85  1.95
5902  2026-10-24 15:00  Sheffield Utd v Burnley  2.20  3.25  3.30  1.32  1.32  1.65  2.05  1.75  1.80  2.00

SPAIN: La Liga
6001  24/10 21:00  Real Madrid vs Barcelona  2.25  3.60  3.00  1.38  1.28  1.62  1.55  2.40  1.50  2.50
`;

const result = parseFixturesText(sample);
console.log('Parsed fixtures count:', result.fixtures.length);
result.fixtures.forEach((f, idx) => {
  console.log(`[${idx + 1}] ${f.country} > ${f.competition}: ${f.homeTeam} vs ${f.awayTeam} (${f.kickoffDisplay}) | 1: ${f.odds.homeOdds}, X: ${f.odds.drawOdds}, 2: ${f.odds.awayOdds}`);
});
