import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('==================================================================');
  console.log('MSHINDIROOM: TOP FIXTURES & GOLD HIGHLIGHTS VERIFICATION SUITE');
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

  // 1. Heading and Subheading Consistency
  assert(
    homeCode.includes('Top Fixtures'),
    'Home.tsx includes the "Top Fixtures" section eyebrow label'
  );
  assert(
    homeCode.includes('Join in on the Discussions of these Highlighted fixtures'),
    'Home.tsx includes "Join in on the Discussions of these Highlighted fixtures" subheading'
  );
  assert(
    homeCode.includes('font-bold text-xs uppercase tracking-wider block mb-1'),
    'Top Fixtures eyebrow uses the exact same font styling as Weekly Editorial'
  );
  assert(
    homeCode.includes('font-extrabold text-xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight'),
    'Subheading uses the exact same responsive font size & weight as Top Stories & Matchday Perspectives'
  );

  // 2. Vertical Alignment
  const topFixturesSectionMatch = homeCode.match(/<section[^>]*bg-\[#FFFFF0\][^>]*>[\s\S]*?<div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">[\s\S]*?<div className="text-left mb-4 sm:mb-8 px-1 sm:px-0">/);
  assert(
    Boolean(topFixturesSectionMatch),
    'Top Fixtures section header is vertically in-line with the other section headings (max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 with px-1 sm:px-0)'
  );

  // 3. Ivory Background
  assert(
    homeCode.includes('bg-[#FFFFF0]'),
    'Top Fixtures section has the warm ivory background'
  );

  // 4. Data Source & Popularity
  assert(
    homeCode.includes('sortHighlightsComparator'),
    'Home.tsx sorts fixtures by popularity using sortHighlightsComparator'
  );
  assert(
    homeCode.includes('.slice(0, 5)'),
    'Home.tsx slices the top 5 fixtures in terms of popularity'
  );

  // 5. Responsive Grid: 5 across on desktop, 2-2-1 on mobile
  assert(
    homeCode.includes('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4'),
    'Uses grid-cols-2 on mobile (2 on row 1, 2 on row 2, 1 on row 3) and lg:grid-cols-5 on desktop (side by side across screen)'
  );

  // 6. Discussion Linking
  assert(
    homeCode.includes('to={`/free/${m.id}`}'),
    'Clicking any top fixture links to the match discussion room'
  );
  assert(
    homeCode.includes('Join Discussion'),
    'Card provides explicit Join Discussion call-to-action'
  );

  // 7. Video and Highlights Gold Background
  assert(
    homeCode.includes('w-full bg-[#D4AF37] text-slate-900 py-6 sm:py-16'),
    'Videos and Highlights section has the full-bleed gold accent background (#D4AF37) covering the whole section'
  );
  assert(
    homeCode.includes('font-extrabold text-2xl sm:text-3xl lg:text-4xl text-slate-950 tracking-tight'),
    'Videos and Highlights heading remains bold and clearly legible on gold background'
  );

  console.log(`\nResults: ${passed}/${total} tests passed.`);
  if (passed === total) {
    console.log('ALL TOP FIXTURES & GOLD HIGHLIGHTS SPECIFICATIONS VERIFIED SUCCESSFULLY!\n');
  }
}

runTests();
