/**
 * Homepage Feed Store
 * 
 * Manages weekly editorial news for the homepage:
 * 1. Carousel Photos with optional bottom foreground captions.
 * 2. Videos and Highlights YouTube embeds.
 * 
 * Persisted in localStorage so administrative updates remain immediate and durable.
 */

export interface HomepageCarouselItem {
  id: string;
  imageUrl: string;
  caption?: string;
  published: boolean;
  createdAt: string;
}

export interface HomepageVideoItem {
  id: string;
  youtubeUrl: string;
  embedUrl: string;
  title: string;
  published: boolean;
  createdAt: string;
}

export interface HomepageFeedData {
  carouselItems: HomepageCarouselItem[];
  videoItems: HomepageVideoItem[];
}

const STORAGE_KEY = 'mshindi_homepage_feed_v1';

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

function emitChange() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentFeed));
    } catch (err) {
      console.warn('Could not persist homepage feed to storage:', err);
    }
  }
  listeners.forEach((listener) => listener());
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
  };

  currentFeed = {
    ...currentFeed,
    videoItems: [newVideo, ...currentFeed.videoItems],
  };
  emitChange();
  return newVideo;
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
