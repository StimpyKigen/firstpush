/**
 * Persistent Store for Homepage Editorial Feed (Photo Carousel & Video Highlights)
 *
 * Permanent Content Persistence Architecture:
 * 1. Cloud Firestore (`mshindiroom-production` -> `siteContent/homepageFeed` & `siteContent/post_{id}`)
 * 2. Authoritative Server Persistence (`/api/homepage-feed` -> `data/homepage_feed.json` & `data/homepage_posts.json`)
 * 3. Browser LocalStorage (`mshindi_homepage_feed_v2`, with automatic migration from `v1`)
 * 4. Cross-tab BroadcastChannel & storage event synchronization
 */

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth, isAdminPhone } from './authStore.js';
import { deleteCarouselPhotoStorage } from './carouselStorageService.js';

export interface HomepageMediaDescriptor {
  url: string;
  type: 'image' | 'video' | 'embed';
  mimeType?: string;
  storagePath?: string;
  width?: number;
  height?: number;
}

export interface HomepagePostComment {
  id: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
  likes?: number;
}

export interface HomepageCarouselItem {
  id: string;
  imageUrl: string;
  storagePath?: string; // Firebase Storage object path (e.g. homepage-carousel/{id}/{file}.webp)
  fileName?: string;
  fileSize?: number;
  dimensions?: { width: number; height: number };
  heading?: string;
  caption?: string;
  source?: string; // Photo source / credit (rendered in italics below caption)
  link?: string;
  published: boolean;
  createdAt: string;
  updatedAt?: string;
  publishedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  order?: number;
  // Permanent lifecycle & metadata fields
  authorId?: string;
  authorRole?: 'admin' | 'user';
  content?: string;
  media?: HomepageMediaDescriptor[];
  mediaType?: 'image/webp' | 'image' | 'youtube' | 'embed' | 'none';
  status?: 'published' | 'archived' | 'draft';
  isActive?: boolean;
  visibility?: 'public' | 'archived';
  contentType?: 'carousel';
  // Social interaction fields preserved across edits and deployments
  likes?: number;
  likedBy?: string[];
  saves?: number;
  savedBy?: string[];
  shares?: number;
  comments?: HomepagePostComment[];
}

export interface HomepageVideoItem {
  id: string;
  youtubeUrl?: string;
  embedUrl: string;
  title: string;
  published: boolean;
  createdAt: string;
  updatedAt?: string;
  publishedAt?: string;
  type?: 'youtube' | 'embed' | 'custom';
  // Permanent lifecycle & metadata fields
  authorId?: string;
  authorRole?: 'admin' | 'user';
  content?: string;
  media?: HomepageMediaDescriptor[];
  mediaType?: 'youtube' | 'embed';
  status?: 'published' | 'archived' | 'draft';
  isActive?: boolean;
  visibility?: 'public' | 'archived';
  contentType?: 'video';
  // Social interaction fields preserved across edits and deployments
  likes?: number;
  likedBy?: string[];
  saves?: number;
  savedBy?: string[];
  shares?: number;
  comments?: HomepagePostComment[];
}

export interface HomepageFeedData {
  authorId?: string;
  authorRole?: 'admin';
  updatedAt?: string;
  carouselItems: HomepageCarouselItem[];
  videoItems: HomepageVideoItem[];
  deletedIds?: string[];
}

export interface HomepageFeedSyncState {
  isLoading: boolean;
  syncError: string | null;
  lastSyncedAt: string | null;
}

export interface AdminMutationOptions {
  adminToken?: string;
  callerPhone?: string;
  callerRole?: 'admin' | 'user';
}

const STORAGE_KEY = 'mshindi_homepage_feed_v2';
const LEGACY_STORAGE_KEY_V1 = 'mshindi_homepage_feed_v1';
const ADMIN_TOKEN_STORAGE_KEY = 'mshindi_admin_token_v1';
const FIRESTORE_COLLECTION = 'siteContent';
const FIRESTORE_DOC = 'homepageFeed';
const ADMIN_PHONE_ID = '254743304579';

let simulatedClientDbFailure = false;

export function setClientDatabaseFailureSimulation(shouldFail: boolean): void {
  simulatedClientDbFailure = shouldFail;
}

/**
 * Extracts YouTube video ID from standard watch URLs, short youtu.be links, shorts, or embed URLs
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Direct 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id && id.length === 11 ? id : null;
    }
    if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtube-nocookie.com')) {
      const vParam = parsed.searchParams.get('v');
      if (vParam && vParam.length === 11) return vParam;

      const parts = parsed.pathname.split('/').filter(Boolean);
      const embedIdx = parts.findIndex((p) => p === 'embed' || p === 'shorts' || p === 'v' || p === 'live');
      if (embedIdx !== -1 && parts[embedIdx + 1]) {
        const candidate = parts[embedIdx + 1].split('?')[0];
        return candidate.length === 11 ? candidate : null;
      }
    }
  } catch {
    const match = trimmed.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    if (match && match[1]) return match[1];
  }

  return null;
}

export function toYouTubeEmbedUrl(url: string): string | null {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;
  return `https://www.youtube.com/embed/${videoId}`;
}

export function normalizeYouTubeEmbedUrl(url: string): string | null {
  return toYouTubeEmbedUrl(url);
}

export function getYouTubeThumbnailUrl(urlOrEmbed: string): string | null {
  const videoId = extractYouTubeVideoId(urlOrEmbed);
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Extracts a usable iframe src URL from either a raw `<iframe ... src="...">` snippet
 * or a direct https:// embed URL (Streamable, ScoreBat, Vimeo, Dailymotion, YouTube, etc.)
 */
export function normalizeCustomEmbedUrl(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. Check if user pasted a full <iframe ...> HTML tag
  if (trimmed.toLowerCase().includes('<iframe')) {
    const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      const extracted = srcMatch[1].trim();
      if (extracted.startsWith('https://') || extracted.startsWith('http://')) {
        return extracted;
      }
      if (extracted.startsWith('//')) {
        return `https:${extracted}`;
      }
    }
    return null;
  }

  // 2. Check if it's a YouTube URL first -> normalize to clean embed URL
  const ytEmbed = toYouTubeEmbedUrl(trimmed);
  if (ytEmbed) return ytEmbed;

  // 3. Check if it's a valid http/https URL
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
}

const DEFAULT_FEED: HomepageFeedData = {
  carouselItems: [],
  videoItems: [],
  deletedIds: [],
};

