import { 
  collection, 
  onSnapshot, 
  query 
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { 
  PRE_EXISTING_COURSES, 
  PRE_EXISTING_LESSONS,
  DEFAULT_COURSE_IDS,
  DEFAULT_POST_IDS
} from "./catalog-data.js";

const pathwayGrid = document.getElementById("dynamic-pathway-grid") || document.querySelector(".class-grid");

let liveCourses = [...PRE_EXISTING_COURSES].filter(c => !DEFAULT_COURSE_IDS.has(c.id));
let livePosts = [...PRE_EXISTING_LESSONS].filter(p => !DEFAULT_POST_IDS.has(p.id));

/**
 * Real-Time Listener for Courses on Public Index Page
 */
export function initPublicRealtimeSync() {
  if (!pathwayGrid) return;

  // Initial render from base catalog
  renderDynamicPathway();

  try {
    // 1. Subscribe to real-time courses
    const coursesQuery = query(collection(db, "courses"));
    onSnapshot(coursesQuery, (snapshot) => {
      if (!snapshot.empty) {
        const firestoreCourses = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.status !== "draft" && !data.isDeleted && !DEFAULT_COURSE_IDS.has(docSnap.id) && !DEFAULT_COURSE_IDS.has(data.slug)) {
            firestoreCourses.push({ id: docSnap.id, ...data });
          }
        });

        const merged = new Map();
        PRE_EXISTING_COURSES.forEach(c => {
          if (!DEFAULT_COURSE_IDS.has(c.id) && !DEFAULT_COURSE_IDS.has(c.slug)) merged.set(c.id, { ...c });
        });
        firestoreCourses.forEach(c => merged.set(c.id, { ...(merged.get(c.id) || {}), ...c }));

        liveCourses = Array.from(merged.values()).filter(c => !DEFAULT_COURSE_IDS.has(c.id) && !DEFAULT_COURSE_IDS.has(c.slug));
        liveCourses.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        renderDynamicPathway();
      }
    }, () => {
      renderDynamicPathway();
    });

    // 2. Subscribe to real-time posts
    const postsQuery = query(collection(db, "posts"));
    onSnapshot(postsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const firestorePosts = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.status !== "draft" && !data.isDeleted && !DEFAULT_POST_IDS.has(docSnap.id) && !DEFAULT_POST_IDS.has(data.slug)) {
            firestorePosts.push({ id: docSnap.id, ...data });
          }
        });

        const mergedPosts = new Map();
        PRE_EXISTING_LESSONS.forEach(l => {
          if (!DEFAULT_POST_IDS.has(l.id) && !DEFAULT_POST_IDS.has(l.slug)) mergedPosts.set(l.id, { ...l });
        });
        firestorePosts.forEach(p => mergedPosts.set(p.id, { ...(mergedPosts.get(p.id) || {}), ...p }));

        livePosts = Array.from(mergedPosts.values()).filter(p => !DEFAULT_POST_IDS.has(p.id) && !DEFAULT_POST_IDS.has(p.slug));
        livePosts.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        renderDynamicPathway();
      }
    }, () => {
      renderDynamicPathway();
    });

  } catch (e) {
    renderDynamicPathway();
  }
}

/**
 * Render Pathway Cards Reactively
 */
function renderDynamicPathway() {
  if (!pathwayGrid) return;

  if (liveCourses.length === 0) {
    pathwayGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; background: #ffffff; border-radius: 12px; border: 1px dashed var(--paper-line); width: 100%;">
        <span style="font-size: 32px; display: block; margin-bottom: 8px;">📚</span>
        <h3 style="font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">No Courses Published Yet</h3>
        <p style="color: #64748b; font-size: 13.5px; max-width: 400px; margin: 0 auto 12px;">
          New courses published in the Admin Panel will be listed here automatically.
        </p>
        
      </div>
    `;
    return;
  }

  pathwayGrid.innerHTML = "";

  liveCourses.forEach((course, index) => {
    // Map directly to verified static html lessons
    const staticMap = {
      "python-basics": "python-basics.html",
      "c-basics": "c-basics.html",
      "data-structures-arrays": "data-structures-arrays.html",
      "java-oop-concepts": "java-oop-basics.html",
      "java-oop-basics": "java-oop-basics.html",
      "html-css-basics": "html-css-basics.html",
      "sql-basics": "sql-basics.html"
    };

    const courseLessons = livePosts.filter(p => p.courseId === course.id || p.courseId === course.slug);
    const targetUrl = course.staticUrl || staticMap[course.id] || staticMap[course.slug] || `${course.slug || course.id}.html`;
    const lessonCount = Math.max(courseLessons.length, 1);
    const hasVideo = courseLessons.some(p => p.youtubeEmbed && p.youtubeEmbed.trim() !== "");

    const card = document.createElement("div");
    card.className = "class-card";
    card.innerHTML = `
      <div class="tape"></div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
        <span class="num">COURSE 0${index + 1}</span>
        <div style="display:flex; gap:6px; align-items:center;">
          ${hasVideo ? '<span style="font-family:\'JetBrains Mono\',monospace; font-size:12px; color:#e11d48; background:rgba(225,29,72,0.1); padding:2px 8px; border-radius:12px;">▶ Video</span>' : ''}
        </div>
      </div>
      <h3>
        ${course.icon ? `<span style="margin-right:6px;">${escapeHtml(course.icon)}</span>` : ""}
        ${escapeHtml(course.title)}
      </h3>
      <p>${escapeHtml(course.description || "Structured written lesson pathway for beginners.")}</p>
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:12px; border-top:1px dashed var(--paper-line);">
        <span style="font-family:'JetBrains Mono',monospace; font-size:13px; color:var(--ink-soft);">
          ${lessonCount} ${lessonCount === 1 ? "lesson" : "lessons"}
        </span>
        <a href="${targetUrl}" class="go">Start course →</a>
      </div>
    `;
    pathwayGrid.appendChild(card);
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Auto-run on index load
initPublicRealtimeSync();
