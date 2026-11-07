# MshindiRoom — Intelligent 24-Hour Stories Carousel, Progressive Image Caching & Lifecycle Architecture

This document defines the production architecture, database schema, caching invariants, real-time synchronization, and deployment safeguards for the MshindiRoom Homepage Editorial Stories Carousel.

---

## 1. Permanent Architectural Invariants

1. **24-Hour Independent Story Lifecycle (`CAROUSEL_STORY_TTL_MS = 86_400_000`)**:
   - Every published carousel post receives a server-authoritative `publishedAt` ISO timestamp and `expiresAt = publishedAt + 24 hours`.
   - Newly published stories always appear first (`Slide 0`) while unexpired stories retain their relative order.
   - Expired stories disappear immediately from both backend API responses (`getSavedHomepageFeedAsync`) and frontend active views (`getActiveCarouselItems`) even before physical database deletion runs.
   - Client clocks NEVER decide permanent deletion eligibility; frontend countdowns and immediate expiry compensate for device clock drift using `serverTime` returned by `/api/homepage-feed`.

2. **Strict Separation Between Image Caching and Story Expiration**:
   - **Story expiration** is governed strictly by `expiresAt` vs authoritative server time in `serverHomepageFeed.ts` and `homepageFeedStore.ts`.
   - **Image binary caching** is governed strictly by `carouselImageCache.ts` inside Browser `Cache Storage` (`mshindi-carousel-media-v1`).
   - Evicting or missing a cached image binary NEVER hides an unexpired story (it re-fetches transparently from the network), and retaining a cached image binary NEVER causes an expired story to reappear.

3. **Progressive Loading in Batches of 3 & Single Initial Skeleton**:
   - On first visit (or empty cache), `EditorialCarouselSkeleton` renders **once** while the active feed resolves and the first batch of up to `3` photographs (`CAROUSEL_BATCH_SIZE = 3`) downloads, stores into `Cache Storage`, and hardware-decodes (`img.decode()`).
   - Once the initial batch (`<= 3` images) settles, the skeleton is dismissed permanently and subsequent slides load progressively in sequential background batches of `3` (`[3..5]`, `[6..8]`, ...).
   - No full skeleton is ever shown again between batches or slide transitions.

4. **10-Second Auto-Advance & Atomic Photo + Caption Synchronization**:
   - Automatic slide transitions occur every **10 seconds** (`CAROUSEL_AUTO_ADVANCE_MS = 10_000`).
   - Transitions wait until the target slide's photograph has finished downloading and decoding (`preloadCarouselStoryItem`) before fading or committing state.
   - `Home.tsx` binds `<img src={currentRenderImageUrl}>`, heading, caption, source credit, link, and 24-hour countdown to a single atomic `CommittedCarouselSlide` object (`displayedSlide`), making it impossible to render a new caption over a previous photograph.

5. **Zero Deployment Resets & Vercel Hobby Compliance**:
   - Production carousel data lives in Cloud Firestore (`siteContent/homepageFeed` and `siteContent/post_{id}`), never in static deployment bundles (`data/homepage_feed.json` remains empty `[]` in git).
   - Scheduled cleanup reuses `/api/homepage-feed?action=cleanup`, adding **0** extra Vercel Serverless Functions (keeping total deployment functions at **4 / 12**).

---

## 2. Critical Services & File Map