const LEGACY_MOCK_IDS = new Set([
  'carousel-featured-reference',
  'slide-1',
  'slide-2',
  'slide-3',
  'video-1',
  'video-2',
]);

export function enrichCarouselItem(
  item: HomepageCarouselItem,
  existing?: HomepageCarouselItem
): HomepageCarouselItem {
  const now = new Date().toISOString();
  const createdAt = existing?.createdAt || item.createdAt || now;
  const isPublished =
    typeof item.published === 'boolean'
      ? item.published
      : typeof item.isActive === 'boolean'
      ? item.isActive
      : item.status !== 'archived';
  const status = item.status || (isPublished ? 'published' : 'archived');
  const isActive = status === 'published' && isPublished;
  const imageUrl = (item.imageUrl || existing?.imageUrl || '').trim();
  const mediaType =
    imageUrl.startsWith('data:image/webp') || imageUrl.endsWith('.webp') ? 'image/webp' : 'image';

  const cleaned: HomepageCarouselItem = {
    ...existing,
    ...item,
    id: item.id,
    imageUrl,
    heading: item.heading ?? existing?.heading ?? '',
    caption: item.caption ?? existing?.caption ?? '',
    source: item.source ?? existing?.source ?? '',
    published: isActive,
    isActive,
    status: isActive ? 'published' : 'archived',
    visibility: isActive ? 'public' : 'archived',
    contentType: 'carousel',
    authorId: item.authorId || existing?.authorId || ADMIN_PHONE_ID,
    authorRole: 'admin',
    content: (item.caption || item.heading || item.content || existing?.content || '').trim(),
    mediaType,
    media:
      Array.isArray(item.media) && item.media.length > 0
        ? item.media
        : imageUrl
        ? [
            {
              url: imageUrl,
              type: 'image',
              mimeType: mediaType,
              ...(item.storagePath ? { storagePath: item.storagePath } : {}),
            },
          ]
        : [],
    createdAt,
    updatedAt: item.updatedAt || now,
    publishedAt: item.publishedAt || existing?.publishedAt || createdAt,
    likes: typeof item.likes === 'number' ? item.likes : existing?.likes ?? 0,
    likedBy: Array.isArray(item.likedBy) ? item.likedBy : existing?.likedBy ?? [],
    saves: typeof item.saves === 'number' ? item.saves : existing?.saves ?? 0,
    savedBy: Array.isArray(item.savedBy) ? item.savedBy : existing?.savedBy ?? [],
    shares: typeof item.shares === 'number' ? item.shares : existing?.shares ?? 0,
    comments: Array.isArray(item.comments) ? item.comments : existing?.comments ?? [],
  };

  // Strip undefined properties so Firestore documents remain strictly valid
  for (const key of Object.keys(cleaned) as Array<keyof HomepageCarouselItem>) {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  }
  return cleaned;
}

export function enrichVideoItem(
  item: HomepageVideoItem,
  existing?: HomepageVideoItem
): HomepageVideoItem {
  const now = new Date().toISOString();
  const createdAt = existing?.createdAt || item.createdAt || now;
  const isPublished =
    typeof item.published === 'boolean'
      ? item.published
      : typeof item.isActive === 'boolean'
      ? item.isActive
      : item.status !== 'archived';
  const status = item.status || (isPublished ? 'published' : 'archived');
  const isActive = status === 'published' && isPublished;
  const embedUrl = (item.embedUrl || existing?.embedUrl || item.youtubeUrl || '').trim();
  const youtubeUrl = (item.youtubeUrl || existing?.youtubeUrl || embedUrl).trim();
  const videoType = item.type || existing?.type || 'youtube';

  return {
    ...existing,
    ...item,
    id: item.id,
    youtubeUrl,
    embedUrl,
    title: (item.title ?? existing?.title ?? '').trim(),
    type: videoType,
    published: isActive,
    isActive,
    status: isActive ? 'published' : 'archived',
    visibility: isActive ? 'public' : 'archived',
    contentType: 'video',
    authorId: item.authorId || existing?.authorId || ADMIN_PHONE_ID,
    authorRole: 'admin',
    content: (item.title || item.content || existing?.content || '').trim(),
    mediaType: videoType === 'youtube' ? 'youtube' : 'embed',
    media:
      Array.isArray(item.media) && item.media.length > 0
        ? item.media
        : embedUrl
        ? [
            {
              url: embedUrl,
              type: 'video',
              mimeType: videoType === 'youtube' ? 'video/youtube' : 'text/html',
            },
          ]
        : [],
    createdAt,
    updatedAt: item.updatedAt || now,
    publishedAt: item.publishedAt || existing?.publishedAt || createdAt,
    likes: typeof item.likes === 'number' ? item.likes : existing?.likes ?? 0,
    likedBy: Array.isArray(item.likedBy) ? item.likedBy : existing?.likedBy ?? [],
    saves: typeof item.saves === 'number' ? item.saves : existing?.saves ?? 0,
    savedBy: Array.isArray(item.savedBy) ? item.savedBy : existing?.savedBy ?? [],
    shares: typeof item.shares === 'number' ? item.shares : existing?.shares ?? 0,
    comments: Array.isArray(item.comments) ? item.comments : existing?.comments ?? [],
  };
}

/**
 * Filter out any legacy mock items so they can never be reused or displayed,
 * while enriching all valid admin posts with permanent lifecycle metadata.
 */
export function sanitizeHomepageFeed(feed: HomepageFeedData): HomepageFeedData {
  const deletedSet = new Set<string>(Array.isArray(feed?.deletedIds) ? feed.deletedIds : []);

  return {
    ...feed,
    authorId: ADMIN_PHONE_ID,
    authorRole: 'admin',
    deletedIds: Array.from(deletedSet),
    carouselItems: (feed?.carouselItems || [])
      .filter(
        (item) =>
          item &&
          item.id &&
          !LEGACY_MOCK_IDS.has(item.id) &&
          !deletedSet.has(item.id)
      )
      .map((item) => enrichCarouselItem(item)),
    videoItems: (feed?.videoItems || [])
      .filter(
        (item) =>
          item &&
          item.id &&
          !LEGACY_MOCK_IDS.has(item.id) &&
          !deletedSet.has(item.id) &&
          !item.youtubeUrl?.includes('aqz-KE-bpKQ') &&
          !item.youtubeUrl?.includes('kJQP7kiw5Fk')
      )
      .map((item) => enrichVideoItem(item)),
  };
}

