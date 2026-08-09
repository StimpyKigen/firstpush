import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export interface SeoProps {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'profile';
  noIndex?: boolean;
  structuredData?: Record<string, any> | Array<Record<string, any>>;
}

const DEFAULT_TITLE = "MshindiRoom — Kenya's Premier Jackpot Consensus & P2P Bets";
const DEFAULT_DESC = "Join Kenya's leading jackpot consensus community. Analyze Sportpesa, Betika & Mozzart jackpots, challenge top punters, share bet slips, and build winning slips.";
const DEFAULT_IMAGE = "https://mshindi.co.ke/pwa-512.png";
const SITE_NAME = "MshindiRoom";
const BASE_URL = "https://mshindi.co.ke";

export default function SeoHead({
  title,
  description,
  canonicalUrl,
  ogImage,
  ogType = 'website',
  noIndex = false,
  structuredData,
}: SeoProps) {
  const location = useLocation();

  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const metaDesc = description || DEFAULT_DESC;
  const currentCanonical = canonicalUrl || `${BASE_URL}${location.pathname}`;
  const image = ogImage || DEFAULT_IMAGE;

  useEffect(() => {
    // 1. Update Document Title
    document.title = fullTitle;

    // Helper to set or create meta tag
    const setMetaTag = (selector: string, attrName: string, attrVal: string, content: string) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // Helper to set or create link tag
    const setLinkTag = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
    };

    // 2. Primary Meta Tags
    setMetaTag('meta[name="description"]', 'name', 'description', metaDesc);
    setMetaTag('meta[name="robots"]', 'name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow');

    // 3. Canonical Tag
    setLinkTag('canonical', currentCanonical);

    // 4. Open Graph Tags
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    setMetaTag('meta[property="og:description"]', 'property', 'og:description', metaDesc);
    setMetaTag('meta[property="og:url"]', 'property', 'og:url', currentCanonical);
    setMetaTag('meta[property="og:type"]', 'property', 'og:type', ogType);
    setMetaTag('meta[property="og:image"]', 'property', 'og:image', image);
    setMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', SITE_NAME);

    // 5. Twitter Card Tags
    setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle);
    setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', metaDesc);
    setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', image);
    setMetaTag('meta[name="twitter:site"]', 'name', 'twitter:site', '@mshindiroom');

    // 6. JSON-LD Structured Data
    const jsonLdId = 'seo-jsonld-schema';
    let scriptEl = document.getElementById(jsonLdId) as HTMLScriptElement | null;
    if (structuredData) {
      if (!scriptEl) {
        scriptEl = document.createElement('script');
        scriptEl.id = jsonLdId;
        scriptEl.type = 'application/ld+json';
        document.head.appendChild(scriptEl);
      }
      scriptEl.textContent = JSON.stringify(structuredData);
    } else if (scriptEl) {
      scriptEl.remove();
    }
  }, [fullTitle, metaDesc, currentCanonical, image, ogType, noIndex, structuredData]);

  return null;
}
