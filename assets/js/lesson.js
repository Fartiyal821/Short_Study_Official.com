import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { sanitizeHTML, processYouTubeEmbed } from "./sanitizer.js";

// Parse URL Parameters
const urlParams = new URLSearchParams(window.location.search);
const lessonId = urlParams.get("id");
const lessonSlug = urlParams.get("slug");

// Elements
const el = {
  breadcrumbCourse: document.getElementById("breadcrumb-course"),
  breadcrumbLesson: document.getElementById("breadcrumb-lesson"),
  readingTime: document.getElementById("reading-time"),
  lessonTitle: document.getElementById("lesson-title"),
  lessonExcerpt: document.getElementById("lesson-excerpt"),
  lessonAuthor: document.getElementById("lesson-author"),
  videoContainer: document.getElementById("lesson-video-container"),
  videoFrameWrapper: document.getElementById("lesson-video-wrapper"),
  lessonContent: document.getElementById("lesson-body-content"),
  courseOutlineList: document.getElementById("course-outline-list"),
  courseOutlineTitle: document.getElementById("course-outline-title"),
  prevLessonBtn: document.getElementById("prev-lesson-btn"),
  nextLessonBtn: document.getElementById("next-lesson-btn"),
  liveSyncStatus: document.getElementById("live-sync-indicator")
};

let currentPost = null;
let siblingLessons = [];

// Fallback lesson for initial preview if Firestore doc doesn't exist yet
const sampleLesson = {
  id: "sample-python",
  title: "Python Variables, Scope & Data Types",
  courseTitle: "Python Basics",
  courseId: "course-python",
  readingTime: "6 min read",
  author: "Gaurav Fartiyal",
  excerpt: "Master how Python allocates memory for variables, handles dynamic typing, and executes control flow constructs from scratch.",
  youtubeEmbed: '<iframe src="https://www.youtube-nocookie.com/embed/kqtD5dpn9C8" title="Python Tutorial" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>',
  content: `
    <h2>1. What is a Variable in Python?</h2>
    <p>Unlike languages like C or Java where variables are strongly typed memory containers, in Python a variable is simply a <strong>name (or reference)</strong> attached to an object in memory.</p>
    <pre><code># Creating variables
student_name = "Alex"
student_age = 20
gpa = 3.85
is_enrolled = True

print(f"Student: {student_name}, Age: {student_age}")
print(f"Type of gpa: {type(gpa)}")</code></pre>

    <h2>2. Dynamic Typing &amp; Reassignment</h2>
    <p>Python variables are dynamically typed. The interpreter determines the variable type at runtime based on the value assigned.</p>
    <pre><code>val = 100         # val is an integer
val = "Now a string" # val now references a string object</code></pre>

    <h2>3. Common Built-in Data Types</h2>
    <ul>
      <li><strong>Numeric:</strong> <code>int</code>, <code>float</code>, <code>complex</code></li>
      <li><strong>Sequence:</strong> <code>list</code>, <code>tuple</code>, <code>range</code></li>
      <li><strong>Text:</strong> <code>str</code></li>
      <li><strong>Mapping:</strong> <code>dict</code></li>
      <li><strong>Set:</strong> <code>set</code>, <code>frozenset</code></li>
      <li><strong>Boolean:</strong> <code>bool</code> (True / False)</li>
    </ul>

    <h2>4. Variable Naming Rules &amp; Best Practices</h2>
    <p>Always use <em>snake_case</em> for standard variables and functions, according to PEP 8 conventions. Never use reserved keywords such as <code>def</code>, <code>class</code>, <code>if</code>, or <code>import</code> as identifier names.</p>
  `
};

/**
 * Start Real-Time Listener on the requested Lesson Document
 */
function initLessonListener() {
  if (!lessonId && !lessonSlug) {
    // Render sample default lesson
    renderLesson(sampleLesson);
    return;
  }

  if (lessonId) {
    try {
      const docRef = doc(db, "posts", lessonId);
      // Real-time listener: onSnapshot
      onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          currentPost = { id: docSnap.id, ...docSnap.data() };
          renderLesson(currentPost);
          loadCourseSiblings(currentPost.courseId);
          if (el.liveSyncStatus) el.liveSyncStatus.textContent = "Live Synced with Firestore";
        } else {
          // If document not found in Firestore, fallback to sample
          renderLesson({ ...sampleLesson, title: "Lesson Not Found (Showing Sample)", id: lessonId });
        }
      }, (error) => {
        console.warn("Firestore lesson listener warning:", error);
        renderLesson(sampleLesson);
      });
    } catch (err) {
      console.error("Failed to bind snapshot listener:", err);
      renderLesson(sampleLesson);
    }
  } else if (lessonSlug) {
    try {
      const q = query(collection(db, "posts"), where("slug", "==", lessonSlug));
      onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          currentPost = { id: docSnap.id, ...docSnap.data() };
          renderLesson(currentPost);
          loadCourseSiblings(currentPost.courseId);
        } else {
          renderLesson(sampleLesson);
        }
      });
    } catch (err) {
      console.error("Slug query error:", err);
      renderLesson(sampleLesson);
    }
  }
}

/**
 * Load other lessons in the same course via onSnapshot
 */
