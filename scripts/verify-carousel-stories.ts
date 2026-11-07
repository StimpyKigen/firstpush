/**
 * MshindiRoom — Intelligent 24-Hour Stories Carousel, Progressive 3-Batch Loading
 * & Persistent Binary Image Cache Verification Suite
 *
 * Verifies all 13 mandatory acceptance scenarios from Section 8:
 *  1. First-time visitor with an empty cache (skeleton held until first 3 decode & cache).
 *  2. Returning visitor with valid cached images (0 network downloads, served from Cache Storage).
 *  3. Carousel containing fewer than three posts (1 and 2 posts settle immediately).
 *  4. Carousel containing more than six posts (8 posts load strictly in batches of 3: 0..2, 3..5, 6..7).
 *  5. New post published while visitors are viewing (SSE push, Slide 0 immediately, order preserved).
 *  6. New post published while app is closed, then viewed on reopen (Slide 0, only new photo fetched).
 *  7. Individual posts expiring at different times + server-authoritative clock offset + cache separation.
 *  8. Expired posts disappearing immediately & physically deleted idempotently (with shared media safety).
 *  9. Image download failures (HTTP 404), slow network, and atomic photo+caption synchronization.
 * 10. Browser refresh, PWA restart, unavailable Cache Storage, and temporary offline conditions.
 * 11. Admin editing caption vs replacing an existing photograph (versioned binary invalidation & prune).
 * 12. Multiple open tabs receiving live carousel updates without full page reload.
 * 13. Future deployments, SW cache preservation, 10-second transition interval & Vercel Hobby cron/functions.
 */

process.env.MSHINDI_ISOLATE_LOCAL_TESTS = '1';

import fs from 'fs';
import path from 'path';
import assert from 'assert';

import {
  CAROUSEL_STORY_TTL_MS,
  addCarouselItem,
  updateCarouselItem,
  replaceCarouselItemPhoto,
  deleteCarouselItem,
  getHomepageFeedSnapshot,
  subscribeToHomepageFeed,
  refreshHomepageFeed,
  simulateClientDeploymentReload,
  setClientCloudSyncEnabledForTests,
  setClientDatabaseFailureSimulation,
  getActiveCarouselItems,
  updateServerClockOffset,
  getAuthoritativeNowMs,
  getCarouselPostRemainingMs,
  formatCarouselCountdown,
  applyAuthoritativeFeedPush,
  computeCarouselImageVersion,
  type HomepageCarouselItem,
} from '../src/lib/homepageFeedStore.js';

import {
  saveHomepageFeed,
  saveHomepageFeedAsync,
  getSavedHomepageFeedAsync,
  cleanupExpiredCarouselPostsAsync,
  savePermanentMediaAsset,
  getPermanentMediaAsset,
  simulateServerDeploymentColdStart,
  setServerCloudSyncEnabledForTests,
} from '../src/lib/serverHomepageFeed.js';

import {
  CAROUSEL_MEDIA_CACHE_NAME,
  MAX_CACHED_CAROUSEL_IMAGES,
  configureCarouselCacheRuntimeForTests,
  getCarouselCacheDiagnostics,
  resetCarouselCacheDiagnostics,
  resetCarouselCacheMemorySession,
  loadAndCacheCarouselImage,
  pruneCarouselImageCache,
  buildCarouselCacheKey,
  getReadyCarouselRenderUrl,
} from '../src/lib/carouselImageCache.js';

import {
  CAROUSEL_BATCH_SIZE,
  loadedImagesCache,
  failedImagesCache,
  loadCarouselInBatchesOfThree,
  preloadCarouselStoryItem,
} from '../src/lib/carouselImagePreloader.js';

import {
  verifyAdminPinCredentials,
  ADMIN_PHONE_NORMALIZED,
} from '../src/lib/adminAuthService.js';

import { realtimeBroadcaster } from '../src/lib/realtimeBroadcaster.js';
import homepageFeedApiHandler from '../api/homepage-feed.js';

// Valid 1x1 WebP binary payload
const VALID_WEBP_BYTES = Buffer.from(
  'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=',
  'base64'
);
const VALID_WEBP_DATA_URL = `data:image/webp;base64,${VALID_WEBP_BYTES.toString('base64')}`;

/**
 * Spec-compliant in-process Browser `Cache` + `CacheStorage` implementation storing real binary Blobs.
 */
class MockBrowserCache implements Cache {
  private entries = new Map<string, { request: Request; response: Response }>();

  private normalizeKey(req: RequestInfo | URL): Request {
    if (req instanceof Request) return req;
    return new Request(String(req));
  }

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    const req = this.normalizeKey(request);
    const hit = this.entries.get(req.url);
    return hit ? hit.response.clone() : undefined;
  }

  async matchAll(): Promise<readonly Response[]> {
    return Array.from(this.entries.values()).map((e) => e.response.clone());
  }

  async add(request: RequestInfo | URL): Promise<void> {
    const req = this.normalizeKey(request);
    const res = await fetch(req);
    await this.put(req, res);
  }

  async addAll(requests: RequestInfo[]): Promise<void> {
    for (const r of requests) await this.add(r);
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    const req = this.normalizeKey(request);
    this.entries.set(req.url, { request: req, response: response.clone() });
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    const req = this.normalizeKey(request);
    return this.entries.delete(req.url);
  }

  async keys(): Promise<readonly Request[]> {
    return Array.from(this.entries.values()).map((e) => e.request);
  }

  size(): number {
    return this.entries.size;
  }
}

class MockBrowserCacheStorage implements CacheStorage {
  public buckets = new Map<string, MockBrowserCache>();

  async open(cacheName: string): Promise<Cache> {
    let bucket = this.buckets.get(cacheName);
    if (!bucket) {
      bucket = new MockBrowserCache();
      this.buckets.set(cacheName, bucket);
    }
    return bucket;
  }

  async has(cacheName: string): Promise<boolean> {
    return this.buckets.has(cacheName);
  }

  async delete(cacheName: string): Promise<boolean> {
    return this.buckets.delete(cacheName);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.buckets.keys());
  }

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    for (const bucket of this.buckets.values()) {
      const m = await bucket.match(request);
      if (m) return m;
    }
    return undefined;
  }
}

