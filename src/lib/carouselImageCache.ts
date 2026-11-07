/**
 * Persistent Binary Image-File Cache for MshindiRoom 24-Hour Stories Carousel
 *
 * Implements actual binary image caching (not merely URL tracking):
 * 1. Persistent Browser Cache Storage (`mshindi-carousel-media-v1`) keyed by `(imageUrl + imageVersion)`
 *    so returning visitors and restarted Android/iOS PWAs reuse binary image files without re-downloading,
 *    while admin photo edits/replacements immediately bust stale cached binaries.
 * 2. Off-main-thread hardware image decoding (`HTMLImageElement.decode()`) into ready `blob:` ObjectURLs
 *    so slide transitions never flash blank frames or show a new caption over a previous photograph.
 * 3. In-flight download deduplication so concurrent requests for the same image share a single network fetch.
 * 4. Automatic storage-budget enforcement (max 30 images / 45 MB) and pruning of expired/replaced binaries.
 * 5. Graceful degradation when Cache Storage is unavailable, quota-limited, evicted, CORS-restricted, or offline.
 *
 * IMPORTANT ARCHITECTURAL INVARIANT:
 * Image caching and 24-hour story expiration are strictly independent systems:
 * - Story visibility is governed solely by server-authoritative `expiresAt`.
 * - Evicting a cached image never hides an unexpired story (it transparently re-fetches).
 * - Having a cached image in Cache Storage never causes an expired story to reappear.
 */

import {
  computeCarouselImageVersion,
  type HomepageCarouselItem,
} from './homepageFeedStore.js';

export const CAROUSEL_MEDIA_CACHE_NAME = 'mshindi-carousel-media-v1';
export const MAX_CACHED_CAROUSEL_IMAGES = 30;
export const MAX_CACHED_CAROUSEL_BYTES = 45 * 1024 * 1024; // 45 MB cap for mobile PWA safety
export const CAROUSEL_IMAGE_LOAD_TIMEOUT_MS = 6_000;

export type CarouselImageLoadPriority = 'high' | 'normal' | 'low';

export interface CarouselImageLoadResult {
  ok: boolean;
  renderUrl: string;
  originalUrl: string;
  cacheKey: string;
  imageVersion: string;
  source: 'memory' | 'cache-storage' | 'network' | 'fallback-element' | 'data-url' | 'error';
  byteSize?: number;
  error?: string;
}

interface DecodedMemoryEntry {
  cacheKey: string;
  originalUrl: string;
  imageVersion: string;
  renderUrl: string;
  isObjectUrl: boolean;
  byteSize: number;
  decodedAt: number;
}

export interface CarouselCacheDiagnostics {
  networkDownloads: number;
  cacheStorageHits: number;
  memoryHits: number;
  failedDownloads: number;
  prunedEntries: number;
  inMemoryCount: number;
}

interface CarouselCacheRuntimeHooks {
  cachesStorage?: CacheStorage | null;
  fetchFn?: typeof fetch;
  decodeFn?: (url: string, priority: CarouselImageLoadPriority) => Promise<boolean>;
  createObjectUrlFn?: (blob: Blob) => string;
  revokeObjectUrlFn?: (url: string) => void;
  timeoutMs?: number;
}

const decodedMemoryPool = new Map<string, DecodedMemoryEntry>();
const inFlightLoads = new Map<string, Promise<CarouselImageLoadResult>>();

const diagnostics: CarouselCacheDiagnostics = {
  networkDownloads: 0,
  cacheStorageHits: 0,
  memoryHits: 0,
  failedDownloads: 0,
  prunedEntries: 0,
  inMemoryCount: 0,
};

let runtimeHooks: CarouselCacheRuntimeHooks = {};

export function configureCarouselCacheRuntimeForTests(hooks: CarouselCacheRuntimeHooks | null): void {
  runtimeHooks = hooks || {};
}

export function getCarouselCacheDiagnostics(): CarouselCacheDiagnostics {
  return {
    ...diagnostics,
    inMemoryCount: decodedMemoryPool.size,
  };
}

export function resetCarouselCacheDiagnostics(): void {
  diagnostics.networkDownloads = 0;
  diagnostics.cacheStorageHits = 0;
  diagnostics.memoryHits = 0;
  diagnostics.failedDownloads = 0;
  diagnostics.prunedEntries = 0;
}