function loadCourseSiblings(courseId) {
  if (!courseId) return;
  try {
    const siblingsQuery = query(collection(db, "posts"), where("courseId", "==", courseId), orderBy("order", "asc"));
    onSnapshot(siblingsQuery, (snapshot) => {
      siblingLessons = [];
      snapshot.forEach((snap) => {
        siblingLessons.push({ id: snap.id, ...snap.data() });
      });
      renderCourseSidebar(siblingLessons);
    }, (err) => {
      console.warn("Siblings listener warning:", err);
    });
  } catch (err) {
    console.error("Siblings query error:", err);
  }
}

/**
 * Render Lesson Details with DOMPurify sanitization
 */
function renderLesson(post) {
  document.title = `${post.title} — ShortStudy`;

  // Breadcrumbs & Meta
  if (el.breadcrumbCourse) {
    el.breadcrumbCourse.textContent = post.courseTitle || "Programming Pathway";
  }
  if (el.breadcrumbLesson) {
    el.breadcrumbLesson.textContent = post.title;
  }
  if (el.readingTime) {
    el.readingTime.textContent = post.readingTime || "5 min read";
  }
  if (el.lessonTitle) {
    el.lessonTitle.textContent = post.title;
  }
  if (el.lessonExcerpt) {
    el.lessonExcerpt.textContent = post.excerpt || "";
  }
  if (el.lessonAuthor) {
    el.lessonAuthor.textContent = post.author || "ShortStudy Editorial";
  }

  // YouTube Video Embed Section
  if (post.youtubeEmbed && post.youtubeEmbed.trim() !== "") {
    const processed = processYouTubeEmbed(post.youtubeEmbed);
    if (processed.isValid && processed.iframeHtml) {
      el.videoFrameWrapper.innerHTML = processed.iframeHtml;
      el.videoContainer.style.display = "block";
    } else {
      // Direct raw embed sanitized via DOMPurify
      el.videoFrameWrapper.innerHTML = sanitizeHTML(post.youtubeEmbed);
      el.videoContainer.style.display = "block";
    }
  } else {
    el.videoContainer.style.display = "none";
    el.videoFrameWrapper.innerHTML = "";
  }

  // Educational Content Sanitization via DOMPurify
  const cleanContent = sanitizeHTML(post.content);
  el.lessonContent.innerHTML = cleanContent;

  // Enhance Code Blocks with Copy Button
  enhanceCodeBlocks();
}

/**
 * Render the Course Outline in the right-hand sidebar
 */
function renderCourseSidebar(lessons) {
  if (!el.courseOutlineList) return;
  el.courseOutlineList.innerHTML = "";

  if (lessons.length === 0) {
    el.courseOutlineList.innerHTML = `<li style="font-size: 13px; color: var(--ink-soft); padding: 8px 0;">No other lessons in this course yet.</li>`;
    return;
  }

  const currentId = currentPost ? currentPost.id : lessonId;

  lessons.forEach((l, idx) => {
    const li = document.createElement("li");
    const isActive = l.id === currentId || l.slug === lessonSlug;
    li.innerHTML = `
      <a href="lesson.html?id=${l.id}" class="${isActive ? "active" : ""}" style="display: flex; align-items: baseline; gap: 8px; font-size: 14px; padding: 6px 0; color: ${isActive ? "var(--pink-dark)" : "var(--ink)"}; font-weight: ${isActive ? "700" : "500"};">
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; opacity: 0.6;">0${idx + 1}.</span>
        <span style="flex: 1;">${escapeHtml(l.title)}</span>
        ${isActive ? '<span style="font-size: 12px; color: var(--pink-dark);">●</span>' : ''}
      </a>
    `;
    el.courseOutlineList.appendChild(li);
  });

  // Setup Next / Prev buttons
  const currentIndex = lessons.findIndex(l => l.id === currentId);
  if (currentIndex > 0) {
    const prev = lessons[currentIndex - 1];
    el.prevLessonBtn.href = `lesson.html?id=${prev.id}`;
    el.prevLessonBtn.style.visibility = "visible";
    el.prevLessonBtn.querySelector(".nav-btn-title").textContent = prev.title;
  } else {
    el.prevLessonBtn.style.visibility = "hidden";
  }

  if (currentIndex !== -1 && currentIndex < lessons.length - 1) {
    const next = lessons[currentIndex + 1];
    el.nextLessonBtn.href = `lesson.html?id=${next.id}`;
    el.nextLessonBtn.style.visibility = "visible";
    el.nextLessonBtn.querySelector(".nav-btn-title").textContent = next.title;
  } else {
    el.nextLessonBtn.style.visibility = "hidden";
  }
}

/**
 * Add interactive 'Copy Code' buttons to all <pre><code> snippets
 */
function enhanceCodeBlocks() {
  const codeBlocks = el.lessonContent.querySelectorAll("pre");
  codeBlocks.forEach((pre) => {
    // Avoid duplicate buttons
    if (pre.querySelector(".code-copy-btn")) return;

    pre.style.position = "relative";
    const copyBtn = document.createElement("button");
    copyBtn.className = "code-copy-btn";
    copyBtn.textContent = "Copy";
    copyBtn.setAttribute("aria-label", "Copy code snippet");

    copyBtn.addEventListener("click", () => {
      const code = pre.querySelector("code") ? pre.querySelector("code").innerText : pre.innerText;
      navigator.clipboard.writeText(code).then(() => {
        copyBtn.textContent = "Copied!";
        copyBtn.classList.add("copied");
        setTimeout(() => {
          copyBtn.textContent = "Copy";
          copyBtn.classList.remove("copied");
        }, 2000);
      });
    });

    pre.appendChild(copyBtn);
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Initialize on load
initLessonListener();
