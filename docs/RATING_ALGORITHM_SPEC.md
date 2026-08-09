# MshindiRoom - Production Player Rating Engine & Ranking Specification

## 1. Executive Summary & Core Philosophy

The MshindiRoom Rating Engine is engineered to solve a fundamental challenge in peer-to-peer jackpot prediction platforms: **distinguishing genuine football analysis and prediction skill from one-off luck.**

Traditional leaderboard systems rely heavily on money won or single jackpot victories. This creates rating inflation, rewards lucky guessers, and punishes consistent analytical punters who finish near the top week after week.

MshindiRoom implements a **dual-metric ranking model**:
1. **Public Star Rating (0–5 Stars)**: Driven by **Reputation Points (RP)**. RP measures accumulated career achievement, near-miss mastery, consistency streaks, and difficulty-adjusted performance. Progression follows a strict exponential curve, making 5 Stars (Legend) an elite badge reserved for the top 1-3% of punters who demonstrate sustained excellence over months.
2. **Hidden Skill Rating (MMR / Matchmaking & Leaderboard Index)**: A modified Glicko-2 / Bayesian Elo rating ($1000 - 3000+$) that measures instantaneous underlying prediction talent, volatility, and confidence interval. Hidden MMR dictates global leaderboard placement and peer match quality.

---

## 2. Mathematical Formulas & Principles

### A. RP Tier Structure & Diminishing Returns

Reputation Points (RP) accumulate with every jackpot settled. Reaching higher star tiers requires exponentially more RP, enforcing diminishing returns.

| Tier | Star Visual | Name | RP Range | Delta RP Needed | Target % of User Base |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Tier 1 | ⭐ (1.0 - 1.5★) | Rookie | 0 – 49 RP | 50 RP | 45% |
| Tier 2 | ⭐⭐ (2.0 - 2.5★) | Rising Player | 50 – 149 RP | 100 RP | 35% |
| Tier 3 | ⭐⭐⭐ (3.0 - 3.5★) | Skilled Predictor | 150 – 349 RP | 200 RP | 15% |
| Tier 4 | ⭐⭐⭐⭐ (4.0 - 4.5★) | Elite Predictor | 350 – 699 RP | 350 RP | 4% |
| Tier 5 | ⭐⭐⭐⭐⭐ (5.0★) | Legend | 700+ RP | — | Top 1 – 3% |

$$\text{Star Rating}(RP) = \begin{cases} 
1.0 + 0.5 \cdot \lfloor \frac{RP}{25} \rfloor & \text{if } 0 \le RP < 50 \\
2.0 + 0.5 \cdot \lfloor \frac{RP - 50}{50} \rfloor & \text{if } 50 \le RP < 150 \\
3.0 + 0.5 \cdot \lfloor \frac{RP - 150}{100} \rfloor & \text{if } 150 \le RP < 350 \\
4.0 + 0.5 \cdot \lfloor \frac{RP - 350}{175} \rfloor & \text{if } 350 \le RP < 700 \\
5.0 & \text{if } RP \ge 700
\end{cases}$$

---

### B. RP Award Formula for a Settled Jackpot

For any settled jackpot $J$ with $N$ total matches, a player's total earned Reputation Points $\Delta RP$ for that jackpot is defined as:

$$\Delta RP = \left( RP_{\text{rank}} + RP_{\text{accuracy}} + RP_{\text{near\_miss}} \right) \cdot M_{\text{difficulty}} + RP_{\text{streak}} + RP_{\text{consistency}}$$

#### 1. Rank Reward ($RP_{\text{rank}}$)
* **1st Place (Winner)**: $+50\text{ RP}$
* **2nd Place**: $+35\text{ RP}$
* **3rd Place**: $+25\text{ RP}$
* **Top 10% (excluding Top 3)**: $+15\text{ RP}$
* **Top 25%**: $+5\text{ RP}$
* **Others**: $0\text{ RP}$

#### 2. Absolute Accuracy Reward ($RP_{\text{accuracy}}$)
Calculated based on percentage of correct picks ($A = \frac{\text{Correct}}{N}$):
* $A \ge 80\%$: $+10\text{ RP}$
* $70\% \le A < 80\%$: $+7\text{ RP}$
* $60\% \le A < 70\%$: $+5\text{ RP}$
* $50\% \le A < 60\%$: $+2\text{ RP}$
* $A < 50\%$: $0\text{ RP}$

#### 3. Near-Miss Mastery Bonus ($RP_{\text{near\_miss}}$)
Punishing near-misses frustrates analytical punters. Players who narrowly miss perfect slips earn substantial RP:
* **0 Matches Off (Perfect Slip)**: $+40\text{ RP}$
* **1 Match Off (19/20 or 16/17)**: $+25\text{ RP}$
* **2 Matches Off**: $+15\text{ RP}$
* **3 Matches Off**: $+8\text{ RP}$

#### 4. Difficulty Multiplier ($M_{\text{difficulty}}$)
To prevent exploiting easy favorites or guessing random underdogs, we weight difficulty using decimal odds $O_i$ for each correct leg $i \in C$:

$$\text{Raw Difficulty Index } D = 1 + 0.1 \cdot \sum_{i \in C} \ln(\max(1.0, O_i))$$

$$M_{\text{difficulty}} = \min(2.0, \max(1.0, D))$$

*Odds cap ensures selecting 10.00+ odds on a whim does not cause exponential point leaks.*

#### 5. Non-Punitive Streak Bonus ($RP_{\text{streak}}$)
A high-performing jackpot is defined as achieving Top 25% or $\ge 60\%$ accuracy.
* **Current Streak $S$**:
  * 3 consecutive high performances: $+5\text{ RP}$
  * 5 consecutive high performances: $+10\text{ RP}$
  * 10+ consecutive high performances: $+25\text{ RP}$
