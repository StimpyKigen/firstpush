import fs from 'fs';
import path from 'path';
import os from 'os';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db as clientDb } from '../firebase.js';
import type {
  HomepageFeedData,
  HomepageCarouselItem,
  HomepageVideoItem,
} from './homepageFeedStore.js';
import { ADMIN_PHONE_NORMALIZED } from './adminAuthService.js';

// Authoritative repository data files (persist across builds and deployments)
const DATA_DIR = path.join(process.cwd(), 'data');
const PRIMARY_DATA_FILE = path.join(DATA_DIR, 'homepage_feed.json');
const PRIMARY_POSTS_FILE = path.join(DATA_DIR, 'homepage_posts.json');
const PRIMARY_MEDIA_FILE = path.join(DATA_DIR, 'homepage_media.json');

// Ephemeral runtime caches (used if primary filesystem is temporarily read-only)
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const CACHE_DIR = isServerless
  ? path.join(os.tmpdir(), '.mshindi-cache')
  : path.join(process.cwd(), '.cache');
const FALLBACK_CACHE_FILE = path.join(CACHE_DIR, 'homepage_feed.json');
const FALLBACK_POSTS_FILE = path.join(CACHE_DIR, 'homepage_posts.json');
const FALLBACK_MEDIA_FILE = path.join(CACHE_DIR, 'homepage_media.json');

const FIRESTORE_COLLECTION = 'siteContent';
const FIRESTORE_DOC = 'homepageFeed';

// In-memory runtime cache (fastest response, survives across requests within Node process)
let inMemoryFeed: (HomepageFeedData & { _isDefault?: boolean }) | null = null;
let simulatedDbFailure = false;

export function setServerDatabaseFailureSimulation(shouldFail: boolean): void {
  simulatedDbFailure = shouldFail;
}

export function isServerDatabaseFailureSimulated(): boolean {
  return simulatedDbFailure;
}

/**
 * Allows test suites to simulate a fresh deployment cold-start by clearing in-memory state
 * and ephemeral runtime caches while leaving persistent database storage intact.
 */
export function simulateServerDeploymentColdStart(): void {
  inMemoryFeed = null;
  try {
    if (fs.existsSync(FALLBACK_CACHE_FILE)) fs.unlinkSync(FALLBACK_CACHE_FILE);
  } catch {}
  try {
    if (fs.existsSync(FALLBACK_POSTS_FILE)) fs.unlinkSync(FALLBACK_POSTS_FILE);
  } catch {}
}

// Empty initial state — no hardcoded mock data is ever injected
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

// Lazy Firebase Admin Firestore instance (uses FIREBASE_SERVICE_ACCOUNT or Cloud Run ADC when available)
let adminFirestoreInstance: any | null = null;
let adminFirestoreInitAttempted = false;

async function getAdminFirestore(): Promise<any | null> {
  if (adminFirestoreInstance) return adminFirestoreInstance;
  if (adminFirestoreInitAttempted) return null;
  adminFirestoreInitAttempted = true;

  try {
    const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT;
    const isCloudRun = Boolean(process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT);
    if (!rawSa && !isCloudRun) {
      return null;
    }

    const adminPkg = 'firebase-admin';
    const adminModule = await import(/* @vite-ignore */ adminPkg);
    const admin = (adminModule as any).default || adminModule;

    if (!admin.apps || admin.apps.length === 0) {
      if (rawSa) {
        const serviceAccount = JSON.parse(rawSa);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: serviceAccount.project_id || 'mshindiroom-production',
        });
      } else {
        admin.initializeApp({
          projectId: 'mshindiroom-production',
        });
      }
    }
    adminFirestoreInstance = admin.firestore();
    return adminFirestoreInstance;
  } catch {
    return null;
  }
}

/**
 * Enriches and normalizes a carousel item with full permanent post lifecycle fields
 */