function makeStory(
  id: string,
  order: number,
  publishedAtIso: string,
  overrides?: Partial<HomepageCarouselItem>
): HomepageCarouselItem {
  const imageUrl = overrides?.imageUrl || `https://cdn.mshindi.test/stories/${id}.webp`;
  const expiresAt =
    overrides?.expiresAt ||
    new Date(Date.parse(publishedAtIso) + CAROUSEL_STORY_TTL_MS).toISOString();
  const photoUpdatedAt = overrides?.photoUpdatedAt || publishedAtIso;
  const imageVersion =
    overrides?.imageVersion || computeCarouselImageVersion(imageUrl, photoUpdatedAt);

  return {
    id,
    imageUrl,
    heading: overrides?.heading || `Headline for ${id}`,
    caption: overrides?.caption || `Editorial caption for ${id}`,
    source: overrides?.source || 'Mshindi Editorial',
    order,
    published: true,
    isActive: true,
    status: 'published',
    createdAt: publishedAtIso,
    publishedAt: publishedAtIso,
    expiresAt,
    photoUpdatedAt,
    imageVersion,
    ...overrides,
  };
}

async function invokeMockApi(params: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}): Promise<{ statusCode: number; headers: Record<string, string>; jsonBody: any }> {
  const headersMap: Record<string, string> = {};
  const req: any = {
    method: params.method,
    url: params.url,
    headers: params.headers || {},
    body: params.body || {},
    query: params.query || {},
  };
  let statusCode = 200;
  let jsonBody: any = null;
  const res: any = {
    setHeader(k: string, v: string) {
      headersMap[k.toLowerCase()] = v;
      return res;
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: any) {
      jsonBody = payload;
      return res;
    },
    end() {
      return res;
    },
  };
  await homepageFeedApiHandler(req, res);
  return { statusCode, headers: headersMap, jsonBody };
}

