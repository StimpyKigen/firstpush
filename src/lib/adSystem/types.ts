export type AdProviderId =
  | 'google_adsense'
  | 'google_ad_manager'
  | 'google_admob'
  | 'unity_ads'
  | 'applovin'
  | 'direct_sponsored'
  | 'house_ads'
  | 'simulated_test';

export interface AdConfig {
  adsEnabled: boolean;
  preferredDuration: number; // in seconds (6-10s, default 8)
  maxPreferredDuration: number; // in seconds (15s)
  absoluteMaxDuration: number; // in seconds (20s)
  tokenDurationMinutes: number; // default 15 minutes
  providerPriority: AdProviderId[];
  fallbackProvider: AdProviderId;
  retryAttempts: number;
  houseAdPriority: boolean;
  perRoomAdsEnabled: Record<string, boolean>; // roomId -> enabled
}

export interface RoomAccessToken {
  tokenId: string;
  userId: string;
  roomId: string;
  issuedAt: number;
  expiresAt: number;
  adProviderUsed: AdProviderId;
  signedTokenString?: string;
}

export interface AdImpressionLog {
  id: string;
  userId: string;
  roomId: string;
  provider: AdProviderId;
  adId: string;
  sponsorName: string;
  requestedAt: number;
  duration: number;
  completed: boolean;
  skipped: boolean;
  estimatedRevenueKsh: number;
  device: string;
}

export interface AdAnalyticsData {
  requests: number;
  served: number;
  completed: number;
  skipped: number;
  tokensGenerated: number;
  purchasesAfterAds: number;
  estimatedRevenueKsh: number;
}

export interface HouseAdItem {
  id: string;
  title: string;
  sponsor: string;
  tagline: string;
  videoUrl?: string;
  imageUrl?: string;
  ctaText: string;
  ctaLink?: string;
  durationSeconds: number;
  category: string;
}

export interface AdMedia {
  adId: string;
  provider: AdProviderId;
  title: string;
  sponsorName: string;
  tagline: string;
  durationSeconds: number;
  videoUrl?: string;
  imageUrl?: string;
  ctaText: string;
  ctaLink?: string;
}

export interface IAdProvider {
  id: AdProviderId;
  name: string;
  isAvailable(config: AdConfig): Promise<boolean>;
  loadAd(config: AdConfig, placementId: string): Promise<AdMedia | null>;
}