export function normalizeCarouselPostItem(
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
  const mediaType = imageUrl.startsWith('data:image/webp') || imageUrl.endsWith('.webp')
    ? 'image/webp'
    : 'image';

  return {
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
    authorId: item.authorId || existing?.authorId || ADMIN_PHONE_NORMALIZED,
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
              storagePath: item.storagePath,
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
 * Enriches and normalizes a video item with full permanent post lifecycle fields
 */
export function normalizeVideoPostItem(
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
    authorId: item.authorId || existing?.authorId || ADMIN_PHONE_NORMALIZED,
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
 * Permanently filters out any legacy mock data items so they can never reappear on new deploys
 */
export function sanitizeFeed(feed: HomepageFeedData): HomepageFeedData {
  const deletedSet = new Set<string>(Array.isArray(feed.deletedIds) ? feed.deletedIds : []);

  const carouselItems = (feed.carouselItems || [])
    .filter(
      (item) =>
        item &&
        item.id &&
        !LEGACY_MOCK_IDS.has(item.id) &&
        !deletedSet.has(item.id) &&
        !item.imageUrl?.includes('mp3tourl.com')
    )
    .map((item) => normalizeCarouselPostItem(item));

  const videoItems = (feed.videoItems || [])
    .filter(
      (item) =>
        item &&
        item.id &&
        !LEGACY_MOCK_IDS.has(item.id) &&
        !deletedSet.has(item.id) &&
        !item.youtubeUrl?.includes('aqz-KE-bpKQ') &&
        !item.youtubeUrl?.includes('kJQP7kiw5Fk')
    )
    .map((item) => normalizeVideoPostItem(item));

  return {
    ...feed,
    authorId: ADMIN_PHONE_NORMALIZED,
    authorRole: 'admin',
    carouselItems,
    videoItems,
    deletedIds: Array.from(deletedSet),
    updatedAt: feed.updatedAt || new Date().toISOString(),
  };
}

/**
 * Reconciles two feed states by post ID and updatedAt timestamp so that
 * published posts are never lost across deployments or storage tiers,
 * while respecting explicit admin deletions recorded in `deletedIds`.
 */
export function reconcileHomepageFeeds(
  primary: HomepageFeedData | null | undefined,
  secondary: HomepageFeedData | null | undefined
): HomepageFeedData {
  if (!primary && !secondary) return { ...DEFAULT_FEED };
  if (!primary) return sanitizeFeed(secondary!);
  if (!secondary) return sanitizeFeed(primary);

  const cleanPrimary = sanitizeFeed(primary);
  const cleanSecondary = sanitizeFeed(secondary);

  const deletedSet = new Set<string>([
    ...(cleanPrimary.deletedIds || []),
    ...(cleanSecondary.deletedIds || []),
  ]);

  // Merge carousel items by ID (newest updatedAt wins, preserving createdAt and engagement)
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
        carouselMap.set(item.id, normalizeCarouselPostItem(item, existing));
      } else {
        carouselMap.set(item.id, normalizeCarouselPostItem(existing, item));
      }
    }
  }

  // Merge video items by ID (newest updatedAt wins, preserving createdAt and engagement)
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
        videoMap.set(item.id, normalizeVideoPostItem(item, existing));
      } else {
        videoMap.set(item.id, normalizeVideoPostItem(existing, item));
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
    authorId: ADMIN_PHONE_NORMALIZED,
    authorRole: 'admin',
    carouselItems,
    videoItems,
    deletedIds: Array.from(deletedSet),
    updatedAt: latestUpdatedAt,
  };
}

function readJsonFileSafe<T>(filePath: string): T | null {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    }
  } catch (err) {
    console.warn(`[serverHomepageFeed] Read notice for ${filePath}:`, err);
  }
  return null;
}

function writeJsonFileSafe(filePath: string, data: unknown): boolean {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.warn(`[serverHomepageFeed] Write notice for ${filePath}:`, err);
    return false;
  }
}

/**
 * Reconstructs a HomepageFeedData object from the indexed posts dictionary file
 * (`data/homepage_posts.json` or `.cache/homepage_posts.json`)
 */