| File | Responsibility |
| :--- | :--- |
| `src/lib/serverHomepageFeed.ts` | Authoritative server-side persistence, feed reconciliation, 24h `publishedAt`/`expiresAt` normalization, `imageVersion` computation, read-time expiry filtering, idempotent physical DB + media cleanup (`cleanupExpiredCarouselPostsAsync`), and SSE broadcast trigger. |
| `api/homepage-feed.ts` | Vercel Serverless Function handling `GET /api/homepage-feed` (`no-store` + `serverTime`), admin-authenticated `POST /api/homepage-feed` (`save`, `upload-media`, `cleanup`), and Vercel Cron `GET /api/homepage-feed?action=cleanup`. |
| `server.ts` | Express Node runtime mirroring `/api/homepage-feed` (`no-store` + `serverTime` + `?action=cleanup`) plus startup and 10-minute background cleanup sweep (`setInterval(...).unref()`). |
| `src/lib/homepageFeedStore.ts` | Client-side external store (`useSyncExternalStore`), server clock-offset tracking (`updateServerClockOffset`, `getAuthoritativeNowMs`), front-insertion publishing (`minOrder - 1`), photo replacement versioning (`replaceCarouselItemPhoto`), and live sync via SSE (`carousel_update`), Firestore `onSnapshot`, `BroadcastChannel`, `storage`, and foreground `visibilitychange`. |
| `src/lib/carouselImageCache.ts` | Persistent binary image cache backed by Browser `Cache Storage` (`mshindi-carousel-media-v1`) + decoded `blob:` ObjectURL session pool, keyed by `(imageUrl + imageVersion)`, with storage caps (`30` images / `45 MB`), automatic pruning, CORS fallback, and in-flight deduplication. |
| `src/lib/carouselImagePreloader.ts` | Sequential 3-by-3 batch loader (`loadCarouselInBatchesOfThree`, `CAROUSEL_BATCH_SIZE = 3`) and single-slide preloader (`preloadCarouselStoryItem`, `preloadCarouselImage`). |
| `src/pages/Home.tsx` | Homepage Stories carousel consumer: single initial skeleton gate, atomic `displayedSlide` state, 10-second visibility-aware transition controller, live Slide `0` promotion for new admin posts, and live 24h story countdown badge. |
| `src/components/admin/AdminHomepageFeed.tsx` | Admin dashboard studio preserving photo URL & WebP upload, inline metadata editing, photo replacement, slide reordering, deletion, and live 24h countdown badges. |
| `public/sw.js` | Service Worker preserving `mshindi-carousel-media-v1` inside `VALID_CACHES` across build version upgrades while never caching `/api/homepage-feed`. |

---

## 3. Database Schema & Fields

### Cloud Firestore Collections (`siteContent`)
- **`siteContent/homepageFeed`**: Master document containing `{ carouselItems, videoItems, deletedIds, updatedAt }`.
- **`siteContent/post_{id}`**: Individual carousel story document mirrored for granular durability and atomic batch deletion on expiry.
- **`siteContent/media_{mediaId}`**: Permanent WebP binary payload (`base64` data URI) uploaded via `/api/homepage-feed?action=upload-media` and served at `/images/uploads/{mediaId}.webp`.

### `HomepageCarouselItem` Fields

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Globally unique story identifier (e.g. `photo-{timestamp}-{rand}`). |
| `imageUrl` | `string` | Public HTTPS image URL or `/images/uploads/{mediaId}.webp`. |
| `heading` | `string` | Bold editorial headline synchronized with the photograph. |
| `caption` | `string` | Editorial story summary synchronized with the photograph. |
| `source` | `string?` | Optional photo/editorial attribution credit. |
| `link` | `string?` | Optional external story URL. |
| `order` | `number` | Display priority (`minOrder - 1` on publish so newest stories appear at `Slide 0`). |
| `published` | `boolean` | Publication flag (`true` for active stories). |
| `isActive` | `boolean?` | Soft-visibility flag (`false` hides without deleting). |
| `status` | `'published' \| 'draft' \| 'archived'` | Editorial lifecycle status. |
| `createdAt` | `string` | ISO-8601 creation timestamp. |
| `publishedAt` | `string` | Authoritative ISO-8601 publication timestamp starting the 24-hour window. |
| `expiresAt` | `string` | Authoritative ISO-8601 expiration timestamp (`publishedAt + 86_400_000 ms`). |
| `updatedAt` | `string?` | ISO-8601 metadata modification timestamp. |
| `photoUpdatedAt` | `string?` | ISO-8601 timestamp updated ONLY when the photograph binary/URL changes. |
| `imageVersion` | `string?` | Deterministic FNV-1a hash of `(imageUrl + photoUpdatedAt)` used for binary cache invalidation. |
| `likes` / `likedBy` / `comments` | `number` / `string[]` / `Array` | Preserved social engagement metadata. |

### Bounded Tombstones (`deletedIds`)
- Deleted and expired story IDs are recorded in `deletedIds` (bounded to the most recent `MAX_TOMBSTONE_IDS = 300` entries) so stale tabs or out-of-order writes can never resurrect deleted or expired stories.

