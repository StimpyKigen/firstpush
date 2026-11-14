(function () {
  try {
    var savedTheme = localStorage.getItem('mshindi-theme');
    var isDark =
      savedTheme === 'dark' ||
      (!savedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
    var isAndroid = /android/i.test(navigator.userAgent);
    if (isAndroid) {
      document.documentElement.classList.add('is-android');
    }
    var pwa =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      /[?&](pwa|splash|loading)=1/.test(location.search) ||
      document.referrer.indexOf('android-app://') !== -1;
    var skipSplash = false;
    try {
      skipSplash = sessionStorage.getItem('mshindi_skip_pwa_splash') === '1';
    } catch (e) {}
    if (pwa && !skipSplash) {
      if (isAndroid) {
        // Android PWA: start in fullscreen logo green accent (#11492D) during loading screen,
        // then transition to #FFFFF0 (light) or #202522 (dark) once loading completes.
        document.documentElement.setAttribute('data-splash', 'active');
        document.querySelectorAll('meta[name="theme-color"]').forEach(function (el) {
          el.setAttribute('content', '#11492D');
        });
        document.documentElement.style.backgroundColor = '#11492D';
      } else {
        // iOS and desktop PWA: preserve existing splash animation backdrop untouched
        document.documentElement.setAttribute('data-splash', 'active');
        document.querySelector('meta[name=theme-color]').setAttribute('content', '#11492D');
        document.documentElement.style.backgroundColor = '#11492D';
      }
    } else {
      var activeColor = isDark ? '#202522' : '#FFFFF0';
      document.querySelectorAll('meta[name="theme-color"]').forEach(function (el) {
        el.setAttribute('content', activeColor);
      });
      if (isAndroid) {
        document.documentElement.style.backgroundColor = activeColor;
      }
    }
  } catch (e) {}
})();