function readIndexedPostsFile(filePath: string): HomepageFeedData | null {
  const parsed = readJsonFileSafe<{
    posts?: Record<string, HomepageCarouselItem | HomepageVideoItem>;
    deletedIds?: string[];
    updatedAt?: string;
  }>(filePath);

  if (!parsed || !parsed.posts || typeof parsed.posts !== 'object') return null;

  const carouselItems: HomepageCarouselItem[] = [];
  const videoItems: HomepageVideoItem[] = [];

  for (const post of Object.values(parsed.posts)) {
    if (!post || !post.id) continue;
    if ((post as any).contentType === 'video' || 'embedUrl' in post || 'youtubeUrl' in post) {
      videoItems.push(post as HomepageVideoItem);
    } else if ('imageUrl' in post) {
      carouselItems.push(post as HomepageCarouselItem);
    }
  }

  return sanitizeFeed({
    carouselItems,
    videoItems,
    deletedIds: parsed.deletedIds || [],
    updatedAt: parsed.updatedAt,
  });
}

function writeIndexedPostsFiles(feed: HomepageFeedData): void {
  const postsMap: Record<string, HomepageCarouselItem | HomepageVideoItem> = {};
  for (const item of feed.carouselItems) {
    postsMap[item.id] = item;
  }
  for (const item of feed.videoItems) {
    postsMap[item.id] = item;
  }
  const payload = {
    updatedAt: feed.updatedAt || new Date().toISOString(),
    deletedIds: feed.deletedIds || [],
    posts: postsMap,
  };
  writeJsonFileSafe(PRIMARY_POSTS_FILE, payload);
  writeJsonFileSafe(FALLBACK_POSTS_FILE, payload);
}

/**
 * Reads the authoritative homepage feed from local/server persistent storage synchronously.
 */
export function getSavedHomepageFeed(): HomepageFeedData & { _isDefault?: boolean } {
  if (simulatedDbFailure) {
    throw new Error('Simulated database connection failure');
  }

  let merged: HomepageFeedData | null = null;
  let foundPersistedRecord = false;

  // 1. Check in-memory runtime cache
  if (inMemoryFeed && !inMemoryFeed._isDefault) {
    merged = reconcileHomepageFeeds(merged, inMemoryFeed);
    foundPersistedRecord = true;
  }

  // 2. Check primary persistent repository file (data/homepage_feed.json)
  const primaryFeed = readJsonFileSafe<HomepageFeedData>(PRIMARY_DATA_FILE);
  if (primaryFeed && Array.isArray(primaryFeed.carouselItems) && Array.isArray(primaryFeed.videoItems)) {
    const clean = sanitizeFeed(primaryFeed);
    if (
      clean.carouselItems.length > 0 ||
      clean.videoItems.length > 0 ||
      (clean.deletedIds && clean.deletedIds.length > 0)
    ) {
      merged = reconcileHomepageFeeds(merged, clean);
      foundPersistedRecord = true;
    }
  }

  // 3. Check indexed posts dictionary file (data/homepage_posts.json)
  const primaryPosts = readIndexedPostsFile(PRIMARY_POSTS_FILE);
  if (
    primaryPosts &&
    (primaryPosts.carouselItems.length > 0 ||
      primaryPosts.videoItems.length > 0 ||
      (primaryPosts.deletedIds && primaryPosts.deletedIds.length > 0))
  ) {
    merged = reconcileHomepageFeeds(merged, primaryPosts);
    foundPersistedRecord = true;
  }

  // 4. Check fallback runtime cache files
  const fallbackFeed = readJsonFileSafe<HomepageFeedData>(FALLBACK_CACHE_FILE);
  if (fallbackFeed && Array.isArray(fallbackFeed.carouselItems) && Array.isArray(fallbackFeed.videoItems)) {
    const clean = sanitizeFeed(fallbackFeed);
    if (
      clean.carouselItems.length > 0 ||
      clean.videoItems.length > 0 ||
      (clean.deletedIds && clean.deletedIds.length > 0)
    ) {
      merged = reconcileHomepageFeeds(merged, clean);
      foundPersistedRecord = true;
    }
  }

  const fallbackPosts = readIndexedPostsFile(FALLBACK_POSTS_FILE);
  if (
    fallbackPosts &&
    (fallbackPosts.carouselItems.length > 0 ||
      fallbackPosts.videoItems.length > 0 ||
      (fallbackPosts.deletedIds && fallbackPosts.deletedIds.length > 0))
  ) {
    merged = reconcileHomepageFeeds(merged, fallbackPosts);
    foundPersistedRecord = true;
  }

  if (merged && foundPersistedRecord) {
    inMemoryFeed = merged;
    return merged;
  }

  return { ...DEFAULT_FEED, _isDefault: true };
}

