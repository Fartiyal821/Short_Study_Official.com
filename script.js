/* =========================================================
   SHORT STUDY — SHARED CORE SCRIPT
   - Cross-origin third-party script error shield (Payhip, AdSense)
   - Tiny top page loading progress bar (showing loading state across page transitions)
   - Mobile navigation toggle & e-book dropdown
   - Google AdSense / GDPR & CCPA Consent Management Platform (CMP)
   ========================================================= */

/* ---- Global Error Shield for Third-Party Cross-Origin Scripts ---- */
(function initGlobalErrorShield() {
  function isCrossOriginScriptError(msg, src, line) {
    if (!msg) return true;
    var s = String(msg).toLowerCase();
    if (s.indexOf('script error') !== -1) return true;
    if ((!src || src === '' || !line || line === 0) && (s.indexOf('error') !== -1 || s.indexOf('syntax') !== -1)) return true;
    if (src && (src.indexOf('payhip.com') !== -1 || src.indexOf('googlesyndication.com') !== -1 || src.indexOf('doubleclick.net') !== -1)) return true;
    return false;
  }

  window.addEventListener('error', function(event) {
    if (isCrossOriginScriptError(event.message, event.filename, event.lineno)) {
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      if (event.stopPropagation) event.stopPropagation();
      event.preventDefault();
      return true;
    }
  }, true);

  var _prevOnError = window.onerror;
  window.onerror = function(msg, url, lineNo, colNo, error) {
    if (isCrossOriginScriptError(msg, url, lineNo)) {
      return true;
    }
    if (typeof _prevOnError === 'function') {
      return _prevOnError(msg, url, lineNo, colNo, error);
    }
  };

  window.addEventListener('unhandledrejection', function(event) {
    var reason = event.reason ? (event.reason.message || String(event.reason)) : '';
    if (isCrossOriginScriptError(reason) || reason.indexOf('payhip') !== -1 || reason.indexOf('adsbygoogle') !== -1) {
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);
})();

/* ---- Top Page Loading Progress Bar (Tiny line across top of page) ---- */
(function initPageProgressBar() {
  function getOrCreateBar() {
    var bar = document.getElementById('page-progress-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'page-progress-bar';
      if (document.body) {
        document.body.appendChild(bar);
      } else if (document.documentElement) {
        document.documentElement.appendChild(bar);
      }
    }
    return bar;
  }

  var progressBar = getOrCreateBar();
  var progressTimer = null;

  function startLoadingProgress() {
    var bar = getOrCreateBar();
    if (!bar) return;
    bar.classList.add('is-loading');
    bar.style.width = '20%';
    clearTimeout(progressTimer);
    progressTimer = setTimeout(function () {
      if (bar) bar.style.width = '70%';
    }, 120);
  }

  function finishLoadingProgress() {
    var bar = getOrCreateBar();
    if (!bar) return;
    clearTimeout(progressTimer);
    bar.style.width = '100%';
    setTimeout(function () {
      if (bar) bar.classList.remove('is-loading');
      setTimeout(function () {
        if (bar && !bar.classList.contains('is-loading')) bar.style.width = '0%';
      }, 300);
    }, 220);
  }

  // Animate on initial document load
  startLoadingProgress();
  if (document.readyState === 'complete') {
    finishLoadingProgress();
  } else {
    window.addEventListener('load', finishLoadingProgress);
    document.addEventListener('DOMContentLoaded', function () {
      var bar = getOrCreateBar();
      if (bar && bar.style.width === '20%') bar.style.width = '85%';
    });
  }

  // Handle bfcache / back-forward navigation
  window.addEventListener('pageshow', function (e) {
    finishLoadingProgress();
  });

  // Track page transitions on internal link clicks
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href');
    var target = a.getAttribute('target');

    // Skip in-page hashes, javascript protocols, external protocols, or new-window tabs
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || target === '_blank') {
      return;
    }

    try {
      var nextUrl = new URL(a.href, window.location.href);
      if (nextUrl.origin === window.location.origin) {
        var bar = getOrCreateBar();
        if (bar) {
          bar.classList.add('is-loading');
          bar.style.width = '15%';
          setTimeout(function () { if (bar) bar.style.width = '55%'; }, 80);
          setTimeout(function () { if (bar) bar.style.width = '85%'; }, 240);
        }
      }
    } catch (err) {
      var bar = getOrCreateBar();
      if (bar) {
        bar.classList.add('is-loading');
        bar.style.width = '65%';
      }
    }
  });

  window.addEventListener('beforeunload', function () {
    var bar = getOrCreateBar();
    if (bar) {
      bar.classList.add('is-loading');
      bar.style.width = '96%';
    }
  });
})();

document.addEventListener('DOMContentLoaded', function () {

  /* ---- 1. Mobile menu toggle ---- */
  var menuToggle = document.getElementById('menuToggle');
  var navLinks = document.getElementById('navLinks');
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', function () {
      navLinks.classList.toggle('open');
    });
  }

  /* ---- 2. E-book dropdown (click to open, closes on outside click) ---- */
  var dropdown = document.querySelector('.dropdown');
  if (dropdown) {
    var toggleBtn = dropdown.querySelector('.dropdown-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function (e) {
        e.preventDefault();
        dropdown.classList.toggle('open');
      });

      document.addEventListener('click', function (e) {
        if (!dropdown.contains(e.target)) {
          dropdown.classList.remove('open');
        }
      });
    }
  }

  /* ---- 3. Close mobile menu after a top-level link is clicked ---- */
  if (navLinks) {
    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        if (window.innerWidth <= 760 && a.closest('.dropdown-menu') === null) {
          navLinks.classList.remove('open');
        }
      });
    });
  }

  /* ---- 4. Consent Management Platform (CMP) for GDPR/CCPA & Google AdSense ---- */
  initConsentBanner();

});

