# Community & Consensus Engine Specification

## 1. Overview

Community features form the core of Mshindi Projo. Punters pool their sports knowledge, analyze 15-17 leg jackpots, share social bet slips, and earn ratings based on verified slip accuracy.

---

## 2. Consensus Engine Algorithms (`src/lib/consensusEngine.ts`)

### 2.1 Consensus Percentage Calculation
For each match leg $i$ in a jackpot, community picks are calculated as:

$$P_{\text{Home}}(i) = \frac{N_{\text{Home}}(i)}{N_{\text{Total}}(i)} \times 100$$

$$P_{\text{Draw}}(i) = \frac{N_{\text{Draw}}(i)}{N_{\text{Total}}(i)} \times 100$$

$$P_{\text{Away}}(i) = \frac{N_{\text{Away}}(i)}{N_{\text{Total}}(i)} \times 100$$

Where $N_{\text{Total}}(i)$ is the number of punters who submitted a pick for leg $i$.

### 2.2 Consensus Slip Auto-Generator
The consensus generator constructs three automated community slips:
1. **Pure Consensus Slip**: Selects the majority pick ($\max(P_1, P_X, P_2)$) for every leg.
2. **Balanced Smart Slip**: Combines community majority picks with high-value draw coverage on volatile matches (draw probability > 30%).
3. **Value Risk Slip**: Covers underdog picks where crowd agreement is split (40%-30%-30%).

---

## 3. 5-Star Punter Rating Algorithm (`src/lib/ratingEngine.ts`)

Punter ratings range from **1.0 to 5.0 stars** in half-star increments.

```
Rating Score = (Base Accuracy Score * 3.5) + (Crown Bonus * 1.0) - (Inactivity Decay)
```

- **Base Accuracy Score**: Ratio of correct picks over settled jackpot legs.
- **Crown Bonus**: Awarded to punters who claim the #1 spot on the weekly Gameweek Leaderboard.
- **Inactivity Decay**: Applied if a punter submits zero slips for 3 consecutive weeks.

---

## 4. Discussion Panels & Social Bet Slips

- **Live Room Discussion (`src/components/DiscussionPanel.tsx`)**: Real-time chat stream per jackpot room featuring verified punter badges, pick tags (e.g. `1X`, `Over 2.5`), and reply threads.
- **Social Bet Slip Feed (`src/pages/BetSlipRoom.tsx`)**: Allows punters to post bookmaker booking codes (1xBet, Betika, SportPesa), like slips, and filter by tags.