/**
 * Async version that also queries Cloud Firestore (`mshindiroom-production`)
 * and reconciles cloud records with server persistent records.
 */
export async function getSavedHomepageFeedAsync(): Promise<
  HomepageFeedData & { _isDefault?: boolean }
> {
  if (simulatedDbFailure) {
    throw new Error('Simulated database connection failure');
  }

  const localFeed = getSavedHomepageFeed();
  let cloudFeed: HomepageFeedData | null = null;

  // 1. Try Firebase Admin SDK if configured
  try {
    const adminDb = await getAdminFirestore();
    if (adminDb) {
      const snap = await adminDb.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC).get();
      if (snap.exists) {
        const data = snap.data() as HomepageFeedData;
        if (data && Array.isArray(data.carouselItems) && Array.isArray(data.videoItems)) {
          cloudFeed = sanitizeFeed(data);
        }
      }
    }
  } catch (err) {
    console.warn('[serverHomepageFeed] Admin Firestore read notice:', err);
  }

  // 2. Try Firebase Client SDK against mshindiroom-production
  if (!cloudFeed && clientDb) {
    try {
      const docRef = doc(clientDb, FIRESTORE_COLLECTION, FIRESTORE_DOC);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as HomepageFeedData;
        if (data && Array.isArray(data.carouselItems) && Array.isArray(data.videoItems)) {
          cloudFeed = sanitizeFeed(data);
        }
      }
    } catch (err) {
      console.warn('[serverHomepageFeed] Client Firestore read notice:', err);
    }
  }

  const hasCloudItems =
    cloudFeed &&
    (cloudFeed.carouselItems.length > 0 ||
      cloudFeed.videoItems.length > 0 ||
      (cloudFeed.deletedIds && cloudFeed.deletedIds.length > 0));
  const hasLocalItems =
    !localFeed._isDefault &&
    (localFeed.carouselItems.length > 0 ||
      localFeed.videoItems.length > 0 ||
      (localFeed.deletedIds && localFeed.deletedIds.length > 0));

  if (hasCloudItems && hasLocalItems) {
    const reconciled = reconcileHomepageFeeds(localFeed, cloudFeed!);
    inMemoryFeed = reconciled;
    writeJsonFileSafe(PRIMARY_DATA_FILE, reconciled);
    writeJsonFileSafe(FALLBACK_CACHE_FILE, reconciled);
    writeIndexedPostsFiles(reconciled);
    return reconciled;
  }

  if (hasCloudItems) {
    inMemoryFeed = cloudFeed!;
    writeJsonFileSafe(PRIMARY_DATA_FILE, cloudFeed!);
    writeJsonFileSafe(FALLBACK_CACHE_FILE, cloudFeed!);
    writeIndexedPostsFiles(cloudFeed!);
    return cloudFeed!;
  }

  return localFeed;
}

/**
 * Persists updated homepage feed to primary repository storage, indexed post records,
 * runtime fallback cache, and Cloud Firestore.
 *
 * CRITICAL PROTECTION: Never overwrites existing published posts with an uninitialized
 * empty default payload unless all items were explicitly deleted via `deletedIds`.
 */
