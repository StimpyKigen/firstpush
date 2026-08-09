# Changelog

All notable changes to the **Mshindi Projo** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-08-03

### Added
- **Gemini 3.6 Flash Integration**: Upgraded Ava Customer Support Specialist to Google Gemini 3.6 Flash model with enhanced system prompt instructions enforcing KSh 10 room unlock rates and factual restraint.
- **Jackpot Webpage Parser API**: Added AI-powered webpage scraper parser endpoint (`/api/gemini/parse-jackpot-text`) allowing admins to paste raw bookmaker jackpot web text to generate match fixtures automatically.
- **PWA Push Notifications & Installation**: Added service worker registration (`swRegister.ts`), web app manifest, and `PWAInstallPrompt` component for iOS/Android home screen installation.
- **Ad Network Rewarded Room Gates**: Integrated rewarded ad player components (`RewardedAdPlayer.tsx`, `RoomAccessGate.tsx`) supporting video ad watches for temporary room unlocks.
- **Comprehensive Documentation Suite**: Created 21 technical specification documents in `/docs/` covering architecture, database, API, wallet, security, PWA, and release processes.

### Fixed
- **React Hook Rules Compliance**: Fixed React runtime errors (`Invalid hook call` / `Cannot read properties of null (reading 'useState')`) caused by early return statements placed before hook invocations in `BetSlipRoom.tsx`, `CreateBet.tsx`, and `P2PBets.tsx`.
- **Duplicate React Bundles**: Resolved duplicate React package resolutions by adding `dedupe: ['react', 'react-dom', 'react-router-dom', 'zustand']` in `vite.config.ts`.
- **Local Store Snapshots**: Fixed infinite re-render loops in `useSyncExternalStore` hooks across `avatarStore.ts` and `adStore.ts` by stabilizing cached snapshot references.

---

## [1.1.0] - 2026-07-15

### Added
- **Jackpot Live Mirror Service**: Real-time server-side scraping and mirroring for SportPesa Mega Jackpot and Betika Midweek Jackpot fixtures (`/api/jackpots/mirror`).
- **Punter Rating Algorithm**: Implemented 5-star punter rating engine in `ratingEngine.ts` calculating weighted scores based on historical jackpot slip accuracy, crown wins, and activity decay.
- **Content Moderation System**: Added automated profanity, phone number, and external promo link filter (`contentModeration.ts`) with user reporting modal and admin moderation dashboard.
- **M-Pesa STK Push Simulation**: Enhanced wallet page with M-Pesa Express top-up simulation, PIN confirmation prompt, and receipt generation.

---

## [1.0.0] - 2026-06-01

### Added
- **Initial Release of Mshindi Room**: Core platform launch featuring Jackpot consensus rooms, Free match prediction rooms, P2P wagers, Gameweek Leaderboards, and user authentication.
- **Firebase Firestore Persistence**: Integrated Firestore collections for users, jackpot consensus picks, P2P bets, and discussion comments.
