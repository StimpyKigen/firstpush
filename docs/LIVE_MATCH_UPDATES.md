# MshindiRoom — Live Match Updates (core infrastructure)

> **Do not weaken the invariants below when changing fixtures, schemas, deployments or caches.**
> Run `npx tsx scripts/verify-live-updates.ts` (and `verify-pwa-and-live-lifecycle.ts`) before shipping.

## Provider (SportScore) — verified capabilities
- **No push/stream.** The SportScore MCP exposes only request/response tools (`get_matches`, `get_match_detail`, …).
  Real-time = efficient server polling of:
  - `https://sportscore.com/api/widget/matches/?sport=football` (live + recent list)
  - `https://sportscore.com/api/widget/match/?sport=football&slug=<slug>` (score, `status`, `live_minute`, `incidents`, HT scores)
- Incident shape (captured from the real API): `{ time, type, type_id, side, player, is_goal|is_card|is_sub, home_score, away_score (goals), player_in/out (subs) }`.
  Goals carry the score *after* the goal. Types seen: Goal, Yellow card, Substitution, VAR (type_id 28), Penalty missed.
  **VAR events carry no decision text** — a decision is shown only if SportScore ever supplies one (`decision|result|reason|text|description`).
- Incidents have **no provider event ID**; MshindiRoom derives a stable ID `<min>'_<type>_<side>_<player>[#n]`.

## Data flow
SportScore → `syncLiveScoresOnly()` (`src/lib/sportsFeedService.ts`; list + per-match widget enrichment, 8 concurrent)
→ `normalizeSportScoreIncidents` → `ingestFixtures` → `mergeMarketFixtureRecords` (`src/lib/fixtureIdentity.ts`)
→ `fixturesStore` (+ disk/Firestore snapshot) → `realtimeBroadcaster` (`src/lib/realtimeBroadcaster.ts`) emits
`score_update | status_change | incident | fixture_upsert | odds_update | live_snapshot`
→ `/api/sports/stream` (SSE) → `realtimeClient` → `freeMatches.ts` handlers → `FixtureSportCard` via `liveEventTracker`.
Fallback/safety nets: `/api/sports/live` adaptive polling in `footballApi.ts`, `live_snapshot` on every (re)connect, `Last-Event-ID` replay.

## Permanent invariants (protected by tests)
1. **Stale-observation guard** (`mergeMarketFixtureRecords`): data observed *earlier* than what we hold (`observedAtMs`/`syncedAt`) may enrich metadata only; it can never change status, period, clock, score, or delete incidents (incidents merge additively). Only `isAuthoritativeCorrection` bypasses it.
2. Terminal state (`post`) never reverts to live/scheduled from schedule refreshes; scheduled `0–0/null` never erases live scores.
3. All writes are idempotent upserts; there is no destructive collection replacement on the live path (`fixturesStore.clear()` exists only in the admin clear action).
4. SSE event IDs are wall-clock based (monotonic across instances/restarts) so reconnecting to another instance never drops new frames.
5. Client drops SSE score/status frames older than the last applied frame (`isStaleRealtimeFrame`, `lastRealtimeAtMs`).
6. Card notifications come only from provider data via `src/lib/liveCardEvents.ts` (goal = score exceeds highest seen score while live, never during shootouts; scorer matched by `scoreAfter`; delayed scorer enriches the same notification; named cards only; subs silent; VAR never attributed to a team; per-match seen-set survives re-renders and reconnects). Duration: 5 s (`CARD_NOTIFICATION_MS`).

## Critical files
`sportsFeedService.ts`, `fixtureIdentity.ts`, `matchStatus.ts`, `realtimeBroadcaster.ts`, `realtimeClient.ts`, `freeMatches.ts`, `liveCardEvents.ts`,
`FixtureSportCard.tsx`, `api/sports.ts`, `vercel.json`, `scripts/verify-live-updates.ts`.
DB: Firestore fixture snapshot (`fixtureSnapshotStore.ts`); fixture fields `status, period, displayClock, homeScore, awayScore, incidents[], syncedAt, observedAtMs, updateVersion`.

## Deployment requirements & known platform limits
- **Vercel Hobby cannot keep a background worker or unlimited SSE.** Functions freeze between requests, SSE is renewed every 25 s (`event: reconnect`), and Hobby cron is at most daily. Polling therefore runs **while at least one SSE/HTTP client is connected to a warm instance**; unwatched matches are reconciled on the next visit via `/api/sports/live`, `/api/sports/daily-fixtures` and the Firestore snapshot.
- For updates independent of viewers, run `server.ts` on an always-on host (it starts `startLiveTelemetryCoordinator`) **or** call `GET/POST /api/sports/sync-live` every 30–60 s from an external scheduler (e.g. GitHub Actions/cron-job.org). Multiple instances are safe: each polls the same authority and all merges are idempotent and order-guarded.
- Keep `SPORTS_FEED_API_KEY`, `CRON_SECRET`, Firebase credentials in server environment variables only. **Action item:** `sportsFeedService.ts` still contains a hard-coded fallback API key — rotate it and remove the fallback.