export function saveHomepageFeed(
  feed: HomepageFeedData,
  options?: { allowReplaceAll?: boolean }
): HomepageFeedData {
  if (simulatedDbFailure) {
    throw new Error('Simulated database write failure');
  }

  const { _isDefault, ...cleanFeed } = feed as any;
  const incomingSanitized = sanitizeFeed(cleanFeed);

  // Merge with existing server records so concurrent or partial updates never drop existing posts
  const existing = (() => {
    try {
      return getSavedHomepageFeed();
    } catch {
      return { ...DEFAULT_FEED, _isDefault: true };
    }
  })();

  const finalFeed = options?.allowReplaceAll
    ? incomingSanitized
    : existing._isDefault
    ? incomingSanitized
    : reconcileHomepageFeeds(incomingSanitized, existing);

  finalFeed.updatedAt = new Date().toISOString();

  // 1. Store in-memory immediately
  inMemoryFeed = finalFeed;

  // 2. Write to primary persistent storage (data/homepage_feed.json)
  const primarySaved = writeJsonFileSafe(PRIMARY_DATA_FILE, finalFeed);

  // 3. Write to fallback cache storage (.cache/homepage_feed.json)
  const fallbackSaved = writeJsonFileSafe(FALLBACK_CACHE_FILE, finalFeed);

  // 4. Write individual post dictionary records (data/homepage_posts.json)
  writeIndexedPostsFiles(finalFeed);

  if (!primarySaved && !fallbackSaved) {
    throw new Error('Failed to write homepage feed to persistent server storage.');
  }

  // 5. Asynchronously mirror to Cloud Firestore (`mshindiroom-production`)
  void mirrorFeedToFirestore(finalFeed);

  return finalFeed;
}

/**
 * Async version of saveHomepageFeed that awaits Cloud Firestore synchronization
 */
export async function saveHomepageFeedAsync(
  feed: HomepageFeedData,
  options?: { allowReplaceAll?: boolean }
): Promise<{ feed: HomepageFeedData; firestoreSaved: boolean; diskSaved: boolean }> {
  const savedFeed = saveHomepageFeed(feed, options);
  const firestoreSaved = await mirrorFeedToFirestore(savedFeed);
  return {
    feed: savedFeed,
    firestoreSaved,
    diskSaved: true,
  };
}

async function mirrorFeedToFirestore(feed: HomepageFeedData): Promise<boolean> {
  const cleanPayload = JSON.parse(
    JSON.stringify({
      ...feed,
      authorId: ADMIN_PHONE_NORMALIZED,
      authorRole: 'admin',
      updatedAt: feed.updatedAt || new Date().toISOString(),
    })
  );

  // 1. Try Firebase Admin SDK first (bypasses security rules when service account or Cloud Run ADC is present)
  try {
    const adminDb = await getAdminFirestore();
    if (adminDb) {
      await adminDb
        .collection(FIRESTORE_COLLECTION)
        .doc(FIRESTORE_DOC)
        .set(cleanPayload, { merge: true });

      // Also persist individual post records in siteContent/post_{id}
      const batch = adminDb.batch();
      for (const item of cleanPayload.carouselItems || []) {
        const ref = adminDb.collection(FIRESTORE_COLLECTION).doc(`post_${item.id}`);
        batch.set(ref, item, { merge: true });
      }
      for (const item of cleanPayload.videoItems || []) {
        const ref = adminDb.collection(FIRESTORE_COLLECTION).doc(`post_${item.id}`);
        batch.set(ref, item, { merge: true });
      }
      await batch.commit();
      return true;
    }
  } catch (err) {
    console.warn('[serverHomepageFeed] Admin Firestore write notice:', err);
  }

  // 2. Try Firebase Client SDK
  if (clientDb) {
    try {
      const feedRef = doc(clientDb, FIRESTORE_COLLECTION, FIRESTORE_DOC);
      await setDoc(feedRef, cleanPayload, { merge: true });
      return true;
    } catch {
      // Expected if Firestore rules require client auth token not present on server
    }
  }

  return false;
}

/**
 * Permanent Media Storage Registry
 * Stores uploaded media base64 payloads in `data/homepage_media.json` and fallback cache
 * in addition to `public/images/uploads/...` so uploaded images survive across deployments
 * even if ephemeral container static directories are recreated.
 */
