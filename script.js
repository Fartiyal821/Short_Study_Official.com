/* =========================================================
   SHORT STUDY — SHARED CORE SCRIPT
   - Mobile navigation toggle & e-book dropdown
   - Google AdSense / GDPR & CCPA Consent Management Platform (CMP)
   - Code syntax formatting & copy helpers
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

  /* ---- 5. Floating AI Doubt-Solver Widget ---- */
  initDoubtSolverWidget();

});

function initDoubtSolverWidget() {
  if (document.getElementById('ai-doubt-fab')) return;

  var path = window.location.pathname;
  var topic = "Computer Science";
  var headerTitle = "ShortStudy AI Assistant";
  var defaultChips = ["Explain this page to me", "What topics are covered here?", "Who built this website?"];

  if (path.indexOf('c-basics') !== -1) {
    topic = "C & Memory Management";
    headerTitle = "C & Memory Assistant";
    defaultChips = ["Explain pointers simply", "What does malloc() do?", "Who built this website?"];
  } else if (path.indexOf('java-oop') !== -1) {
    topic = "Java & OOP";
    headerTitle = "Java & OOP Assistant";
    defaultChips = ["4 Pillars of OOP explained", "Interface vs Abstract Class", "Who built this website?"];
  } else if (path.indexOf('html-css') !== -1) {
    topic = "HTML & CSS";
    headerTitle = "HTML/CSS Assistant";
    defaultChips = ["Flexbox vs Grid layout", "How does z-index work?", "Who built this website?"];
  } else if (path.indexOf('sql-basics') !== -1) {
    topic = "SQL & Databases";
    headerTitle = "SQL & Database Assistant";
    defaultChips = ["WHERE vs HAVING clause", "INNER JOIN vs LEFT JOIN", "Who built this website?"];
  } else if (path.indexOf('data-structures') !== -1) {
    topic = "Data Structures";
    headerTitle = "Data Structures Assistant";
    defaultChips = ["Explain Big-O Notation", "Stack vs Queue difference", "Who built this website?"];
  } else if (path.indexOf('python') !== -1) {
    topic = "Python Programming";
    headerTitle = "Python Assistant";
    defaultChips = ["Mutable vs Immutable in Python", "List vs Tuple difference", "Who built this website?"];
  }

  function extractPageOverview() {
    var rawTitle = document.title ? document.title.split('|')[0].trim() : "ShortStudy";
    var navLinks = [];
    var navEls = document.querySelectorAll('nav a, header .nav-link, .nav-menu a, .header-right a');
    navEls.forEach(function(el) {
      var txt = el.textContent.trim();
      if (txt && txt.length > 1 && txt.length < 25 && navLinks.indexOf(txt) === -1) {
        navLinks.push(txt);
      }
    });
    if (navLinks.length === 0) {
      navLinks = ["Home", "Courses", "Video Lectures", "Online Test", "Contact"];
    }

    var headings = [];
    var headingEls = document.querySelectorAll('h1, h2, h3, .lesson-title, .class-card h3');
    headingEls.forEach(function(el) {
      if (el.closest && el.closest('.ai-doubt-modal')) return;
      var txt = el.textContent.trim().replace(/^[0-9.]+\s*/, '');
      if (txt && txt.length > 2 && txt.length < 65 && headings.indexOf(txt) === -1) {
        headings.push(txt);
      }
    });

    return {
      title: rawTitle,
      navLinks: navLinks.slice(0, 5),
      headings: headings.slice(0, 5)
    };
  }

  var pageOverview = extractPageOverview();

  var welcomeContent = '👋 <strong>Welcome to ShortStudy AI Assistant!</strong><br>' +
    'I am here to guide you through this page and answer any question.<br><br>' +
    '📍 <strong>Current Page:</strong> ' + escapeHtml(pageOverview.title) + '<br>';

  if (pageOverview.navLinks.length > 0) {
    welcomeContent += '🧭 <strong>Page Navigation Menu:</strong> ' + pageOverview.navLinks.join(' • ') + '<br>';
  }

  if (pageOverview.headings.length > 0) {
    welcomeContent += '📚 <strong>Topics & Sections on this Page:</strong><ul style="margin:4px 0 6px 16px; padding:0; font-size:12.5px; color:var(--yellow);">';
    pageOverview.headings.forEach(function(h) {
      welcomeContent += '<li>' + escapeHtml(h) + '</li>';
    });
    welcomeContent += '</ul>';
  }

  welcomeContent += 'Ask me any question about the topics above, code syntax, or menu options!';

  // Create FAB
  var fab = document.createElement('div');
  fab.id = 'ai-doubt-fab';
  fab.className = 'ai-doubt-fab';
  fab.setAttribute('role', 'button');
  fab.setAttribute('aria-label', 'Open AI Assistant');
  fab.innerHTML = [
    '<span class="ai-fab-icon">🤖</span>',
    '<span class="ai-fab-text">AI Assistant</span>',
    '<span class="ai-fab-dot"></span>'
  ].join('');

  // Create Modal Card
  var modal = document.createElement('div');
  modal.id = 'ai-doubt-modal';
  modal.className = 'ai-doubt-modal';
  modal.innerHTML = [
    '<div class="ai-doubt-header">',
    '  <div class="ai-header-left">',
    '    <span class="ai-header-badge">⚡</span>',
    '    <div>',
    '      <h4 id="ai-doubt-title">' + headerTitle + '</h4>',
    '      <span class="ai-doubt-status">● Gemini AI Live • ' + topic + '</span>',
    '    </div>',
    '  </div>',
    '  <button id="ai-doubt-close" class="ai-close-btn" aria-label="Close Chat">✕</button>',
    '</div>',
    '<div class="ai-doubt-chips" id="ai-doubt-chips"></div>',
    '<div class="ai-doubt-messages" id="ai-doubt-messages">',
    '  <div class="ai-msg bot-msg">',
    '    <div class="msg-content">' + welcomeContent + '</div>',
    '  </div>',
    '</div>',
    '<div class="ai-doubt-input-row">',
    '  <input type="text" id="ai-doubt-input" placeholder="Ask anything about this page..." autocomplete="off">',
    '  <button id="ai-doubt-send" aria-label="Send Question">',
    '    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
    '  </button>',
    '</div>'
  ].join('');

  document.body.appendChild(fab);
  document.body.appendChild(modal);

  var chipsContainer = document.getElementById('ai-doubt-chips');
  var messagesContainer = document.getElementById('ai-doubt-messages');
  var inputEl = document.getElementById('ai-doubt-input');
  var sendBtn = document.getElementById('ai-doubt-send');
  var closeBtn = document.getElementById('ai-doubt-close');

  // Render quick chips
  defaultChips.forEach(function (chipText) {
    var chip = document.createElement('button');
    chip.className = 'ai-chip-btn';
    chip.textContent = chipText;
    chip.onclick = function () {
      sendQuestion(chipText);
    };
    chipsContainer.appendChild(chip);
  });

  // Toggle open/close
  fab.onclick = function () {
    modal.classList.toggle('active');
    if (modal.classList.contains('active')) {
      inputEl.focus();
    }
  };

  closeBtn.onclick = function () {
    modal.classList.remove('active');
  };

  sendBtn.onclick = function () {
    sendQuestion(inputEl.value);
  };

  inputEl.onkeydown = function (e) {
    if (e.key === 'Enter') {
      sendQuestion(inputEl.value);
    }
  };

  function sendQuestion(text) {
    var q = (text || '').trim();
    if (!q) return;

    inputEl.value = '';

    // Append User Message
    var uMsg = document.createElement('div');
    uMsg.className = 'ai-msg user-msg';
    uMsg.innerHTML = '<div class="msg-content">' + escapeHtml(q) + '</div>';
    messagesContainer.appendChild(uMsg);

    // Append Fast Loading Indicator
    var loadingMsg = document.createElement('div');
    loadingMsg.className = 'ai-msg bot-msg loading-msg';
    loadingMsg.innerHTML = '<div class="msg-content"><em>⚡ Answering...</em></div>';
    messagesContainer.appendChild(loadingMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Fetch API with page overview context
    fetch('/api/ai/doubt-solver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        topic: topic, 
        question: q,
        pageInfo: pageOverview
      })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      loadingMsg.remove();
      var botMsg = document.createElement('div');
      botMsg.className = 'ai-msg bot-msg';
      var ansText = (data && data.answer) ? data.answer : "Sorry, I couldn't answer that. Try rephrasing.";
      botMsg.innerHTML = '<div class="msg-content">' + formatMarkdown(ansText) + '</div>';
      messagesContainer.appendChild(botMsg);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    })
    .catch(function () {
      loadingMsg.remove();
      var botMsg = document.createElement('div');
      botMsg.className = 'ai-msg bot-msg';
      botMsg.innerHTML = '<div class="msg-content">Sorry, could not connect to AI service right now. Please check your network connection.</div>';
      messagesContainer.appendChild(botMsg);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatMarkdown(str) {
    var escaped = escapeHtml(str);
    // Code block formatting
    escaped = escaped.replace(/```([\s\S]*?)```/g, function (match, p1) {
      return '<pre class="ai-code-block"><code>' + p1.trim() + '</code></pre>';
    });
    // Inline code
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Newlines to br
    escaped = escaped.replace(/\n/g, '<br>');
    return escaped;
  }
}

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
