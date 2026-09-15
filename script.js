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

    // Fast check for strict guardrails client-side (instant response)
    var devPatterns = /(who (built|made|created|developed|is the developer|is the creator|designed|wrote|owns) (this|the)? (website|site|app|platform|shortstudy)|developer name|who built this|who made this)/i;
    if (devPatterns.test(q)) {
      var devMsg = document.createElement('div');
      devMsg.className = 'ai-msg bot-msg';
      devMsg.innerHTML = '<div class="msg-content"><strong>Gaurav Fartiyal</strong></div>';
      messagesContainer.appendChild(devMsg);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      return;
    }

    var privatePatterns = /(private|secret|password|credential|backend|database|user data|admin|order log|transaction ledger|payment details|user account|firestore rule|env var)/i;
    if (privatePatterns.test(q)) {
      var privMsg = document.createElement('div');
      privMsg.className = 'ai-msg bot-msg';
      privMsg.innerHTML = '<div class="msg-content">Sorry, The content is not publicly available.</div>';
      messagesContainer.appendChild(privMsg);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      return;
    }

    // Append Fast Loading Indicator
    var loadingMsg = document.createElement('div');
    loadingMsg.className = 'ai-msg bot-msg loading-msg';
    loadingMsg.innerHTML = '<div class="msg-content"><em>⚡ Answering...</em></div>';
    messagesContainer.appendChild(loadingMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Try server API first; seamlessly fall back to local knowledge engine for GitHub Pages & static hosting
    fetch('/api/ai/doubt-solver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        topic: topic, 
        question: q,
        pageInfo: pageOverview
      })
    })
    .then(function (res) {
      if (!res.ok) throw new Error('API Unavailable');
      return res.json();
    })
    .then(function (data) {
      loadingMsg.remove();
      var botMsg = document.createElement('div');
      botMsg.className = 'ai-msg bot-msg';
      var ansText = (data && data.answer) ? data.answer : getLocalKnowledgeAnswer(q, topic, pageOverview);
      botMsg.innerHTML = '<div class="msg-content">' + formatMarkdown(ansText) + '</div>';
      messagesContainer.appendChild(botMsg);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    })
    .catch(function () {
      // Offline / GitHub Pages fallback
      loadingMsg.remove();
      var botMsg = document.createElement('div');
      botMsg.className = 'ai-msg bot-msg';
      var ansText = getLocalKnowledgeAnswer(q, topic, pageOverview);
      botMsg.innerHTML = '<div class="msg-content">' + formatMarkdown(ansText) + '</div>';
      messagesContainer.appendChild(botMsg);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
  }

  function getLocalKnowledgeAnswer(query, currentTopic, pageInfo) {
    var lower = query.toLowerCase();

    // 1. Page / Menu overview query
    if (lower.indexOf('explain this page') !== -1 || lower.indexOf('what is this page') !== -1 || lower.indexOf('menu') !== -1 || lower.indexOf('topics are covered') !== -1 || lower.indexOf('about this page') !== -1) {
      var res = "### Overview of " + pageInfo.title + "\n\n";
      res += "You are currently on the **" + pageInfo.title + "** section of ShortStudy.\n\n";
      if (pageInfo.navLinks && pageInfo.navLinks.length > 0) {
        res += "**Navigation Menu:** " + pageInfo.navLinks.join(' | ') + "\n\n";
      }
      if (pageInfo.headings && pageInfo.headings.length > 0) {
        res += "**Key Curriculum Sections Available:**\n";
        pageInfo.headings.forEach(function(h) {
          res += "- " + h + "\n";
        });
        res += "\n";
      }
      res += "You can ask me to explain any of these topics, solve coding questions, or clarify syntax!";
      return res;
    }

    // 2. C & Memory Pointers
    if (lower.indexOf('pointer') !== -1 || lower.indexOf('malloc') !== -1 || lower.indexOf('memory') !== -1) {
      return "### Understanding Pointers & Memory in C\n\n" +
        "A **pointer** is a variable that stores the memory address of another variable.\n\n" +
        "```c\n" +
        "int num = 42;\n" +
        "int *ptr = &num; // ptr stores address of num\n\n" +
        "printf(\"Address: %p\\n\", ptr);   // Memory address\n" +
        "printf(\"Value: %d\\n\", *ptr);    // Dereferencing outputs 42\n" +
        "```\n\n" +
        "**Key Functions:**\n" +
        "- `malloc(bytes)`: Allocates uninitialized memory on the heap.\n" +
        "- `calloc(n, size)`: Allocates and zero-initializes memory.\n" +
        "- `free(ptr)`: Releases allocated heap memory back to the OS to prevent memory leaks.";
    }

    // 3. Java & OOP
    if (lower.indexOf('oop') !== -1 || lower.indexOf('pillar') !== -1 || lower.indexOf('polymorphism') !== -1 || lower.indexOf('encapsulation') !== -1 || lower.indexOf('inheritance') !== -1 || lower.indexOf('abstraction') !== -1) {
      return "### The 4 Pillars of Object-Oriented Programming (OOP)\n\n" +
        "1. **Encapsulation**: Bundling data (private fields) and methods together with getters/setters to protect state.\n" +
        "2. **Inheritance**: Subclass deriving attributes and methods from a superclass using `extends`.\n" +
        "3. **Polymorphism**: Ability of a method or object to take multiple forms (Compile-time overloading & Runtime method overriding with `@Override`).\n" +
        "4. **Abstraction**: Hiding internal complexities and exposing essential interfaces via `abstract` classes and `interface` definitions.\n\n" +
        "```java\n" +
        "abstract class Shape {\n" +
        "    abstract double getArea();\n" +
        "}\n\n" +
        "class Circle extends Shape {\n" +
        "    private double radius;\n" +
        "    public Circle(double r) { this.radius = r; }\n" +
        "    @Override\n" +
        "    double getArea() { return Math.PI * radius * radius; }\n" +
        "}\n" +
        "```";
    }

    // 4. Interface vs Abstract Class
    if (lower.indexOf('interface vs abstract') !== -1 || lower.indexOf('abstract vs interface') !== -1) {
      return "### Interface vs. Abstract Class in Java\n\n" +
        "| Feature | Interface | Abstract Class |\n" +
        "| :--- | :--- | :--- |\n" +
        "| **Inheritance** | Multiple interfaces can be implemented (`implements A, B`) | Single inheritance only (`extends Base`) |\n" +
        "| **State/Variables** | `public static final` constants only | Can have instance variables with any access modifier |\n" +
        "| **Constructors** | Cannot have constructors | Can define constructors for subclasses |\n" +
        "| **Methods** | Abstract, `default`, or `static` methods | Abstract or fully implemented concrete methods |";
    }

    // 5. HTML / CSS
    if (lower.indexOf('flexbox') !== -1 || lower.indexOf('grid') !== -1 || lower.indexOf('box model') !== -1 || lower.indexOf('z-index') !== -1 || lower.indexOf('css') !== -1 || lower.indexOf('html') !== -1) {
      return "### Modern CSS Layout & Box Model\n\n" +
        "**The Box Model**: Content ➔ Padding ➔ Border ➔ Margin.\n\n" +
        "**Flexbox vs Grid:**\n" +
        "- **Flexbox (1D)**: Perfect for aligning elements along a single row or column.\n" +
        "- **Grid (2D)**: Ideal for complex grid systems with both rows and columns simultaneously.\n\n" +
        "```css\n" +
        "/* Modern Centering with Flexbox */\n" +
        ".container {\n" +
        "  display: flex;\n" +
        "  justify-content: center; /* Main axis */\n" +
        "  align-items: center;     /* Cross axis */\n" +
        "  gap: 16px;\n" +
        "}\n" +
        "```";
    }

    // 6. SQL Queries & Joins
    if (lower.indexOf('sql') !== -1 || lower.indexOf('join') !== -1 || lower.indexOf('where') !== -1 || lower.indexOf('having') !== -1) {
      return "### SQL Query Fundamentals\n\n" +
        "**WHERE vs HAVING:**\n" +
        "- `WHERE` filters individual rows **before** any aggregation (`GROUP BY`) takes place.\n" +
        "- `HAVING` filters aggregated groups **after** `GROUP BY`.\n\n" +
        "```sql\n" +
        "SELECT department_id, COUNT(*) AS employee_count\n" +
        "FROM employees\n" +
        "WHERE salary > 50000        -- Filter rows first\n" +
        "GROUP BY department_id\n" +
        "HAVING COUNT(*) >= 5;       -- Filter groups\n" +
        "```\n\n" +
        "**Relational JOINs:**\n" +
        "- `INNER JOIN`: Returns records matching both tables.\n" +
        "- `LEFT JOIN`: Returns all records from the left table and matched records from the right table.";
    }

    // 7. Data Structures & Big-O
    if (lower.indexOf('big-o') !== -1 || lower.indexOf('time complexity') !== -1 || lower.indexOf('stack') !== -1 || lower.indexOf('queue') !== -1 || lower.indexOf('array') !== -1 || lower.indexOf('data structure') !== -1) {
      return "### Data Structures & Complexity Overview\n\n" +
        "**Big-O Hierarchy (Fastest to Slowest):**\n" +
        "`O(1)` (Constant) ➔ `O(log n)` (Binary Search) ➔ `O(n)` (Linear) ➔ `O(n log n)` (MergeSort) ➔ `O(n²)` (Nested Loops).\n\n" +
        "**Core Linear Structures:**\n" +
        "- **Array**: Contiguous memory, `O(1)` random index access.\n" +
        "- **Stack**: **LIFO** (Last In, First Out) with `push()` and `pop()` operations (e.g. browser history, undo stack).\n" +
        "- **Queue**: **FIFO** (First In, First Out) with `enqueue()` and `dequeue()` operations (e.g. CPU task scheduling).";
    }

    // 8. Python Basics
    if (lower.indexOf('python') !== -1 || lower.indexOf('mutable') !== -1 || lower.indexOf('tuple') !== -1 || lower.indexOf('list') !== -1) {
      return "### Python Data Types & Mutability\n\n" +
        "**Mutable vs. Immutable:**\n" +
        "- **Mutable** (Can be modified in place): `list`, `dict`, `set`.\n" +
        "- **Immutable** (Cannot be altered after creation): `int`, `float`, `str`, `tuple`, `bool`.\n\n" +
        "```python\n" +
        "# List vs Tuple\n" +
        "my_list = [1, 2, 3]\n" +
        "my_list.append(4)  # Allowed\n\n" +
        "my_tuple = (1, 2, 3)\n" +
        "# my_tuple[0] = 99 -> Raises TypeError (immutable)\n" +
        "```";
    }

    // 9. Online Test / Quizzes
    if (lower.indexOf('test') !== -1 || lower.indexOf('quiz') !== -1 || lower.indexOf('exam') !== -1) {
      return "### ShortStudy Online Testing Portal\n\n" +
        "You can practice multiple-choice assessments across programming tracks:\n" +
        "- Head over to the **Online Test** tab (`/test.html`).\n" +
        "- Select your subject (Python, C, Java, HTML/CSS, SQL, DSA).\n" +
        "- Pick a difficulty: **Easy** (10 questions), **Medium** (15 questions), or **Hard** (20 questions).\n" +
        "- Tests feature live countdown timers and immediate score analysis upon submission.";
    }

    // 10. Video Masterclasses & Courses
    if (lower.indexOf('video') !== -1 || lower.indexOf('masterclass') !== -1 || lower.indexOf('paid course') !== -1) {
      return "### Programming Video Masterclasses Hub\n\n" +
        "Our video library on the **Programming Video's** menu is built for hands-on, visual learning:\n" +
        "- **Step-by-Step Walkthroughs**: Watch experienced engineers build full-stack projects, write clean code, and debug real errors in real-time.\n" +
        "- **Lifetime On-Demand Access**: Learn at your own pace without time pressure or arbitrary deadlines.\n" +
        "- **Complete Source Code**: Download all project repositories, cheatsheets, and starter templates to code along side-by-side.\n" +
        "- **Instant Enrollment**: Seamless enrollment with cloud receipts and instant student dashboard access.";
    }

    // Default intelligent programming guidance
    return "### ShortStudy AI Assistant (" + currentTopic + ")\n\n" +
      "Thank you for asking: **\"" + escapeHtml(query) + "\"**.\n\n" +
      "Here is a complete breakdown:\n" +
      "- **Context**: In `" + currentTopic + "`, understanding core principles and applying clean syntax is key.\n" +
      "- **Best Practice**: Always break complex problems into smaller sub-tasks, write unit test cases, and verify edge conditions (like `null` checks or array boundaries).\n" +
      "- **Curriculum Access**: Check the free lecture notes on this page for in-depth diagrams and runnable examples!\n\n" +
      "Feel free to ask for specific code snippets or step-by-step algorithms on any programming topic.";
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatMarkdown(str) {
    if (!str) return '';
    var escaped = escapeHtml(str);

    // Code block formatting
    escaped = escaped.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, function (match, lang, code) {
      return '<pre class="ai-code-block"><code class="language-' + (lang || 'text') + '">' + code.trim() + '</code></pre>';
    });

    // Inline code
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers
    escaped = escaped.replace(/^### (.*$)/gim, '<h4 style="color:var(--yellow);margin:10px 0 4px;font-size:14px;">$1</h4>');
    escaped = escaped.replace(/^## (.*$)/gim, '<h3 style="color:var(--yellow);margin:12px 0 6px;font-size:15px;">$1</h3>');

    // Bold & Italic
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Unordered list items
    escaped = escaped.replace(/^- (.*$)/gim, '<li style="margin-left:14px;list-style:disc;">$1</li>');

    // Newlines to br (avoiding duplicate br after pre/headers/lists)
    escaped = escaped.replace(/\n\n/g, '<br><br>');
    escaped = escaped.replace(/\n/g, '<br>');
    escaped = escaped.replace(/<\/pre><br>/g, '</pre>');
    escaped = escaped.replace(/<\/h[34]><br>/g, '</h$1>');
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
