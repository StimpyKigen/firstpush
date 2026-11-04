/**
 * Homepage Feed Store
 * 
 * Manages weekly editorial news for the homepage:
 * 1. Carousel Photos with optional bottom foreground captions.
 * 2. Videos and Highlights YouTube embeds.
 * 
 * Persisted in Cloud Firestore and authoritative server database (`data/homepage_feed.json`).
 */

import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { deleteCarouselPhotoStorage } from './carouselStorageService.js';

export interface HomepageCarouselItem {
  id: string;
  imageUrl: string;
  storagePath?: string; // Canonical Firebase Storage path (e.g. homepage-carousel/{photoId}/{fileName}.webp)
  heading?: string;
  caption?: string;
  source?: string;
  link?: string;
  order?: number; // Explicit display order (1, 2, 3...)
  published: boolean;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string; // Authenticated admin phone or UID
  updatedBy?: string; // Authenticated admin phone or UID
  dimensions?: { width: number; height: number };
  fileSize?: number;
}

export interface HomepageVideoItem {
  id: string;
  youtubeUrl?: string;
  embedUrl: string;
  title: string;
  published: boolean;
  createdAt: string;
  type?: 'youtube' | 'custom';
}

export interface HomepageFeedData {
  carouselItems: HomepageCarouselItem[];
  videoItems: HomepageVideoItem[];
}

const STORAGE_KEY = 'mshindi_homepage_feed_v2';
const FIRESTORE_COLLECTION = 'siteContent';
const FIRESTORE_DOC = 'homepageFeed';

/**
 * Normalizes any YouTube URL (watch, shorts, youtu.be, embed) into a safe embed URL
 */
export function normalizeYouTubeEmbedUrl(input: string): string | null {
  if (!input) return null;
  const str = input.trim();

  // Already an embed URL
  if (str.includes('/embed/')) {
    const match = str.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : str;
  }

  // Watch URL: youtube.com/watch?v=XYZ
  const watchMatch = str.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) {
    return `https://www.youtube.com/embed/${watchMatch[1]}`;
  }

  // Short URL: youtu.be/XYZ
  const shortMatch = str.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) {
    return `https://www.youtube.com/embed/${shortMatch[1]}`;
  }

  // Shorts URL: youtube.com/shorts/XYZ
  const shortsMatch = str.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) {
    return `https://www.youtube.com/embed/${shortsMatch[1]}`;
  }

  return null;
}

/**
 * Normalizes custom/external embed URLs or extracts the src from pasted <iframe> snippets.
 * Supports Vimeo, Dailymotion, Streamable, and generic valid HTTP/HTTPS embed URLs.
 */
export function normalizeCustomEmbedUrl(input: string): string | null {
  if (!input) return null;
  let str = input.trim();

  // 1. If user pasted an <iframe> snippet, extract the src attribute
  if (str.includes('<iframe') || str.includes('src=')) {
    const srcMatch = str.match(/src=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      str = srcMatch[1].trim();
    }
  }

  // 2. Handle protocol-relative URLs
  if (str.startsWith('//')) {
    str = `https:${str}`;
  }

  // 3. If a YouTube URL was accidentally pasted here, gracefully normalize it
  const ytNormalized = normalizeYouTubeEmbedUrl(str);
  if (ytNormalized) {
    return ytNormalized;
  }

  // 4. Vimeo standard URL: https://vimeo.com/123456789 -> https://player.vimeo.com/video/123456789
  const vimeoMatch = str.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)/);
  if (vimeoMatch && vimeoMatch[3]) {
    return `https://player.vimeo.com/video/${vimeoMatch[3]}`;
  }

  // 5. Dailymotion standard URL: dailymotion.com/video/x123abc -> embed
  const dailyMatch = str.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
  if (dailyMatch && dailyMatch[1]) {
    return `https://www.dailymotion.com/embed/video/${dailyMatch[1]}`;
  }

  // 6. Streamable URL: streamable.com/abc12 -> embed
  const streamableMatch = str.match(/streamable\.com\/(?:e\/)?([a-zA-Z0-9]+)/);
  if (streamableMatch && streamableMatch[1]) {
    return `https://streamable.com/e/${streamableMatch[1]}`;
  }

  // 7. General URL validation: must be a valid http or https URL
  try {
    const url = new URL(str);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    // If user omitted protocol: e.g. player.vimeo.com/video/123
    if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(str)) {
      try {
        const url = new URL(`https://${str}`);
        return url.toString();
      } catch {
        return null;
      }
    }
  }

  return null;
}

