/**
 * Carousel Image Preloader & Intelligent Cache
 * 
 * Manages image preloading, progressive hardware decoding, in-memory caching,
 * and synchronized skeleton-to-content state transitions for the Weekly Editorial News carousel.
 */

import { useState, useEffect, useRef } from 'react';
import type { HomepageCarouselItem } from './homepageFeedStore';

// In-memory session cache of successfully decoded and loaded image URLs
export const loadedImagesCache = new Set<string>();
// In-memory cache of failed image URLs to avoid repeated failing network calls
export const failedImagesCache = new Set<string>();

const FALLBACK_IMAGE_URL = '/images/hero-striker.jpg';
// Also preload fallback image once in background
if (typeof window !== 'undefined') {
  const fallbackImg = new Image();
  fallbackImg.src = FALLBACK_IMAGE_URL;
  fallbackImg.onload = () => loadedImagesCache.add(FALLBACK_IMAGE_URL);
}

/**
 * Preloads and hardware-decodes a single image URL with priority control.
 * Reuses browser cache and deduplicates requests.
 */
export function preloadCarouselImage(
  url: string | undefined,
  priority: 'high' | 'normal' | 'low' = 'normal'
): Promise<boolean> {
  if (!url || typeof window === 'undefined') return Promise.resolve(false);

  const cleanUrl = url.trim();
  if (!cleanUrl) return Promise.resolve(false);

  if (loadedImagesCache.has(cleanUrl)) {
    return Promise.resolve(true);
  }
  if (failedImagesCache.has(cleanUrl)) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const img = new Image();

    if ('fetchPriority' in img) {
      (img as any).fetchPriority = priority;
    }

    img.onload = () => {
      // Decode image asynchronously to eliminate layout/painting stalls
      if (typeof img.decode === 'function') {
        img
          .decode()
          .then(() => {
            loadedImagesCache.add(cleanUrl);
            resolve(true);
          })
          .catch(() => {
            // Even if decode throws (e.g. minor decoding quirk), onload fired successfully
            loadedImagesCache.add(cleanUrl);
            resolve(true);
          });
      } else {
        loadedImagesCache.add(cleanUrl);
        resolve(true);
      }
    };

    img.onerror = () => {
      failedImagesCache.add(cleanUrl);
      resolve(false);
    };

    img.src = cleanUrl;
  });
}

export type CarouselCardLoadState = 'loading' | 'loaded' | 'error';

export interface UseCarouselCardLoaderResult {
  loadState: CarouselCardLoadState;
  isReady: boolean;
  displayImageUrl: string;
}

/**
 * React hook that coordinates image loading and skeleton display for the active carousel card.
 *
 * Guarantees:
 * 1. Both photo and caption display skeleton placeholders until the image is decoded and ready.
 * 2. Instant reveal without skeleton flicker for already-cached images.
 * 3. Race-condition-free state updates during fast navigation or auto-rotation.
 * 4. Priority-based background preloading of adjacent and distant slides.
 * 5. Automatic fallback recovery so cards are never stuck in an infinite skeleton.
 */
export function useCarouselCardLoader(
  currentPhoto: HomepageCarouselItem | undefined,
  allPhotos: HomepageCarouselItem[],
  activeIndex: number
): UseCarouselCardLoaderResult {
  const targetUrl = currentPhoto?.imageUrl?.trim() || '';

  // Initialize directly to 'loaded' if the target image is already in memory cache
  const [loadState, setLoadState] = useState<CarouselCardLoadState>(() => {
    if (!targetUrl) return 'loaded';
    return loadedImagesCache.has(targetUrl) ? 'loaded' : 'loading';
  });

  const [displayImageUrl, setDisplayImageUrl] = useState<string>(() => {
    if (!targetUrl || failedImagesCache.has(targetUrl)) return FALLBACK_IMAGE_URL;
    return targetUrl;
  });

  const activeRequestIdRef = useRef<number>(0);

  // 1. Primary Loader: Track active slide loading state with hardware decoding & safety timeout
  useEffect(() => {
    const requestId = ++activeRequestIdRef.current;

    if (!targetUrl) {
      setDisplayImageUrl(FALLBACK_IMAGE_URL);
      setLoadState('loaded');
      return;
    }

    // Fast-path: Image already loaded and decoded in this browser session
    if (loadedImagesCache.has(targetUrl)) {
      setDisplayImageUrl(targetUrl);
      setLoadState('loaded');
      return;
    }

    // If previously failed, immediately fall back
    if (failedImagesCache.has(targetUrl)) {
      setDisplayImageUrl(FALLBACK_IMAGE_URL);
      setLoadState('loaded');
      return;
    }

    // Transition into loading state
    setLoadState('loading');

    // 4.5-second safety timer: prevent infinite skeleton under flaky network
    const safetyTimer = setTimeout(() => {
      if (activeRequestIdRef.current === requestId) {
        setDisplayImageUrl((prev) => (prev ? prev : FALLBACK_IMAGE_URL));
        setLoadState('loaded');
      }
    }, 4500);

    // Fetch and decode the active image with high priority
    preloadCarouselImage(targetUrl, 'high').then((success) => {
      if (activeRequestIdRef.current !== requestId) return; // Stale request, ignore
      clearTimeout(safetyTimer);

      if (success) {
        setDisplayImageUrl(targetUrl);
        setLoadState('loaded');
      } else {
        // Primary failed; verify fallback image
        preloadCarouselImage(FALLBACK_IMAGE_URL, 'high').then(() => {
          if (activeRequestIdRef.current !== requestId) return;
          setDisplayImageUrl(FALLBACK_IMAGE_URL);
          setLoadState('loaded');
        });
      }
    });

    return () => {
      clearTimeout(safetyTimer);
    };
  }, [targetUrl]);

  // 2. Background Preloading: Prioritize adjacent slides (Priority 2) and idle distant slides (Priority 3)
  useEffect(() => {
    if (!allPhotos || allPhotos.length <= 1) return;

    const total = allPhotos.length;

    // Priority 2: Next and previous slides (immediate anticipation)
    const nextIdx = (activeIndex + 1) % total;
    const prevIdx = (activeIndex - 1 + total) % total;

    const nextUrl = allPhotos[nextIdx]?.imageUrl;
    const prevUrl = allPhotos[prevIdx]?.imageUrl;

    if (nextUrl) {
      preloadCarouselImage(nextUrl, 'normal');
    }
    if (prevUrl && prevUrl !== nextUrl) {
      preloadCarouselImage(prevUrl, 'normal');
    }

    // Priority 3: Distant slides preloaded lazily when browser is idle
    const distantIndices = allPhotos
      .map((_, i) => i)
      .filter((i) => i !== activeIndex && i !== nextIdx && i !== prevIdx);

    if (distantIndices.length > 0) {
      const scheduleIdle =
        typeof window !== 'undefined' && 'requestIdleCallback' in window
          ? (window as any).requestIdleCallback
          : (cb: () => void) => setTimeout(cb, 1200);

      const idleHandle = scheduleIdle(() => {
        distantIndices.forEach((idx) => {
          const distantUrl = allPhotos[idx]?.imageUrl;
          if (distantUrl) {
            preloadCarouselImage(distantUrl, 'low');
          }
        });
      });

      return () => {
        if (typeof window !== 'undefined' && 'cancelIdleCallback' in window && typeof idleHandle === 'number') {
          (window as any).cancelIdleCallback(idleHandle);
        }
      };
    }
  }, [activeIndex, allPhotos]);

  return {
    loadState,
    isReady: loadState === 'loaded',
    displayImageUrl,
  };
}
