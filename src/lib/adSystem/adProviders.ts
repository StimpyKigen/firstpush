import { AdConfig, AdMedia, AdProviderId, HouseAdItem, IAdProvider } from './types';

// Curated House & Sponsored Ads Catalog for fallback & direct campaigns
export const HOUSE_ADS_CATALOG: HouseAdItem[] = [
  {
    id: 'house-sp-01',
    title: 'SportPesa Mega Jackpot Pro',
    sponsor: 'SportPesa Kenya',
    tagline: 'Predict 17 matches every weekend to win Ksh 350,000,000+!',
    ctaText: 'Visit SportPesa',
    ctaLink: 'https://www.sportpesa.co.ke',
    durationSeconds: 8,
    category: 'jackpot',
    imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'house-mp-02',
    title: 'M-Pesa Super App',
    sponsor: 'Safaricom M-Pesa',
    tagline: 'Send money, pay bills & unlock punter rooms seamlessly with 0 fees on MshindiRoom!',
    ctaText: 'Open M-Pesa App',
    ctaLink: 'https://www.safaricom.co.ke/mpesa',
    durationSeconds: 7,
    category: 'fintech',
    imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'house-mb-03',
    title: 'MozzartBet Super Grand Jackpot',
    sponsor: 'MozzartBet Kenya',
    tagline: 'Daily Ksh 20,000,000 jackpot with zero minimum odds requirement.',
    ctaText: 'Join MozzartBet',
    ctaLink: 'https://www.mozzartbet.co.ke',
    durationSeconds: 9,
    category: 'betting',
    imageUrl: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'house-bt-04',
    title: 'Betika Midweek Jackpot',
    sponsor: 'Betika Kenya',
    tagline: 'Stake 15 Bob and stand a chance to win Ksh 15,000,000.',
    ctaText: 'Play on Betika',
    ctaLink: 'https://www.betika.com',
    durationSeconds: 10,
    category: 'betting',
    imageUrl: 'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?auto=format&fit=crop&w=800&q=80',
  },
];

class HouseAdsProvider implements IAdProvider {
  id: AdProviderId = 'house_ads';
  name = 'House & Sponsor Ads';

  async isAvailable(): Promise<boolean> {
    return true; // Always available fallback
  }

  async loadAd(config: AdConfig): Promise<AdMedia | null> {
    const validAds = HOUSE_ADS_CATALOG.filter(
      (ad) => ad.durationSeconds <= config.absoluteMaxDuration
    );
    const chosen = validAds[Math.floor(Math.random() * validAds.length)] || HOUSE_ADS_CATALOG[0];

    // Restrict duration to user preferred range if configured
    const duration = Math.min(
      Math.max(chosen.durationSeconds, config.preferredDuration),
      config.maxPreferredDuration
    );

    return {
      adId: chosen.id,
      provider: this.id,
      title: chosen.title,
      sponsorName: chosen.sponsor,
      tagline: chosen.tagline,
      durationSeconds: duration,
      imageUrl: chosen.imageUrl,
      ctaText: chosen.ctaText,
      ctaLink: chosen.ctaLink,
    };
  }
}

class DirectSponsoredProvider implements IAdProvider {
  id: AdProviderId = 'direct_sponsored';
  name = 'Direct Brand Partners';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async loadAd(config: AdConfig): Promise<AdMedia | null> {
    const duration = Math.min(config.preferredDuration, config.maxPreferredDuration);
    return {
      adId: `direct-brand-${Date.now()}`,
      provider: this.id,
      title: 'Mshindi VIP Punter League',
      sponsorName: 'Premier Sports Network',
      tagline: 'Get exclusive match analytics, punter consensus stats, and live odds tracking!',
      durationSeconds: duration,
      ctaText: 'Explore VIP League',
      ctaLink: '#',
      imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80',
    };
  }
}