const DEFAULT_FEED: HomepageFeedData = {
  carouselItems: [],
  videoItems: [],
};

const LEGACY_MOCK_IDS = new Set([
  'carousel-featured-reference',
  'slide-1',
  'slide-2',
  'slide-3',
  'video-1',
  'video-2',
]);

/**
 * Filter out any legacy mock items so they can never be reused or displayed
 */
export function sanitizeHomepageFeed(feed: HomepageFeedData): HomepageFeedData {
  return {
    ...feed,
    carouselItems: (feed.carouselItems || []).filter(
      (item) => item && item.id && !LEGACY_MOCK_IDS.has(item.id) && !item.imageUrl?.includes('mp3tourl.com')
    ),
    videoItems: (feed.videoItems || []).filter(
      (item) =>
        item &&
        item.id &&
        !LEGACY_MOCK_IDS.has(item.id) &&
        !item.youtubeUrl?.includes('aqz-KE-bpKQ') &&
        !item.youtubeUrl?.includes('kJQP7kiw5Fk')
    ),
  };
}

function loadStoredFeed(): HomepageFeedData {
  if (typeof window === 'undefined') return DEFAULT_FEED;
  try {
    // Purge old v1 key if present
    try {
      localStorage.removeItem('mshindi_homepage_feed_v1');
    } catch {}

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FEED;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.carouselItems) && Array.isArray(parsed.videoItems)) {
      return sanitizeHomepageFeed(parsed);
    }
    return DEFAULT_FEED;
  } catch {
    return DEFAULT_FEED;
  }
}

let currentFeed: HomepageFeedData = loadStoredFeed();
const listeners = new Set<() => void>();
let isListeningToCloud = false;

function setupCloudSync() {
  if (typeof window === 'undefined' || isListeningToCloud) return;
  isListeningToCloud = true;

  // 1. Cross-tab storage synchronization
  try {
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          if (parsed && Array.isArray(parsed.carouselItems) && Array.isArray(parsed.videoItems)) {
            currentFeed = parsed;
            listeners.forEach((l) => l());
          }
        } catch {
          // ignore JSON parsing issues
        }
      }
    });
  } catch (err) {
    console.warn('[HomepageFeed] Storage listener setup notice:', err);
  }

  // 2. Real-time Cloud Firestore synchronization across all users and devices
  try {
    if (db) {
      const feedRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
      onSnapshot(
        feedRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const rawData = snapshot.data() as HomepageFeedData;
            if (rawData && Array.isArray(rawData.carouselItems) && Array.isArray(rawData.videoItems)) {
              const cloudData = sanitizeHomepageFeed(rawData);
              currentFeed = cloudData;
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData));
              } catch {}
              listeners.forEach((l) => l());
            }
          }
        },
        (error) => {
          console.warn('[HomepageFeed] Firestore listener notice (using server database API):', error.message);
        }
      );
    }
  } catch (err: any) {
    console.warn('[HomepageFeed] Cloud sync initialization fallback:', err?.message || err);
  }

  // 3. Backend API sync (hydrates from authoritative persistent server database)
  try {
    fetch('/api/homepage-feed')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.success && data.feed && Array.isArray(data.feed.carouselItems)) {
          const isServerDefault = Boolean(data.feed._isDefault);
          const hasLocalEdits = Boolean(localStorage.getItem(STORAGE_KEY));

          // Never let default mock fallback overwrite existing local changes
          if (isServerDefault && hasLocalEdits) {
            // Push local edits to server so the server database is initialized with current records
            persistToCloud(currentFeed);
            return;
          }

          const cleanServerFeed = sanitizeHomepageFeed(data.feed);
          currentFeed = cleanServerFeed;
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanServerFeed));
          } catch {}
          listeners.forEach((l) => l());
        }
      })
      .catch(() => {});
  } catch {}
}

