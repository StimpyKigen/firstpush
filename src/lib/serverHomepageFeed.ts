import fs from 'fs';
import path from 'path';
import os from 'os';
import type { HomepageFeedData } from './homepageFeedStore';

// Authoritative repository data file (persists across builds and deployments)
const PRIMARY_DATA_FILE = path.join(process.cwd(), 'data', 'homepage_feed.json');

// Ephemeral runtime caches (used if primary filesystem is temporarily read-only)
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const targetDir = isVercel ? path.join(os.tmpdir(), '.mshindi-cache') : path.join(process.cwd(), '.cache');
const FALLBACK_CACHE_FILE = path.join(targetDir, 'homepage_feed.json');

const DEFAULT_FEED: HomepageFeedData = {
  carouselItems: [
    {
      id: 'carousel-featured-reference',
      imageUrl: 'https://mp3tourl.com/images/1793039738103-776c77ad-d580-4fc7-b2ec-44663adcbfd2.jpg',
      heading: 'Top Stories & Matchday Perspectives',
      caption: 'Community consensus rallies behind top weekend fixtures and tactical matchday showdowns across Europe.',
      published: true,
      createdAt: '2026-10-26T22:00:00.000Z',
    },
  ],
  videoItems: [
    {
      id: 'video-1',
      youtubeUrl: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      embedUrl: 'https://www.youtube.com/embed/aqz-KE-bpKQ',
      title: 'Premier League Matchweek Highlights & Tactical Breakdown',
      published: true,
      createdAt: '2026-10-22T00:00:00.000Z',
      type: 'youtube',
    },
    {
      id: 'video-2',
      youtubeUrl: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
      embedUrl: 'https://www.youtube.com/embed/kJQP7kiw5Fk',
      title: 'Top 10 Weekend Goals & Decisive Match-Winning Moments',
      published: true,
      createdAt: '2026-10-22T00:00:00.000Z',
      type: 'youtube',
    },
  ],
};

/**
 * Reads the authoritative homepage feed from persistent storage.
 * Prioritizes data/homepage_feed.json, then fallback cache, and only returns DEFAULT_FEED if uninitialized.
 */
export function getSavedHomepageFeed(): HomepageFeedData & { _isDefault?: boolean } {
  // 1. Check primary persistent repository file
  try {
    if (fs.existsSync(PRIMARY_DATA_FILE)) {
      const raw = fs.readFileSync(PRIMARY_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.carouselItems) && Array.isArray(parsed.videoItems)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[serverHomepageFeed] Primary read notice:', err);
  }

  // 2. Check fallback cache file
  try {
    if (fs.existsSync(FALLBACK_CACHE_FILE)) {
      const raw = fs.readFileSync(FALLBACK_CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.carouselItems) && Array.isArray(parsed.videoItems)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[serverHomepageFeed] Fallback read notice:', err);
  }

  // 3. Mark fallback so clients don't overwrite saved user records with defaults
  return { ...DEFAULT_FEED, _isDefault: true };
}

/**
 * Persists updated homepage feed to both primary repository storage and runtime fallback cache.
 */
export function saveHomepageFeed(feed: HomepageFeedData): void {
  // Clean internal metadata flags
  const { _isDefault, ...cleanFeed } = feed as any;

  // 1. Write to primary persistent storage
  try {
    const primaryDir = path.dirname(PRIMARY_DATA_FILE);
    if (!fs.existsSync(primaryDir)) {
      fs.mkdirSync(primaryDir, { recursive: true });
    }
    fs.writeFileSync(PRIMARY_DATA_FILE, JSON.stringify(cleanFeed, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[serverHomepageFeed] Primary write notice (might be read-only deployment):', err);
  }

  // 2. Also write to fallback runtime cache
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(FALLBACK_CACHE_FILE, JSON.stringify(cleanFeed, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[serverHomepageFeed] Fallback write notice:', err);
  }
}
