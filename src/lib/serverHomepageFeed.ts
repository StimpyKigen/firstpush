import fs from 'fs';
import path from 'path';
import os from 'os';
import type { HomepageFeedData } from './homepageFeedStore.js';

// Authoritative repository data file (persists across builds and deployments)
const PRIMARY_DATA_FILE = path.join(process.cwd(), 'data', 'homepage_feed.json');

// In-memory runtime cache (fastest response, survives across requests within Node process)
let inMemoryFeed: (HomepageFeedData & { _isDefault?: boolean }) | null = null;

// Ephemeral runtime caches (used if primary filesystem is temporarily read-only)
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const targetDir = isVercel ? path.join(os.tmpdir(), '.mshindi-cache') : path.join(process.cwd(), '.cache');
const FALLBACK_CACHE_FILE = path.join(targetDir, 'homepage_feed.json');

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
 * Permanently filter out any legacy mock data items so they can never reappear on new deploys
 */
function sanitizeFeed(feed: HomepageFeedData): HomepageFeedData {
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

/**
 * Reads the authoritative homepage feed from persistent storage.
 * Prioritizes data/homepage_feed.json, then fallback cache, and only returns DEFAULT_FEED if uninitialized.
 */
export function getSavedHomepageFeed(): HomepageFeedData & { _isDefault?: boolean } {
  // 1. Fast in-memory hit
  if (inMemoryFeed && !inMemoryFeed._isDefault && (inMemoryFeed.carouselItems.length > 0 || inMemoryFeed.videoItems.length > 0)) {
    return inMemoryFeed;
  }

  // 2. Check primary persistent repository file
  try {
    if (fs.existsSync(PRIMARY_DATA_FILE)) {
      const raw = fs.readFileSync(PRIMARY_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.carouselItems) && Array.isArray(parsed.videoItems)) {
        const sanitized = sanitizeFeed(parsed);
        if (sanitized.carouselItems.length > 0 || sanitized.videoItems.length > 0) {
          inMemoryFeed = sanitized;
          return sanitized;
        }
      }
    }
  } catch (err) {
    console.warn('[serverHomepageFeed] Primary read notice:', err);
  }

  // 3. Check fallback cache file
  try {
    if (fs.existsSync(FALLBACK_CACHE_FILE)) {
      const raw = fs.readFileSync(FALLBACK_CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.carouselItems) && Array.isArray(parsed.videoItems)) {
        const sanitized = sanitizeFeed(parsed);
        if (sanitized.carouselItems.length > 0 || sanitized.videoItems.length > 0) {
          inMemoryFeed = sanitized;
          return sanitized;
        }
      }
    }
  } catch (err) {
    console.warn('[serverHomepageFeed] Fallback read notice:', err);
  }

  // 4. Mark fallback so clients don't overwrite saved user records with defaults
  return { ...DEFAULT_FEED, _isDefault: true };
}

/**
 * Persists updated homepage feed to both primary repository storage and runtime fallback cache.
 */
export function saveHomepageFeed(feed: HomepageFeedData): void {
  // Clean internal metadata flags and strip mock data
  const { _isDefault, ...cleanFeed } = feed as any;
  const sanitized = sanitizeFeed(cleanFeed);

  // Store in-memory immediately
  inMemoryFeed = sanitized;

  // 1. Write to primary persistent storage
  try {
    const primaryDir = path.dirname(PRIMARY_DATA_FILE);
    if (!fs.existsSync(primaryDir)) {
      fs.mkdirSync(primaryDir, { recursive: true });
    }
    fs.writeFileSync(PRIMARY_DATA_FILE, JSON.stringify(sanitized, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[serverHomepageFeed] Primary write notice (might be read-only deployment):', err);
  }

  // 2. Also write to fallback runtime cache
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(FALLBACK_CACHE_FILE, JSON.stringify(sanitized, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[serverHomepageFeed] Fallback write notice:', err);
  }
}