// Initialize listener immediately on browser
if (typeof window !== 'undefined') {
  setupCloudSync();
}

/**
 * Persists feed data to Cloud Firestore and the server database backend.
 * Returns confirmation of which database writes succeeded.
 */
export async function persistToCloud(data: HomepageFeedData): Promise<{
  success: boolean;
  firestoreSaved: boolean;
  serverSaved: boolean;
  error?: string;
}> {
  let firestoreSaved = false;
  let serverSaved = false;
  let lastError: string | undefined;

  // Deep sanitize payload: removes all undefined keys, purges legacy mock records, and enforces valid JSON
  const sanitized = sanitizeHomepageFeed(data);
  const cleanData: HomepageFeedData = JSON.parse(
    JSON.stringify({
      ...sanitized,
      updatedAt: new Date().toISOString(),
    })
  );

  // 1. Write to Cloud Firestore (if available & configured)
  try {
    if (db) {
      const feedRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
      await setDoc(feedRef, cleanData, { merge: true });
      firestoreSaved = true;
    }
  } catch (err: any) {
    lastError = err?.message || 'Firestore write failed';
    console.warn('[HomepageFeed] Firestore push notice:', err?.message || err);
  }

  // 2. Persist to server backend database (/api/homepage-feed) with a 5s safety timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch('/api/homepage-feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanData),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (res.ok) {
      serverSaved = true;
    } else {
      const errJson = await res.json().catch(() => null);
      if (!firestoreSaved) {
        lastError = errJson?.error || `Server responded with status ${res.status}`;
      }
    }
  } catch (err: any) {
    if (!firestoreSaved) {
      lastError = err?.message || 'Server network request failed';
    }
    console.warn('[HomepageFeed] Server feed push notice:', err?.message || err);
  }

  const success = firestoreSaved || serverSaved;
  return { success, firestoreSaved, serverSaved, error: success ? undefined : lastError };
}

export function getHomepageFeedSnapshot(): HomepageFeedData {
  return currentFeed;
}

