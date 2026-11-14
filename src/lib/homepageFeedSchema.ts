/**
 * Shared Homepage Editorial Feed schema, lifecycle constants, and pure normalization helpers.
 * Used identically by both client (`homepageFeedStore.ts`) and server (`serverHomepageFeed.ts`).
 */

/** Exact 24-hour story lifecycle duration in milliseconds (86,400,000 ms). */
export const CAROUSEL_STORY_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_TOMBSTONE_IDS = 300;

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
  storagePath?: string;
  fileName?: string;
  fileSize?: number;
  dimensions?: { width: number; height: number };
  heading?: string;
  caption?: string;
  source?: string;
  link?: string;
  published: boolean;
  createdAt: string;
  updatedAt?: string;
  publishedAt?: string;
  expiresAt?: string;
  photoUpdatedAt?: string;
  imageVersion?: string;
  createdBy?: string;
  updatedBy?: string;
  order?: number;
  authorId?: string;
  authorRole?: 'admin' | 'user';
  content?: string;
  media?: HomepageMediaDescriptor[];
  mediaType?: 'image/webp' | 'image' | 'youtube' | 'embed' | 'none';
  status?: 'published' | 'archived' | 'draft';
  isActive?: boolean;
  visibility?: 'public' | 'archived';
  contentType?: 'carousel';
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
  authorId?: string;
  authorRole?: 'admin' | 'user';
  content?: string;
  media?: HomepageMediaDescriptor[];
  mediaType?: 'youtube' | 'embed';
  status?: 'published' | 'archived' | 'draft';
  isActive?: boolean;
  visibility?: 'public' | 'archived';
  contentType?: 'video';
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

export function computeCarouselImageVersion(imageUrl: string, versionSeed?: string): string {
  const input = `${(imageUrl || '').trim()}::${(versionSeed || '').trim()}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `imgv-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function computeCarouselExpiresAt(
  publishedAtIso: string,
  nowMs: number = Date.now()
): string {
  const pubMs = Date.parse(publishedAtIso);
  const baseMs = Number.isFinite(pubMs) ? pubMs : nowMs;
  return new Date(baseMs + CAROUSEL_STORY_TTL_MS).toISOString();
}

export function getCarouselExpiresAtMs(
  item: Pick<HomepageCarouselItem, 'publishedAt' | 'createdAt' | 'expiresAt'>,
  fallbackNowMs: number = Date.now()
): number {
  if (item.expiresAt) {
    const expMs = Date.parse(item.expiresAt);
    if (Number.isFinite(expMs)) return expMs;
  }
  const pubRaw = item.publishedAt || item.createdAt;
  const pubMs = pubRaw ? Date.parse(pubRaw) : NaN;
  if (Number.isFinite(pubMs)) {
    return pubMs + CAROUSEL_STORY_TTL_MS;
  }
  return fallbackNowMs + CAROUSEL_STORY_TTL_MS;
}

export function isCarouselItemExpired(
  item: Pick<HomepageCarouselItem, 'publishedAt' | 'createdAt' | 'expiresAt'>,
  referenceNowMs: number = Date.now()
): boolean {
  return referenceNowMs >= getCarouselExpiresAtMs(item, referenceNowMs);
}

export interface FeedNormalizationOptions {
  nowMs?: number;
  defaultAuthorId: string;
}

/**
 * Pure normalization/enrichment shared between client store & server repository.
 */
export function normalizeCarouselItemWithOptions(
  item: HomepageCarouselItem,
  existing: HomepageCarouselItem | undefined,
  options: FeedNormalizationOptions
): HomepageCarouselItem {
  const nowMs = options.nowMs ?? Date.now();
  const now = new Date(nowMs).toISOString();
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

  const rawPublishedAt = item.publishedAt || existing?.publishedAt || createdAt;
  const publishedMs = Number.isFinite(Date.parse(rawPublishedAt))
    ? Date.parse(rawPublishedAt)
    : Date.parse(now);
  const publishedAt = new Date(publishedMs).toISOString();

  let expiresAt: string;
  if (item.expiresAt && Number.isFinite(Date.parse(item.expiresAt))) {
    expiresAt = new Date(Date.parse(item.expiresAt)).toISOString();
  } else if (
    existing?.expiresAt &&
    existing.publishedAt === publishedAt &&
    Number.isFinite(Date.parse(existing.expiresAt))
  ) {
    expiresAt = new Date(Date.parse(existing.expiresAt)).toISOString();
  } else {
    expiresAt = computeCarouselExpiresAt(publishedAt, nowMs);
  }

  const imageChanged = Boolean(existing?.imageUrl && existing.imageUrl !== imageUrl);
  const versionExplicitlyBumped = Boolean(
    item.imageVersion && existing?.imageVersion && item.imageVersion !== existing.imageVersion
  );
  const photoUpdatedAt =
    imageChanged || versionExplicitlyBumped
      ? item.photoUpdatedAt || item.updatedAt || now
      : item.photoUpdatedAt || existing?.photoUpdatedAt || publishedAt;
  const imageVersion = versionExplicitlyBumped
    ? item.imageVersion!
    : !imageChanged && (item.imageVersion || existing?.imageVersion)
    ? (item.imageVersion || existing?.imageVersion)!
    : computeCarouselImageVersion(imageUrl, photoUpdatedAt);

  const cleaned: HomepageCarouselItem = {
    ...existing,
    ...item,
    id: item.id,
    imageUrl,
    photoUpdatedAt,
    imageVersion,
    heading: item.heading ?? existing?.heading ?? '',
    caption: item.caption ?? existing?.caption ?? '',
    source: item.source ?? existing?.source ?? '',
    published: isActive,
    isActive,
    status: isActive ? 'published' : 'archived',
    visibility: isActive ? 'public' : 'archived',
    contentType: 'carousel',
    authorId: item.authorId || existing?.authorId || options.defaultAuthorId,
    authorRole: 'admin',
    content: (item.caption || item.heading || item.content || existing?.content || '').trim(),
    mediaType,
    media:
      Array.isArray(item.media) && item.media.length > 0 && !imageChanged
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
    publishedAt,
    expiresAt,
    likes: typeof item.likes === 'number' ? item.likes : existing?.likes ?? 0,
    likedBy: Array.isArray(item.likedBy) ? item.likedBy : existing?.likedBy ?? [],
    saves: typeof item.saves === 'number' ? item.saves : existing?.saves ?? 0,
    savedBy: Array.isArray(item.savedBy) ? item.savedBy : existing?.savedBy ?? [],
    shares: typeof item.shares === 'number' ? item.shares : existing?.shares ?? 0,
    comments: Array.isArray(item.comments) ? item.comments : existing?.comments ?? [],
  };

  for (const key of Object.keys(cleaned) as Array<keyof HomepageCarouselItem>) {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  }
  return cleaned;
}

export function normalizeVideoItemWithOptions(
  item: HomepageVideoItem,
  existing: HomepageVideoItem | undefined,
  options: FeedNormalizationOptions
): HomepageVideoItem {
  const nowMs = options.nowMs ?? Date.now();
  const now = new Date(nowMs).toISOString();
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
    authorId: item.authorId || existing?.authorId || options.defaultAuthorId,
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