/**
 * Reconciles two feed states by post ID and updatedAt timestamp so that
 * published posts are never lost across deployments or storage tiers.
 */
export function reconcileClientFeeds(
  primary: HomepageFeedData | null | undefined,
  secondary: HomepageFeedData | null | undefined
): HomepageFeedData {
  if (!primary && !secondary) return { ...DEFAULT_FEED };
  if (!primary) return sanitizeHomepageFeed(secondary!);
  if (!secondary) return sanitizeHomepageFeed(primary);

  const cleanPrimary = sanitizeHomepageFeed(primary);
  const cleanSecondary = sanitizeHomepageFeed(secondary);

  const deletedSet = new Set<string>([
    ...(cleanPrimary.deletedIds || []),
    ...(cleanSecondary.deletedIds || []),
  ]);

  const carouselMap = new Map<string, HomepageCarouselItem>();
  for (const item of cleanSecondary.carouselItems) {
    if (!deletedSet.has(item.id)) {
      carouselMap.set(item.id, item);
    }
  }
  for (const item of cleanPrimary.carouselItems) {
    if (deletedSet.has(item.id)) continue;
    const existing = carouselMap.get(item.id);
    if (!existing) {
      carouselMap.set(item.id, item);
    } else {
      const timeNew = new Date(item.updatedAt || item.createdAt || 0).getTime();
      const timeOld = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      if (timeNew >= timeOld) {
        carouselMap.set(item.id, enrichCarouselItem(item, existing));
      } else {
        carouselMap.set(item.id, enrichCarouselItem(existing, item));
      }
    }
  }

  const videoMap = new Map<string, HomepageVideoItem>();
  for (const item of cleanSecondary.videoItems) {
    if (!deletedSet.has(item.id)) {
      videoMap.set(item.id, item);
    }
  }
  for (const item of cleanPrimary.videoItems) {
    if (deletedSet.has(item.id)) continue;
    const existing = videoMap.get(item.id);
    if (!existing) {
      videoMap.set(item.id, item);
    } else {
      const timeNew = new Date(item.updatedAt || item.createdAt || 0).getTime();
      const timeOld = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      if (timeNew >= timeOld) {
        videoMap.set(item.id, enrichVideoItem(item, existing));
      } else {
        videoMap.set(item.id, enrichVideoItem(existing, item));
      }
    }
  }

  const carouselItems = Array.from(carouselMap.values()).sort((a, b) => {
    const orderA = typeof a.order === 'number' ? a.order : 9999;
    const orderB = typeof b.order === 'number' ? b.order : 9999;
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const videoItems = Array.from(videoMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const primaryTime = new Date(cleanPrimary.updatedAt || 0).getTime();
  const secondaryTime = new Date(cleanSecondary.updatedAt || 0).getTime();
  const latestUpdatedAt =
    primaryTime >= secondaryTime
      ? cleanPrimary.updatedAt || new Date().toISOString()
      : cleanSecondary.updatedAt || new Date().toISOString();

  return {
    authorId: ADMIN_PHONE_ID,
    authorRole: 'admin',
    carouselItems,
    videoItems,
    deletedIds: Array.from(deletedSet),
    updatedAt: latestUpdatedAt,
  };
}

function loadStoredFeed(): HomepageFeedData {
  if (typeof window === 'undefined') return DEFAULT_FEED;
  try {
    let migratedFromV1: HomepageFeedData | null = null;
    try {
      const rawV1 = localStorage.getItem(LEGACY_STORAGE_KEY_V1);
      if (rawV1) {
        const parsedV1 = JSON.parse(rawV1);
        if (parsedV1 && Array.isArray(parsedV1.carouselItems) && Array.isArray(parsedV1.videoItems)) {
          migratedFromV1 = sanitizeHomepageFeed(parsedV1);
        }
        localStorage.removeItem(LEGACY_STORAGE_KEY_V1);
      }
    } catch {}

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      if (migratedFromV1) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedFromV1));
        } catch {}
        return migratedFromV1;
      }
      return DEFAULT_FEED;
    }

    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.carouselItems) && Array.isArray(parsed.videoItems)) {
      const sanitizedV2 = sanitizeHomepageFeed(parsed);
      return migratedFromV1 ? reconcileClientFeeds(sanitizedV2, migratedFromV1) : sanitizedV2;
    }
    return migratedFromV1 || DEFAULT_FEED;
  } catch {
    return DEFAULT_FEED;
  }
}

let currentFeed: HomepageFeedData = loadStoredFeed();
let syncState: HomepageFeedSyncState = {
  isLoading: false,
  syncError: null,
  lastSyncedAt: null,
};
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

function updateSyncState(partial: Partial<HomepageFeedSyncState>) {
  syncState = { ...syncState, ...partial };
  notifyListeners();
}

export function getHomepageFeedSyncState(): HomepageFeedSyncState {
  return syncState;
}

/**
 * Simulates a fresh browser session / new frontend deployment reload by clearing
 * in-memory state and browser localStorage, then hydrating strictly from persistent database storage.
 */
export async function simulateClientDeploymentReload(): Promise<HomepageFeedData> {
  currentFeed = { ...DEFAULT_FEED };
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
  notifyListeners();
  return refreshHomepageFeed();
}

function getStoredAdminCredentials(options?: AdminMutationOptions): {
  adminToken: string;
  adminPhone: string;
} {
  let adminToken = options?.adminToken || '';
  let adminPhone = options?.callerPhone || '';

  if (typeof window !== 'undefined') {
    try {
      if (!adminToken) {
        adminToken = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '';
      }
    } catch {}
  }

  try {
    const authUser = useAuth.getState().getCurrentUser();
    if (authUser && !adminPhone) {
      adminPhone = authUser.phone || '';
    }
  } catch {}

  if (!adminPhone) {
    adminPhone = ADMIN_PHONE_ID;
  }

  return { adminToken, adminPhone };
}

/**
 * Verifies that the caller attempting to publish, edit, archive, or delete
 * homepage feed content is the authorized administrator (0743304579).
 */