* **Non-Wipeout Decay**: When a player misses a high performance, their streak count is **not reset to 0**. Instead, it is reduced by $20\%$: $S_{\text{new}} = \lfloor S_{\text{old}} \cdot 0.8 \rfloor$.

#### 6. Rolling Consistency Bonus ($RP_{\text{consistency}}$)
Evaluated over rolling windows of last 10, 25, and 50 jackpots:
* $C_{10}$ ($\ge 65\%$ avg accuracy over last 10): $+5\text{ RP}$
* $C_{25}$ ($\ge 65\%$ avg accuracy over last 25): $+10\text{ RP}$
* $C_{50}$ ($\ge 65\%$ avg accuracy over last 50): $+20\text{ RP}$

---

### C. Activity Decay Algorithm

To prevent inactive users from camping at ⭐⭐⭐⭐⭐ indefinitely:
* **Inactivity < 30 days**: No decay ($0\%$)
* **30 – 59 days inactive**: $1\%$ decay per 30 days
* **60 – 89 days inactive**: $3\%$ decay per 30 days
* **90+ days inactive**: $5\%$ decay per 30 days
* **Maximum Cumulative Decay Cap**: $15\%$ of total career RP. RP can never decay below the baseline of $0\text{ RP}$.

---

### D. Hidden MMR (Skill Index) Mathematics

Hidden MMR ($M$) updates after each jackpot using a Bayesian update function:

$$M_{\text{new}} = M_{\text{old}} + K \cdot \left( S_{\text{actual}} - S_{\text{expected}} \right)$$

Where:
* $K = 32 \cdot \left(1 + \frac{1}{\sqrt{\text{JackpotsPlayed}}}\right)$
* $S_{\text{actual}} = \frac{\text{User Rank Percentile}}{100}$
* $S_{\text{expected}} = \frac{1}{1 + 10^{\frac{M_{\text{avg\_room}} - M_{\text{user}}}{400}}}$

---

## 3. Example Calculations (17-Match Jackpot)

### Scenario:
A player enters a **17-match SportPesa Mega Jackpot Pro**.
* **Correct Picks**: 15 / 17 ($88.2\%$ accuracy) -> **2 matches off**.
* **Final Rank**: 2nd place out of 10,000 participants.
* **Odds Profile**: Average odds for 15 correct legs was $2.40$.
* **Current Streak**: 4 consecutive high-performance jackpots.
* **Last 10 Average Accuracy**: $71\%$.

### Calculation Steps:
1. **$RP_{\text{rank}}$**: 2nd Place = $+35\text{ RP}$
2. **$RP_{\text{accuracy}}$**: $88.2\% \ge 80\%$ = $+10\text{ RP}$
3. **$RP_{\text{near\_miss}}$**: 2 matches off = $+15\text{ RP}$
4. **Base Sum**: $35 + 10 + 15 = 60\text{ RP}$
5. **$M_{\text{difficulty}}$**:
   $$D = 1 + 0.1 \cdot (15 \cdot \ln(2.40)) = 1 + 0.1 \cdot (15 \cdot 0.875) = 2.31 \implies \text{Capped at } 2.0$$
   $$\text{Adjusted Base} = 60 \times 1.32 = 79.2\text{ RP}$$
6. **$RP_{\text{streak}}$**: 4 consecutive ($S \ge 3$) = $+5\text{ RP}$
7. **$RP_{\text{consistency}}$**: Last 10 avg $71\% \ge 65\%$ = $+5\text{ RP}$
8. **Total $\Delta RP$**: $79.2 + 5 + 5 = 89.2 \approx \mathbf{89\text{ RP}}$

*Result*: The player gains **+89 RP**, elevating a 2-Star player ($100\text{ RP}$) directly to **189 RP (⭐⭐⭐ 3-Star Skilled Predictor)**!

---

## 4. Exploitation & Abuse Prevention Matrix

| Attack Vector | Threat Level | Mitigation Strategy Implemented |
| :--- | :--- | :--- |
| **Sybil Account Ringing** (Multiple accounts submitting same picks) | High | Internal MMR uses room percentile, not raw participant count; RP awards cap per user UID per jackpot. |
| **Longshot Farm Exploit** (Always picking 20.0+ underdogs to inflate difficulty) | Critical | Difficulty multiplier $M_{\text{difficulty}}$ is capped strictly at $2.0\times$ and logarithmic ($\ln(O_i)$). |
| **Camping at 5 Stars** (Reaching Legend then abandoning account) | High | Automated scheduled activity decay reduces RP by up to $15\%$ over 90 days of inactivity. |
| **Streak Reset Rage-Quitting** | Medium | Non-punitive -20% streak degradation prevents players from abandoning accounts after 1 bad week. |
| **Low-Match Jackpot Farming** | Medium | All RP awards are normalized by match length multiplier $N / 17$. |

---

## 5. Scalability & High-Throughput Performance Architecture

For platforms with millions of users submitting slips simultaneously:
1. **Asynchronous Queue Processing**: Jackpot settlement is decoupled from HTTP requests. When a jackpot settles, a message is published to Google Cloud Pub/Sub or Kafka.
2. **Batch Firestore Mutations**: Leaderboards and RP updates execute in chunked 500-item atomic Firestore transactions.
3. **Read-Optimized Denormalization**: Player profile cards read pre-computed `stars`, `rp`, `mmr`, and `accuracyPct` from the `PlayerRatings` document in $O(1)$ constant time.
