/**
 * Carousel Image Preloader, Progressive 3-Batch Controller & Persistent Binary Cache Bridge
 *
 * Coordinates:
 * 1. Progressive loading in strict batches of 3 (`CAROUSEL_BATCH_SIZE = 3`):
 *    - First batch (`0..2`, or fewer if `< 3` posts exist) is downloaded, cached, and decoded
 *      BEFORE initial skeleton removal.
 *    - Subsequent batches (`3..5`, `6..8`, ...) load sequentially in the background without
 *      ever showing another skeleton or blocking user/auto navigation.
 * 2. Persistent binary file caching (`Cache Storage` via `carouselImageCache.ts`) + in-memory
 *    session tracking (`loadedImagesCache`, `failedImagesCache`).
 * 3. Off-thread hardware rasterization (`HTMLImageElement.decode()`).
 */

import { useState, useEffect, useRef } from 'react';
import type { HomepageCarouselItem } from './homepageFeedStore.js';
import {
  loadAndCacheCarouselImage,
  getReadyCarouselRenderUrl,
  pruneCarouselImageCache,
  type CarouselImageLoadResult,
} from './carouselImageCache.js';

/** Number of carousel photographs loaded per progressive batch. */
export const CAROUSEL_BATCH_SIZE = 3;

// In-memory session cache of successfully decoded and loaded image URLs
export const loadedImagesCache = new Set<string>();
// In-memory cache of failed image URLs to avoid repeated failing network calls
export const failedImagesCache = new Set<string>();

export interface ProgressiveBatchProgress {
  batchIndex: number;
  batchStart: number;
  batchEnd: number;
  results: CarouselImageLoadResult[];
  totalItems: number;
}

export interface ProgressiveBatchLoadSummary {
  initialBatchResults: CarouselImageLoadResult[];
  allBatchResults: CarouselImageLoadResult[];
  batchesCompleted: number;
}

/**
 * Preloads, caches (in persistent Cache Storage), and hardware-decodes a single image URL or item.
 * Preserves full compatibility with `preloadCarouselImage(photo.imageUrl, priority)`.
 */
export function preloadCarouselImage(
  url: string | undefined,
  priority: 'high' | 'normal' | 'low' = 'normal',
  imageVersion?: string
): Promise<boolean> {
  if (!url) return Promise.resolve(false);

  const cleanUrl = url.trim();
  if (!cleanUrl) return Promise.resolve(false);

  const versionKey = imageVersion ? `${cleanUrl}::${imageVersion}` : cleanUrl;
  if (loadedImagesCache.has(versionKey)) {
    return Promise.resolve(true);
  }
  if (failedImagesCache.has(versionKey)) {
    return Promise.resolve(false);
  }

  return loadAndCacheCarouselImage(
    imageVersion
      ? { id: '', imageUrl: cleanUrl, imageVersion }
      : cleanUrl,
    priority
  ).then((res) => {
    if (res.ok) {
      loadedImagesCache.add(cleanUrl);
      loadedImagesCache.add(versionKey);
      return true;
    }

    // Direct HTMLImageElement.decode() safety fallback in browser environments if not already attempted
    if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
      return new Promise<boolean>((resolve) => {
        const img = new Image();
        if ('fetchPriority' in img) {
          (img as any).fetchPriority = priority;
        }
        img.onload = () => {
          if (typeof img.decode === 'function') {
            img
              .decode()
              .then(() => {
                loadedImagesCache.add(cleanUrl);
                loadedImagesCache.add(versionKey);
                resolve(true);
              })
              .catch(() => {
                loadedImagesCache.add(cleanUrl);
                loadedImagesCache.add(versionKey);
                resolve(true);
              });
          } else {
            loadedImagesCache.add(cleanUrl);
            loadedImagesCache.add(versionKey);
            resolve(true);
          }
        };
        img.onerror = () => {
          failedImagesCache.add(versionKey);
          resolve(false);
        };
        img.src = cleanUrl;
      });
    }

    failedImagesCache.add(versionKey);
    return false;
  });
}

/**
 * Loads, decodes, and caches a single `HomepageCarouselItem` and updates session caches.
 */
export async function preloadCarouselStoryItem(
  item: Pick<HomepageCarouselItem, 'id' | 'imageUrl' | 'imageVersion' | 'photoUpdatedAt'>,
  priority: 'high' | 'normal' | 'low' = 'normal'
): Promise<CarouselImageLoadResult> {
  const result = await loadAndCacheCarouselImage(item, priority);
  const cleanUrl = (item.imageUrl || '').trim();
  const versionKey = item.imageVersion ? `${cleanUrl}::${item.imageVersion}` : cleanUrl;

  if (result.ok) {
    loadedImagesCache.add(cleanUrl);
    loadedImagesCache.add(versionKey);
    failedImagesCache.delete(cleanUrl);
    failedImagesCache.delete(versionKey);
  } else if (cleanUrl) {
    failedImagesCache.add(versionKey);
  }
  return result;
}

/**
 * Progressive 3-by-3 Carousel Batch Loader:
 * 1. Downloads, decodes, and caches the first batch of up to 3 active posts (`0..2`).
 * 2. Fires `onInitialBatchReady` immediately once those first `<= 3` images settle so the UI
 *    removes the initial skeleton and starts the carousel without waiting on later batches.
 * 3. Continues sequentially in background batches of 3 (`3..5`, `6..8`, ...) until all active
 *    photographs are ready, never blocking the UI or re-downloading cached images.
 */