function assertAdminAuthorized(options?: AdminMutationOptions): void {
  // 1. Explicit caller role or phone passed to mutation
  if (options?.callerRole && options.callerRole !== 'admin') {
    throw new Error(
      'Unauthorized: Regular users are not permitted to publish, edit, archive, or delete homepage feed posts.'
    );
  }
  if (options?.callerPhone && !isAdminPhone(options.callerPhone)) {
    throw new Error(
      `Unauthorized: Phone number '${options.callerPhone}' does not have administrator privileges.`
    );
  }

  // 2. Check active user in authStore (if signed in as a non-admin user, block immediately)
  try {
    const activeUser = useAuth.getState().getCurrentUser();
    if (activeUser && !isAdminPhone(activeUser.phone)) {
      throw new Error(
        'Unauthorized: Only administrator 0743304579 can publish, edit, archive, or delete homepage feed posts.'
      );
    }
  } catch (err: any) {
    if (err?.message?.startsWith('Unauthorized:')) {
      throw err;
    }
  }
}

// BroadcastChannel for instant sync across same-browser tabs
let channel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    channel = new BroadcastChannel('mshindi_homepage_feed_channel');
    channel.onmessage = (event) => {
      if (event.data && event.data.type === 'FEED_UPDATED' && event.data.payload) {
        currentFeed = reconcileClientFeeds(event.data.payload, currentFeed);
        notifyListeners();
      }
    };
  } catch {}
}

// Set up cross-tab storage listener + Cloud Firestore real-time listener + API hydration
let cloudUnsubscribe: (() => void) | null = null;
function setupCloudSync() {
  if (typeof window === 'undefined') return;

  // 1. LocalStorage cross-tab listener
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        currentFeed = reconcileClientFeeds(parsed, currentFeed);
        notifyListeners();
      } catch {}
    }
  });

  // 2. Real-time Firestore listener (syncs across all devices & visitors globally)
  try {
    if (db && !cloudUnsubscribe) {
      const feedRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
      cloudUnsubscribe = onSnapshot(
        feedRef,
        (snapshot) => {
          if (simulatedClientDbFailure) return;
          if (snapshot.exists()) {
            const rawData = snapshot.data() as HomepageFeedData;
            if (rawData && Array.isArray(rawData.carouselItems) && Array.isArray(rawData.videoItems)) {
              const cloudData = sanitizeHomepageFeed(rawData);
              const cloudHasItems =
                cloudData.carouselItems.length > 0 ||
                cloudData.videoItems.length > 0 ||
                (cloudData.deletedIds && cloudData.deletedIds.length > 0);
              const currentHasItems =
                currentFeed.carouselItems.length > 0 || currentFeed.videoItems.length > 0;

              if (cloudHasItems) {
                currentFeed = reconcileClientFeeds(cloudData, currentFeed);
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(currentFeed));
                } catch {}
                updateSyncState({
                  isLoading: false,
                  syncError: null,
                  lastSyncedAt: new Date().toISOString(),
                });
              } else if (currentHasItems) {
                // Cloud is empty/uninitialized, but client/server has published items:
                // Preserve valid published items and push to cloud
                persistToCloud(currentFeed).catch(() => {});
              }
            }
          }
        },
        (error) => {
          console.warn('[HomepageFeed] Firestore listener fallback:', error.message);
        }
      );
    }
  } catch (err: any) {
    console.warn('[HomepageFeed] Cloud sync initialization fallback:', err?.message || err);
  }

  // 3. Hydrate immediately from persistent backend API & Firestore on startup
  refreshHomepageFeed().catch(() => {});
}

setupCloudSync();

/**
 * Proactively fetches the latest published homepage feed from both Cloud Firestore
 * and the backend persistent database (`/api/homepage-feed`), reconciling with current state.
 *
 * CRITICAL FAILURE PROTECTION: If both database queries fail temporarily, existing
 * published posts in memory and localStorage are preserved intact and never overwritten.
 */
export async function refreshHomepageFeed(): Promise<HomepageFeedData> {
  updateSyncState({ isLoading: true, syncError: null });

  if (simulatedClientDbFailure) {
    const errMsg = 'Temporary database connection error. Preserving existing published posts.';
    updateSyncState({ isLoading: false, syncError: errMsg });
    throw new Error(errMsg);
  }

  let resolvedFeed: HomepageFeedData | null = null;
  let anySourceSucceeded = false;
  let lastError: string | null = null;

  // 1. Check backend API (/api/homepage-feed)
  try {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/homepage-feed', {
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.feed && Array.isArray(data.feed.carouselItems)) {
          anySourceSucceeded = true;
          const sanitized = sanitizeHomepageFeed(data.feed);
          if (
            !data.feed._isDefault &&
            (sanitized.carouselItems.length > 0 ||
              sanitized.videoItems.length > 0 ||
              (sanitized.deletedIds && sanitized.deletedIds.length > 0))
          ) {
            resolvedFeed = reconciledOrInitial(resolvedFeed, sanitized);
          }
        }
      } else {
        lastError = `Server returned HTTP ${res.status}`;
      }
    } else {
      // Server/Node environment: read directly from serverHomepageFeed
      const serverMod = './serverHomepageFeed.js';
      const { getSavedHomepageFeedAsync } = await import(/* @vite-ignore */ serverMod);
      const serverFeed = await getSavedHomepageFeedAsync();
      anySourceSucceeded = true;
      if (
        !serverFeed._isDefault &&
        (serverFeed.carouselItems.length > 0 ||
          serverFeed.videoItems.length > 0 ||
          (serverFeed.deletedIds && serverFeed.deletedIds.length > 0))
      ) {
        resolvedFeed = reconciledOrInitial(resolvedFeed, sanitizeHomepageFeed(serverFeed));
      }
    }
  } catch (err: any) {
    lastError = err?.message || 'Backend API unreachable';
  }

  // 2. Check Cloud Firestore directly
  if (db) {
    try {
      const feedRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
      const snap = await getDoc(feedRef);
      anySourceSucceeded = true;
      if (snap.exists()) {
        const rawData = snap.data() as HomepageFeedData;
        if (rawData && Array.isArray(rawData.carouselItems) && Array.isArray(rawData.videoItems)) {
          const sanitized = sanitizeHomepageFeed(rawData);
          if (
            sanitized.carouselItems.length > 0 ||
            sanitized.videoItems.length > 0 ||
            (sanitized.deletedIds && sanitized.deletedIds.length > 0)
          ) {
            resolvedFeed = reconciledOrInitial(resolvedFeed, sanitized);
          }
        }
      }
    } catch (err: any) {
      lastError = err?.message || 'Firestore read failed';
    }
  }

  if (!anySourceSucceeded) {
    const errMsg = lastError || 'Unable to reach homepage feed database';
    updateSyncState({ isLoading: false, syncError: errMsg });
    throw new Error(errMsg);
  }

  if (resolvedFeed) {
    currentFeed = reconcileClientFeeds(resolvedFeed, currentFeed);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentFeed));
      } catch {}
    }
  }

  updateSyncState({
    isLoading: false,
    syncError: null,
    lastSyncedAt: new Date().toISOString(),
  });
  return currentFeed;
}