function initConsentBanner() {
  var consentKey = 'shortstudy_cookie_consent_v1';
  var userConsent = localStorage.getItem(consentKey);

  // If banner already exists or consent given, set Google consent and return
  if (userConsent) {
    applyConsentState(userConsent === 'granted');
    return;
  }

  // Create CMP Banner dynamically if not present
  if (!document.getElementById('cmp-banner')) {
    var banner = document.createElement('div');
    banner.id = 'cmp-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie and Privacy Consent');
    banner.innerHTML = [
      '<div class="cmp-inner">',
      '  <div class="cmp-text">',
      '    <h4>Cookie &amp; Privacy Choices</h4>',
      '    <p>Short Study uses cookies and related technologies to ensure website functionality, measure audience traffic, and deliver personalized educational content and Google advertisements compliant with GDPR and CCPA regulations. Learn more in our <a href="privacy-policy.html">Privacy Policy</a> and <a href="disclaimer.html">Disclaimer</a>.</p>',
      '  </div>',
      '  <div class="cmp-actions">',
      '    <button type="button" class="cmp-btn cmp-btn-decline" id="cmp-btn-decline">Essential Only</button>',
      '    <button type="button" class="cmp-btn cmp-btn-accept" id="cmp-btn-accept">Accept All</button>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(banner);

    // Trigger smooth slide up
    setTimeout(function () {
      banner.classList.add('cmp-show');
    }, 400);

    var acceptBtn = document.getElementById('cmp-btn-accept');
    var declineBtn = document.getElementById('cmp-btn-decline');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        localStorage.setItem(consentKey, 'granted');
        banner.classList.remove('cmp-show');
        setTimeout(function () { banner.remove(); }, 350);
        applyConsentState(true);
      });
    }

    if (declineBtn) {
      declineBtn.addEventListener('click', function () {
        localStorage.setItem(consentKey, 'denied');
        banner.classList.remove('cmp-show');
        setTimeout(function () { banner.remove(); }, 350);
        applyConsentState(false);
      });
    }
  }
}

function applyConsentState(granted) {
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', {
      'ad_storage': granted ? 'granted' : 'denied',
      'ad_user_data': granted ? 'granted' : 'denied',
      'ad_personalization': granted ? 'granted' : 'denied',
      'analytics_storage': granted ? 'granted' : 'denied'
    });
  }
}

// Global hook for user to re-open consent choices from footer
window.showConsentPreferences = function () {
  localStorage.removeItem('shortstudy_cookie_consent_v1');
  initConsentBanner();
};

/* =========================================================
   5. CODEWITHHARRY-STYLE INTERACTIVE LAYOUT ENHANCEMENTS
   ========================================================= */
document.addEventListener('DOMContentLoaded', function () {
  // Hero typing text animation
  initHeroTyping();

  // Course category filter buttons
  initCourseFilters();

  // Search input filter
  initSiteSearch();

  // Code block copy buttons
  initCodeCopyButtons();
});

function initCodeCopyButtons() {
  var copyButtons = document.querySelectorAll('.cwh-copy-btn');
  copyButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var container = btn.closest('.cwh-code-container');
      if (!container) return;
      var pre = container.querySelector('.cwh-code-pre') || container.querySelector('code');
      if (!pre) return;

      var textToCopy = pre.innerText || pre.textContent;
      navigator.clipboard.writeText(textToCopy).then(function () {
        var originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        btn.style.background = '#10b981';
        btn.style.color = '#ffffff';
        setTimeout(function () {
          btn.textContent = originalText;
          btn.style.background = '';
          btn.style.color = '';
        }, 2000);
      }).catch(function () {
        btn.textContent = 'Copied!';
      });
    });
  });
}

function initHeroTyping() {
  var el = document.getElementById('typingWord');
  if (!el) return;

  var words = [
    'Python Programming',
    'Data Structures & Arrays',
    'C Language & Memory',
    'Java & OOP Concepts',
    'HTML5 & Modern CSS',
    'SQL Databases'
  ];
  var wordIdx = 0;
  var charIdx = 0;
  var isDeleting = false;
  var typingSpeed = 100;

  function type() {
    var currentWord = words[wordIdx];
    if (isDeleting) {
      el.textContent = currentWord.substring(0, charIdx - 1);
      charIdx--;
      typingSpeed = 50;
    } else {
      el.textContent = currentWord.substring(0, charIdx + 1);
      charIdx++;
      typingSpeed = 110;
    }

    if (!isDeleting && charIdx === currentWord.length) {
      typingSpeed = 1800; // Pause at end of word
      isDeleting = true;
    } else if (isDeleting && charIdx === 0) {
      isDeleting = false;
      wordIdx = (wordIdx + 1) % words.length;
      typingSpeed = 400;
    }

    setTimeout(type, typingSpeed);
  }

  type();
}

function initCourseFilters() {
  var buttons = document.querySelectorAll('.cwh-filter-btn');
  var cards = document.querySelectorAll('.cwh-card');
  if (!buttons.length || !cards.length) return;

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      buttons.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');

      var cat = btn.getAttribute('data-filter');
      cards.forEach(function (card) {
        var cardCat = card.getAttribute('data-category') || '';
        if (cat === 'all' || cardCat.includes(cat)) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

function initSiteSearch() {
  var searchInput = document.getElementById('siteSearchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', function () {
    var query = searchInput.value.toLowerCase().trim();
    var cards = document.querySelectorAll('.cwh-card, .class-card');

    cards.forEach(function (card) {
      var text = card.textContent.toLowerCase();
      if (!query || text.includes(query)) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  });
}

