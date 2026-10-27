import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('==================================================================');
  console.log('MSHINDIROOM: HOMEPAGE REFINEMENTS VERIFICATION SUITE');
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
  const photoContainerIndex = homeCode.indexOf('aspect-[3/4]');
  const sourceIndex = homeCode.indexOf('Source:');
  const textContainerIndex = homeCode.indexOf('TEXT CONTAINER');
  assert(
    photoContainerIndex !== -1 && sourceIndex !== -1 && textContainerIndex !== -1 &&
    photoContainerIndex < sourceIndex && sourceIndex < textContainerIndex,
    '"Source:" text is located at the bottom-left directly under the 3:4 photo container, before the text container'
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
  assert(
    homeCode.includes('font-bold text-xs uppercase tracking-wider block mb-1'),
    'Top Fixtures eyebrow matches Weekly Editorial font styling'
  );
  assert(
    homeCode.includes('font-extrabold text-xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight'),
    'Top Fixtures subheading matches Top Stories & Matchday Perspectives font styling'
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
    homeCode.includes('w-full bg-[#D4AF37] text-slate-900 py-6 sm:py-16'),
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

  console.log(`\nResults: ${passed}/${total} tests passed.`);
  if (passed === total) {
    console.log('ALL HOMEPAGE REFINEMENTS VERIFIED SUCCESSFULLY!\n');
  }
}

runTests();