function reconciledOrInitial(
  a: HomepageFeedData | null,
  b: HomepageFeedData
): HomepageFeedData {
  return a ? reconcileClientFeeds(b, a) : b;
}

/**
 * Persists the homepage feed to Cloud Firestore and the backend server database.
 *
 * Returns `success: true` ONLY when at least one persistent database write
 * (`firestoreSaved` or `serverSaved`) has been confirmed.
 */
export async function persistToCloud(
  data: HomepageFeedData,
  options?: AdminMutationOptions & {
    allowReplaceAll?: boolean;
    postDoc?: HomepageCarouselItem | HomepageVideoItem;
  }
): Promise<{
  success: boolean;
  firestoreSaved: boolean;
  serverSaved: boolean;
  error?: string;
}> {
  if (simulatedClientDbFailure) {
    const errMsg = 'Simulated database failure: write aborted to protect existing content.';
    updateSyncState({ syncError: errMsg });
    return {
      success: false,
      firestoreSaved: false,
      serverSaved: false,
      error: errMsg,
    };
  }

  let firestoreSaved = false;
  let serverSaved = false;
  let lastError: string | undefined;

  const { adminToken, adminPhone } = getStoredAdminCredentials(options);

  // Deep sanitize payload: removes all undefined keys and enforces valid JSON
  const cleanData: HomepageFeedData = JSON.parse(
    JSON.stringify({
      ...sanitizeHomepageFeed(data),
      authorId: ADMIN_PHONE_ID,
      authorRole: 'admin',
      updatedAt: new Date().toISOString(),
    })
  );

  // 1. Write to Cloud Firestore (if available & configured)
  try {
    if (db) {
      const feedRef = doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC);
      await setDoc(feedRef, cleanData, { merge: true });
      if (options?.postDoc && options.postDoc.id) {
        const cleanPost = JSON.parse(JSON.stringify(options.postDoc));
        const postRef = doc(db, FIRESTORE_COLLECTION, `post_${options.postDoc.id}`);
        await setDoc(postRef, cleanPost, { merge: true });
      }
      firestoreSaved = true;
    }
  } catch (err: any) {
    lastError = err?.message || 'Firestore write failed';
    console.warn('[HomepageFeed] Firestore push notice:', lastError);
  }

  // 2. Persist to server backend database (/api/homepage-feed)
  try {
    if (typeof window !== 'undefined') {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-admin-phone': adminPhone,
      };
      if (adminToken) {
        headers['x-admin-token'] = adminToken;
      }

      const res = await fetch('/api/homepage-feed', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...cleanData,
          adminToken: adminToken || undefined,
          adminPhone,
          allowReplaceAll: options?.allowReplaceAll,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (json && json.success) {
          serverSaved = true;
          if (json.feed) {
            currentFeed = sanitizeHomepageFeed(json.feed);
          }
        } else {
          lastError = json?.error || 'Server rejected homepage feed update';
        }
      } else {
        const errBody = await res.json().catch(() => ({}));
        lastError = errBody?.error || `Server returned status ${res.status}`;
      }
    } else {
      // Server/Node environment: write directly via serverHomepageFeed
      const serverMod = './serverHomepageFeed.js';
      const { saveHomepageFeedAsync } = await import(/* @vite-ignore */ serverMod);
      const saved = await saveHomepageFeedAsync(cleanData, {
        allowReplaceAll: options?.allowReplaceAll,
      });
      serverSaved = saved.diskSaved;
      firestoreSaved = firestoreSaved || saved.firestoreSaved;
      currentFeed = sanitizeHomepageFeed(saved.feed);
    }
  } catch (err: any) {
    lastError = err?.message || 'Backend API unreachable';
    console.warn('[HomepageFeed] Backend API push notice:', lastError);
  }

  // Strictly require at least one confirmed persistent database write
  const success = firestoreSaved || serverSaved;

  if (success) {
    updateSyncState({
      syncError: null,
      lastSyncedAt: new Date().toISOString(),
    });
  } else {
    updateSyncState({
      syncError: lastError || 'Failed to persist homepage feed to database',
    });
  }

  return { success, firestoreSaved, serverSaved, error: success ? undefined : lastError };
}

async function commitAndSyncFeed(
  nextFeed: HomepageFeedData,
  options?: AdminMutationOptions & {
    allowReplaceAll?: boolean;
    postDoc?: HomepageCarouselItem | HomepageVideoItem;
    requireDatabaseConfirmation?: boolean;
  }
): Promise<{
  success: boolean;
  firestoreSaved: boolean;
  serverSaved: boolean;
  error?: string;
}> {
  const previousFeed = currentFeed;
  const sanitizedNext = sanitizeHomepageFeed({
    ...nextFeed,
    updatedAt: new Date().toISOString(),
  });

  currentFeed = sanitizedNext;

  const result = await persistToCloud(sanitizedNext, options);

  if (!result.success && options?.requireDatabaseConfirmation) {
    // Roll back optimistic memory mutation if database write failed
    currentFeed = previousFeed;
    notifyListeners();
    throw new Error(result.error || 'Failed to save post to the production database.');
  }

  // Persist to browser LocalStorage and broadcast after confirmation
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentFeed));
    } catch {}
  }

  try {
    channel?.postMessage({ type: 'FEED_UPDATED', payload: currentFeed });
  } catch {}

  notifyListeners();
  return result;
}

