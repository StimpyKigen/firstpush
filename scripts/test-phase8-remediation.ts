/**
 * Phase 8 Remediation Verification Suite (FND-005, FND-020, FND-021, FND-023)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const root = process.cwd();

  // 1. FND-005: package.json hygiene
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  assert.ok(pkg.dependencies['@radix-ui/react-slot'], '@radix-ui/react-slot must be explicitly declared in dependencies');
  assert.ok(
    fs.existsSync(path.join(root, 'node_modules/@radix-ui/react-slot/package.json')),
    '@radix-ui/react-slot must resolve directly inside node_modules'
  );
  assert.ok(!pkg.dependencies['@tailwindcss/vite'], '@tailwindcss/vite must not sit in dependencies');
  assert.ok(!pkg.dependencies['@vitejs/plugin-react'], '@vitejs/plugin-react must not sit in dependencies');
  assert.ok(pkg.devDependencies['@tailwindcss/vite'], '@tailwindcss/vite must sit in devDependencies');
  assert.ok(pkg.devDependencies['@vitejs/plugin-react'], '@vitejs/plugin-react must sit in devDependencies');

  for (const deadPkg of [
    '@radix-ui/react-avatar',
    '@shadcn/react',
    'canvas-confetti',
    '@types/canvas-confetti',
    'gsap',
    'autoprefixer',
  ]) {
    assert.ok(!pkg.dependencies[deadPkg] && !pkg.devDependencies[deadPkg], `Dead dependency ${deadPkg} should be removed`);
  }
  console.log('PASS: FND-005 package.json declarations & dev/prod split verified');

  // 2. FND-020: dead code & clutter cleanup
  const removedFiles = [
    'src/components/ui/avatar.tsx',
    'src/components/ui/message-scroller.tsx',
    'src/components/AccordionGallery.tsx',
    'src/components/AccordionGallery.css',
    'src/components/GradientWaves.tsx',
    'src/components/GradientWaves.jsx',
    'src/components/Hero.jsx',
    'src/components/Login.jsx',
    'src/components/OtpInput.tsx',
    'src/components/PickCard.tsx',
    'src/lib/pushNotifications.ts',
    'src/lib/ratingDatabase.sql',
    'src/lib/useAutoCollapse.ts',
    'lib/utils.ts',
    'src/data/bundledSportsCatalogue.ts.bak',
    'test-chat.html',
  ];
  for (const rel of removedFiles) {
    assert.ok(!fs.existsSync(path.join(root, rel)), `Dead file ${rel} should be removed`);
  }
  const sportsFeedSrc = fs.readFileSync(path.join(root, 'src/lib/sportsFeedService.ts'), 'utf8');
  assert.ok(!sportsFeedSrc.includes('function getMarketFixtures'), 'Unused getMarketFixtures should be removed');
  assert.ok(!sportsFeedSrc.includes('startContinuousSportsScheduler'), 'Unused startContinuousSportsScheduler should be removed');
  console.log('PASS: FND-020 dead UI stubs, unused schemas & backup cleanup verified');

  // 3. FND-021: shared PDF stream decoder & homepage feed schema parity
  const clientPdfSrc = fs.readFileSync(path.join(root, 'src/lib/fixturePdfParser.ts'), 'utf8');
  const serverPdfSrc = fs.readFileSync(path.join(root, 'src/lib/serverPdfParser.ts'), 'utf8');
  assert.ok(!clientPdfSrc.includes('function parseCoordinateTextStream('), 'fixturePdfParser must import shared parseCoordinateTextStream');
  assert.ok(!serverPdfSrc.includes('function parseCoordinateTextStream('), 'serverPdfParser must import shared parseCoordinateTextStream');
  assert.ok(!clientPdfSrc.includes('export function isBinaryGarbage('), 'fixturePdfParser must not duplicate isBinaryGarbage');
  assert.ok(!serverPdfSrc.includes('export function isBinaryGarbage('), 'serverPdfParser must not duplicate isBinaryGarbage');

  const { parseCoordinateTextStream, isBinaryGarbage } = await import('../src/lib/pdfTextDecode');
  const sampleStream = [
    'BT 10 700 Td (1234) Tj ET',
    'BT 60 700 Td (2026-11-15) Tj ET',
    'BT 140 700 Td (Arsenal vs Chelsea) Tj ET',
    'BT 300 700 Td (1.90) Tj ET',
  ].join('\n');
  const reconstructed = parseCoordinateTextStream(sampleStream);
  assert.equal(reconstructed, '1234\t2026-11-15\tArsenal vs Chelsea\t1.90');
  assert.equal(isBinaryGarbage('Arsenal vs Chelsea'), false);
  assert.equal(isBinaryGarbage('\u00ff\u00fe\u00fd\u00fc'), true);

  const clientFeedSrc = fs.readFileSync(path.join(root, 'src/lib/homepageFeedStore.ts'), 'utf8');
  const serverFeedSrc = fs.readFileSync(path.join(root, 'src/lib/serverHomepageFeed.ts'), 'utf8');
  assert.ok(clientFeedSrc.includes("from './homepageFeedSchema.js'"), 'homepageFeedStore must use homepageFeedSchema');
  assert.ok(serverFeedSrc.includes("from './homepageFeedSchema.js'"), 'serverHomepageFeed must use homepageFeedSchema');

  const { normalizeCarouselPostItem } = await import('../src/lib/serverHomepageFeed');
  const { enrichCarouselItem } = await import('../src/lib/homepageFeedStore');
  const probeItem = {
    id: 'story-parity-1',
    imageUrl: 'https://example.com/a.webp',
    caption: 'Test',
    published: true,
    createdAt: '2026-11-14T10:00:00.000Z',
    publishedAt: '2026-11-14T10:00:00.000Z',
  };
  const serverNormalized = normalizeCarouselPostItem(probeItem);
  const clientNormalized = enrichCarouselItem(probeItem);
  assert.equal(serverNormalized.expiresAt, clientNormalized.expiresAt);
  assert.equal(serverNormalized.imageVersion, clientNormalized.imageVersion);
  assert.equal(serverNormalized.status, clientNormalized.status);
  console.log('PASS: FND-021 shared PDF stream decode & homepage feed schema parity verified');

  // 4. FND-023: quarantined M-Pesa UX notice & no fake seedTx
  const walletSrc = fs.readFileSync(path.join(root, 'src/pages/WalletPage.tsx'), 'utf8');
  assert.ok(!walletSrc.includes('seedTx'), 'WalletPage must not contain fake seedTx entries');
  for (const rel of [
    'src/pages/WalletPage.tsx',
    'src/pages/profile/DepositPanel.tsx',
    'src/components/PayGate.tsx',
    'src/components/subscription/PremiumPaywall.tsx',
  ]) {
    const fileText = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.ok(
      fileText.includes('MPESA_VERIFICATION_STATUS_NOTICE'),
      `${rel} must surface MPESA_VERIFICATION_STATUS_NOTICE`
    );
  }
  console.log('PASS: FND-023 quarantined payment notice & seedTx removal verified');

  console.log('\nALL PHASE 8 REMEDIATION TESTS PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

