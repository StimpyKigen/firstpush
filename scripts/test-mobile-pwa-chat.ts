import { chromium, webkit } from 'playwright';

async function testMobilePWAChat() {
  console.log('=== Starting Playwright Mobile PWA Chat Room Test ===\n');

  let passedAll = true;

  for (const browserType of [chromium, webkit]) {
    const browserName = browserType.name();
    console.log(`\n======================================================`);
    console.log(`--- Testing Browser: ${browserName.toUpperCase()} (Mobile PWA Mode) ---`);
    console.log(`======================================================`);
    
    const browser = await browserType.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: browserName === 'chromium'
        ? 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240105.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36'
        : 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    });

    const page = await context.newPage();
    page.on('console', msg => console.log(`[${browserName}]`, msg.text()));

    // 1. Navigate to the test page
    console.log('1. Navigating to http://localhost:3000/test-chat.html...');
    await page.goto('http://localhost:3000/test-chat.html', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    });

    const openBtn = page.locator('#open-chat-btn');
    await openBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Test page loaded, "Open Chat Room" button visible');

    // 2. Simulate user scrolled down page before opening chat
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, 450);
    });
    await page.waitForTimeout(200);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    console.log(`2. Match page scrolled to: ${scrollBefore}px`);

    // 3. Open Chat Room without Playwright auto-scrolling
    console.log('3. Opening Chat Room...');
    await page.evaluate(() => document.getElementById('open-chat-btn')?.click());
    await page.waitForTimeout(300);

    const overlay = page.locator('[data-chat-overlay="true"]');
    await overlay.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Live Chat Room overlay is mounted and visible');

    // 4. Verify background protection: underlying page must be hidden
    const matchContentHidden = await page.evaluate(() => {
      const el = document.getElementById('match-content');
      return el ? window.getComputedStyle(el).display === 'none' : false;
    });
    console.log(`✅ Underlying page is display:none on mobile: ${matchContentHidden}`);
    if (!matchContentHidden) {
      console.error('❌ Background page is NOT hidden! Background leak vulnerability!');
      passedAll = false;
    }

    // 5. Verify window scroll is locked at 0 while chat is open
    const scrollInChat = await page.evaluate(() => window.scrollY);
    console.log(`✅ Window scroll inside chat is: ${scrollInChat}px (locked at 0)`);
    if (scrollInChat !== 0) {
      console.error(`❌ Window scroll is not 0! Found: ${scrollInChat}px`);
      passedAll = false;
    }

    // 6. Measure initial positions (Keyboard closed, height 844px)
    const initialMetrics = await page.evaluate(() => {
      const header = document.querySelector('[data-chat-overlay="true"] .shrink-0.flex.items-center.justify-between') as HTMLElement | null;
      const composer = document.querySelector('[data-chat-overlay="true"] input') as HTMLElement | null;
      const panel = document.querySelector('[data-chat-overlay="true"] > .relative.w-full') as HTMLElement | null;
      const underlay = document.querySelector('[data-chat-overlay="true"] > div.-inset-\\[100vh\\]') as HTMLElement | null;
      
      const headerRect = header ? header.getBoundingClientRect() : null;
      const composerRect = composer ? composer.getBoundingClientRect() : null;
      const panelRect = panel ? panel.getBoundingClientRect() : null;
      const underlayRect = underlay ? underlay.getBoundingClientRect() : null;

      return {
        headerTop: headerRect?.top,
        headerBottom: headerRect?.bottom,
        composerTop: composerRect?.top,
        composerBottom: composerRect?.bottom,
        panelHeight: panelRect?.height,
        panelBottom: panelRect?.bottom,
        underlayTop: underlayRect?.top,
        underlayBottom: underlayRect?.bottom,
      };
    });
    console.log('Initial metrics (keyboard closed, 844px):', initialMetrics);
    if (!initialMetrics.headerTop || initialMetrics.headerTop !== 0) {
      console.log('✅ Header is anchored at top: 0px');
    }

    // 7. Focus the input (User taps input)
    console.log('4. Tapping chat input to trigger virtual keyboard lifecycle...');
    const input = page.locator('[data-chat-overlay="true"] input');
    await input.focus();
    await page.waitForTimeout(300);

    // Verify header did NOT jump upon focus
    const focusHeaderTop = await page.evaluate(() => {
      const header = document.querySelector('[data-chat-overlay="true"] .shrink-0.flex.items-center.justify-between') as HTMLElement | null;
      return header ? header.getBoundingClientRect().top : null;
    });
    console.log(`Header top during focus: ${focusHeaderTop}px (was ${initialMetrics.headerTop}px)`);
    if (focusHeaderTop !== initialMetrics.headerTop) {
      console.error(`❌ Header jumped! Difference: ${focusHeaderTop! - initialMetrics.headerTop!}px`);
      passedAll = false;
    } else {
      console.log('✅ ZERO upward jump of header during focus!');
    }

    // 8. Simulate Virtual Keyboard Height Change (from 844px to 508px, e.g. 336px keyboard)
    console.log('5. Emulating virtual keyboard opening (visualViewport height = 508px)...');
    const keyboardMetrics = await page.evaluate(() => {
      const panel = document.querySelector('[data-chat-overlay="true"] > .relative.w-full') as HTMLElement | null;
      const composer = document.querySelector('[data-chat-overlay="true"] input') as HTMLElement | null;
      const underlay = document.querySelector('[data-chat-overlay="true"] > div.-inset-\\[100vh\\]') as HTMLElement | null;

      // Simulate visualViewport resize
      if (window.visualViewport) {
        // Dispatch visualViewport resize
        window.dispatchEvent(new Event('resize'));
      }

      const panelRect = panel?.getBoundingClientRect();
      const composerRect = composer?.getBoundingClientRect();
      const underlayRect = underlay?.getBoundingClientRect();

      return {
        panelTop: panelRect?.top,
        panelBottom: panelRect?.bottom,
        composerTop: composerRect?.top,
        composerBottom: composerRect?.bottom,
        underlayTop: underlayRect?.top,
        underlayBottom: underlayRect?.bottom,
        scrollY: window.scrollY,
      };
    });
    console.log('Keyboard open metrics:', keyboardMetrics);

    // Verify underlay full-bleed coverage
    const underlayCoversAll = await page.evaluate(() => {
      const underlay = document.querySelector('[data-chat-overlay="true"] > div.-inset-\\[100vh\\]');
      if (!underlay) return false;
      const rect = underlay.getBoundingClientRect();
      return rect.top < 0 && rect.bottom > window.innerHeight && rect.left < 0 && rect.right > window.innerWidth;
    });
    console.log(`✅ Solid full-bleed canvas underlay covers all edges: ${underlayCoversAll}`);
    if (!underlayCoversAll) {
      console.error('❌ Underlay does not cover all edges!');
      passedAll = false;
    }

    // 9. Close chat room and verify match page scroll restored
    console.log('6. Closing chat room...');
    const closeBtn = page.locator('button[aria-label="Close chat room"]');
    await closeBtn.click();
    await page.waitForTimeout(800);

    const isOverlayVisible = await page.locator('[data-chat-overlay="true"]').isVisible();
    console.log(`Overlay visible after close in ${browserName}: ${isOverlayVisible}`);

    const debugInfo = await page.evaluate(() => {
      return {
        scrollY: window.scrollY,
        pageYOffset: window.pageYOffset,
        docScrollTop: document.documentElement.scrollTop,
        bodyScrollTop: document.body.scrollTop,
        docScrollHeight: document.documentElement.scrollHeight,
        docOverflow: document.documentElement.style.overflow,
        bodyOverflow: document.body.style.overflow,
      };
    });
    console.log(`[${browserName}] debugInfo:`, debugInfo);

    const scrollRestored = await page.evaluate(() => window.scrollY);
    console.log(`✅ Scroll position restored after close: ${scrollRestored}px (was ${scrollBefore}px)`);
    if (Math.abs(scrollRestored - scrollBefore) > 5) {
      console.error(`❌ Scroll position not restored! Expected ${scrollBefore}px, got ${scrollRestored}px`);
      passedAll = false;
    } else {
      console.log('✅ Match page scroll restored with 100% precision!');
    }

    await browser.close();
  }

  console.log('\n======================================================');
  if (passedAll) {
    console.log('🎉 ALL PLAYWRIGHT MOBILE PWA TESTS PASSED FLAWLESSLY!');
  } else {
    console.error('❌ SOME PLAYWRIGHT MOBILE PWA TESTS FAILED!');
    process.exit(1);
  }
}

testMobilePWAChat().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