export function subscribeToHomepageFeed(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// -------------------------------------------------------------
// Action API for Admin Console (with Guaranteed DB Persistence)
// -------------------------------------------------------------

export async function addCarouselItem(item: {
  imageUrl: string;
  storagePath?: string;
  heading?: string;
  caption?: string;
  source?: string;
  link?: string;
  published?: boolean;
  order?: number;
  createdBy?: string;
  dimensions?: { width: number; height: number };
  fileSize?: number;
}) {
  const now = new Date().toISOString();
  const existingOrders = currentFeed.carouselItems
    .map((c) => (typeof c.order === 'number' ? c.order : 0));
  const nextOrder = existingOrders.length > 0 ? Math.max(...existingOrders) + 1 : 1;

  const newItem: HomepageCarouselItem = {
    id: `carousel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    imageUrl: item.imageUrl.trim(),
    storagePath: item.storagePath?.trim() || undefined,
    heading: item.heading?.trim() || '',
    caption: item.caption?.trim() || '',
    source: item.source?.trim() || '',
    link: item.link?.trim() || '',
    order: typeof item.order === 'number' ? item.order : nextOrder,
    published: item.published !== undefined ? item.published : true,
    createdAt: now,
    updatedAt: now,
    createdBy: item.createdBy?.trim() || undefined,
    updatedBy: item.createdBy?.trim() || undefined,
    dimensions: item.dimensions,
    fileSize: item.fileSize,
  };

  const nextFeed: HomepageFeedData = {
    ...currentFeed,
    carouselItems: [newItem, ...currentFeed.carouselItems],
  };

  const result = await persistToCloud(nextFeed);
  if (!result.success) {
    throw new Error(result.error || 'Failed to persist carousel slide to database.');
  }

  currentFeed = nextFeed;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentFeed));
    } catch {}
  }
  listeners.forEach((l) => l());
  return newItem;
}

export async function updateCarouselItem(
  id: string,
  updates: Partial<Omit<HomepageCarouselItem, 'id' | 'createdAt'>>
) {
  const now = new Date().toISOString();
  const existing = currentFeed.carouselItems.find((c) => c.id === id);
  if (!existing) {
    throw new Error('Carousel photo record not found.');
  }

  const nextFeed: HomepageFeedData = {
    ...currentFeed,
    carouselItems: currentFeed.carouselItems.map((c) => {
      if (c.id !== id) return c;
      return {
        ...c,
        ...updates,
        heading: updates.heading !== undefined ? updates.heading.trim() : c.heading,
        caption: updates.caption !== undefined ? updates.caption.trim() : c.caption,
        source: updates.source !== undefined ? updates.source.trim() : c.source,
        link: updates.link !== undefined ? updates.link.trim() : c.link,
        order: typeof updates.order === 'number' ? updates.order : c.order,
        updatedAt: now,
      };
    }),
  };

  const result = await persistToCloud(nextFeed);
  if (!result.success) {
    throw new Error(result.error || 'Failed to update carousel photo in database.');
  }

  currentFeed = nextFeed;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentFeed));
    } catch {}
  }
  listeners.forEach((l) => l());
  return nextFeed.carouselItems.find((c) => c.id === id)!;
}

export async function replaceCarouselItemPhoto(
  id: string,
  photoData: {
    imageUrl: string;
    storagePath: string;
    dimensions?: { width: number; height: number };
    fileSize?: number;
    updatedBy?: string;
  }
) {
  const existing = currentFeed.carouselItems.find((c) => c.id === id);
  if (!existing) {
    throw new Error('Carousel photo not found.');
  }
  const oldStoragePath = existing.storagePath;

  const updated = await updateCarouselItem(id, {
    imageUrl: photoData.imageUrl,
    storagePath: photoData.storagePath,
    dimensions: photoData.dimensions,
    fileSize: photoData.fileSize,
    updatedBy: photoData.updatedBy,
  });

  // Safe deferred cleanup: Only clean old storage object after successful database update
  if (oldStoragePath && oldStoragePath !== photoData.storagePath) {
    deleteCarouselPhotoStorage(oldStoragePath).catch((err) => {
      console.warn('[HomepageFeedStore] Old storage object cleanup warning:', oldStoragePath, err);
    });
  }

  return updated;
}

export async function reorderCarouselItems(orderedIds: string[]) {
  const idToOrder = new Map(orderedIds.map((id, index) => [id, index + 1]));
  const now = new Date().toISOString();

  const nextFeed: HomepageFeedData = {
    ...currentFeed,
    carouselItems: currentFeed.carouselItems.map((c) => {
      if (idToOrder.has(c.id)) {
        return { ...c, order: idToOrder.get(c.id)!, updatedAt: now };
      }
      return c;
    }),
  };

  const result = await persistToCloud(nextFeed);
  if (!result.success) {
    throw new Error(result.error || 'Failed to persist carousel order in database.');
  }

  currentFeed = nextFeed;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentFeed));
    } catch {}
  }
  listeners.forEach((l) => l());
}

export async function toggleCarouselItemPublish(id: string) {
  const nextFeed: HomepageFeedData = {
    ...currentFeed,
    carouselItems: currentFeed.carouselItems.map((c) =>
      c.id === id ? { ...c, published: !c.published, updatedAt: new Date().toISOString() } : c
    ),
  };

  const result = await persistToCloud(nextFeed);
  if (!result.success) {
    throw new Error(result.error || 'Failed to update carousel visibility in database.');
  }

  currentFeed = nextFeed;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentFeed));
    } catch {}
  }
  listeners.forEach((l) => l());
}

export async function deleteCarouselItem(id: string) {
  const targetItem = currentFeed.carouselItems.find((c) => c.id === id);
  const oldStoragePath = targetItem?.storagePath;

  const nextFeed: HomepageFeedData = {
    ...currentFeed,
    carouselItems: currentFeed.carouselItems.filter((c) => c.id !== id),
  };

  const result = await persistToCloud(nextFeed);
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete carousel photo from database.');
  }

  currentFeed = nextFeed;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentFeed));
    } catch {}
  }
  listeners.forEach((l) => l());

  // Clean up Storage object if it exists and is stored in Firebase Storage
  if (oldStoragePath) {
    deleteCarouselPhotoStorage(oldStoragePath).catch((err) => {
      console.warn('[HomepageFeedStore] Storage cleanup notice for deleted photo:', oldStoragePath, err);
    });
  }
}

export async function addVideoItem(item: { youtubeUrl: string; title: string; published?: boolean }) {
  const embed = normalizeYouTubeEmbedUrl(item.youtubeUrl);
  if (!embed) {
    throw new Error('Please enter a valid YouTube video or embed URL.');
  }

  const newVideo: HomepageVideoItem = {
    id: `video-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    youtubeUrl: item.youtubeUrl.trim(),
    embedUrl: embed,
    title: item.title.trim() || 'Featured Match Highlights',
    published: item.published !== undefined ? item.published : true,
    createdAt: new Date().toISOString(),
    type: 'youtube',
  };

  const nextFeed: HomepageFeedData = {
    ...currentFeed,
    videoItems: [newVideo, ...currentFeed.videoItems],
  };

  const result = await persistToCloud(nextFeed);
  if (!result.success) {
    throw new Error(result.error || 'Failed to persist video to database.');
  }

  currentFeed = nextFeed;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentFeed));
    } catch {}
  }
  listeners.forEach((l) => l());
  return newVideo;
}