export async function loadCarouselInBatchesOfThree(
  activeItems: HomepageCarouselItem[],
  options?: {
    signal?: AbortSignal;
    onInitialBatchReady?: (results: CarouselImageLoadResult[]) => void;
    onBatchCompleted?: (progress: ProgressiveBatchProgress) => void;
  }
): Promise<ProgressiveBatchLoadSummary> {
  const validItems = (activeItems || []).filter(
    (item) => item && typeof item.imageUrl === 'string' && item.imageUrl.trim().length > 0
  );

  if (validItems.length === 0) {
    options?.onInitialBatchReady?.([]);
    return {
      initialBatchResults: [],
      allBatchResults: [],
      batchesCompleted: 0,
    };
  }

  const allBatchResults: CarouselImageLoadResult[] = [];
  let initialBatchResults: CarouselImageLoadResult[] = [];
  let batchesCompleted = 0;

  for (let start = 0; start < validItems.length; start += CAROUSEL_BATCH_SIZE) {
    if (options?.signal?.aborted) {
      break;
    }

    const batchIndex = Math.floor(start / CAROUSEL_BATCH_SIZE);
    const isInitialBatch = batchIndex === 0;
    const batchSlice = validItems.slice(start, start + CAROUSEL_BATCH_SIZE);
    const priority: 'high' | 'normal' | 'low' = isInitialBatch ? 'high' : 'low';

    const settled = await Promise.all(
      batchSlice.map((item) => preloadCarouselStoryItem(item, priority))
    );

    allBatchResults.push(...settled);
    batchesCompleted++;

    options?.onBatchCompleted?.({
      batchIndex,
      batchStart: start,
      batchEnd: start + batchSlice.length - 1,
      results: settled,
      totalItems: validItems.length,
    });

    if (isInitialBatch) {
      initialBatchResults = settled;
      options?.onInitialBatchReady?.(settled);
    }
  }

  // Prune obsolete image versions and expired story binaries once active items are reconciled
  if (!options?.signal?.aborted) {
    void pruneCarouselImageCache(validItems);
  }

  return {
    initialBatchResults,
    allBatchResults,
    batchesCompleted,
  };
}

export type CarouselCardLoadState = 'loading' | 'loaded' | 'error';

export interface UseCarouselCardLoaderResult {
  loadState: CarouselCardLoadState;
  isReady: boolean;
  displayImageUrl: string;
}

/**
 * React hook that coordinates image loading & versioned binary cache lookup for a carousel card.
 */
export function useCarouselCardLoader(
  currentPhoto: HomepageCarouselItem | undefined,
  allPhotos: HomepageCarouselItem[],
  activeIndex: number
): UseCarouselCardLoaderResult {
  const targetUrl = currentPhoto?.imageUrl?.trim() || '';
  const targetVersion = currentPhoto?.imageVersion || '';

  const [loadState, setLoadState] = useState<CarouselCardLoadState>(() => {
    if (!targetUrl) return 'loaded';
    if (currentPhoto && getReadyCarouselRenderUrl(currentPhoto)) return 'loaded';
    return loadedImagesCache.has(targetUrl) ? 'loaded' : 'loading';
  });

  const [displayImageUrl, setDisplayImageUrl] = useState<string>(() => {
    if (currentPhoto) {
      const readyUrl = getReadyCarouselRenderUrl(currentPhoto);
      if (readyUrl) return readyUrl;
    }
    return targetUrl;
  });

  const activeRequestIdRef = useRef<number>(0);

  // 1. Resolve active slide image from memory / Cache Storage / network with race-condition guard
  useEffect(() => {
    const requestId = ++activeRequestIdRef.current;

    if (!targetUrl || !currentPhoto) {
      setDisplayImageUrl('');
      setLoadState('loaded');
      return;
    }

    const readyUrl = getReadyCarouselRenderUrl(currentPhoto);
    if (readyUrl) {
      setDisplayImageUrl(readyUrl);
      setLoadState('loaded');
      return;
    }

    setLoadState('loading');
    preloadCarouselStoryItem(currentPhoto, 'high').then((res) => {
      if (activeRequestIdRef.current !== requestId) return;
      setDisplayImageUrl(res.renderUrl || targetUrl);
      setLoadState(res.ok ? 'loaded' : 'error');
    });
  }, [targetUrl, targetVersion, currentPhoto?.id]);

  // 2. Preload immediate next slide so the upcoming 10-second transition is already decoded
  useEffect(() => {
    if (!allPhotos || allPhotos.length <= 1) return;
    const total = allPhotos.length;
    const nextIdx = (activeIndex + 1) % total;
    const prevIdx = (activeIndex - 1 + total) % total;

    const nextPhoto = allPhotos[nextIdx];
    const prevPhoto = allPhotos[prevIdx];

    if (nextPhoto?.imageUrl) {
      void preloadCarouselImage(nextPhoto.imageUrl, 'high', nextPhoto.imageVersion);
    }
    if (prevPhoto?.imageUrl && prevPhoto.id !== nextPhoto?.id) {
      void preloadCarouselImage(prevPhoto.imageUrl, 'normal', prevPhoto.imageVersion);
    }
  }, [activeIndex, allPhotos]);

  return {
    loadState,
    isReady: loadState === 'loaded',
    displayImageUrl,
  };
}
