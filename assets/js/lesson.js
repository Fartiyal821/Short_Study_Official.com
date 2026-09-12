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
import { parseAndFormatLessonContent } from "./content-format.js";
import { PRE_EXISTING_LESSONS, PRE_EXISTING_COURSES } from "./catalog-data.js";

// Parse URL Parameters
const urlParams = new URLSearchParams(window.location.search);
const lessonId = urlParams.get("id");
const lessonSlug = urlParams.get("slug");
const courseParam = urlParams.get("course");

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

// Fallback lesson for initial preview
const sampleLesson = PRE_EXISTING_LESSONS[0];

/**
 * Find fallback lesson from catalog
 */
function findCatalogLesson(idOrSlug, courseId) {
  if (idOrSlug) {
    const found = PRE_EXISTING_LESSONS.find(l => l.id === idOrSlug || l.slug === idOrSlug);
    if (found) return found;
  }
  if (courseId) {
    const foundByCourse = PRE_EXISTING_LESSONS.find(l => l.courseId === courseId || l.courseId === `course-${courseId}`);
    if (foundByCourse) return foundByCourse;
  }
  return sampleLesson;
}

/**
 * Start Real-Time Listener on the requested Lesson Document
 */
function initLessonListener() {
  const catalogFallback = findCatalogLesson(lessonId || lessonSlug, courseParam);
  // Render catalog fallback immediately for fast perceived performance
  renderLesson(catalogFallback);
  loadCourseSiblings(catalogFallback.courseId);

  if (!lessonId && !lessonSlug && !courseParam) {
    return;
  }

  if (lessonId) {
    try {
      const docRef = doc(db, "posts", lessonId);
      onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          currentPost = { id: docSnap.id, ...docSnap.data() };
          renderLesson(currentPost);
          loadCourseSiblings(currentPost.courseId);
          if (el.liveSyncStatus) el.liveSyncStatus.textContent = "Live Synced with Firestore";
        }
      }, (error) => {
        console.warn("Firestore lesson listener warning:", error);
      });
    } catch (err) {
      console.error("Failed to bind snapshot listener:", err);
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
        }
      });
    } catch (err) {
      console.error("Slug query error:", err);
    }
  }
}

/**
 * Load other lessons in the same course via onSnapshot
 */
function loadCourseSiblings(courseId) {
  if (!courseId) return;

  const catalogSiblings = PRE_EXISTING_LESSONS.filter(l => l.courseId === courseId || l.courseId === `course-${courseId}`);
  renderCourseSidebar(catalogSiblings);

  try {
    const siblingsQuery = query(collection(db, "posts"), where("courseId", "==", courseId), orderBy("order", "asc"));
    onSnapshot(siblingsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const firestoreSiblings = [];
        snapshot.forEach((snap) => {
          firestoreSiblings.push({ id: snap.id, ...snap.data() });
        });

        // Merge with catalog
        const map = new Map();
        catalogSiblings.forEach(s => map.set(s.id, s));
        firestoreSiblings.forEach(s => map.set(s.id, s));

        siblingLessons = Array.from(map.values());
        siblingLessons.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        renderCourseSidebar(siblingLessons);
      }
    }, (err) => {
      console.warn("Siblings listener warning:", err);
    });
  } catch (err) {
    console.error("Siblings query error:", err);
  }
}

/**
 * Render Lesson Details with semantic alignment & DOMPurify
 */
function renderLesson(post) {
  if (!post) return;
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
      el.videoFrameWrapper.innerHTML = sanitizeHTML(post.youtubeEmbed);
      el.videoContainer.style.display = "block";
    }
  } else {
    el.videoContainer.style.display = "none";
    el.videoFrameWrapper.innerHTML = "";
  }

  // Parse and format educational content to guarantee semantic alignment
  const rawOrFormatted = post.formattedHtml || post.content || "";
  const alignedContent = parseAndFormatLessonContent(rawOrFormatted);
  el.lessonContent.innerHTML = alignedContent;

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
