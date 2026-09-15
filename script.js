/* =========================================================
   SHORT STUDY — SHARED CORE SCRIPT
   - Mobile navigation toggle & e-book dropdown
   - Google AdSense / GDPR & CCPA Consent Management Platform (CMP)
   ========================================================= */

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
