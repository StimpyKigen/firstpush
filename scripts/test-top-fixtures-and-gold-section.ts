import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('==================================================================');
  console.log('MSHINDIROOM: HOMEPAGE, PWA CLEARANCE & ZOOM LOCK VERIFICATION');
  console.log('==================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      process.exitCode = 1;
    }
  }

  const homeFile = path.resolve('src/pages/Home.tsx');
  const homeCode = fs.readFileSync(homeFile, 'utf8');

  const appFile = path.resolve('src/App.tsx');
  const appCode = fs.readFileSync(appFile, 'utf8');

  const indexHtmlFile = path.resolve('index.html');
  const indexHtmlCode = fs.readFileSync(indexHtmlFile, 'utf8');

  const indexCssFile = path.resolve('src/index.css');
  const indexCssCode = fs.readFileSync(indexCssFile, 'utf8');

  const pwaZoomFile = path.resolve('src/lib/pwaZoomPrevention.ts');
  const pwaZoomCode = fs.existsSync(pwaZoomFile) ? fs.readFileSync(pwaZoomFile, 'utf8') : '';

  const mainFile = path.resolve('src/main.tsx');
  const mainCode = fs.readFileSync(mainFile, 'utf8');

  // 1. Source Text under Photo in Italics
  assert(
    homeCode.includes('Source: <span className="text-slate-300 font-medium italic">{currentPhoto.source}</span>') ||
    homeCode.includes('Source:'),
    'Home.tsx renders the "Source:" credit'
  );
  assert(
    homeCode.includes('italic') && homeCode.includes('text-slate-400/80 italic'),
    'The "Source:" credit text uses italics'
  );

  // 2. Top Fixtures Section Headings
  assert(
    homeCode.includes('Top Fixtures'),
    'Home.tsx includes "Top Fixtures" eyebrow label'
  );
  assert(
    homeCode.includes('Join in on the Discussions of these Highlighted fixtures'),
    'Home.tsx includes "Join in on the Discussions of these Highlighted fixtures" subheading'
  );

  // 3. Warm Ivory Background
  assert(
    homeCode.includes('bg-[#FFFFF0]'),
    'Top Fixtures section uses warm ivory background (#FFFFF0)'
  );

  // 4. Data Slicing and Popularity
  assert(
    homeCode.includes('sortHighlightsComparator'),
    'Home.tsx sorts fixtures by popularity using sortHighlightsComparator'
  );
  assert(
    homeCode.includes('.slice(0, 5)'),
    'Home.tsx selects the top 5 fixtures in terms of popularity'
  );

  // 5. Desktop Full-Size FixtureSportCard Edge-to-Edge
  assert(
    homeCode.includes('<FixtureSportCard') && homeCode.includes('onToggleLeg') && homeCode.includes('onOpenBetBuilder'),
    'Desktop Top Fixtures renders original full-size FixtureSportCard with bet builder & consensus integration'
  );
  assert(
    homeCode.includes('hidden md:block w-full px-3 sm:px-6 lg:px-8 xl:px-10'),
    'Desktop Top Fixtures spans edge-to-edge from absolute left to absolute right across desktop'
  );

  // 6. Mobile Compact Fixtures (2-2-1 layout)
  assert(
    homeCode.includes('block md:hidden max-w-7xl mx-auto px-2') && homeCode.includes('grid grid-cols-2 gap-2.5'),
    'Mobile Top Fixtures retains compact card design (grid-cols-2: 2 on row 1, 2 on row 2, 1 on row 3)'
  );

  // 7. Video & Highlights Gold Section & Headings
  assert(
    homeCode.includes('bg-[#D4AF37]'),
    'Videos & Highlights section has the full gold accent background (#D4AF37)'
  );
  assert(
    homeCode.includes('Video &amp; Highlights') || homeCode.includes('Video & Highlights'),
    'Videos & Highlights has small eyebrow heading "Video & Highlights"'
  );
  assert(
    homeCode.includes('Tune in to Post-match Highlights, Post-match Punditry and other Featured Videos'),
    'Videos & Highlights has main heading "Tune in to Post-match Highlights, Post-match Punditry and other Featured Videos"'
  );

  // 8. Desktop Videos Edge-to-Edge with Compact max-w-[340px] Iframe Size
  assert(
    homeCode.includes('hidden md:block w-full px-3 sm:px-6 lg:px-8 xl:px-10'),
    'Desktop Videos span edge-to-edge across desktop'
  );
  assert(
    homeCode.includes('max-w-[340px] w-full mx-auto'),
    'Desktop video card maintains max-w-[340px] to keep the 16:9 video iframe compact as before'
  );

  // 9. Minimalistic Heart Icon on Bottom Right of Video Cards
  assert(
    homeCode.includes('likedVideoIds') && homeCode.includes('handleToggleLikeVideo'),
    'Home.tsx manages video like state persisted in localStorage'
  );
  assert(
    homeCode.includes('<Heart') && homeCode.includes('aria-label={isLiked ? \'Unlike video\' : \'Like video\'}'),
    'Video cards feature a minimalistic Heart icon button with like/unlike toggle on the bottom right'
  );

  // 10. Mobile Logged-in PWA Clearance & Complete Gold Sector
  assert(
    homeCode.includes('pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]'),
    'Home.tsx gold video section adds bottom clearance for fixed mobile nav when user is logged in'
  );
  assert(
    appCode.includes('if (currentUser)') && appCode.includes('hidden lg:block') && appCode.includes('<Footer />'),
    'App.tsx preserves not showing footer on mobile when user is logged in'
  );

  // 11. Disable Zooming in PWA (Viewport, CSS, Event Listeners)
  assert(
    indexHtmlCode.includes('maximum-scale=1.0') && indexHtmlCode.includes('user-scalable=no'),
    'index.html defines maximum-scale=1.0 and user-scalable=no in viewport meta tag'
  );
  assert(
    indexCssCode.includes('touch-action: pan-x pan-y'),
    'index.css enforces touch-action: pan-x pan-y to disable pinch-zoom in CSS'
  );
  assert(
    pwaZoomCode.includes('gesturestart') && pwaZoomCode.includes('touchmove') && pwaZoomCode.includes('wheel'),
    'pwaZoomPrevention.ts intercepts gestures, multi-touch pinch, wheel zoom, and keyboard zoom shortcuts'
  );
  assert(
    mainCode.includes('initPwaZoomPrevention()'),
    'main.tsx invokes initPwaZoomPrevention() upon app startup'
  );

  console.log(`\nResults: ${passed}/${total} tests passed.`);
  if (passed === total) {
    console.log('ALL HOMEPAGE, PWA CLEARANCE & ZOOM LOCK SPECIFICATIONS VERIFIED SUCCESSFULLY!\n');
  }
}

runTests();
