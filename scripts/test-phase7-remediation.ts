/**
 * Phase 7 Remediation Test Suite (FND-011 & FND-012)
 *
 * Verifies:
 *  - FND-011: Vite manualChunks + lazy-loaded admin/modals split monolithic entry chunk (< 500 KB),
 *             standalone hero video preload removed from index.html, unused duplicate stubs deleted.
 *  - FND-012: Service Worker SHELL_PRECACHE_ASSETS resolve to real files in public/, stale cross-origin
 *             fonts.g exception removed, manifest.json theme_color & shortcuts aligned with real routes.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function main() {
  const root = process.cwd();

  // 1. index.html: no eager preload of pwa-loading-animation.mp4
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(
    !indexHtml.includes('pwa-loading-animation.mp4'),
    'index.html should not eagerly preload pwa-loading-animation.mp4'
  );

  // 2. Unused duplicate stubs deleted
  assert.ok(
    !fs.existsSync(path.join(root, 'src/assets/auth-pitch-bg.jpg')),
    'src/assets/auth-pitch-bg.jpg duplicate stub should be removed'
  );
  assert.ok(
    !fs.existsSync(path.join(root, 'src/assets/google.svg')),
    'src/assets/google.svg duplicate stub should be removed'
  );

  // 3. Vite build chunks verification (requires npm run build prior to running this test)
  const distAssetsDir = path.join(root, 'dist/assets');
  assert.ok(fs.existsSync(distAssetsDir), 'dist/assets directory must exist');
  const assetFiles = fs.readdirSync(distAssetsDir);
  const jsFiles = assetFiles.filter((name) => name.endsWith('.js'));

  const mainEntry = jsFiles.find((name) => /^index-[A-Za-z0-9_-]+\.js$/.test(name) && fs.statSync(path.join(distAssetsDir, name)).size > 50_000);
  assert.ok(mainEntry, 'Main entry bundle dist/assets/index-*.js must exist');
  const mainEntryBytes = fs.statSync(path.join(distAssetsDir, mainEntry)).size;
  assert.ok(
    mainEntryBytes < 500 * 1024,
    `Main entry bundle must stay under 500 KiB (actual: ${mainEntryBytes} bytes)`
  );

  for (const prefix of [
    'vendor-react-',
    'vendor-firebase-',
    'vendor-firebase-firestore-',
    'vendor-motion-',
    'vendor-icons-',
    'data-competitions-',
    'data-avatars-',
    'JackpotAdminModal-',
    'QuickBetBuilderModal-',
    'AvaChatSupport-',
    'AuthWallModal-',
    'PremiumPaywall-',
  ]) {
    assert.ok(
      jsFiles.some((name) => name.startsWith(prefix)),
      `Expected split chunk starting with "${prefix}"`
    );
  }

  for (const file of jsFiles) {
    const size = fs.statSync(path.join(distAssetsDir, file)).size;
    assert.ok(size < 500 * 1024, `Chunk ${file} exceeded 500 KiB (${size} bytes)`);
  }

  // 4. Service Worker SHELL_PRECACHE_ASSETS & cross-origin bypass hygiene
  const swSource = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  assert.ok(!swSource.includes('/icons/icon-192x192.png'), 'Dead icon-192x192.png path must not exist in sw.js');
  assert.ok(!swSource.includes('/icons/icon-512x512.png'), 'Dead icon-512x512.png path must not exist in sw.js');
  assert.ok(!swSource.includes("fonts.g"), 'Stale fonts.g cross-origin bypass exception must be removed from sw.js');

  const precacheMatch = swSource.match(/const SHELL_PRECACHE_ASSETS\s*=\s*\[([\s\S]*?)\];/);
  assert.ok(precacheMatch, 'SHELL_PRECACHE_ASSETS array must exist in sw.js');
  const precachePaths = Array.from(precacheMatch[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
  assert.ok(precachePaths.length >= 3, 'SHELL_PRECACHE_ASSETS must include manifest and PWA icons');
  for (const relUrl of precachePaths) {
    const cleanRel = relUrl.replace(/^\//, '');
    assert.ok(
      fs.existsSync(path.join(root, 'public', cleanRel)),
      `SW precache asset public/${cleanRel} must exist`
    );
  }

  // 5. Manifest alignment & App.tsx routes
  const manifestRaw = fs.readFileSync(path.join(root, 'public/manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestRaw) as {
    theme_color: string;
    shortcuts: Array<{ name: string; url: string; icons: Array<{ src: string }> }>;
  };
  assert.equal(manifest.theme_color, '#FFFFF0', 'manifest theme_color should align with default #FFFFF0');

  const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  for (const shortcut of manifest.shortcuts) {
    assert.ok(
      !shortcut.url.includes('?room='),
      `Shortcut ${shortcut.name} should point directly to its route rather than ?room=`
    );
    assert.ok(
      appSource.includes(`path="${shortcut.url}"`),
      `App.tsx must define Route for manifest shortcut ${shortcut.url}`
    );
    for (const icon of shortcut.icons) {
      assert.ok(
        fs.existsSync(path.join(root, 'public', icon.src.replace(/^\//, ''))),
        `Shortcut icon ${icon.src} must exist in public/`
      );
    }
  }
  assert.ok(appSource.includes('ROOM_SHORTCUT_MAP'), 'App.tsx should preserve legacy ?room= shortcut redirect');

  console.log('[Phase 7 Remediation Tests] ALL CHECKS PASSED', {
    mainEntry,
    mainEntryBytes,
    splitChunkCount: jsFiles.length,
    precachePaths,
  });
}

main();

