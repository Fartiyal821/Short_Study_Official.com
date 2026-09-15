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
const sampleLesson = PRE_EXISTING_LESSONS[0] || null;

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
  if (catalogFallback) {
    renderLesson(catalogFallback);
    if (catalogFallback.courseId) loadCourseSiblings(catalogFallback.courseId);
  } else {
    if (el.lessonTitle) el.lessonTitle.textContent = "Lesson";
    if (el.lessonContent) el.lessonContent.innerHTML = "<p style='color: var(--ink-soft);'>Waiting for published lesson data...</p>";
  }

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
      }, (err) => {
        console.warn("Firestore slug listener warning:", err);
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

  // Multiple Videos or Single YouTube Video Embed Section
  const videosList = (Array.isArray(post.videos) && post.videos.length > 0)
    ? post.videos
    : (post.youtubeEmbed && post.youtubeEmbed.trim() !== "")
      ? [{ id: "v-1", title: post.title || "Lesson Video", videoUrl: post.youtubeEmbed, description: "" }]
      : [];

  if (videosList.length > 0) {
    el.videoContainer.style.display = "block";

    const renderActiveVideo = (index) => {
      const v = videosList[index];
      if (!v) return;

      let processed = processYouTubeEmbed(v.videoUrl || v.url || "");
      let embedHtml = (processed.isValid && processed.iframeHtml) ? processed.iframeHtml : sanitizeHTML(v.videoUrl || "");
      if (!embedHtml && v.videoUrl) {
        let embedSrc = v.videoUrl.replace("watch?v=", "embed/");
        embedHtml = `<iframe src="${escapeHtml(embedSrc)}" frameborder="0" allowfullscreen style="width:100%; height:100%; border-radius:8px;"></iframe>`;
      }

      // Format plain text description (convert line breaks to <br>)
      const rawDesc = v.description || "";
      const formattedDesc = escapeHtml(rawDesc).replace(/\n/g, "<br>");

      const playlistHtml = videosList.length > 1 ? `
        <div style="margin-top: 14px; background: rgba(0, 0, 0, 0.03); border: 1px solid var(--paper-line); border-radius: 8px; padding: 12px;">
          <div style="font-size: 12px; font-weight: 700; color: var(--ink); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span>📹 Lesson Videos (${videosList.length})</span>
            <span style="font-size: 11px; color: var(--ink-soft); font-weight: 400;">Select video to play</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; max-height: 200px; overflow-y: auto;">
            ${videosList.map((item, idx) => `
              <button type="button" class="lesson-v-playlist-btn" data-idx="${idx}" style="display: flex; align-items: center; justify-content: space-between; text-align: left; padding: 8px 12px; border-radius: 6px; font-size: 13px; border: 1px solid ${idx === index ? 'var(--pink-dark)' : 'var(--paper-line)'}; background: ${idx === index ? 'rgba(225, 29, 72, 0.08)' : 'var(--paper)'}; color: var(--ink); cursor: pointer; font-weight: ${idx === index ? '700' : '500'}; transition: all 0.2s;">
                <span>▶ ${idx + 1}. ${escapeHtml(item.title || `Video ${idx + 1}`)}</span>
                <span style="font-size: 11px; color: ${idx === index ? 'var(--pink-dark)' : 'var(--ink-soft)'}; font-weight: 700;">${idx === index ? 'Now Playing' : 'Play'}</span>
              </button>
            `).join('')}
          </div>
        </div>
      ` : '';

      const descHtml = rawDesc.trim() !== "" ? `
        <div style="margin-top: 12px; padding: 12px 14px; background: rgba(0, 0, 0, 0.02); border-left: 3px solid var(--pink-dark); border-radius: 4px; font-size: 13.5px; line-height: 1.6; color: var(--ink);">
          <div style="font-size: 11px; font-weight: 700; color: var(--ink-soft); text-transform: uppercase; margin-bottom: 4px;">Video Overview</div>
          <div>${formattedDesc}</div>
        </div>
      ` : '';

      el.videoFrameWrapper.innerHTML = `
        <div class="video-aspect" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px; background: #000;">
          <div style="position: absolute; top:0; left:0; width:100%; height:100%;">
            ${embedHtml}
          </div>
        </div>
        ${descHtml}
        ${playlistHtml}
      `;

      el.videoFrameWrapper.querySelectorAll(".lesson-v-playlist-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.dataset.idx, 10);
          renderActiveVideo(idx);
        });
      });
    };

    renderActiveVideo(0);
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