/**
 * Clears in-memory session state (simulating browser refresh / PWA restart)
 * while leaving persistent Browser Cache Storage (`mshindi-carousel-media-v1`) intact.
 */
export function resetCarouselCacheMemorySession(): void {
  for (const entry of decodedMemoryPool.values()) {
    if (entry.isObjectUrl) {
      revokeSafeObjectUrl(entry.renderUrl);
    }
  }
  decodedMemoryPool.clear();
  inFlightLoads.clear();
}

export function resolveItemImageVersion(
  itemOrUrl: Pick<HomepageCarouselItem, 'imageUrl' | 'imageVersion' | 'photoUpdatedAt'> | string,
  explicitVersion?: string
): { cleanUrl: string; imageVersion: string } {
  if (typeof itemOrUrl === 'string') {
    const cleanUrl = itemOrUrl.trim();
    const imageVersion = explicitVersion || computeCarouselImageVersion(cleanUrl);
    return { cleanUrl, imageVersion };
  }
  const cleanUrl = (itemOrUrl.imageUrl || '').trim();
  const imageVersion =
    explicitVersion ||
    itemOrUrl.imageVersion ||
    computeCarouselImageVersion(cleanUrl, itemOrUrl.photoUpdatedAt);
  return { cleanUrl, imageVersion };
}

/**
 * Generates a deterministic, version-stamped synthetic HTTPS Request key for Cache Storage.
 * Editing or replacing an image changes `imageVersion`, guaranteeing immediate cache invalidation.
 */
export function buildCarouselCacheKey(imageUrl: string, imageVersion?: string): string {
  const cleanUrl = (imageUrl || '').trim();
  const resolvedVersion = imageVersion || computeCarouselImageVersion(cleanUrl);
  return `https://carousel-cache.mshindiroom.internal/v1/${encodeURIComponent(
    resolvedVersion
  )}?src=${encodeURIComponent(cleanUrl)}`;
}

/**
 * Synchronous lookup for already-decoded images in the current session.
 * Returns the ready-to-paint `renderUrl` (`blob:...` or verified URL) if ready, or `null` if not yet decoded.
 */
export function getReadyCarouselRenderUrl(
  itemOrUrl: Pick<HomepageCarouselItem, 'imageUrl' | 'imageVersion' | 'photoUpdatedAt'> | string | undefined
): string | null {
  if (!itemOrUrl) return null;
  const { cleanUrl, imageVersion } = resolveItemImageVersion(itemOrUrl);
  if (!cleanUrl) return null;
  const cacheKey = buildCarouselCacheKey(cleanUrl, imageVersion);
  const mem = decodedMemoryPool.get(cacheKey);
  return mem ? mem.renderUrl : null;
}

export function isCarouselItemImageReady(
  itemOrUrl: Pick<HomepageCarouselItem, 'imageUrl' | 'imageVersion' | 'photoUpdatedAt'> | string | undefined
): boolean {
  return getReadyCarouselRenderUrl(itemOrUrl) !== null;
}

function getCacheStorageApi(): CacheStorage | null {
  if (runtimeHooks.cachesStorage !== undefined) {
    return runtimeHooks.cachesStorage;
  }
  if (typeof globalThis !== 'undefined' && 'caches' in globalThis && globalThis.caches) {
    return globalThis.caches;
  }
  return null;
}

async function openCarouselMediaCache(): Promise<Cache | null> {
  const storage = getCacheStorageApi();
  if (!storage || typeof storage.open !== 'function') return null;
  try {
    return await storage.open(CAROUSEL_MEDIA_CACHE_NAME);
  } catch {
    return null;
  }
}

function createSafeObjectUrl(blob: Blob, fallbackUrl: string): { url: string; isObjectUrl: boolean } {
  if (runtimeHooks.createObjectUrlFn) {
    try {
      return { url: runtimeHooks.createObjectUrlFn(blob), isObjectUrl: true };
    } catch {
      return { url: fallbackUrl, isObjectUrl: false };
    }
  }
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    try {
      return { url: URL.createObjectURL(blob), isObjectUrl: true };
    } catch {
      return { url: fallbackUrl, isObjectUrl: false };
    }
  }
  return { url: fallbackUrl, isObjectUrl: false };
}

function revokeSafeObjectUrl(url: string): void {
  if (!url) return;
  if (runtimeHooks.revokeObjectUrlFn) {
    try {
      runtimeHooks.revokeObjectUrlFn(url);
    } catch {}
    return;
  }
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function' && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
}