class GoogleAdSenseProvider implements IAdProvider {
  id: AdProviderId = 'google_adsense';
  name = 'Google AdSense / Ad Manager';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async loadAd(config: AdConfig): Promise<AdMedia | null> {
    // In production, integrates Google IMA / AdSense SDK window.googletag
    const duration = Math.min(config.preferredDuration, config.maxPreferredDuration);
    return {
      adId: `google-ad-${Date.now()}`,
      provider: this.id,
      title: 'Google Rewarded Sponsor Ad',
      sponsorName: 'Google Ad Network',
      tagline: 'Watch this sponsored highlight to unlock your 15-minute room access pass.',
      durationSeconds: duration,
      ctaText: 'Learn More',
      imageUrl: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?auto=format&fit=crop&w=800&q=80',
    };
  }
}

class UnityAdsProvider implements IAdProvider {
  id: AdProviderId = 'unity_ads';
  name = 'Unity Ads Network';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async loadAd(config: AdConfig): Promise<AdMedia | null> {
    const duration = Math.min(config.preferredDuration, config.maxPreferredDuration);
    return {
      adId: `unity-ad-${Date.now()}`,
      provider: this.id,
      title: 'Unity Video Partner Ad',
      sponsorName: 'Unity Ads',
      tagline: 'Short video rewarded placement for instant room token access.',
      durationSeconds: duration,
      ctaText: 'Install App',
      imageUrl: 'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?auto=format&fit=crop&w=800&q=80',
    };
  }
}

class AppLovinProvider implements IAdProvider {
  id: AdProviderId = 'applovin';
  name = 'AppLovin MAX';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async loadAd(config: AdConfig): Promise<AdMedia | null> {
    const duration = Math.min(config.preferredDuration, config.maxPreferredDuration);
    return {
      adId: `applovin-ad-${Date.now()}`,
      provider: this.id,
      title: 'AppLovin Rewarded Video',
      sponsorName: 'AppLovin Partner',
      tagline: 'Watch 8 seconds of sponsored content to receive full room entry token.',
      durationSeconds: duration,
      ctaText: 'View Details',
      imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80',
    };
  }
}

class SimulatedTestProvider implements IAdProvider {
  id: AdProviderId = 'simulated_test';
  name = 'Simulated Test Engine';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async loadAd(config: AdConfig): Promise<AdMedia | null> {
    const duration = Math.min(config.preferredDuration, config.maxPreferredDuration);
    return {
      adId: `simulated-ad-${Date.now()}`,
      provider: this.id,
      title: 'Mshindi Community Partner Spotlight',
      sponsorName: 'Mshindi Network',
      tagline: 'Watch this short preview to receive a 15-minute temporary room access pass.',
      durationSeconds: duration,
      ctaText: 'View Offer',
      imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80',
    };
  }
}

export class AdProviderRegistry {
  private providers: Map<AdProviderId, IAdProvider> = new Map();

  constructor() {
    this.register(new HouseAdsProvider());
    this.register(new DirectSponsoredProvider());
    this.register(new GoogleAdSenseProvider());
    this.register(new UnityAdsProvider());
    this.register(new AppLovinProvider());
    this.register(new SimulatedTestProvider());
  }

  register(provider: IAdProvider) {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: AdProviderId): IAdProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Request an ad using provider priority list and automatic fallbacks.
   * Maximizes ad fill rate.
   */
  async fetchAdWithFallbacks(config: AdConfig, placementId: string): Promise<AdMedia | null> {
    if (!config.adsEnabled) return null;

    const priorityList = [...config.providerPriority];
    if (config.houseAdPriority && !priorityList.includes('house_ads')) {
      priorityList.unshift('house_ads');
    }

    // Attempt through priority list
    for (const providerId of priorityList) {
      const provider = this.providers.get(providerId);
      if (provider) {
        try {
          const available = await provider.isAvailable(config);
          if (available) {
            const media = await provider.loadAd(config, placementId);
            if (media) return media;
          }
        } catch (err) {
          console.warn(`[AdSystem] Provider ${providerId} failed:`, err);
        }
      }
    }

    // Try fallback provider if primary list returned no fill
    const fallback = this.providers.get(config.fallbackProvider) || this.providers.get('house_ads');
    if (fallback) {
      try {
        return await fallback.loadAd(config, placementId);
      } catch (err) {
        console.error('[AdSystem] Fallback provider failed:', err);
      }
    }

    return null;
  }
}

export const adRegistry = new AdProviderRegistry();
