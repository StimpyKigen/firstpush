# Detailed Directory & Folder Structure

```
/
├── .env.example                     # Template for environment variables
├── .gitignore                       # Git ignore list
├── CHANGELOG.md                     # Semantic versioning changelog
├── CONTRIBUTING.md                  # Guidelines for open-source contributors
├── README.md                        # Primary repository documentation
├── firebase-applet-config.json      # Firebase web configuration
├── firebase-blueprint.json          # Firestore schema blueprint
├── firestore.rules                  # Firebase Firestore security rules
├── index.html                       # Single Page App HTML entry point
├── metadata.json                    # Application metadata and major capabilities
├── package.json                     # Project dependencies and npm scripts
├── server.ts                        # Express server & Gemini AI API routes
├── tsconfig.json                    # TypeScript compiler configuration
├── vite.config.ts                   # Vite build, alias, and dev server config
│
├── docs/                            # Technical Documentation Suite
│   ├── RATING_ALGORITHM_SPEC.md     # Punter 5-Star rating calculation spec
│   ├── api.md                       # REST API endpoint reference
│   ├── architecture.md              # System design and data flow diagrams
│   ├── authentication.md            # OTP auth, anonymous sessions, & security
│   ├── coding-standards.md          # TypeScript and React coding rules
│   ├── community.md                 # Pick consensus algorithms & chat panels
│   ├── database.md                  # Firestore ERD & collection specs
│   ├── deployment.md                # Cloud Run container deployment guide
│   ├── folder-structure.md          # Detailed directory reference (this file)
│   ├── installation.md              # Local development setup instructions
│   ├── moderation.md                # Content filtering & admin dashboard
│   ├── notifications.md             # Push notifications & alert queues
│   ├── payments.md                  # M-Pesa Express (STK Push) integration spec
│   ├── performance.md               # Optimization benchmarks & caching rules
│   ├── pwa.md                       # Service worker & PWA manifest setup
│   ├── release-process.md           # Deployment checklist & versioning flow
│   ├── roadmap.md                   # Implemented vs planned feature matrix
│   ├── security.md                  # Security headers, rate limiting, & CSP
│   ├── testing.md                   # Linting, type checks, & QA procedures
│   ├── theme-system.md              # Dark/light theme state & Tailwind tokens
│   ├── troubleshooting.md           # Technical knowledge base & error solutions
│   └── wallet.md                    # Ledger tracking & room unlock payments
│
├── public/                          # Static Web Assets
│   ├── manifest.json                # Web App Manifest for mobile PWA install
│   ├── sw.js                        # Service Worker script
│   └── icon-192.png                 # App icon 192x192
│
├── scripts/                         # DevOps & Build Utility Scripts
│   ├── build.sh                     # Production build runner
│   └── verify.js                    # Pre-flight linter verification
│
└── src/                             # Application Source Code
    ├── App.tsx                      # Root component & page routing
    ├── firebase.ts                  # Firebase SDK re-export module
    ├── main.tsx                     # React DOM entry point
    ├── index.css                    # Tailwind CSS imports & global styles
    ├── vite-env.d.ts                # Vite environment type declarations
    │
    ├── components/                  # Reusable React UI Components
    │   ├── AdminModerationDashboard.tsx # Admin report review & word blacklist
    │   ├── AvaChatSupport.tsx       # Floating Ava 24/7 AI chat widget
    │   ├── Avatar.tsx               # Punter avatar renderer
    │   ├── AvatarPicker.tsx         # Avatar selection modal
    │   ├── BetSlipCard.tsx          # Social bet slip card
    │   ├── CompactPickRow.tsx       # Compact match pick row
    │   ├── DiscussionPanel.tsx      # Real-time room chat stream
    │   ├── ErrorBoundary.tsx        # React Error Boundary fallback
    │   ├── Footer.tsx               # Footer component & navigation links
    │   ├── GameweekLeaderboard.tsx  # Leaderboard table & Mshindi Crown display
    │   ├── InviteModal.tsx          # Punter invite & share modal
    │   ├── JackpotAdminModal.tsx    # Jackpot fixture manager & AI parser
    │   ├── JackpotCard.tsx          # Jackpot room card widget
    │   ├── Logo.tsx                 # Mshindi Projo branding logo
    │   ├── MiniBrowserModal.tsx     # Embedded bookmaker viewer
    │   ├── ModerationWarningBox.tsx # Safety warning banner
    │   ├── Navbar.tsx               # Top navigation bar & balance pill
    │   ├── OfflineBar.tsx           # Offline connectivity banner
    │   ├── OtpInput.tsx             # 6-Digit OTP verification field
    │   ├── OutcomeBar.tsx           # Consensus percentage bar (1, X, 2)
    │   ├── PayGate.tsx              # KSh 10 M-Pesa room unlock modal
    │   ├── PickCard.tsx             # Match prediction selector card
    │   ├── PinInput.tsx             # 4-Digit M-Pesa PIN prompt
    │   ├── PlayerProfileModal.tsx   # Punter stats modal
    │   ├── PWAInstallPrompt.tsx     # Mobile home screen install banner
    │   ├── ReportModal.tsx          # Flag/Report content modal
    │   ├── ScrollToTop.tsx          # Route change scroll reset
    │   ├── StarRating.tsx           # 5-Star rating visualization
    │   └── adSystem/                # Ad Network Components
    │       ├── AdLoadingScreen.tsx  # Ad player loading transition
    │       ├── AdminAdSettingsModal.tsx # Ad provider settings modal
    │       ├── RewardedAdPlayer.tsx # Rewarded video ad player
    │       └── RoomAccessGate.tsx   # PayGate vs Ad Gate selector
    │
    ├── lib/                         # State Stores & Business Logic
    │   ├── authStore.ts             # User session & profile store
    │   ├── avatarCatalog.ts         # Preset avatar catalog
    │   ├── avatarStore.ts           # Avatar selection state
    │   ├── betSlipParser.ts         # Booking code extractor
    │   ├── betSlipStore.ts          # Social bet slip post store
    │   ├── consensusEngine.ts       # Pick percentage & slip generator
    │   ├── contentModeration.ts     # Profanity & spam filter
    │   ├── firebase.ts              # Firebase initialization & auth
    │   ├── followStore.ts           # Punter follow/unfollow store
    │   ├── footballApi.ts           # Live match scores & fixtures
    │   ├── freeMatches.ts           # Free match prediction rooms
    │   ├── jackpotFeed.ts           # Jackpot competition feed
    │   ├── jackpotMirrorService.ts  # Server scraper for SportPesa/Betika
    │   ├── mpesa.ts                 # M-Pesa Express STK push helper
    │   ├── notificationStore.ts     # Alert notifications store
    │   ├── p2pStore.ts              # P2P 1v1 wager contract store
    │   ├── punterRatings.ts         # Star rating calculator
    │   ├── ratingEngine.ts          # Advanced rating & decay algorithm
    │   ├── reportsStore.ts          # User reports store
    │   ├── store.ts                 # Main wallet & room unlock store
    │   ├── swRegister.ts            # Service worker registration
    │   ├── themeStore.ts            # Dark/light theme state
    │   └── types.ts                 # Global TypeScript interfaces
    │
    └── pages/                       # Application Route Views
        ├── Auth.tsx                 # Phone OTP login page
        ├── BetDetail.tsx            # Single wager detail page
        ├── BetSlipRoom.tsx          # Social bet slip sharing feed
        ├── CreateBet.tsx            # Custom P2P wager creator
        ├── FreeMatches.tsx          # Free prediction rooms index
        ├── FreeMatchRoom.tsx        # Single free match prediction room
        ├── Home.tsx                 # Homepage dashboard
        ├── HowItWorks.tsx           # Platform guide & FAQ
        ├── Leaderboard.tsx          # Gameweek leaderboard & rankings
        ├── P2PBets.tsx              # P2P 1v1 wagers list
        ├── Profile.tsx              # User profile & statistics
        ├── Room.tsx                 # Jackpot consensus room view
        └── WalletPage.tsx           # M-Pesa deposits & transaction ledger
```