async function decodeImageElement(
  src: string,
  priority: CarouselImageLoadPriority,
  timeoutMs: number
): Promise<boolean> {
  if (runtimeHooks.decodeFn) {
    return runtimeHooks.decodeFn(src, priority);
  }
  if (typeof Image === 'undefined') {
    // Non-DOM environment without custom decode hook: treat valid binary blob as decoded
    return true;
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
    const img = new Image();
    if ('fetchPriority' in img) {
      (img as any).fetchPriority = priority;
    }
    img.decoding = 'async';

    img.onload = () => {
      if (typeof img.decode === 'function') {
        img
          .decode()
          .then(() => finish(true))
          .catch(() => finish(true));
      } else {
        finish(true);
      }
    };

    img.onerror = () => finish(false);
    img.src = src;
  });
}

function isValidImageBlob(blob: Blob | null | undefined, contentTypeHeader?: string | null): boolean {
  if (!blob || blob.size <= 0) return false;
  const mime = (blob.type || contentTypeHeader || '').toLowerCase();
  if (mime.includes('text/html') || mime.includes('application/json')) {
    return false;
  }
  return true;
}

/**
 * Downloads (or retrieves from persistent Cache Storage), validates, hardware-decodes,
 * and caches a carousel story's photograph binary.
 */