export async function addCustomEmbedItem(item: { embedUrl: string; title: string; published?: boolean }) {
  const embed = normalizeCustomEmbedUrl(item.embedUrl);
  if (!embed) {
    throw new Error('Please enter a valid embed URL or <iframe> snippet.');
  }

  const newEmbed: HomepageVideoItem = {
    id: `embed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    youtubeUrl: item.embedUrl.trim(),
    embedUrl: embed,
    title: item.title.trim() || 'Featured Media Embed',
    published: item.published !== undefined ? item.published : true,
    createdAt: new Date().toISOString(),
    type: 'custom',
  };

  const nextFeed: HomepageFeedData = {
    ...currentFeed,
    videoItems: [newEmbed, ...currentFeed.videoItems],
  };

  const result = await persistToCloud(nextFeed);
  if (!result.success) {
    throw new Error(result.error || 'Failed to persist embed to database.');
  }

  currentFeed = nextFeed;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentFeed));
    } catch {}
  }
  listeners.forEach((l) => l());
  return newEmbed;
}

export async function toggleVideoItemPublish(id: string) {
  const nextFeed: HomepageFeedData = {
    ...currentFeed,
    videoItems: currentFeed.videoItems.map((v) =>
      v.id === id ? { ...v, published: !v.published } : v
    ),
  };

  const result = await persistToCloud(nextFeed);
  if (!result.success) {
    throw new Error(result.error || 'Failed to update video visibility in database.');
  }

  currentFeed = nextFeed;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentFeed));
    } catch {}
  }
  listeners.forEach((l) => l());
}

export async function deleteVideoItem(id: string) {
  const nextFeed: HomepageFeedData = {
    ...currentFeed,
    videoItems: currentFeed.videoItems.filter((v) => v.id !== id),
  };

  const result = await persistToCloud(nextFeed);
  if (!result.success) {
    throw new Error(result.error || 'Failed to delete video from database.');
  }

  currentFeed = nextFeed;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentFeed));
    } catch {}
  }
  listeners.forEach((l) => l());
}

export async function resetHomepageFeedToDefault() {
  const result = await persistToCloud(DEFAULT_FEED);
  if (!result.success) {
    throw new Error(result.error || 'Failed to reset homepage feed in database.');
  }

  currentFeed = DEFAULT_FEED;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentFeed));
    } catch {}
  }
  listeners.forEach((l) => l());
}
