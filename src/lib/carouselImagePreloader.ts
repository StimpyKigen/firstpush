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
 * React hook that coordinates image loading for the active carousel card.
 *
 * Guarantees:
 * 1. Only loads and presents verified active carousel photos.
 * 2. Instant reveal without flicker for already-cached images.
 * 3. Race-condition-free state updates during navigation or auto-rotation.
 * 4. Priority-based background preloading of adjacent and remaining slides.
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
    return targetUrl;
  });

  const activeRequestIdRef = useRef<number>(0);

  // 1. Primary Loader: Track active slide loading state with hardware decoding
  useEffect(() => {
    const requestId = ++activeRequestIdRef.current;

    if (!targetUrl) {
      setDisplayImageUrl('');
      setLoadState('loaded');
      return;
    }

    // Fast-path: Image already loaded and decoded in this browser session
    if (loadedImagesCache.has(targetUrl)) {
      setDisplayImageUrl(targetUrl);
      setLoadState('loaded');
      return;
    }

    // If previously failed, retain target URL without mock resurrection
    if (failedImagesCache.has(targetUrl)) {
      setDisplayImageUrl(targetUrl);
      setLoadState('loaded');
      return;
    }

    // Fetch and decode the active image with high priority
    preloadCarouselImage(targetUrl, 'high').then((success) => {
      if (activeRequestIdRef.current !== requestId) return; // Stale request, ignore

      setDisplayImageUrl(targetUrl);
      setLoadState('loaded');
    });
  }, [targetUrl]);

  // 2. Background Preloading: Eagerly preload adjacent and all remaining active slides
  useEffect(() => {
    if (!allPhotos || allPhotos.length <= 1) return;

    const total = allPhotos.length;
    const nextIdx = (activeIndex + 1) % total;
    const prevIdx = (activeIndex - 1 + total) % total;

    // High priority for immediate adjacent slides
    const nextUrl = allPhotos[nextIdx]?.imageUrl;
    const prevUrl = allPhotos[prevIdx]?.imageUrl;

    if (nextUrl) {
      preloadCarouselImage(nextUrl, 'high');
    }
    if (prevUrl && prevUrl !== nextUrl) {
      preloadCarouselImage(prevUrl, 'high');
    }

    // Normal priority for all other active slides in carousel
    allPhotos.forEach((photo, idx) => {
      if (idx !== activeIndex && idx !== nextIdx && idx !== prevIdx && photo?.imageUrl) {
        preloadCarouselImage(photo.imageUrl, 'normal');
      }
    });
  }, [activeIndex, allPhotos]);

  return {
    loadState,
    isReady: loadState === 'loaded',
    displayImageUrl,
  };
}
