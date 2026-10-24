import fs from 'fs';
import path from 'path';
import { CLUB_LOGOS, getShuffledClubLogos } from '../src/lib/clubLogos';
import { isInstalledMobilePWA } from '../src/lib/pwaDetection';

console.log('================================================================');
console.log('   PWA 6-SECOND FULLSCREEN LOADING SCREEN VERIFICATION SUITE   ');
console.log('================================================================\n');

let passCount = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passCount++;
    console.log(`[PASS] Test ${totalTests}: ${testName}${details ? ` - ${details}` : ''}`);
  } else {
    console.error(`[FAIL] Test ${totalTests}: ${testName}${details ? ` - ${details}` : ''}`);
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// 1. ASSET VERIFICATION (ALL 20 CLUB LOGOS)
// -------------------------------------------------------------
assert(CLUB_LOGOS.length === 20, 'Club logos list contains exactly 20 items', `Count: ${CLUB_LOGOS.length}`);

const publicClubLogosDir = path.resolve(process.cwd(), 'public/images/club-logos');
const existingFiles = fs.readdirSync(publicClubLogosDir);

assert(existingFiles.length === 20, 'Public directory contains all 20 processed PNG logos', `Files: ${existingFiles.length}`);

let allFilesExistAndNonEmpty = true;
for (const club of CLUB_LOGOS) {
  const relativePath = club.img.replace(/^\//, '');
  const fullPath = path.resolve(process.cwd(), 'public', relativePath);
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size === 0) {
    allFilesExistAndNonEmpty = false;
    console.error(`Missing or empty file: ${fullPath}`);
  }
}
assert(allFilesExistAndNonEmpty, 'All 20 club logo PNG assets exist on disk and have non-zero file sizes');

// Verify dimensions specified as 512x512
const allUniformDimensions = CLUB_LOGOS.every(c => c.width === 512 && c.height === 512);
assert(allUniformDimensions, 'All club logo assets have uniform 512x512 canvas dimensions defined');

// -------------------------------------------------------------
// 2. SHUFFLE LOGIC VERIFICATION
// -------------------------------------------------------------
const shuffled1 = getShuffledClubLogos();
const shuffled2 = getShuffledClubLogos();

assert(shuffled1.length === 20, 'Shuffled list returns all 20 items');
const uniqueIds = new Set(shuffled1.map(c => c.id));
assert(uniqueIds.size === 20, 'Shuffled list maintains 100% uniqueness of all 20 club IDs');

// Check that order varies between runs (randomized)
const isOrderVaried = shuffled1.some((c, idx) => c.id !== shuffled2[idx].id) ||
                      shuffled1.some((c, idx) => c.id !== CLUB_LOGOS[idx].id);
assert(isOrderVaried, 'Shuffled logo order is dynamically randomized on launch');

// -------------------------------------------------------------
// 3. STRICT PLATFORM & DISPLAY RESTRICTIONS
// -------------------------------------------------------------
// Setup mock environment for browser window
const originalWindow = (globalThis as any).window;
const originalNavigator = (globalThis as any).navigator;

// Helper to set navigator safely
function setMockNavigator(navObj: any) {
  Object.defineProperty(globalThis, 'navigator', {
    value: navObj,
    configurable: true,
    writable: true,
  });
}

// Test 3a: Standard Desktop Browser -> MUST BE FALSE
(globalThis as any).window = {
  innerWidth: 1440,
  matchMedia: () => ({
    matches: false, // Not standalone, pointer not coarse
  }),
};
setMockNavigator({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});
assert(!isInstalledMobilePWA(), 'Desktop standard browser returns false (Loading screen NEVER displays on desktop)');

// Test 3b: Desktop PWA Standalone (e.g. Chrome app on PC) -> MUST BE FALSE (Mobile only requirement)
(globalThis as any).window = {
  innerWidth: 1440,
  matchMedia: (query: string) => ({
    matches: query.includes('display-mode: standalone'), // Standalone, but NOT mobile
  }),
};
setMockNavigator({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});
assert(!isInstalledMobilePWA(), 'Desktop standalone PWA returns false (Loading screen restricted strictly to mobile)');

// Test 3c: Mobile Standard Browser Tab (Chrome on Android or Safari on iPhone) -> MUST BE FALSE
(globalThis as any).window = {
  innerWidth: 390,
  matchMedia: (query: string) => ({
    matches: query.includes('pointer: coarse'), // Touch screen, but display-mode is browser (NOT standalone)
  }),
};
setMockNavigator({
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
assert(!isInstalledMobilePWA(), 'Mobile standard browser tab returns false (Website loading unchanged for browser visitors)');

// Test 3d: Installed Android Mobile PWA (standalone) -> MUST BE TRUE
(globalThis as any).window = {
  innerWidth: 390,
  matchMedia: (query: string) => ({
    matches: query.includes('display-mode: standalone') || query.includes('pointer: coarse'),
  }),
};
setMockNavigator({
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
});
assert(isInstalledMobilePWA(), 'Installed Android Mobile PWA in standalone mode returns true (Triggers loading screen)');

// Test 3e: Installed iOS Mobile PWA (navigator.standalone === true) -> MUST BE TRUE
(globalThis as any).window = {
  innerWidth: 390,
  matchMedia: (query: string) => ({
    matches: query.includes('pointer: coarse'),
  }),
};
setMockNavigator({
  standalone: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
});
assert(isInstalledMobilePWA(), 'Installed iOS Home Screen PWA (navigator.standalone) returns true (Triggers loading screen)');

// Restore globals
(globalThis as any).window = originalWindow;
setMockNavigator(originalNavigator);

console.log('\n================================================================');
console.log(`TEST SUITE SUMMARY: ${passCount} / ${totalTests} PASSED`);
if (passCount === totalTests) {
  console.log('ALL PWA LOADING SCREEN TESTS PASSED WITH 100% SUCCESS!');
}
console.log('================================================================\n');