export async function loadAndCacheCarouselImage(
  itemOrUrl:
    | Pick<HomepageCarouselItem, 'id' | 'imageUrl' | 'imageVersion' | 'photoUpdatedAt'>
    | string,
  priority: CarouselImageLoadPriority = 'normal'
): Promise<CarouselImageLoadResult> {
  const postId = typeof itemOrUrl === 'object' ? itemOrUrl.id : undefined;
  const { cleanUrl, imageVersion } = resolveItemImageVersion(itemOrUrl);

  if (!cleanUrl) {
    return {
      ok: false,
      renderUrl: '',
      originalUrl: '',
      cacheKey: '',
      imageVersion: '',
      source: 'error',
      error: 'Empty image URL',
    };
  }

  const cacheKey = buildCarouselCacheKey(cleanUrl, imageVersion);

  // 1. Check decoded in-memory pool (0ms synchronous hit)
  const memoryHit = decodedMemoryPool.get(cacheKey);
  if (memoryHit) {
    diagnostics.memoryHits++;
    return {
      ok: true,
      renderUrl: memoryHit.renderUrl,
      originalUrl: cleanUrl,
      cacheKey,
      imageVersion,
      source: 'memory',
      byteSize: memoryHit.byteSize,
    };
  }

  // 2. Deduplicate concurrent in-flight loads for the exact same versioned key
  const existingInFlight = inFlightLoads.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const timeoutMs = runtimeHooks.timeoutMs ?? CAROUSEL_IMAGE_LOAD_TIMEOUT_MS;

  const task = (async (): Promise<CarouselImageLoadResult> => {
    // Handle inline data:image/* URIs directly
    if (cleanUrl.startsWith('data:image/')) {
      const decoded = await decodeImageElement(cleanUrl, priority, timeoutMs);
      if (decoded) {
        decodedMemoryPool.set(cacheKey, {
          cacheKey,
          originalUrl: cleanUrl,
          imageVersion,
          renderUrl: cleanUrl,
          isObjectUrl: false,
          byteSize: cleanUrl.length,
          decodedAt: Date.now(),
        });
        return {
          ok: true,
          renderUrl: cleanUrl,
          originalUrl: cleanUrl,
          cacheKey,
          imageVersion,
          source: 'data-url',
          byteSize: cleanUrl.length,
        };
      }
      diagnostics.failedDownloads++;
      return {
        ok: false,
        renderUrl: cleanUrl,
        originalUrl: cleanUrl,
        cacheKey,
        imageVersion,
        source: 'error',
        error: 'Failed to decode inline data URL',
      };
    }

    // 3. Check persistent Browser Cache Storage (`mshindi-carousel-media-v1`)
    const mediaCache = await openCarouselMediaCache();
    if (mediaCache) {
      try {
        const cachedResponse = await mediaCache.match(cacheKey);
        if (cachedResponse && cachedResponse.ok) {
          const contentType = cachedResponse.headers.get('content-type');
          const blob = await cachedResponse.blob();
          if (isValidImageBlob(blob, contentType)) {
            const { url: renderUrl, isObjectUrl } = createSafeObjectUrl(blob, cleanUrl);
            const decoded = await decodeImageElement(renderUrl, priority, timeoutMs);
            if (decoded) {
              diagnostics.cacheStorageHits++;
              decodedMemoryPool.set(cacheKey, {
                cacheKey,
                originalUrl: cleanUrl,
                imageVersion,
                renderUrl,
                isObjectUrl,
                byteSize: blob.size,
                decodedAt: Date.now(),
              });
              return {
                ok: true,
                renderUrl,
                originalUrl: cleanUrl,
                cacheKey,
                imageVersion,
                source: 'cache-storage',
                byteSize: blob.size,
              };
            }
            if (isObjectUrl) {
              revokeSafeObjectUrl(renderUrl);
            }
          }
          // Corrupted or invalid cached entry — purge so fresh network fetch can recover
          await mediaCache.delete(cacheKey).catch(() => {});
        }
      } catch {
        // Storage read evicted or unavailable — proceed seamlessly to network fetch
      }
    }

    // 4. Network download -> binary Cache Storage persistence -> hardware decode
    const fetchImpl = runtimeHooks.fetchFn || (typeof fetch === 'function' ? fetch : null);
    if (fetchImpl) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const abortTimer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        const response = await fetchImpl(cleanUrl, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          ...(controller ? { signal: controller.signal } : {}),
        });
        if (abortTimer) clearTimeout(abortTimer);

        if (response && response.ok && response.status === 200) {
          const contentType = response.headers.get('content-type') || 'image/webp';
          const blob = await response.blob();
          if (isValidImageBlob(blob, contentType)) {
            diagnostics.networkDownloads++;

            // Persist binary file into Cache Storage for instant reuse on subsequent visits / PWA restarts
            if (mediaCache) {
              try {
                const storedResponse = new Response(blob, {
                  status: 200,
                  headers: {
                    'Content-Type': blob.type || contentType || 'image/webp',
                    'X-Mshindi-Post-Id': postId || '',
                    'X-Mshindi-Image-Version': imageVersion,
                    'X-Mshindi-Cached-At': String(Date.now()),
                    'X-Mshindi-Byte-Size': String(blob.size),
                    'X-Mshindi-Source-Url': cleanUrl,
                  },
                });
                await mediaCache.put(cacheKey, storedResponse);
                void enforceCarouselCacheStorageBudget(mediaCache);
              } catch {
                // Quota exceeded or private-mode restriction: continue without failing render
              }
            }

            const { url: renderUrl, isObjectUrl } = createSafeObjectUrl(blob, cleanUrl);
            const decoded = await decodeImageElement(renderUrl, priority, timeoutMs);
            if (decoded) {
              decodedMemoryPool.set(cacheKey, {
                cacheKey,
                originalUrl: cleanUrl,
                imageVersion,
                renderUrl,
                isObjectUrl,
                byteSize: blob.size,
                decodedAt: Date.now(),
              });
              return {
                ok: true,
                renderUrl,
                originalUrl: cleanUrl,
                cacheKey,
                imageVersion,
                source: 'network',
                byteSize: blob.size,
              };
            }
            if (isObjectUrl) {
              revokeSafeObjectUrl(renderUrl);
            }
          }
        } else if (response && response.status >= 400) {
          // Definitive HTTP error (404 / 500): do not retry redundant element load
          diagnostics.failedDownloads++;
          return {
            ok: false,
            renderUrl: cleanUrl,
            originalUrl: cleanUrl,
            cacheKey,
            imageVersion,
            source: 'error',
            error: `HTTP ${response.status}`,
          };
        }
      } catch {
        if (abortTimer) clearTimeout(abortTimer);
        // CORS restriction on third-party image host or offline state:
        // Fall through to native HTMLImageElement decode fallback when in browser
      }
    }

    // 5. Fallback for non-CORS third-party image hosts (loads & decodes via native <img>)
    if (typeof Image !== 'undefined' || runtimeHooks.decodeFn) {
      const elementDecoded = await decodeImageElement(cleanUrl, priority, timeoutMs);
      if (elementDecoded) {
        decodedMemoryPool.set(cacheKey, {
          cacheKey,
          originalUrl: cleanUrl,
          imageVersion,
          renderUrl: cleanUrl,
          isObjectUrl: false,
          byteSize: 0,
          decodedAt: Date.now(),
        });
        return {
          ok: true,
          renderUrl: cleanUrl,
          originalUrl: cleanUrl,
          cacheKey,
          imageVersion,
          source: 'fallback-element',
        };
      }
    }

    diagnostics.failedDownloads++;
    return {
      ok: false,
      renderUrl: cleanUrl,
      originalUrl: cleanUrl,
      cacheKey,
      imageVersion,
      source: 'error',
      error: 'Image download or decode failed',
    };
  })();

  inFlightLoads.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inFlightLoads.delete(cacheKey);
  }
}

