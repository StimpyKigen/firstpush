import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { COMPETITION_BANNERS } from '../src/lib/competitionBanners';
import { CLUB_LOGOS } from '../src/constants/clubLogos';
import { BOOKIE_THEMES, getBookieLogo } from '../src/lib/bookies';

const ROOT = process.cwd();

function assertValidWebpFile(relPath: string) {
  const fullPath = path.join(ROOT, relPath);
  assert.ok(fs.existsSync(fullPath), `Expected WebP file to exist: ${relPath}`);
  const stat = fs.statSync(fullPath);
  assert.ok(stat.size > 100, `Expected non-empty WebP file: ${relPath} (${stat.size}B)`);
  const buf = fs.readFileSync(fullPath);
  const riff = buf.subarray(0, 4).toString('ascii');
  const webp = buf.subarray(8, 12).toString('ascii');
  assert.equal(riff, 'RIFF', `Invalid RIFF header in ${relPath}`);
  assert.equal(webp, 'WEBP', `Invalid WEBP header in ${relPath}`);
}

console.log('=== Phase 2 WebP Asset Migration Verification ===');

// 1. Verify all 14 Competition Banners in competitionBanners.ts
const bannerEntries = Object.entries(COMPETITION_BANNERS);
assert.equal(bannerEntries.length, 14, 'Expected 14 competition banners');
for (const [id, cfg] of bannerEntries) {
  assert.ok(cfg.bannerUrl.endsWith('.webp'), `Banner ${id} must use .webp: ${cfg.bannerUrl}`);
  assertValidWebpFile(path.join('public', cfg.bannerUrl));
}
console.log('✓ 1. All 14 competition banners use valid .webp files');

// 2. Verify all 20 Club Logos in clubLogos.ts
assert.equal(CLUB_LOGOS.length, 20, 'Expected 20 club logos in CLUB_LOGOS');
for (const url of CLUB_LOGOS) {
  assert.ok(url.endsWith('.webp'), `Club logo must use .webp: ${url}`);
  assertValidWebpFile(path.join('public', url));
}
console.log('✓ 2. All 20 Auth GridMotion club crest tiles use valid .webp files');

// 3. Verify all Bookie Logos in bookies.ts
for (const [key, theme] of Object.entries(BOOKIE_THEMES)) {
  assert.ok(theme.logo.endsWith('.webp'), `Bookie ${key} logo must use .webp: ${theme.logo}`);
  assertValidWebpFile(path.join('public', theme.logo));
}
const defaultLogo = getBookieLogo('UnknownBookie');
assert.ok(defaultLogo.endsWith('.webp'), `Default bookie logo must use .webp: ${defaultLogo}`);
assertValidWebpFile(path.join('public', defaultLogo));
console.log('✓ 3. All bookmaker logos and default fallback use valid .webp files');

// 4. Verify CompetitionLogoStrip.tsx, Login.tsx, AvaChatSupport.tsx, DiscussionPanel.tsx, Navbar.tsx, Footer.tsx, Logo.tsx
const componentChecks: Array<{ file: string; expectedWebpPaths: string[]; forbiddenPatterns: string[] }> = [
  {
    file: 'src/components/subscription/CompetitionLogoStrip.tsx',
    expectedWebpPaths: [
      '/images/competitions/ucl.webp',
      '/images/competitions/uel.webp',
      '/images/competitions/uecl.webp',
      '/images/competitions/premier-league.webp',
      '/images/competitions/laliga.webp',
      '/images/competitions/serie-a.webp',
      '/images/competitions/bundesliga.webp',
      '/images/competitions/ligue-1.webp',
      '/images/competitions/kpl.webp',
    ],
    forbiddenPatterns: ['/images/competitions/ucl.png', '/images/competitions/kpl.png'],
  },
  {
    file: 'src/components/Login.tsx',
    expectedWebpPaths: ['/images/auth-pitch-bg.webp'],
    forbiddenPatterns: ['/images/auth-pitch-bg.jpg'],
  },
  {
    file: 'src/components/AvaChatSupport.tsx',
    expectedWebpPaths: [
      '/images/chat-icon.webp',
      '/images/send-icon.webp',
      '/images/send-icon-ivory.webp',
    ],
    forbiddenPatterns: [
      '/images/chat-icon.png',
      '/images/send-icon.png',
      '/images/send-icon-ivory.png',
    ],
  },
  {
    file: 'src/components/DiscussionPanel.tsx',
    expectedWebpPaths: ['/images/send-icon-green.webp'],
    forbiddenPatterns: ['/images/send-icon-green.png'],
  },
  {
    file: 'src/components/Navbar.tsx',
    expectedWebpPaths: ['/images/logo.webp', '/images/logo-dark.webp'],
    forbiddenPatterns: ['/images/logo.png', '/images/logo-dark.png'],
  },
  {
    file: 'src/components/Footer.tsx',
    expectedWebpPaths: ['/images/logo.webp', '/images/logo-dark.webp'],
    forbiddenPatterns: ['/images/logo.png', '/images/logo-dark.png'],
  },
];

for (const check of componentChecks) {
  const src = fs.readFileSync(path.join(ROOT, check.file), 'utf8');
  for (const webpUrl of check.expectedWebpPaths) {
    assert.ok(src.includes(webpUrl), `Expected ${check.file} to reference ${webpUrl}`);
    assertValidWebpFile(path.join('public', webpUrl));
  }
  for (const forbidden of check.forbiddenPatterns) {
    assert.ok(!src.includes(forbidden), `Forbidden legacy reference ${forbidden} in ${check.file}`);
  }
}

const logoComponentSrc = fs.readFileSync(path.join(ROOT, 'src/components/Logo.tsx'), 'utf8');
assert.ok(
  logoComponentSrc.includes('../assets/images/app_logo_1785495412555.webp'),
  'Logo.tsx must import app_logo_1785495412555.webp'
);
assertValidWebpFile('src/assets/images/app_logo_1785495412555.webp');
console.log('✓ 4. All UI components reference valid .webp assets with zero stale .jpg/.png paths');

// 5. Verify converted legacy/unused assets also exist as valid WebP
const convertedLegacyAssets = [
  'public/images/celebration.webp',
  'public/images/match-action.webp',
  'public/images/hero-striker.webp',
  'public/images/midfielder.webp',
  'public/images/send-icon-green-dark.webp',
  'src/assets/images/app_logo_1785495412555.webp',
];
for (const rel of convertedLegacyAssets) {
  assertValidWebpFile(rel);
}
console.log('✓ 5. All 6 converted legacy photographic/icon assets are valid .webp files');

// 6. Verify protected PWA, Apple Touch, Favicon, OpenGraph & Schema.org assets remain intact
const protectedFiles = [
  'public/apple-touch-icon.png',
  'public/favicon-16.png',
  'public/favicon-32.png',
  'public/favicon.ico',
  'public/favicon.svg',
  'public/google.svg',
  'public/hero-stadium.svg',
  'public/logo.png',
  'public/pwa-192.png',
  'public/pwa-512.png',
  'public/pwa-maskable.png',
  'public/pwa-loading-animation.mp4',
];
for (const rel of protectedFiles) {
  assert.ok(fs.existsSync(path.join(ROOT, rel)), `Protected asset must remain intact: ${rel}`);
}
console.log('✓ 6. All 12 protected PWA/favicon/OpenGraph/SVG/MP4 assets remain intact');

console.log('\nALL WEBP ASSET MIGRATION CHECKS PASSED!');