---

## 4. 24-Hour Expiration & Idempotent Server Cleanup

1. **Immediate Read-Time Filtering**:
   - Backend `getSavedHomepageFeedAsync()` filters every stored item through `isServerCarouselItemExpired(item, Date.now())` before returning HTTP responses.
   - Frontend `getActiveCarouselItems(feed, getAuthoritativeNowMs())` filters every item every second using the server-compensated clock (`Date.now() + serverClockOffsetMs`), immediately removing any story the instant its 24-hour window elapses.
2. **Physical Deletion (`cleanupExpiredCarouselPostsAsync`)**:
   - Reconciles all storage tiers (memory, `data/homepage_feed.json`, `data/homepage_posts.json`, `.cache/*`, and Cloud Firestore `siteContent/homepageFeed` + `siteContent/post_{id}`).
   - Physically deletes ONLY stories where server time `>= expiresAt` (never touches newer or unexpired stories).
   - Appends purged IDs into `deletedIds` tombstones.
   - Calls `purgeUnreferencedPermanentMedia(candidateUrls, remainingActiveItems)` to delete `/images/uploads/{mediaId}.webp` files and `siteContent/media_{mediaId}` docs **only** if no remaining unexpired story references the same media URL.
   - Broadcasts `carousel_update` over SSE if any records were purged.
   - Completely **idempotent**: running cleanup repeatedly when no additional stories have expired performs zero destructive writes and returns `purgedCount: 0`.

---

## 5. Persistent Binary Image Caching & Invalidation

- **Storage Engine**: Browser `Cache Storage` bucket `mshindi-carousel-media-v1` + in-memory decoded `blob:` ObjectURL pool (`carouselImageCache.ts`).
- **Cache Key**: Synthetic versioned request URL `https://carousel-cache.mshindiroom.internal/v1/{encodeURIComponent(imageVersion)}?src={encodeURIComponent(imageUrl)}`.
  - **Caption/Heading Edit**: `imageUrl` and `photoUpdatedAt` remain unchanged -> `imageVersion` is unchanged -> existing cached binary is reused with **0 network bytes downloaded**.
  - **Admin Photo Replacement (`replaceCarouselItemPhoto`)**: Updates `photoUpdatedAt` and recomputes `imageVersion` -> immediately misses old cache entry, downloads & decodes new photo, and `pruneCarouselImageCache` deletes the obsolete binary.
- **Bounds & Eviction Safety**:
  - Enforces `MAX_CACHED_CAROUSEL_IMAGES = 30` and `MAX_CACHED_CAROUSEL_BYTES = 45 * 1024 * 1024` (45 MB).
  - Cross-origin images without CORS headers gracefully fall back to standard browser `new Image()` preload + `img.decode()` without failing slide readiness.
  - Protected across Service Worker upgrades via `CAROUSEL_MEDIA_CACHE = 'mshindi-carousel-media-v1'` in `VALID_CACHES` (`public/sw.js`).

---

## 6. Scheduled Jobs & Hosting Compatibility

- **Vercel Production (`vercel.json`)**:
  - Cron entry: `{ "path": "/api/homepage-feed?action=cleanup", "schedule": "0 2 * * *" }` (daily at 02:00 UTC, compliant with Vercel Hobby once-daily cron rules).
  - Authorized via `Authorization: Bearer ${CRON_SECRET}`, `x-vercel-cron`, or `verifyAdminRequest`.
  - Combined with opportunistic non-blocking `cleanupExpiredCarouselPostsAsync()` triggered inside `getSavedHomepageFeedAsync()` whenever a read detects expired records, ensuring timely physical cleanup even between daily cron invocations.
- **Node / Persistent Server (`server.ts`)**:
  - Runs an initial cleanup sweep 15 seconds after boot and every 10 minutes (`600_000 ms`) via `.unref()` background timer.
- **Serverless Function Budget**:
  - Total API entrypoints under `api/`: **4** (`api/admin.ts`, `api/homepage-feed.ts`, `api/sports.ts`, `api/tokens.ts`), strictly within the Vercel Hobby limit of `12`.