export interface PermanentMediaEntry {
  key: string;
  folder: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  publicUrl: string;
  createdAt: string;
}

export function savePermanentMediaAsset(params: {
  dataUrl: string;
  fileName: string;
  folder?: string;
}): PermanentMediaEntry {
  if (simulatedDbFailure) {
    throw new Error('Simulated media storage failure');
  }

  const cleanFileName = String(params.fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const cleanFolder = String(params.folder || 'feed').replace(/[^a-zA-Z0-9_-]/g, '_');
  const key = `${cleanFolder}/${cleanFileName}`;
  const publicUrl = `/images/uploads/${cleanFolder}/${cleanFileName}`;

  const matches = params.dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  const mimeType = matches && matches[1] ? matches[1] : 'image/webp';
  const base64Payload = matches && matches[2] ? matches[2] : params.dataUrl;
  const fullDataUrl = params.dataUrl.startsWith('data:')
    ? params.dataUrl
    : `data:${mimeType};base64,${base64Payload}`;
  const buffer = Buffer.from(base64Payload, 'base64');

  // 1. Write binary file to public/images/uploads/<folder>/<fileName> for fast static serving
  try {
    const targetDir = path.join(process.cwd(), 'public', 'images', 'uploads', cleanFolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(path.join(targetDir, cleanFileName), buffer);
  } catch (err) {
    console.warn('[serverHomepageFeed] Static upload dir write notice:', err);
  }

  const entry: PermanentMediaEntry = {
    key,
    folder: cleanFolder,
    fileName: cleanFileName,
    mimeType,
    dataUrl: fullDataUrl,
    publicUrl,
    createdAt: new Date().toISOString(),
  };

  // 2. Persist in permanent media registry (`data/homepage_media.json` + `.cache/homepage_media.json`)
  const registry =
    readJsonFileSafe<Record<string, PermanentMediaEntry>>(PRIMARY_MEDIA_FILE) ||
    readJsonFileSafe<Record<string, PermanentMediaEntry>>(FALLBACK_MEDIA_FILE) ||
    {};
  registry[key] = entry;
  writeJsonFileSafe(PRIMARY_MEDIA_FILE, registry);
  writeJsonFileSafe(FALLBACK_MEDIA_FILE, registry);

  return entry;
}

export function getPermanentMediaAsset(
  folder: string,
  fileName: string
): { buffer: Buffer; mimeType: string; dataUrl: string } | null {
  const cleanFileName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const cleanFolder = String(folder).replace(/[^a-zA-Z0-9_-]/g, '_');
  const key = `${cleanFolder}/${cleanFileName}`;

  // 1. Check disk file first
  try {
    const diskPath = path.join(
      process.cwd(),
      'public',
      'images',
      'uploads',
      cleanFolder,
      cleanFileName
    );
    if (fs.existsSync(diskPath)) {
      const buffer = fs.readFileSync(diskPath);
      const ext = path.extname(cleanFileName).toLowerCase();
      const mimeType =
        ext === '.webp'
          ? 'image/webp'
          : ext === '.png'
          ? 'image/png'
          : ext === '.gif'
          ? 'image/gif'
          : 'image/jpeg';
      return {
        buffer,
        mimeType,
        dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`,
      };
    }
  } catch {}

  // 2. Check permanent media registry (`data/homepage_media.json` / `.cache/homepage_media.json`)
  const registry =
    readJsonFileSafe<Record<string, PermanentMediaEntry>>(PRIMARY_MEDIA_FILE) ||
    readJsonFileSafe<Record<string, PermanentMediaEntry>>(FALLBACK_MEDIA_FILE);
  const entry = registry?.[key];
  if (entry && entry.dataUrl) {
    const matches = entry.dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    const mimeType = matches?.[1] || entry.mimeType || 'image/webp';
    const base64Data = matches?.[2] || entry.dataUrl;
    return {
      buffer: Buffer.from(base64Data, 'base64'),
      mimeType,
      dataUrl: entry.dataUrl,
    };
  }

  return null;
}