/**
 * Enforces sensible storage limits (`MAX_CACHED_CAROUSEL_IMAGES` and `MAX_CACHED_CAROUSEL_BYTES`)
 * by evicting the oldest cached entries first when over budget.
 */
async function enforceCarouselCacheStorageBudget(
  cacheInstance?: Cache | null,
  protectedKeys: Set<string> = new Set()
): Promise<number> {
  const cache = cacheInstance ?? (await openCarouselMediaCache());
  if (!cache) return 0;

  try {
    const requests = await cache.keys();
    if (requests.length === 0) return 0;

    const entries: Array<{ request: Request; key: string; cachedAt: number; byteSize: number }> = [];
    for (const req of requests) {
      const res = await cache.match(req);
      const cachedAt = Number(res?.headers.get('X-Mshindi-Cached-At') || 0);
      const byteSize = Number(res?.headers.get('X-Mshindi-Byte-Size') || 0);
      entries.push({ request: req, key: req.url, cachedAt, byteSize });
    }

    // Sort newest first so oldest entries at the tail are evicted first
    entries.sort((a, b) => b.cachedAt - a.cachedAt);

    let keptCount = 0;
    let keptBytes = 0;
    let evicted = 0;

    for (const entry of entries) {
      const isProtected = protectedKeys.has(entry.key);
      const withinCount = keptCount < MAX_CACHED_CAROUSEL_IMAGES;
      const withinBytes = keptBytes + entry.byteSize <= MAX_CACHED_CAROUSEL_BYTES;

      if (isProtected || (withinCount && withinBytes)) {
        keptCount++;
        keptBytes += entry.byteSize;
      } else {
        await cache.delete(entry.request);
        evicted++;
        diagnostics.prunedEntries++;
      }
    }

    return evicted;
  } catch {
    return 0;
  }
}

/**
 * Synchronizes persistent Cache Storage and in-memory ObjectURLs with the current active
 * unexpired carousel stories:
 * - Immediately purges stale image versions after an admin replaces a photograph.
 * - Automatically removes cached binaries of expired or deleted stories.
 * - Enforces entry count and byte limits.
 */
export async function pruneCarouselImageCache(
  activeUnexpiredItems: Array<
    Pick<HomepageCarouselItem, 'id' | 'imageUrl' | 'imageVersion' | 'photoUpdatedAt'>
  >
): Promise<{ prunedCount: number }> {
  const validKeys = new Set<string>();
  const firstBatchProtectedKeys = new Set<string>();

  activeUnexpiredItems.forEach((item, idx) => {
    const { cleanUrl, imageVersion } = resolveItemImageVersion(item);
    if (!cleanUrl) return;
    const key = buildCarouselCacheKey(cleanUrl, imageVersion);
    validKeys.add(key);
    if (idx < 3) {
      firstBatchProtectedKeys.add(key);
    }
  });

  let prunedCount = 0;

  // 1. Prune obsolete/expired entries from in-memory decoded pool & revoke unused blob: URLs
  for (const [key, entry] of decodedMemoryPool.entries()) {
    if (!validKeys.has(key)) {
      if (entry.isObjectUrl) {
        revokeSafeObjectUrl(entry.renderUrl);
      }
      decodedMemoryPool.delete(key);
      prunedCount++;
    }
  }

  // 2. Prune obsolete/expired entries from persistent Browser Cache Storage
  const cache = await openCarouselMediaCache();
  if (cache) {
    try {
      const requests = await cache.keys();
      for (const req of requests) {
        if (!validKeys.has(req.url)) {
          const deleted = await cache.delete(req);
          if (deleted) {
            prunedCount++;
            diagnostics.prunedEntries++;
          }
        }
      }
      prunedCount += await enforceCarouselCacheStorageBudget(cache, firstBatchProtectedKeys);
    } catch {
      // Ignore storage access errors in restricted modes
    }
  }

  return { prunedCount };
}