export function subscribeToHomepageFeed(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getHomepageFeedSnapshot(): HomepageFeedData {
  return currentFeed;
}

// ============================================================================
// CAROUSEL PHOTO ACTIONS (Admin Protected)
// ============================================================================

export async function addCarouselItem(
  item: {
    id?: string;
    imageUrl: string;
    storagePath?: string;
    fileName?: string;
    fileSize?: number;
    dimensions?: { width: number; height: number };
    heading?: string;
    caption?: string;
    source?: string;
    link?: string;
    order?: number;
    createdBy?: string;
    published?: boolean;
  },
  options?: AdminMutationOptions
): Promise<HomepageCarouselItem> {
  assertAdminAuthorized(options);

  const cleanImageUrl = (item.imageUrl || '').trim();
  if (!cleanImageUrl) {
    throw new Error('Cannot publish carousel item without a valid image URL.');
  }

  const minOrder = currentFeed.carouselItems.reduce(
    (min, i) => (typeof i.order === 'number' && i.order < min ? i.order : min),
    0
  );

  const now = new Date().toISOString();
  const newItem = enrichCarouselItem({
    id: item.id || `carousel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    imageUrl: cleanImageUrl,
    storagePath: item.storagePath,
    fileName: item.fileName,
    fileSize: item.fileSize,
    dimensions: item.dimensions,
    heading: item.heading?.trim() || '',
    caption: item.caption?.trim() || '',
    source: item.source?.trim() || '',
    link: item.link?.trim() || undefined,
    createdBy: item.createdBy || ADMIN_PHONE_ID,
    published: item.published ?? true,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    order: typeof item.order === 'number' ? item.order : minOrder - 1,
  });

  const deletedSet = new Set(currentFeed.deletedIds || []);
  deletedSet.delete(newItem.id);

  await commitAndSyncFeed(
    {
      ...currentFeed,
      deletedIds: Array.from(deletedSet),
      carouselItems: [
        newItem,
        ...currentFeed.carouselItems.filter((existing) => existing.id !== newItem.id),
      ],
    },
    { ...options, postDoc: newItem, requireDatabaseConfirmation: true }
  );

  return newItem;
}

export async function updateCarouselItem(
  id: string,
  updates: Partial<
    Pick<
      HomepageCarouselItem,
      | 'heading'
      | 'caption'
      | 'source'
      | 'link'
      | 'order'
      | 'imageUrl'
      | 'storagePath'
      | 'dimensions'
      | 'fileSize'
      | 'updatedBy'
      | 'published'
    >
  >,
  options?: AdminMutationOptions
): Promise<HomepageCarouselItem | null> {
  assertAdminAuthorized(options);

  const existing = currentFeed.carouselItems.find((item) => item.id === id);
  if (!existing) return null;

  const updatedItem = enrichCarouselItem(
    {
      ...existing,
      ...updates,
      heading: updates.heading !== undefined ? updates.heading.trim() : existing.heading,
      caption: updates.caption !== undefined ? updates.caption.trim() : existing.caption,
      source: updates.source !== undefined ? updates.source.trim() : existing.source,
      published: updates.published !== undefined ? updates.published : existing.published,
      isActive: updates.published !== undefined ? updates.published : existing.isActive,
      status:
        updates.published !== undefined
          ? updates.published
            ? 'published'
            : 'archived'
          : existing.status,
      order: updates.order !== undefined ? updates.order : existing.order,
      createdAt: existing.createdAt, // Strictly preserve original creation timestamp
      updatedAt: new Date().toISOString(),
    },
    existing
  );

  await commitAndSyncFeed(
    {
      ...currentFeed,
      carouselItems: currentFeed.carouselItems.map((item) =>
        item.id === id ? updatedItem : item
      ),
    },
    { ...options, postDoc: updatedItem, requireDatabaseConfirmation: true }
  );

  return updatedItem;
}

export async function replaceCarouselItemPhoto(
  id: string,
  photoData: {
    imageUrl: string;
    storagePath?: string;
    fileName?: string;
    fileSize?: number;
    dimensions?: { width: number; height: number };
    updatedBy?: string;
  },
  options?: AdminMutationOptions
): Promise<HomepageCarouselItem | null> {
  assertAdminAuthorized(options);

  const existing = currentFeed.carouselItems.find((item) => item.id === id);
  if (!existing) return null;

  const updatedItem = enrichCarouselItem(
    {
      ...existing,
      imageUrl: photoData.imageUrl.trim(),
      storagePath: photoData.storagePath,
      fileName: photoData.fileName,
      fileSize: photoData.fileSize,
      dimensions: photoData.dimensions,
      updatedBy: photoData.updatedBy || existing.updatedBy,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    },
    existing
  );

  await commitAndSyncFeed(
    {
      ...currentFeed,
      carouselItems: currentFeed.carouselItems.map((item) =>
        item.id === id ? updatedItem : item
      ),
    },
    { ...options, postDoc: updatedItem, requireDatabaseConfirmation: true }
  );

  return updatedItem;
}

export async function reorderCarouselItems(
  orderedIds: string[],
  updatedByOrOptions?: string | AdminMutationOptions
): Promise<void> {
  const options =
    typeof updatedByOrOptions === 'object' ? updatedByOrOptions : undefined;
  const updatedBy =
    typeof updatedByOrOptions === 'string' ? updatedByOrOptions : undefined;
  assertAdminAuthorized(options);

  const orderMap = new Map<string, number>();
  orderedIds.forEach((id, idx) => orderMap.set(id, idx + 1));

  const reordered = currentFeed.carouselItems
    .map((item) => ({
      ...item,
      order: orderMap.has(item.id) ? orderMap.get(item.id)! : (item.order ?? 9999),
      updatedBy: updatedBy || item.updatedBy,
      updatedAt: new Date().toISOString(),
    }))
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));

  await commitAndSyncFeed(
    {
      ...currentFeed,
      carouselItems: reordered,
    },
    { ...options, requireDatabaseConfirmation: true }
  );
}

export async function deleteCarouselItem(
  id: string,
  options?: AdminMutationOptions
): Promise<void> {
  assertAdminAuthorized(options);

  const targetItem = currentFeed.carouselItems.find((c) => c.id === id);
  const oldStoragePath = targetItem?.storagePath;

  const deletedSet = new Set(currentFeed.deletedIds || []);
  deletedSet.add(id);

  await commitAndSyncFeed(
    {
      ...currentFeed,
      deletedIds: Array.from(deletedSet),
      carouselItems: currentFeed.carouselItems.filter((item) => item.id !== id),
    },
    { ...options, allowReplaceAll: true, requireDatabaseConfirmation: true }
  );

  if (oldStoragePath) {
    deleteCarouselPhotoStorage(oldStoragePath).catch((err) => {
      console.warn('[HomepageFeedStore] Storage cleanup notice:', oldStoragePath, err);
    });
  }
}

export async function toggleCarouselItemPublish(
  id: string,
  options?: AdminMutationOptions
): Promise<HomepageCarouselItem | null> {
  assertAdminAuthorized(options);

  const existing = currentFeed.carouselItems.find((item) => item.id === id);
  if (!existing) return null;

  const nextPublished = !existing.published;
  return updateCarouselItem(id, { published: nextPublished }, options);
}

export async function archiveCarouselItem(
  id: string,
  options?: AdminMutationOptions
): Promise<HomepageCarouselItem | null> {
  assertAdminAuthorized(options);
  return updateCarouselItem(id, { published: false }, options);
}

// ============================================================================
// VIDEO HIGHLIGHT ACTIONS (Admin Protected)
// ============================================================================

export async function addVideoItem(
  item: {
    id?: string;
    youtubeUrl: string;
    title: string;
    published?: boolean;
    type?: 'youtube' | 'embed';
  },
  options?: AdminMutationOptions
): Promise<HomepageVideoItem | null> {
  assertAdminAuthorized(options);

  const isCustomEmbed = item.type === 'embed' || !extractYouTubeVideoId(item.youtubeUrl);
  const embedUrl = isCustomEmbed
    ? normalizeCustomEmbedUrl(item.youtubeUrl)
    : toYouTubeEmbedUrl(item.youtubeUrl);

  if (!embedUrl) return null;

  const now = new Date().toISOString();
  const newItem = enrichVideoItem({
    id: item.id || `video-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    youtubeUrl: item.youtubeUrl.trim(),
    embedUrl,
    title: item.title.trim() || 'Matchweek Video Highlight',
    published: item.published ?? true,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    type: isCustomEmbed ? 'embed' : 'youtube',
  });

  const deletedSet = new Set(currentFeed.deletedIds || []);
  deletedSet.delete(newItem.id);

  await commitAndSyncFeed(
    {
      ...currentFeed,
      deletedIds: Array.from(deletedSet),
      videoItems: [
        newItem,
        ...currentFeed.videoItems.filter((existing) => existing.id !== newItem.id),
      ],
    },
    { ...options, postDoc: newItem, requireDatabaseConfirmation: true }
  );

  return newItem;
}

export async function updateVideoItem(
  id: string,
  updates: {
    title?: string;
    youtubeUrl?: string;
    published?: boolean;
  },
  options?: AdminMutationOptions
): Promise<HomepageVideoItem | null> {
  assertAdminAuthorized(options);

  const existing = currentFeed.videoItems.find((item) => item.id === id);
  if (!existing) return null;

  let nextEmbedUrl = existing.embedUrl;
  let nextYoutubeUrl = existing.youtubeUrl;
  let nextType = existing.type;

  if (updates.youtubeUrl !== undefined && updates.youtubeUrl.trim()) {
    const isCustomEmbed = !extractYouTubeVideoId(updates.youtubeUrl);
    const parsedEmbed = isCustomEmbed
      ? normalizeCustomEmbedUrl(updates.youtubeUrl)
      : toYouTubeEmbedUrl(updates.youtubeUrl);
    if (parsedEmbed) {
      nextEmbedUrl = parsedEmbed;
      nextYoutubeUrl = updates.youtubeUrl.trim();
      nextType = isCustomEmbed ? 'embed' : 'youtube';
    }
  }

  const updatedItem = enrichVideoItem(
    {
      ...existing,
      title: updates.title !== undefined ? updates.title.trim() : existing.title,
      youtubeUrl: nextYoutubeUrl,
      embedUrl: nextEmbedUrl,
      type: nextType,
      published: updates.published !== undefined ? updates.published : existing.published,
      isActive: updates.published !== undefined ? updates.published : existing.isActive,
      status:
        updates.published !== undefined
          ? updates.published
            ? 'published'
            : 'archived'
          : existing.status,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    },
    existing
  );

  await commitAndSyncFeed(
    {
      ...currentFeed,
      videoItems: currentFeed.videoItems.map((item) => (item.id === id ? updatedItem : item)),
    },
    { ...options, postDoc: updatedItem, requireDatabaseConfirmation: true }
  );

  return updatedItem;
}

export async function deleteVideoItem(
  id: string,
  options?: AdminMutationOptions
): Promise<void> {
  assertAdminAuthorized(options);

  const deletedSet = new Set(currentFeed.deletedIds || []);
  deletedSet.add(id);

  await commitAndSyncFeed(
    {
      ...currentFeed,
      deletedIds: Array.from(deletedSet),
      videoItems: currentFeed.videoItems.filter((item) => item.id !== id),
    },
    { ...options, allowReplaceAll: true, requireDatabaseConfirmation: true }
  );
}

export async function toggleVideoItemPublish(
  id: string,
  options?: AdminMutationOptions
): Promise<HomepageVideoItem | null> {
  assertAdminAuthorized(options);

  const existing = currentFeed.videoItems.find((item) => item.id === id);
  if (!existing) return null;

  return updateVideoItem(id, { published: !existing.published }, options);
}

export async function archiveVideoItem(
  id: string,
  options?: AdminMutationOptions
): Promise<HomepageVideoItem | null> {
  assertAdminAuthorized(options);
  return updateVideoItem(id, { published: false }, options);
}

export async function addCustomEmbedItem(
  item: {
    id?: string;
    embedUrl: string;
    title: string;
    published?: boolean;
  },
  options?: AdminMutationOptions
): Promise<HomepageVideoItem> {
  assertAdminAuthorized(options);

  const embed = normalizeCustomEmbedUrl(item.embedUrl);
  if (!embed) {
    throw new Error('Please enter a valid embed URL or <iframe> snippet.');
  }

  const now = new Date().toISOString();
  const newEmbed = enrichVideoItem({
    id: item.id || `embed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    youtubeUrl: item.embedUrl.trim(),
    embedUrl: embed,
    title: item.title.trim() || 'Featured Media Embed',
    published: item.published !== undefined ? item.published : true,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    type: 'custom',
  });

  const deletedSet = new Set(currentFeed.deletedIds || []);
  deletedSet.delete(newEmbed.id);

  await commitAndSyncFeed(
    {
      ...currentFeed,
      deletedIds: Array.from(deletedSet),
      videoItems: [
        newEmbed,
        ...currentFeed.videoItems.filter((existing) => existing.id !== newEmbed.id),
      ],
    },
    { ...options, postDoc: newEmbed, requireDatabaseConfirmation: true }
  );

  return newEmbed;
}

export async function resetHomepageFeedToDefault(
  options?: AdminMutationOptions
): Promise<void> {
  assertAdminAuthorized(options);
  await commitAndSyncFeed(
    { ...DEFAULT_FEED },
    { ...options, allowReplaceAll: true, requireDatabaseConfirmation: true }
  );
}

// ============================================================================
// SOCIAL ENGAGEMENT ACTIONS (Open to Authenticated / Public Community Users)
// ============================================================================

export async function toggleHomepagePostLike(
  itemId: string,
  userId: string
): Promise<{ liked: boolean; likes: number }> {
  const cleanUserId = (userId || 'anonymous').trim();
  const now = new Date().toISOString();

  const carouselTarget = currentFeed.carouselItems.find((i) => i.id === itemId);
  if (carouselTarget) {
    const likedBy = Array.isArray(carouselTarget.likedBy) ? [...carouselTarget.likedBy] : [];
    const alreadyLiked = likedBy.includes(cleanUserId);
    const nextLikedBy = alreadyLiked
      ? likedBy.filter((u) => u !== cleanUserId)
      : [...likedBy, cleanUserId];
    const nextLikes = Math.max(0, nextLikedBy.length);

    const updated = enrichCarouselItem(
      {
        ...carouselTarget,
        likes: nextLikes,
        likedBy: nextLikedBy,
        updatedAt: now,
      },
      carouselTarget
    );

    await commitAndSyncFeed(
      {
        ...currentFeed,
        carouselItems: currentFeed.carouselItems.map((i) => (i.id === itemId ? updated : i)),
      },
      { postDoc: updated }
    );

    return { liked: !alreadyLiked, likes: nextLikes };
  }

  const videoTarget = currentFeed.videoItems.find((v) => v.id === itemId);
  if (videoTarget) {
    const likedBy = Array.isArray(videoTarget.likedBy) ? [...videoTarget.likedBy] : [];
    const alreadyLiked = likedBy.includes(cleanUserId);
    const nextLikedBy = alreadyLiked
      ? likedBy.filter((u) => u !== cleanUserId)
      : [...likedBy, cleanUserId];
    const nextLikes = Math.max(0, nextLikedBy.length);

    const updated = enrichVideoItem(
      {
        ...videoTarget,
        likes: nextLikes,
        likedBy: nextLikedBy,
        updatedAt: now,
      },
      videoTarget
    );

    await commitAndSyncFeed(
      {
        ...currentFeed,
        videoItems: currentFeed.videoItems.map((v) => (v.id === itemId ? updated : v)),
      },
      { postDoc: updated }
    );

    return { liked: !alreadyLiked, likes: nextLikes };
  }

  throw new Error(`Homepage post '${itemId}' not found.`);
}

export async function toggleHomepagePostSave(
  itemId: string,
  userId: string
): Promise<{ saved: boolean; saves: number }> {
  const cleanUserId = (userId || 'anonymous').trim();
  const now = new Date().toISOString();

  const carouselTarget = currentFeed.carouselItems.find((i) => i.id === itemId);
  if (carouselTarget) {
    const savedBy = Array.isArray(carouselTarget.savedBy) ? [...carouselTarget.savedBy] : [];
    const alreadySaved = savedBy.includes(cleanUserId);
    const nextSavedBy = alreadySaved
      ? savedBy.filter((u) => u !== cleanUserId)
      : [...savedBy, cleanUserId];
    const nextSaves = Math.max(0, nextSavedBy.length);

    const updated = enrichCarouselItem(
      {
        ...carouselTarget,
        saves: nextSaves,
        savedBy: nextSavedBy,
        updatedAt: now,
      },
      carouselTarget
    );

    await commitAndSyncFeed(
      {
        ...currentFeed,
        carouselItems: currentFeed.carouselItems.map((i) => (i.id === itemId ? updated : i)),
      },
      { postDoc: updated }
    );

    return { saved: !alreadySaved, saves: nextSaves };
  }

  const videoTarget = currentFeed.videoItems.find((v) => v.id === itemId);
  if (videoTarget) {
    const savedBy = Array.isArray(videoTarget.savedBy) ? [...videoTarget.savedBy] : [];
    const alreadySaved = savedBy.includes(cleanUserId);
    const nextSavedBy = alreadySaved
      ? savedBy.filter((u) => u !== cleanUserId)
      : [...savedBy, cleanUserId];
    const nextSaves = Math.max(0, nextSavedBy.length);

    const updated = enrichVideoItem(
      {
        ...videoTarget,
        saves: nextSaves,
        savedBy: nextSavedBy,
        updatedAt: now,
      },
      videoTarget
    );

    await commitAndSyncFeed(
      {
        ...currentFeed,
        videoItems: currentFeed.videoItems.map((v) => (v.id === itemId ? updated : v)),
      },
      { postDoc: updated }
    );

    return { saved: !alreadySaved, saves: nextSaves };
  }

  throw new Error(`Homepage post '${itemId}' not found.`);
}

export async function addHomepagePostComment(
  itemId: string,
  commentInput: { userId: string; username: string; text: string }
): Promise<HomepagePostComment> {
  const cleanText = (commentInput.text || '').trim();
  if (!cleanText) {
    throw new Error('Comment text cannot be empty.');
  }

  const now = new Date().toISOString();
  const newComment: HomepagePostComment = {
    id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId: (commentInput.userId || 'anonymous').trim(),
    username: (commentInput.username || 'Member').trim(),
    text: cleanText,
    createdAt: now,
    likes: 0,
  };

  const carouselTarget = currentFeed.carouselItems.find((i) => i.id === itemId);
  if (carouselTarget) {
    const existingComments = Array.isArray(carouselTarget.comments) ? carouselTarget.comments : [];
    const updated = enrichCarouselItem(
      {
        ...carouselTarget,
        comments: [...existingComments, newComment],
        updatedAt: now,
      },
      carouselTarget
    );

    await commitAndSyncFeed(
      {
        ...currentFeed,
        carouselItems: currentFeed.carouselItems.map((i) => (i.id === itemId ? updated : i)),
      },
      { postDoc: updated }
    );

    return newComment;
  }

  const videoTarget = currentFeed.videoItems.find((v) => v.id === itemId);
  if (videoTarget) {
    const existingComments = Array.isArray(videoTarget.comments) ? videoTarget.comments : [];
    const updated = enrichVideoItem(
      {
        ...videoTarget,
        comments: [...existingComments, newComment],
        updatedAt: now,
      },
      videoTarget
    );

    await commitAndSyncFeed(
      {
        ...currentFeed,
        videoItems: currentFeed.videoItems.map((v) => (v.id === itemId ? updated : v)),
      },
      { postDoc: updated }
    );

    return newComment;
  }

  throw new Error(`Homepage post '${itemId}' not found.`);
}
