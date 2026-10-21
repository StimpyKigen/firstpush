/**
 * Homepage Feed Store
 * 
 * Manages weekly editorial news for the homepage:
 * 1. Carousel Photos with optional bottom foreground captions.
 * 2. Videos and Highlights YouTube embeds.
 * 
 * Persisted in localStorage so administrative updates remain immediate and durable.
 */

import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface HomepageCarouselItem {
  id: string;
  imageUrl: string;
  caption?: string;
  published: boolean;
  createdAt: string;
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

const STORAGE_KEY = 'mshindi_homepage_feed_v1';
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
  carouselItems: [
    {
      id: 'slide-1',
      imageUrl: '/images/hero-striker.jpg',
      caption: 'Hazard magic has Chelsea sitting pretty at the top of the Premier League table.',
      published: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'slide-2',
      imageUrl: '/images/celebration.jpg',
      caption: 'Community consensus rallies behind a massive weekend derby slate across Europe.',
      published: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'slide-3',
      imageUrl: '/images/match-action.jpg',
      caption: 'High-stakes continental drama unfolds as top contenders battle for supremacy.',
      published: true,
      createdAt: new Date().toISOString(),
    },
  ],
  videoItems: [
    {
      id: 'video-1',
      youtubeUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      embedUrl: 'https://www.youtube.com/embed/aqz-KE-bpKQ',
      title: 'Premier League Matchweek Highlights & Tactical Breakdown',
      published: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'video-2',
      youtubeUrl: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
      embedUrl: 'https://www.youtube.com/embed/kJQP7kiw5Fk',
      title: 'Top 10 Weekend Goals & Decisive Match-Winning Moments',
      published: true,
      createdAt: new Date().toISOString(),
    },
  ],
};

function loadStoredFeed(): HomepageFeedData {
  if (typeof window === 'undefined') return DEFAULT_FEED;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FEED;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.carouselItems) && Array.isArray(parsed.videoItems)) {
      return parsed;
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
    const feedRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
    onSnapshot(
      feedRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const cloudData = snapshot.data() as HomepageFeedData;
          if (cloudData && Array.isArray(cloudData.carouselItems) && Array.isArray(cloudData.videoItems)) {
            currentFeed = cloudData;
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData));
            } catch {}
            listeners.forEach((l) => l());
          }
        }
      },
      (error) => {
        console.warn('[HomepageFeed] Firestore listener notice (using local cache):', error.message);
      }
    );
  } catch (err) {
    console.warn('[HomepageFeed] Cloud sync initialization fallback:', err);
  }
}

// Initialize listener immediately on browser
if (typeof window !== 'undefined') {
  setupCloudSync();
}

async function persistToCloud(data: HomepageFeedData) {
  try {
    const feedRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
    await setDoc(feedRef, data, { merge: true });
  } catch (err) {
    console.warn('[HomepageFeed] Cloud push notice (persisted in local storage):', err);
  }
}

function emitChange(syncCloud = true) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentFeed));
    } catch (err) {
      console.warn('Could not persist homepage feed to storage:', err);
    }
  }
  listeners.forEach((listener) => listener());
  if (syncCloud && typeof window !== 'undefined') {
    persistToCloud(currentFeed);
  }
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
// Action API for Admin Console
// -------------------------------------------------------------

export function addCarouselItem(item: { imageUrl: string; caption?: string; published?: boolean }) {
  const newItem: HomepageCarouselItem = {
    id: `carousel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    imageUrl: item.imageUrl.trim(),
    caption: item.caption?.trim(),
    published: item.published !== undefined ? item.published : true,
    createdAt: new Date().toISOString(),
  };

  currentFeed = {
    ...currentFeed,
    carouselItems: [newItem, ...currentFeed.carouselItems],
  };
  emitChange();
  return newItem;
}

export function toggleCarouselItemPublish(id: string) {
  currentFeed = {
    ...currentFeed,
    carouselItems: currentFeed.carouselItems.map((c) =>
      c.id === id ? { ...c, published: !c.published } : c
    ),
  };
  emitChange();
}

export function deleteCarouselItem(id: string) {
  currentFeed = {
    ...currentFeed,
    carouselItems: currentFeed.carouselItems.filter((c) => c.id !== id),
  };
  emitChange();
}

export function addVideoItem(item: { youtubeUrl: string; title: string; published?: boolean }) {
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

  currentFeed = {
    ...currentFeed,
    videoItems: [newVideo, ...currentFeed.videoItems],
  };
  emitChange();
  return newVideo;
}

export function addCustomEmbedItem(item: { embedUrl: string; title: string; published?: boolean }) {
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

  currentFeed = {
    ...currentFeed,
    videoItems: [newEmbed, ...currentFeed.videoItems],
  };
  emitChange();
  return newEmbed;
}

export function toggleVideoItemPublish(id: string) {
  currentFeed = {
    ...currentFeed,
    videoItems: currentFeed.videoItems.map((v) =>
      v.id === id ? { ...v, published: !v.published } : v
    ),
  };
  emitChange();
}

export function deleteVideoItem(id: string) {
  currentFeed = {
    ...currentFeed,
    videoItems: currentFeed.videoItems.filter((v) => v.id !== id),
  };
  emitChange();
}

export function resetHomepageFeedToDefault() {
  currentFeed = DEFAULT_FEED;
  emitChange();
}
