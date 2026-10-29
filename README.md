# Mshindi Projo 🇰🇪

> **Mshindi Room**: Kenya's Premier Peer-to-Peer Wager Platform, Bet Slip Consensus Engine, Live Jackpot Mirror, and Community Gameweek Leaderboard.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61dafb)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5+-646cff)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4+-06b6d4)](https://tailwindcss.com/)
[![Gemini AI](https://img.shields.io/badge/Gemini_AI-3.6_Flash-8e44ad)](https://ai.google.dev/)

---

## 📌 Overview

**Mshindi Projo** (Mshindi Room) is an analytical sports community and wagering platform tailored specifically for Kenyan sports punters. It provides real-time community consensus on major Kenyan bookmaker jackpots (SportPesa Mega Jackpot, Betika Midweek/Grand, MozzartBet, Odibets, etc.), allows punters to pool predictions, create P2P 1v1 wagers, track performance ratings, and get 24/7 AI-driven assistance powered by Google Gemini.

> ⚠️ **Notice**: Mshindi Room is an analytical consensus community and social wagering utility. It is **not** a licensed gambling operator. Punters place official bets directly on their preferred licensed sportsbooks.

---

## ✨ Key Features

- **🏆 Live Jackpot Consensus Engine**: Real-time aggregation of punter picks across 15 to 17 leg jackpots (SportPesa, Betika, MozzartBet, Odibets). Punters unlock consensus rooms for a flat KSh 10 fee via M-Pesa, wallet balance, or Mshindi Tokens.
- **🤖 Ava 24/7 AI Support & Site Guide**: Gemini 3.6 Flash-powered assistant offering instant guidance on room unlocks, leaderboards, M-Pesa deposits, and platform features.
- **⚽ Free Match Prediction Rooms**: Open discussion rooms for top daily European and African football matches with live consensus bars, reasoning feeds, and social discussions.
- **⚔️ P2P Custom 1v1 Wagers**: Create and challenge friends or community members on custom outcomes with M-Pesa escrow or room tokens.
- **🎖️ 5-Star Punter Rating Engine**: Dynamic performance scoring (1.0 to 5.0 stars) calculated from settled jackpot slips, crown bonuses, and prediction accuracy.
- **👑 Gameweek Leaderboard**: Real-time ranking of punters whose slips come closest to official jackpot winning outcomes, crowned with the weekly Mshindi Crown.
- **📲 Mobile PWA & Offline Access**: Full Progressive Web App support with service worker offline caching and installation directly to iOS and Android home screens.
- **🛡️ Community Moderation & Reporting**: Automated swearing/phone number/promotional link filtering and user report workflows.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide React Icons, Motion (Framer Motion API)
- **State Management**: Zustand, React `useSyncExternalStore` for persistent real-time subscriptions
- **Backend / API**: Express.js server bundled with Vite middleware in development and esbuild CJS in production
- **Database / Auth**: Firebase Firestore & Anonymous Authentication, with local sync store fallbacks
- **AI Integrations**: `@google/genai` SDK using `gemini-3.6-flash` model for Ava Chat Support, Sports Advisor, and Webpage Jackpot Parsing
- **Build & Runtime**: Node.js, Vite 5, esbuild, Cloud Run (Port 3000)

---

## 📂 Folder Structure Overview

```
├── docs/                        # Complete technical documentation suite
├── public/                      # Static web assets & PWA manifest
├── scripts/                     # Deployment and build scripts
├── src/
│   ├── components/              # Reusable UI components & Modals
│   ├── lib/                     # Core business logic, stores, & Firebase helpers
│   ├── pages/                   # Application route views (Home, Room, Auth, Wallet, etc.)
│   ├── types/                   # TypeScript interfaces and types
│   ├── App.tsx                  # Root App routing & global layout
│   └── main.tsx                 # Client entry point
├── server.ts                    # Express API server & Vite dev integration
├── metadata.json                # Applet configuration metadata
├── package.json                 # Project dependencies & npm scripts
└── vite.config.ts               # Vite build & alias configuration
```

For detailed folder structure breakdown, see [docs/folder-structure.md](docs/folder-structure.md).

---

## 🚀 Quick Start & Local Development

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm** or **bun**

### Installation Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/mshindi/mshindi-projo.git
   cd mshindi-projo
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and configure your keys:
   ```bash
   cp .env.example .env
   ```
   Set `GEMINI_API_KEY` with your Google Gemini API Key.

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   The application will boot at `http://localhost:3000`.

---

## 🏗️ Build & Production Deployment

To build the application for production:

```bash
npm run build
```

This executes a 2-step build process:
1. `vite build` - Compiles the React frontend into static assets in `dist/`.
2. `esbuild server.ts` - Bundles `server.ts` into a CommonJS production script `dist/server.cjs`.

To start the production server:

```bash
npm run start
```

For detailed deployment instructions on Cloud Run or Docker, see [docs/deployment.md](docs/deployment.md).

---

## 📚 Documentation Suite

Comprehensive technical documentation is available in the [`/docs`](docs/) directory:

| Document | Description |
| :--- | :--- |
| [Architecture](docs/architecture.md) | System design, data flow, & component hierarchy |
| [Installation](docs/installation.md) | Setup, requirements, and environment configuration |
| [Deployment](docs/deployment.md) | Containerization, Cloud Run, and CI/CD pipelines |
| [Authentication](docs/authentication.md) | OTP login, Firebase Anonymous auth, & session stores |
| [Database](docs/database.md) | Firestore schema, local state snapshots, & queries |
| [API Reference](docs/api.md) | Complete Express API endpoint reference |
| [Wallet System](docs/wallet.md) | Ledger tracking, M-Pesa transactions, & token balances |
| [Payments](docs/payments.md) | M-Pesa Express (STK Push) integration specifications |
| [Community](docs/community.md) | Pick consensus algorithms, chat panels, & punter ratings |
| [Moderation](docs/moderation.md) | Automated text filters, flag rules, & admin portal |
| [Notifications](docs/notifications.md) | Push notification store & local alert queues |
| [Theme System](docs/theme-system.md) | Dark/Light theme state & Tailwind design tokens |
| [PWA Implementation](docs/pwa.md) | Service Worker, offline caching, & manifest configuration |
| [Security](docs/security.md) | API rate limiting, CSP headers, XSS/CSRF mitigation |
| [Performance](docs/performance.md) | Code splitting, asset optimization, & bundle benchmarks |
| [Testing](docs/testing.md) | Linting, type checks, and debugging procedures |
| [Troubleshooting](docs/troubleshooting.md) | Common runtime issues & solution knowledge base |
| [Roadmap](docs/roadmap.md) | Implemented vs planned feature progression |
| [Coding Standards](docs/coding-standards.md) | TypeScript patterns, hook rules, & styling conventions |
| [Folder Structure](docs/folder-structure.md) | In-depth directory reference |
| [Release Process](docs/release-process.md) | Versioning, CHANGELOG updates, and deployment checks |

---

## 🤝 Contributing

We welcome contributions from the community! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) guide before submitting pull requests or issue reports.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🏆 Credits

Built with ❤️ for the Kenyan sports betting community by the **Mshindi Projo Engineering Team**.
