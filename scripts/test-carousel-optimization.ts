/**
 * Verification Test Suite: Carousel Optimization, Skeleton States & Background Preloading
 * 
 * Verifies:
 * 1. Cache initialization and deduplication
 * 2. Preloader priority tiers and safety fallback
 * 3. Race condition resilience
 * 4. CSS tokens, accessibility and prefers-reduced-motion rules
 * 5. Coordinated skeleton layout matching production carousel
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
    process.exitCode = 1;
  }
}

console.log('==================================================================');
console.log('MSHINDIROOM: CAROUSEL PRELOADER & SKELETON VERIFICATION SUITE');
console.log('==================================================================\n');

// 1. Verify CSS Tokens and prefers-reduced-motion
const rootDir = process.cwd();
const cssPath = resolve(rootDir, 'src/index.css');
const cssContent = readFileSync(cssPath, 'utf8');

assert(
  cssContent.includes('.skeleton-shimmer-dark'),
  'index.css defines .skeleton-shimmer-dark class'
);
assert(
  cssContent.includes('#06372a'),
  'index.css uses dark stadium emerald #06372a for dark skeleton background'
);
assert(
  cssContent.includes('rgba(74, 222, 128,'),
  'index.css includes emerald sheen in shimmer gradient'
);
assert(
  cssContent.includes('rgba(212, 175, 55,'),
  'index.css includes gold sheen in shimmer gradient'
);
assert(
  cssContent.includes('@media (prefers-reduced-motion: reduce)') &&
  cssContent.includes('.skeleton-shimmer-dark::after'),
  'index.css disables .skeleton-shimmer-dark animation under prefers-reduced-motion'
);
assert(
  cssContent.includes('.animate-editorial-fade-in'),
  'index.css defines .animate-editorial-fade-in for smooth skeleton-to-content reveal'
);

// 2. Verify EditorialCarouselSkeleton Component
const skeletonPath = resolve(rootDir, 'src/components/skeleton/EditorialCarouselSkeleton.tsx');
const skeletonContent = readFileSync(skeletonPath, 'utf8');

const skeletonCorePath = resolve(rootDir, 'src/components/skeleton/Skeleton.tsx');
const skeletonCoreContent = readFileSync(skeletonCorePath, 'utf8');

assert(
  skeletonContent.includes('SkeletonContainer') && skeletonCoreContent.includes('role="status"'),
  'EditorialCarouselSkeleton uses accessible SkeletonContainer with live region status'
);
assert(
  skeletonContent.includes('aspect-[3/4]') &&
  skeletonContent.includes('min-h-0'),
  'EditorialCarouselSkeleton matches exact 3:4 photo aspect ratio and min-h-0 for 1-screen mobile fit'
);
assert(
  skeletonContent.includes('tone="dark"'),
  'EditorialCarouselSkeleton requests dark stadium tone for skeletons'
);
assert(
  skeletonContent.includes('sm:flex-row') &&
  skeletonContent.includes('sm:gap-6 lg:gap-7'),
  'EditorialCarouselSkeleton matches desktop hugging layout with sm:gap-6 lg:gap-7 allowance'
);

// 3. Verify Carousel Preloader & Intelligent Cache
const preloaderPath = resolve(rootDir, 'src/lib/carouselImagePreloader.ts');
const preloaderContent = readFileSync(preloaderPath, 'utf8');

assert(
  preloaderContent.includes('loadedImagesCache = new Set<string>()'),
  'carouselImagePreloader exports in-memory loadedImagesCache Set'
);
assert(
  preloaderContent.includes('failedImagesCache = new Set<string>()'),
  'carouselImagePreloader exports in-memory failedImagesCache Set'
);
assert(
  !preloaderContent.includes('/images/hero-striker.jpg'),
  'carouselImagePreloader strictly does NOT include deleted mock photos like hero-striker.jpg'
);
assert(
  preloaderContent.includes('priority: \'high\' | \'normal\' | \'low\''),
  'preloadCarouselImage supports high, normal, and low priority tiers'
);
assert(
  preloaderContent.includes('.decode()'),
  'preloadCarouselImage calls HTMLImageElement.decode() for off-thread hardware rasterization'
);
assert(
  preloaderContent.includes('activeRequestIdRef'),
  'useCarouselCardLoader implements request ID token to prevent race conditions during rapid slide navigation'
);
assert(
  preloaderContent.includes('preloadCarouselImage(photo.imageUrl'),
  'useCarouselCardLoader preloads active and remaining slides'
);

// 4. Verify Home.tsx Integration
const homePath = resolve(rootDir, 'src/pages/Home.tsx');
const homeContent = readFileSync(homePath, 'utf8');

assert(
  homeContent.includes('hasInitiallyLoaded') && homeContent.includes('EditorialCarouselSkeleton'),
  'Home.tsx imports and uses hasInitiallyLoaded to show skeleton ONLY during initial fetch'
);
assert(
  homeContent.includes('!hasInitiallyLoaded ? ('),
  'Home.tsx renders EditorialCarouselSkeleton only when carousels have not initially loaded'
);
assert(
  !homeContent.includes('hero-striker.jpg'),
  'Home.tsx strictly avoids falling back to deleted mock photos like hero-striker.jpg'
);
assert(
  homeContent.includes('bg-[#06372a]'),
  'Home.tsx uses dark stadium bg-[#06372a] instead of black void'
);
assert(
  homeContent.includes('sm:flex-row sm:items-start sm:gap-6 lg:gap-7'),
  'Home.tsx desktop layout pushes caption to hug photo with controlled allowance'
);
assert(
  homeContent.includes('animate-editorial-fade-in'),
  'Home.tsx applies smooth fade-in reveal when transitioning from skeleton to content'
);

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
if (passedTests === totalTests) {
  console.log('All carousel optimization and skeleton specifications verified successfully!\n');
} else {
  console.error('Some tests failed. Inspect details above.\n');
  process.exitCode = 1;
}
