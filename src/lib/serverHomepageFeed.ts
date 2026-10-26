import fs from 'fs';
import path from 'path';
import os from 'os';
import type { HomepageFeedData } from './homepageFeedStore';

const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const targetDir = isVercel ? path.join(os.tmpdir(), '.mshindi-cache') : path.join(process.cwd(), '.cache');
const FEED_CACHE_FILE = path.join(targetDir, 'homepage_feed.json');

const DEFAULT_FEED: HomepageFeedData = {
  carouselItems: [
    {
      id: 'slide-1',
      imageUrl: '/images/hero-striker.jpg',
      heading: 'Match of the year is coming',
      caption: 'Hazard magic has Chelsea sitting pretty at the top of the Premier League table with tactical dominance and decisive finishing.',
      published: true,
      createdAt: '2026-10-22T00:00:00.000Z',
    },
    {
      id: 'slide-2',
      imageUrl: '/images/celebration.jpg',
      heading: 'Derby day showdown across Europe',
      caption: 'Community consensus rallies behind a massive weekend derby slate across Europe with record pundit engagement.',
      published: true,
      createdAt: '2026-10-22T00:00:00.000Z',
    },
    {
      id: 'slide-3',
      imageUrl: '/images/match-action.jpg',
      heading: 'Continental supremacy on the line',
      caption: 'High-stakes continental drama unfolds as top contenders battle for supremacy in the knockout tournament rounds.',
      published: true,
      createdAt: '2026-10-22T00:00:00.000Z',
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

export function getSavedHomepageFeed(): HomepageFeedData {
  try {
    if (fs.existsSync(FEED_CACHE_FILE)) {
      const raw = fs.readFileSync(FEED_CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.carouselItems) && Array.isArray(parsed.videoItems)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[serverHomepageFeed] Read notice:', err);
  }
  return DEFAULT_FEED;
}

export function saveHomepageFeed(feed: HomepageFeedData): void {
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(FEED_CACHE_FILE, JSON.stringify(feed, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[serverHomepageFeed] Write notice:', err);
  }
}