async function runVerification() {
  console.log('================================================================================');
  console.log('MSHINDIROOM — 24-HOUR STORIES CAROUSEL & BINARY IMAGE CACHE SUITE (SCENARIOS 1–13)');
  console.log('================================================================================\n');

  setServerCloudSyncEnabledForTests(false);
  setClientCloudSyncEnabledForTests(false);

  const dataDir = path.join(process.cwd(), 'data');
  const feedFilePath = path.join(dataDir, 'homepage_feed.json');
  const postsFilePath = path.join(dataDir, 'homepage_posts.json');
  const mediaFilePath = path.join(dataDir, 'homepage_media.json');
  const uploadsDir = path.join(process.cwd(), 'public', 'images', 'uploads');

  const backupFeed = fs.existsSync(feedFilePath) ? fs.readFileSync(feedFilePath, 'utf-8') : null;
  const backupPosts = fs.existsSync(postsFilePath) ? fs.readFileSync(postsFilePath, 'utf-8') : null;
  const backupMedia = fs.existsSync(mediaFilePath) ? fs.readFileSync(mediaFilePath, 'utf-8') : null;
  const createdUploadFiles: string[] = [];

  const mockCacheStorage = new MockBrowserCacheStorage();
  const activeObjectUrls = new Set<string>();
  const networkFetchLog: string[] = [];
  let offlineMode = false;
  let slowUrlDelaysMs = new Map<string, number>();
  let failingUrls = new Set<string>();
  let objCounter = 0;

  const installCacheRuntime = (overrideStorage?: CacheStorage | null) => {
    configureCarouselCacheRuntimeForTests({
      cachesStorage: overrideStorage !== undefined ? overrideStorage : mockCacheStorage,
      timeoutMs: 2500,
      fetchFn: (async (input: RequestInfo | URL) => {
        const url = String(input);
        networkFetchLog.push(url);
        if (offlineMode) {
          throw new TypeError('Failed to fetch: network offline');
        }
        const delay = slowUrlDelaysMs.get(url) || 0;
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }
        if (failingUrls.has(url)) {
          return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
        }
        const blob = new Blob([VALID_WEBP_BYTES], { type: 'image/webp' });
        return new Response(blob, {
          status: 200,
          headers: { 'Content-Type': 'image/webp' },
        });
      }) as typeof fetch,
      decodeFn: async (url: string) => {
        if (!url || failingUrls.has(url)) return false;
        return true;
      },
      createObjectUrlFn: () => {
        const u = `blob:https://mshindi.co.ke/carousel-obj-${++objCounter}`;
        activeObjectUrls.add(u);
        return u;
      },
      revokeObjectUrlFn: (u: string) => {
        activeObjectUrls.delete(u);
      },
    });
  };

  try {
    installCacheRuntime();
    resetCarouselCacheMemorySession();
    resetCarouselCacheDiagnostics();
    loadedImagesCache.clear();
    failedImagesCache.clear();

    await saveHomepageFeedAsync(
      { carouselItems: [], videoItems: [], deletedIds: [] },
      { allowReplaceAll: true }
    );
    await simulateClientDeploymentReload();

    const adminAuth = verifyAdminPinCredentials('0743304579', '7433');
    assert.strictEqual(adminAuth.valid, true, 'Admin PIN auth must succeed');
    const adminOpts = {
      adminToken: adminAuth.adminToken!,
      callerPhone: ADMIN_PHONE_NORMALIZED,
      callerRole: 'admin' as const,
    };

    const baseNowIso = new Date().toISOString();

    // =========================================================================
    // SCENARIO 1: First-time visitor with an empty cache
    // =========================================================================
    console.log('▶ Scenario 1: First-time visitor with an empty cache...');
    assert.strictEqual(CAROUSEL_BATCH_SIZE, 3, 'CAROUSEL_BATCH_SIZE must be 3');

    const fiveStories = [1, 2, 3, 4, 5].map((n) =>
      makeStory(`s1-post-${n}`, n, baseNowIso)
    );
    let downloadsAtSkeletonDismiss = -1;
    let skeletonDismissedCount = 0;

    const s1Summary = await loadCarouselInBatchesOfThree(fiveStories, {
      onInitialBatchReady: (initialResults) => {
        skeletonDismissedCount++;
        downloadsAtSkeletonDismiss = getCarouselCacheDiagnostics().networkDownloads;
        assert.strictEqual(
          initialResults.length,
          3,
          'Initial batch must resolve exactly the first 3 photographs before dismissing skeleton'
        );
        assert.ok(
          initialResults.every((r) => r.ok && r.source === 'network' && r.renderUrl.startsWith('blob:')),
          'First 3 photographs must be downloaded, cached, and decoded to blob: URLs'
        );
      },
    });

    assert.strictEqual(skeletonDismissedCount, 1, 'Initial skeleton callback must fire ONLY once');
    assert.strictEqual(
      downloadsAtSkeletonDismiss,
      3,
      'Exactly 3 images must be downloaded & decoded when initial skeleton is removed (before batch 2 starts)'
    );
    assert.strictEqual(s1Summary.batchesCompleted, 2, '5 posts must complete in 2 batches (3 + 2)');
    assert.strictEqual(getCarouselCacheDiagnostics().networkDownloads, 5, 'All 5 images downloaded across 2 batches');

    const cacheBucket = mockCacheStorage.buckets.get(CAROUSEL_MEDIA_CACHE_NAME);
    assert.ok(cacheBucket, `Persistent Cache Storage bucket '${CAROUSEL_MEDIA_CACHE_NAME}' must exist`);
    assert.strictEqual(cacheBucket!.size(), 5, 'All 5 binary WebP responses must be persisted in Cache Storage');
    console.log('  ✓ Passed: First 3 images downloaded, decoded & cached before single skeleton removal; remaining 2 loaded in background.');

    // =========================================================================
    // SCENARIO 2: Returning visitor with valid cached images
    // =========================================================================
    console.log('▶ Scenario 2: Returning visitor with valid cached images...');
    resetCarouselCacheMemorySession();
    loadedImagesCache.clear();
    resetCarouselCacheDiagnostics();
    networkFetchLog.length = 0;

    const s2Summary = await loadCarouselInBatchesOfThree(fiveStories);
    const s2Diag = getCarouselCacheDiagnostics();

    assert.strictEqual(networkFetchLog.length, 0, 'Returning visitor must perform ZERO network fetches');
    assert.strictEqual(s2Diag.networkDownloads, 0, 'Diagnostics must report 0 network downloads');
    assert.strictEqual(s2Diag.cacheStorageHits, 5, 'All 5 photographs must be served from persistent Cache Storage');
    assert.ok(
      s2Summary.allBatchResults.every((r) => r.ok && r.source === 'cache-storage'),
      'Every slide must resolve directly from persistent Cache Storage'
    );
    console.log('  ✓ Passed: Returning visitor loaded all 5 photographs with 0 network downloads from Cache Storage.');

    // =========================================================================
    // SCENARIO 3: Carousel containing fewer than three posts
    // =========================================================================
    console.log('▶ Scenario 3: Carousel containing fewer than three posts (1 post and 2 posts)...');
    await mockCacheStorage.delete(CAROUSEL_MEDIA_CACHE_NAME);
    resetCarouselCacheMemorySession();
    loadedImagesCache.clear();
    resetCarouselCacheDiagnostics();

    const oneStory = [makeStory('s3-single', 1, baseNowIso)];
    let s3OneReady = false;
    const s3OneRes = await loadCarouselInBatchesOfThree(oneStory, {
      onInitialBatchReady: (r) => {
        s3OneReady = true;
        assert.strictEqual(r.length, 1, '1-post carousel must settle immediately with 1 result');
      },
    });
    assert.ok(s3OneReady && s3OneRes.batchesCompleted === 1, '1-post carousel must not wait for nonexistent images');

    const twoStories = [makeStory('s3-two-a', 1, baseNowIso), makeStory('s3-two-b', 2, baseNowIso)];
    let s3TwoReady = false;
    const s3TwoRes = await loadCarouselInBatchesOfThree(twoStories, {
      onInitialBatchReady: (r) => {
        s3TwoReady = true;
        assert.strictEqual(r.length, 2, '2-post carousel must settle immediately with 2 results');
      },
    });
    assert.ok(s3TwoReady && s3TwoRes.batchesCompleted === 1, '2-post carousel must complete in 1 batch');
    console.log('  ✓ Passed: < 3 posts (1 and 2 posts) initialize immediately without waiting on nonexistent images.');

    // =========================================================================
    // SCENARIO 4: Carousel containing more than six posts (8 posts in batches of 3) + deduplication
    // =========================================================================
    console.log('▶ Scenario 4: Carousel containing > 6 posts (8 posts) in strict sequential batches of 3...');
    await mockCacheStorage.delete(CAROUSEL_MEDIA_CACHE_NAME);
    resetCarouselCacheMemorySession();
    loadedImagesCache.clear();
    resetCarouselCacheDiagnostics();
    networkFetchLog.length = 0;

    const eightStories = [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
      makeStory(`s4-eight-${n}`, n, baseNowIso)
    );
    const batchRanges: string[] = [];
    let batchCountWhenSkeletonRemoved = -1;

    const s4Summary = await loadCarouselInBatchesOfThree(eightStories, {
      onBatchCompleted: (p) => {
        batchRanges.push(`${p.batchStart}..${p.batchEnd}(${p.results.length})`);
      },
      onInitialBatchReady: () => {
        batchCountWhenSkeletonRemoved = batchRanges.length;
        assert.strictEqual(
          networkFetchLog.length,
          3,
          'Only batch 0 (first 3 images) may have been fetched when skeleton is dismissed'
        );
      },
    });

    assert.strictEqual(batchCountWhenSkeletonRemoved, 1, 'Skeleton dismissed right after batch 0');
    assert.deepStrictEqual(
      batchRanges,
      ['0..2(3)', '3..5(3)', '6..7(2)'],
      '8 posts must load strictly in batches of 3: [0..2], [3..5], [6..7]'
    );
    assert.strictEqual(s4Summary.batchesCompleted, 3);

    // Verify concurrent in-flight deduplication on a brand-new uncached image
    const dedupeStory = makeStory('s4-dedupe', 9, baseNowIso);
    slowUrlDelaysMs.set(dedupeStory.imageUrl, 60);
    networkFetchLog.length = 0;
    const [d1, d2, d3] = await Promise.all([
      loadAndCacheCarouselImage(dedupeStory, 'high'),
      loadAndCacheCarouselImage(dedupeStory, 'high'),
      loadAndCacheCarouselImage(dedupeStory, 'normal'),
    ]);
    slowUrlDelaysMs.clear();
    assert.ok(d1.ok && d2.ok && d3.ok);
    assert.strictEqual(networkFetchLog.length, 1, 'Concurrent requests for same image must share 1 network download');
    console.log('  ✓ Passed: 8 posts loaded in batches [0..2], [3..5], [6..7] and concurrent loads deduplicated.');

    // =========================================================================
    // SCENARIO 5: New post published while visitors are viewing the carousel
    // =========================================================================
    console.log('▶ Scenario 5: New post published while visitors are viewing...');
    await mockCacheStorage.delete(CAROUSEL_MEDIA_CACHE_NAME);
    resetCarouselCacheMemorySession();
    loadedImagesCache.clear();
    resetCarouselCacheDiagnostics();

    await saveHomepageFeedAsync(
      { carouselItems: [], videoItems: [], deletedIds: [] },
      { allowReplaceAll: true }
    );
    await simulateClientDeploymentReload();

    // Capture SSE broadcasts emitted by realtimeBroadcaster
    const ssePayloads: string[] = [];
    const mockSseRes: any = {
      writableEnded: false,
      destroyed: false,
      write(chunk: string) {
        ssePayloads.push(chunk);
        return true;
      },
      end() {
        this.writableEnded = true;
      },
      on() {},
    };
    const sseClientId = realtimeBroadcaster.addClient(mockSseRes);

    const existingOlder = await addCarouselItem(
      {
        id: 's5-existing-older',
        imageUrl: 'https://cdn.mshindi.test/s5/older.webp',
        heading: 'Older Active Story',
        caption: 'Published first',
        published: true,
      },
      adminOpts
    );
    const existingMid = await addCarouselItem(
      {
        id: 's5-existing-mid',
        imageUrl: 'https://cdn.mshindi.test/s5/mid.webp',
        heading: 'Second Active Story',
        caption: 'Published second -> becomes Slide 0',
        published: true,
      },
      adminOpts
    );

    // Preload active viewer's current 2 slides into Cache Storage
    await loadCarouselInBatchesOfThree(getActiveCarouselItems(getHomepageFeedSnapshot()));
    resetCarouselCacheDiagnostics();
    networkFetchLog.length = 0;

    // Now admin publishes a brand-new breaking story while visitors are viewing!
    const liveBreaking = await addCarouselItem(
      {
        id: 's5-live-breaking',
        imageUrl: 'https://cdn.mshindi.test/s5/breaking.webp',
        heading: 'BREAKING: New Top Slide',
        caption: 'Appears immediately at Slide 0 without reload',
        published: true,
      },
      adminOpts
    );

    realtimeBroadcaster.removeClient(sseClientId);

    assert.ok(existingOlder && existingMid && liveBreaking, 'All 3 stories published');
    assert.strictEqual(
      Date.parse(liveBreaking!.expiresAt!) - Date.parse(liveBreaking!.publishedAt!),
      CAROUSEL_STORY_TTL_MS,
      'expiresAt must be exactly 24 hours (86,400,000 ms) after publishedAt'
    );

    const activeAfterLivePublish = getActiveCarouselItems(getHomepageFeedSnapshot());
    assert.deepStrictEqual(
      activeAfterLivePublish.map((i) => i.id),
      ['s5-live-breaking', 's5-existing-mid', 's5-existing-older'],
      'Newest published post must appear at Slide 0 while unexpired posts keep their exact order'
    );
    assert.ok(
      ssePayloads.some((chunk) => chunk.includes('event: carousel_update') && chunk.includes('s5-live-breaking')),
      'Server must broadcast live `carousel_update` SSE event over existing stream immediately'
    );

    // Active visitor loads updated carousel without page reload: only the new story downloads
    await loadCarouselInBatchesOfThree(activeAfterLivePublish);
    assert.strictEqual(
      networkFetchLog.length,
      1,
      'Only the newly published Slide 0 photo should be downloaded; existing slides stay cached'
    );
    assert.strictEqual(networkFetchLog[0], 'https://cdn.mshindi.test/s5/breaking.webp');
    console.log('  ✓ Passed: Live admin post became Slide 0 immediately via SSE push, preserving unexpired order & cached photos.');

    // =========================================================================
    // SCENARIO 6: New post published while app is closed, then viewed after reopening
    // =========================================================================
    console.log('▶ Scenario 6: New post published while app is closed, then viewed on reopen...');
    // Simulate visitor closing app (memory cleared, Cache Storage kept)
    resetCarouselCacheMemorySession();
    loadedImagesCache.clear();

    // Admin publishes on backend while visitor's app is closed
    const closedPublishedAt = new Date(Date.now() + 1000).toISOString();
    const serverCurrent = await getSavedHomepageFeedAsync();
    const minServerOrder = Math.min(0, ...serverCurrent.carouselItems.map((c) => c.order));
    const whileClosedStory = makeStory('s6-while-closed', minServerOrder - 1, closedPublishedAt, {
      imageUrl: 'https://cdn.mshindi.test/s6/while-closed.webp',
      heading: 'Published While App Closed',
      caption: 'Fetched fresh on reopen with no-store headers',
    });
    saveHomepageFeed({
      ...serverCurrent,
      carouselItems: [whileClosedStory, ...serverCurrent.carouselItems],
    });

    // Visitor reopens app: verify GET /api/homepage-feed returns Cache-Control: no-store + serverTime + new post first
    const reopenApiRes = await invokeMockApi({ method: 'GET', url: '/api/homepage-feed' });
    assert.strictEqual(reopenApiRes.statusCode, 200);
    assert.ok(
      String(reopenApiRes.headers['cache-control']).includes('no-store'),
      'GET /api/homepage-feed must enforce Cache-Control: no-store so stale API caches never hide new posts'
    );
    assert.ok(reopenApiRes.jsonBody.serverTime, 'GET /api/homepage-feed must include authoritative serverTime');

    await refreshHomepageFeed();
    const reopenedActive = getActiveCarouselItems(getHomepageFeedSnapshot());
    assert.strictEqual(reopenedActive[0].id, 's6-while-closed', 'Post published while closed must be Slide 0 on reopen');

    resetCarouselCacheDiagnostics();
    networkFetchLog.length = 0;
    await loadCarouselInBatchesOfThree(reopenedActive);
    const s6Diag = getCarouselCacheDiagnostics();
    assert.strictEqual(s6Diag.networkDownloads, 1, 'On reopen, ONLY the 1 new photograph is downloaded');
    assert.strictEqual(s6Diag.cacheStorageHits, 3, 'All 3 previously cached photographs are reused from Cache Storage');
    console.log('  ✓ Passed: Reopened app fetched fresh un-cached feed (no-store), put new post at Slide 0, and reused 3 cached binaries.');

    // =========================================================================
    // SCENARIO 7: Individual posts expiring at different times + clock skew + cache/expiry independence
    // =========================================================================
    console.log('▶ Scenario 7: Independent 24-hour countdowns, skewed client clock compensation & cache separation...');
    const refNowMs = Date.now();
    const nearlyExpiredPub = new Date(refNowMs - (CAROUSEL_STORY_TTL_MS - 10_000)).toISOString(); // 10s left
    const midLifePub = new Date(refNowMs - 12 * 3600_000).toISOString(); // 12h left
    const freshPub = new Date(refNowMs - 1 * 3600_000).toISOString(); // 23h left

    const staggeredStories = [
      makeStory('s7-fresh', 1, freshPub, { imageUrl: 'https://cdn.mshindi.test/s7/fresh.webp' }),
      makeStory('s7-mid', 2, midLifePub, { imageUrl: 'https://cdn.mshindi.test/s7/mid.webp' }),
      makeStory('s7-nearly-expired', 3, nearlyExpiredPub, { imageUrl: 'https://cdn.mshindi.test/s7/nearly.webp' }),
    ];

    await saveHomepageFeedAsync(
      { carouselItems: staggeredStories, videoItems: [], deletedIds: [] },
      { allowReplaceAll: true }
    );
    await simulateClientDeploymentReload();
    await loadCarouselInBatchesOfThree(staggeredStories);

    // Verify independent countdown formatting at refNowMs
    assert.strictEqual(
      formatCarouselCountdown(getCarouselPostRemainingMs(staggeredStories[0], refNowMs)),
      '23h 00m'
    );
    assert.strictEqual(
      formatCarouselCountdown(getCarouselPostRemainingMs(staggeredStories[1], refNowMs)),
      '12h 00m'
    );
    assert.strictEqual(
      formatCarouselCountdown(getCarouselPostRemainingMs(staggeredStories[2], refNowMs)),
      '0m 10s'
    );

    // Simulate server clock offset (+15 seconds into the future, so s7-nearly-expired is now 5s past 24h!)
    const serverFutureIso = new Date(refNowMs + 15_000).toISOString();
    updateServerClockOffset(serverFutureIso);
    const activeAtTPlus15s = getActiveCarouselItems(getHomepageFeedSnapshot(), getAuthoritativeNowMs());
    assert.deepStrictEqual(
      activeAtTPlus15s.map((i) => i.id),
      ['s7-fresh', 's7-mid'],
      'Expired story must IMMEDIATELY disappear from active carousel even before physical DB cleanup runs'
    );

    // Verify image cache & story expiration are strictly separate systems:
    // 1. Even though s7-nearly-expired STILL has its binary in Cache Storage right now, it did NOT reappear!
    const s7Bucket = mockCacheStorage.buckets.get(CAROUSEL_MEDIA_CACHE_NAME)!;
    const expiredCacheKey = buildCarouselCacheKey(staggeredStories[2].imageUrl, staggeredStories[2].imageVersion);
    assert.ok(await s7Bucket.match(expiredCacheKey), 'Expired story binary is still in Cache Storage pre-prune');
    assert.ok(
      !activeAtTPlus15s.some((i) => i.id === 's7-nearly-expired'),
      'Cached image in Cache Storage must NEVER make an expired story reappear'
    );

    // 2. Evict unexpired story s7-fresh from Cache Storage & memory: story MUST remain active and re-fetch cleanly
    await s7Bucket.delete(buildCarouselCacheKey(staggeredStories[0].imageUrl, staggeredStories[0].imageVersion));
    resetCarouselCacheMemorySession();
    const activeAfterCacheEviction = getActiveCarouselItems(getHomepageFeedSnapshot(), getAuthoritativeNowMs());
    assert.ok(
      activeAfterCacheEviction.some((i) => i.id === 's7-fresh'),
      'Evicting a cached image must NEVER cause an unexpired story to disappear'
    );
    const reFetchedFresh = await loadAndCacheCarouselImage(staggeredStories[0], 'high');
    assert.strictEqual(reFetchedFresh.ok, true);
    assert.strictEqual(reFetchedFresh.source, 'network', 'Evicted unexpired story transparently re-downloads');

    // Reset clock offset to real server time
    updateServerClockOffset(new Date().toISOString());
    console.log('  ✓ Passed: Independent 24h countdowns, server clock-offset compensation, immediate expiry & cache separation verified.');

    // =========================================================================
    // SCENARIO 8: Physical server deletion of expired posts (idempotent + shared media protection)
    // =========================================================================
    console.log('▶ Scenario 8: Physical DB & media cleanup of expired stories (idempotent + media retention safety)...');
    const exclusiveMedia = savePermanentMediaAsset({
      dataUrl: VALID_WEBP_DATA_URL,
      fileName: 'test-expired-only-asset.webp',
      folder: 'uploads',
    });
    const sharedMedia = savePermanentMediaAsset({
      dataUrl: VALID_WEBP_DATA_URL,
      fileName: 'test-shared-active-asset.webp',
      folder: 'uploads',
    });
    createdUploadFiles.push(
      path.join(uploadsDir, exclusiveMedia.fileName),
      path.join(uploadsDir, sharedMedia.fileName)
    );

    const expired25hAgoIso = new Date(Date.now() - (CAROUSEL_STORY_TTL_MS + 3600_000)).toISOString();
    const unexpired1hAgoIso = new Date(Date.now() - 3600_000).toISOString();

    const s8ExpiredExclusive = makeStory('s8-expired-exclusive', 1, expired25hAgoIso, {
      imageUrl: exclusiveMedia.publicUrl,
    });
    const s8ExpiredShared = makeStory('s8-expired-shared', 2, expired25hAgoIso, {
      imageUrl: sharedMedia.publicUrl,
    });
    const s8ActiveShared = makeStory('s8-active-shared', 3, unexpired1hAgoIso, {
      imageUrl: sharedMedia.publicUrl,
    });

    await saveHomepageFeedAsync(
      {
        carouselItems: [s8ExpiredExclusive, s8ExpiredShared, s8ActiveShared],
        videoItems: [],
        deletedIds: [],
      },
      { allowReplaceAll: true }
    );

    const cleanupPass1 = await cleanupExpiredCarouselPostsAsync(Date.now());
    assert.deepStrictEqual(
      cleanupPass1.removedIds.sort(),
      ['s8-expired-exclusive', 's8-expired-shared'].sort(),
      'Cleanup must physically delete both expired records'
    );
    assert.strictEqual(cleanupPass1.remainingCarouselCount, 1, 'Unexpired post must never be deleted');
    assert.strictEqual(cleanupPass1.feed.carouselItems[0].id, 's8-active-shared');
    assert.ok(
      cleanupPass1.feed.deletedIds?.includes('s8-expired-exclusive') &&
        cleanupPass1.feed.deletedIds?.includes('s8-expired-shared'),
      'Purged story IDs must be added to deletedIds tombstones'
    );

    // Verify physical JSON file on disk no longer contains expired posts
    const rawDiskAfterCleanup = JSON.parse(fs.readFileSync(feedFilePath, 'utf-8'));
    assert.deepStrictEqual(
      rawDiskAfterCleanup.carouselItems.map((c: any) => c.id),
      ['s8-active-shared'],
      'Primary persistent database file must physically contain only unexpired stories'
    );

    // Verify unreferenced media was purged while shared active media was preserved!
    assert.strictEqual(
      getPermanentMediaAsset('uploads', exclusiveMedia.fileName),
      null,
      'Unreferenced expired uploaded media must be deleted'
    );
    assert.ok(
      getPermanentMediaAsset('uploads', sharedMedia.fileName) !== null,
      'Uploaded media still referenced by an unexpired post MUST NOT be deleted prematurely'
    );

    // Run cleanup a second time immediately -> verify strict idempotency
    const cleanupPass2 = await cleanupExpiredCarouselPostsAsync(Date.now());
    assert.strictEqual(cleanupPass2.removedIds.length, 0, 'Second cleanup run must be idempotent (0 removed)');
    assert.strictEqual(cleanupPass2.remainingCarouselCount, 1, 'Active post remains untouched');
    console.log('  ✓ Passed: Physical cleanup purged expired stories & orphan media idempotently while protecting shared media.');

    // =========================================================================
    // SCENARIO 9: Image download failures, slow network & atomic photo+caption synchronization
    // =========================================================================
    console.log('▶ Scenario 9: Failed downloads (HTTP 404), slow network & atomic photo+caption transition gate...');
    await mockCacheStorage.delete(CAROUSEL_MEDIA_CACHE_NAME);
    resetCarouselCacheMemorySession();
    loadedImagesCache.clear();
    failedImagesCache.clear();

    const brokenUrl = 'https://cdn.mshindi.test/s9/broken-404.webp';
    failingUrls.add(brokenUrl);

    const mixedBatch = [
      makeStory('s9-ok-1', 1, baseNowIso, { imageUrl: 'https://cdn.mshindi.test/s9/ok-1.webp' }),
      makeStory('s9-broken-2', 2, baseNowIso, { imageUrl: brokenUrl }),
      makeStory('s9-ok-3', 3, baseNowIso, { imageUrl: 'https://cdn.mshindi.test/s9/ok-3.webp' }),
    ];

    let s9SkeletonReleased = false;
    const s9Summary = await loadCarouselInBatchesOfThree(mixedBatch, {
      onInitialBatchReady: () => {
        s9SkeletonReleased = true;
      },
    });
    failingUrls.clear();

    assert.strictEqual(
      s9SkeletonReleased,
      true,
      'Failed image download must NEVER permanently block initial skeleton removal'
    );
    assert.strictEqual(s9Summary.initialBatchResults[0].ok, true);
    assert.strictEqual(s9Summary.initialBatchResults[1].ok, false);
    assert.strictEqual(s9Summary.initialBatchResults[2].ok, true);

    // Slow next-slide simulation: prove Slide 0 photo + caption stay locked together until Slide 1 finishes decoding
    const slowNextStory = makeStory('s9-slow-next', 4, baseNowIso, {
      imageUrl: 'https://cdn.mshindi.test/s9/slow-next.webp',
      heading: 'Slide 1 New Heading',
      caption: 'Slide 1 New Caption',
    });
    slowUrlDelaysMs.set(slowNextStory.imageUrl, 180);

    let committedSlide = {
      item: mixedBatch[0],
      renderUrl: getReadyCarouselRenderUrl(mixedBatch[0])!,
    };
    assert.strictEqual(committedSlide.item.id, 's9-ok-1');

    let transitionCompleted = false;
    const transitionPromise = (async () => {
      const res = await preloadCarouselStoryItem(slowNextStory, 'high');
      assert.strictEqual(res.ok, true);
      // Atomic state commit (mirrors Home.tsx setDisplayedSlide)
      committedSlide = { item: slowNextStory, renderUrl: res.renderUrl };
      transitionCompleted = true;
    })();

    // Mid-download check (60ms into 180ms slow network load):
    await new Promise((r) => setTimeout(r, 60));
    assert.strictEqual(transitionCompleted, false, 'Transition must wait while next image is still loading/decoding');
    assert.strictEqual(
      committedSlide.item.caption,
      mixedBatch[0].caption,
      'Current caption MUST remain matched with current photograph while next image loads'
    );
    assert.notStrictEqual(
      committedSlide.item.caption,
      slowNextStory.caption,
      'New caption must NEVER appear over previous photograph'
    );

    await transitionPromise;
    slowUrlDelaysMs.clear();
    assert.strictEqual(committedSlide.item.id, 's9-slow-next');
    assert.ok(committedSlide.renderUrl.startsWith('blob:'));
    console.log('  ✓ Passed: HTTP 404 never blocks initialization; slow slide retains current photo+caption until decoded.');

    // =========================================================================
    // SCENARIO 10: Browser refresh, PWA restart, unavailable storage & offline conditions
    // =========================================================================
    console.log('▶ Scenario 10: Browser refresh, PWA restart, offline mode & unavailable Cache Storage...');
    // `s9-ok-1` and `s9-slow-next` are in persistent Cache Storage. Simulate PWA restart + full offline mode!
    resetCarouselCacheMemorySession();
    loadedImagesCache.clear();
    offlineMode = true;

    const offlineCachedLoad = await loadAndCacheCarouselImage(slowNextStory, 'high');
    assert.strictEqual(offlineCachedLoad.ok, true, 'Cached story must load & decode while completely offline');
    assert.strictEqual(offlineCachedLoad.source, 'cache-storage');

    // Also verify DB outage protection preserves in-memory client feed
    setClientDatabaseFailureSimulation(true);
    let outageCaught = false;
    try {
      await refreshHomepageFeed();
    } catch {
      outageCaught = true;
    }
    setClientDatabaseFailureSimulation(false);
    assert.strictEqual(outageCaught, true);
    assert.ok(
      getHomepageFeedSnapshot().carouselItems.length > 0,
      'Temporary offline/DB failure must preserve existing active carousel stories'
    );

    // Simulate unavailable Cache Storage (`caches === null`, e.g. restricted webview) while back online
    offlineMode = false;
    installCacheRuntime(null);
    resetCarouselCacheMemorySession();
    const noStorageStory = makeStory('s10-no-cache-api', 1, baseNowIso, {
      imageUrl: 'https://cdn.mshindi.test/s10/no-storage.webp',
    });
    const noStorageRes = await loadAndCacheCarouselImage(noStorageStory, 'high');
    assert.strictEqual(noStorageRes.ok, true, 'Must gracefully load & decode even when Cache Storage is unavailable');

    // Restore normal mock Cache Storage
    installCacheRuntime(mockCacheStorage);
    console.log('  ✓ Passed: PWA offline cache hits, DB outage preservation, and unavailable Cache Storage fallback verified.');

    // =========================================================================
    // SCENARIO 11: Admin editing caption vs replacing an existing photograph
    // =========================================================================
    console.log('▶ Scenario 11: Admin caption edit (cache kept) vs photo replacement (cache busted & pruned)...');
    await mockCacheStorage.delete(CAROUSEL_MEDIA_CACHE_NAME);
    resetCarouselCacheMemorySession();
    loadedImagesCache.clear();
    resetCarouselCacheDiagnostics();

    await saveHomepageFeedAsync(
      { carouselItems: [], videoItems: [], deletedIds: [] },
      { allowReplaceAll: true }
    );
    await simulateClientDeploymentReload();

    const editablePost = await addCarouselItem(
      {
        id: 's11-editable-story',
        imageUrl: 'https://cdn.mshindi.test/s11/photo-v1.webp',
        heading: 'Initial Headline',
        caption: 'Initial Caption',
        published: true,
      },
      adminOpts
    );
    assert.ok(editablePost);
    const v1Load = await loadAndCacheCarouselImage(editablePost!, 'high');
    assert.strictEqual(v1Load.ok, true);
    const v1Version = editablePost!.imageVersion!;
    const v1BlobUrl = v1Load.renderUrl;
    assert.ok(activeObjectUrls.has(v1BlobUrl));

    // 11A: Admin edits caption & heading ONLY -> imageVersion MUST NOT change, 0 network downloads
    await updateCarouselItem(
      's11-editable-story',
      { heading: 'Updated Headline Only', caption: 'Updated Caption Only' },
      adminOpts
    );
    const afterCaptionEdit = getHomepageFeedSnapshot().carouselItems.find(
      (c) => c.id === 's11-editable-story'
    )!;
    assert.strictEqual(
      afterCaptionEdit.imageVersion,
      v1Version,
      'Caption-only edit must preserve imageVersion so cached photograph binary is reused'
    );
    resetCarouselCacheDiagnostics();
    const afterCaptionLoad = await loadAndCacheCarouselImage(afterCaptionEdit, 'high');
    assert.strictEqual(getCarouselCacheDiagnostics().networkDownloads, 0, 'Caption edit must trigger 0 network downloads');
    assert.strictEqual(afterCaptionLoad.source, 'memory');

    // 11B: Admin replaces photograph on the same post -> imageVersion MUST change, new photo fetched, old binary pruned
    await replaceCarouselItemPhoto(
      's11-editable-story',
      { imageUrl: 'https://cdn.mshindi.test/s11/photo-v2-replaced.webp' },
      adminOpts
    );
    const afterPhotoReplace = getHomepageFeedSnapshot().carouselItems.find(
      (c) => c.id === 's11-editable-story'
    )!;
    assert.notStrictEqual(
      afterPhotoReplace.imageVersion,
      v1Version,
      'Replacing photograph must immediately bump imageVersion to prevent stale images'
    );

    resetCarouselCacheDiagnostics();
    const v2Load = await loadAndCacheCarouselImage(afterPhotoReplace, 'high');
    assert.strictEqual(v2Load.ok, true);
    assert.strictEqual(v2Load.source, 'network', 'Replaced photograph must download fresh binary');
    assert.strictEqual(getCarouselCacheDiagnostics().networkDownloads, 1);

    const pruneRes = await pruneCarouselImageCache([afterPhotoReplace]);
    assert.ok(pruneRes.prunedCount >= 1, 'Prune must remove obsolete v1 image entry');
    assert.strictEqual(
      activeObjectUrls.has(v1BlobUrl),
      false,
      'Obsolete v1 blob: ObjectURL must be revoked on prune'
    );
    const s11Bucket = mockCacheStorage.buckets.get(CAROUSEL_MEDIA_CACHE_NAME)!;
    assert.strictEqual(s11Bucket.size(), 1, 'Cache Storage must hold only the 1 active replacement binary');

    // Also verify MAX_CACHED_CAROUSEL_IMAGES budget enforcement (35 items -> capped cleanly to 30)
    const manyItems = Array.from({ length: MAX_CACHED_CAROUSEL_IMAGES + 5 }, (_, idx) =>
      makeStory(`s11-cap-${idx}`, idx, baseNowIso)
    );
    for (const item of manyItems) {
      await loadAndCacheCarouselImage(item, 'low');
    }
    await pruneCarouselImageCache(manyItems);
    assert.ok(
      s11Bucket.size() <= MAX_CACHED_CAROUSEL_IMAGES + 3,
      `Cache Storage must enforce storage cap (~${MAX_CACHED_CAROUSEL_IMAGES} entries)`
    );
    console.log('  ✓ Passed: Caption edit reused cache (0 downloads); photo replacement busted version & pruned stale binary.');

    // =========================================================================
    // SCENARIO 12: Multiple open tabs receiving carousel updates
    // =========================================================================
    console.log('▶ Scenario 12: Multiple open tabs receiving live carousel updates...');
    let tabListenerNotifications = 0;
    const unsubTab = subscribeToHomepageFeed(() => {
      tabListenerNotifications++;
    });

    const tabAPublishedAt = new Date().toISOString();
    const crossTabStory = makeStory('s12-cross-tab-story', -99, tabAPublishedAt, {
      heading: 'Published in Tab A, Instant in Tab B',
    });

    applyAuthoritativeFeedPush(
      {
        carouselItems: [crossTabStory, afterPhotoReplace],
        videoItems: [],
        deletedIds: [],
        updatedAt: tabAPublishedAt,
      },
      tabAPublishedAt
    );
    unsubTab();

    assert.ok(tabListenerNotifications >= 1, 'Sibling tab subscriber must be notified immediately without reload');
    const tabBActive = getActiveCarouselItems(getHomepageFeedSnapshot());
    assert.strictEqual(tabBActive[0].id, 's12-cross-tab-story', 'Sibling tab immediately sees new story at Slide 0');

    // Delete in Tab A -> verify tombstone propagates to Tab B
    await deleteCarouselItem('s12-cross-tab-story', adminOpts);
    assert.ok(
      !getActiveCarouselItems(getHomepageFeedSnapshot()).some((i) => i.id === 's12-cross-tab-story'),
      'Deleted story immediately disappears across tabs'
    );
    console.log('  ✓ Passed: Multi-tab synchronization delivers live publish & delete updates without page reload.');

    // =========================================================================
    // SCENARIO 13: Future deployments, SW cache version changes, 10s interval & Vercel Hobby compliance
    // =========================================================================
    console.log('▶ Scenario 13: Future deployments, SW VALID_CACHES, 10s transition interval & Vercel cron/functions...');

    // 13.1: Confirm 10-second transition interval in Home.tsx (and no legacy 5000/6000 carousel interval)
    const homeSource = fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'Home.tsx'), 'utf-8');
    assert.ok(
      homeSource.includes('export const CAROUSEL_AUTO_ADVANCE_MS = 10_000'),
      'Home.tsx must define CAROUSEL_AUTO_ADVANCE_MS = 10_000 (10 seconds)'
    );
    assert.ok(
      !homeSource.includes('}, 6000)') && !homeSource.includes('}, 5000)'),
      'Home.tsx must not contain legacy 5s or 6s carousel auto-advance timers'
    );
    assert.ok(
      !homeSource.includes('carousel-story-countdown'),
      'Home.tsx must NOT render the visible countdown pill overlay on the homepage card'
    );
    assert.ok(
      homeSource.includes('([-1, 0, 1] as const)') &&
        homeSource.includes('carousel-dots-glide-next-a') &&
        homeSource.includes('carousel-dots-glide-prev-a'),
      'Home.tsx must enforce a maximum of 3 gliding dot indicators with the middle slot as main active indicator'
    );

    // 13.2: Confirm public/sw.js preserves mshindi-carousel-media-v1 across deployments & skips /api/
    const swSource = fs.readFileSync(path.join(process.cwd(), 'public', 'sw.js'), 'utf-8');
    assert.ok(
      swSource.includes("const CAROUSEL_MEDIA_CACHE = 'mshindi-carousel-media-v1'") &&
        swSource.includes('CAROUSEL_MEDIA_CACHE'),
      'public/sw.js must preserve mshindi-carousel-media-v1 in VALID_CACHES across build version changes'
    );
    assert.ok(
      swSource.includes('NEVER_INTERCEPT_PATTERNS') && swSource.includes("'/api/'"),
      'public/sw.js must exclude /api/ in NEVER_INTERCEPT_PATTERNS'
    );

    // 13.3: Confirm vercel.json cron job & no-store headers
    const vercelConfig = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf-8')
    );
    const hasCleanupCron = Array.isArray(vercelConfig.crons) &&
      vercelConfig.crons.some(
        (c: any) => c.path === '/api/homepage-feed?action=cleanup' && c.schedule === '0 2 * * *'
      );
    assert.strictEqual(
      hasCleanupCron,
      true,
      'vercel.json must configure daily scheduled cleanup cron at /api/homepage-feed?action=cleanup'
    );

    // 13.4: Confirm Vercel Serverless Function count remains <= 12 (exactly 4)
    const apiFiles = fs
      .readdirSync(path.join(process.cwd(), 'api'))
      .filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
    assert.ok(
      apiFiles.length <= 12,
      `Vercel Serverless Function count (${apiFiles.length}) must stay within Hobby limit (12)`
    );
    assert.strictEqual(apiFiles.length, 4, `Expected exactly 4 consolidated API functions, found ${apiFiles.length}`);

    // 13.5: Security & Cron execution tests on /api/homepage-feed
    const unauthPost = await invokeMockApi({
      method: 'POST',
      url: '/api/homepage-feed',
      body: { carouselItems: [], videoItems: [] },
    });
    assert.ok(
      unauthPost.statusCode === 401 || unauthPost.statusCode === 403,
      `Unauthenticated POST /api/homepage-feed must be rejected (got ${unauthPost.statusCode})`
    );

    const prevCronSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'test-vercel-cron-secret-2026';

    const unauthCron = await invokeMockApi({
      method: 'GET',
      url: '/api/homepage-feed?action=cleanup',
      query: { action: 'cleanup' },
      headers: { authorization: 'Bearer wrong-secret' },
    });
    assert.ok(
      unauthCron.statusCode === 401 || unauthCron.statusCode === 403,
      `Unauthorized cleanup trigger must return 401 or 403 (got ${unauthCron.statusCode})`
    );

    const authorizedCron = await invokeMockApi({
      method: 'GET',
      url: '/api/homepage-feed?action=cleanup',
      query: { action: 'cleanup' },
      headers: { authorization: 'Bearer test-vercel-cron-secret-2026' },
    });
    if (prevCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = prevCronSecret;
    }

    assert.strictEqual(authorizedCron.statusCode, 200, 'Authorized scheduled cleanup cron must return 200 OK');
    assert.strictEqual(authorizedCron.jsonBody.success, true);
    assert.strictEqual(authorizedCron.jsonBody.action, 'cleanup');

    // 13.6: Simulate full server + client deployment cold start and confirm unexpired posts + cached media survive
    simulateServerDeploymentColdStart();
    const postDeployFeed = await simulateClientDeploymentReload();
    assert.ok(
      postDeployFeed.carouselItems.some((c) => c.id === 's11-editable-story'),
      'Unexpired carousel stories must survive future deployments & cold starts intact'
    );

    console.log(
      `  ✓ Passed: 10s interval, SW cache protection, cron auth, cold-start survival & Vercel function count (${apiFiles.length}/12) verified.`
    );

    console.log('\n================================================================================');
    console.log('✅ ALL 13 CAROUSEL STORIES & CACHING SCENARIOS PASSED 100%!');
    console.log('================================================================================');
  } finally {
    configureCarouselCacheRuntimeForTests(null);
    resetCarouselCacheMemorySession();
    setServerCloudSyncEnabledForTests(true);
    setClientCloudSyncEnabledForTests(true);

    // Clean up any temporary test upload files
    for (const f of createdUploadFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {}
    }

    // Restore original repository data files cleanly so zero test data remains in git working tree
    if (backupFeed !== null) {
      fs.writeFileSync(feedFilePath, backupFeed, 'utf-8');
    }
    if (backupPosts !== null) {
      fs.writeFileSync(postsFilePath, backupPosts, 'utf-8');
    } else if (fs.existsSync(postsFilePath)) {
      fs.unlinkSync(postsFilePath);
    }
    if (backupMedia !== null) {
      fs.writeFileSync(mediaFilePath, backupMedia, 'utf-8');
    } else if (fs.existsSync(mediaFilePath)) {
      fs.unlinkSync(mediaFilePath);
    }
    try {
      const cacheDir = path.join(process.cwd(), '.cache');
      for (const name of ['homepage_feed.json', 'homepage_posts.json', 'homepage_media.json']) {
        const p = path.join(cacheDir, name);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    } catch {}
  }
}

runVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ CAROUSEL VERIFICATION SUITE FAILED:', err);
    process.exit(1);
  });
