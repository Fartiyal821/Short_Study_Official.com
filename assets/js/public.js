import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { db } from "./firebase-config.js";

const pathwayGrid = document.getElementById("dynamic-pathway-grid") || document.querySelector(".class-grid");

let liveCourses = [];
let livePosts = [];

/**
 * Real-Time Listener for Courses on Public Index Page
 */
export function initPublicRealtimeSync() {
  if (!pathwayGrid) return;

  try {
    // 1. Subscribe to real-time courses
    const coursesQuery = query(collection(db, "courses"));
    onSnapshot(coursesQuery, (snapshot) => {
      if (!snapshot.empty) {
        liveCourses = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          // Include published and in_development courses in public curriculum
          if (data.status !== "draft") {
            liveCourses.push({ id: docSnap.id, ...data });
          }
        });
        // Sort courses by curriculum order
        liveCourses.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        renderDynamicPathway();
      }
    }, (err) => {
      console.warn("Public courses listener fallback:", err);
    });

    // 2. Subscribe to real-time posts
    const postsQuery = query(collection(db, "posts"));
    onSnapshot(postsQuery, (snapshot) => {
      if (!snapshot.empty) {
        livePosts = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.status !== "draft") {
            livePosts.push({ id: docSnap.id, ...data });
          }
        });
        livePosts.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        renderDynamicPathway();
      }
    }, (err) => {
      console.warn("Public posts listener fallback:", err);
    });

  } catch (e) {
    console.error("Failed to establish public onSnapshot listener:", e);
  }
}

/**
 * Render Pathway Cards Reactively
 */
function renderDynamicPathway() {
  if (!pathwayGrid || liveCourses.length === 0) return;

  pathwayGrid.innerHTML = "";

  liveCourses.forEach((course, index) => {
    const isInDevelopment = course.status === "in_development";
    const courseLessons = livePosts.filter(p => p.courseId === course.id);
    const firstLesson = courseLessons[0];
    const targetUrl = firstLesson ? `lesson.html?id=${firstLesson.id}` : `lesson.html?course=${course.id}`;
    const lessonCount = courseLessons.length;
    const hasVideo = courseLessons.some(p => p.youtubeEmbed && p.youtubeEmbed.trim() !== "");

    const card = document.createElement("div");
    card.className = "class-card";
    card.innerHTML = `
      <div class="tape"></div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
        <span class="num">COURSE 0${index + 1}</span>
        <div style="display:flex; gap:6px; align-items:center;">
          ${hasVideo ? '<span style="font-family:\'JetBrains Mono\',monospace; font-size:11px; color:#e11d48; background:rgba(225,29,72,0.1); padding:2px 8px; border-radius:12px;">▶ Video</span>' : ''}
          ${isInDevelopment ? '<span style="font-family:\'JetBrains Mono\',monospace; font-size:11px; font-weight:600; color:#b45309; background:#fef3c7; border:1px solid #fcd34d; padding:2px 8px; border-radius:12px;">🚧 In Development</span>' : ''}
        </div>
      </div>
      <h3>
        ${course.icon ? `<span style="margin-right:6px;">${escapeHtml(course.icon)}</span>` : ""}
        ${escapeHtml(course.title)}
      </h3>
      <p>${escapeHtml(course.description || "Structured written lesson pathway for beginners.")}</p>
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:12px; border-top:1px dashed var(--paper-line);">
        <span style="font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--ink-soft);">
          ${lessonCount} ${lessonCount === 1 ? "lesson" : "lessons"}
        </span>
        ${isInDevelopment 
          ? '<span class="go" style="color:var(--ink-soft); cursor:default; background:rgba(0,0,0,0.04); border:1px solid rgba(0,0,0,0.1); padding:4px 10px; border-radius:6px; font-size:12px;">In development</span>'
          : `<a href="${targetUrl}" class="go">Start course</a>`}
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
