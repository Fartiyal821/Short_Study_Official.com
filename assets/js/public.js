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
    const coursesQuery = query(collection(db, "courses"), orderBy("order", "asc"));
    onSnapshot(coursesQuery, (snapshot) => {
      if (!snapshot.empty) {
        liveCourses = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.status === "published" || !data.status) {
            liveCourses.push({ id: docSnap.id, ...data });
          }
        });
        renderDynamicPathway();
      }
    }, (err) => {
      console.warn("Public courses listener fallback:", err);
    });

    // 2. Subscribe to real-time posts
    const postsQuery = query(collection(db, "posts"), orderBy("order", "asc"));
    onSnapshot(postsQuery, (snapshot) => {
      if (!snapshot.empty) {
        livePosts = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.status === "published" || !data.status) {
            livePosts.push({ id: docSnap.id, ...data });
          }
        });
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
    const courseLessons = livePosts.filter(p => p.courseId === course.id);
    const firstLesson = courseLessons[0];
    const targetUrl = firstLesson ? `lesson.html?id=${firstLesson.id}` : `lesson.html?course=${course.id}`;
    const lessonCount = courseLessons.length;
    const hasVideo = courseLessons.some(p => p.youtubeEmbed && p.youtubeEmbed.trim() !== "");

    const card = document.createElement("div");
    card.className = "class-card";
    card.innerHTML = `
      <div class="tape"></div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span class="num">COURSE 0${index + 1}</span>
        ${hasVideo ? '<span style="font-family:\'JetBrains Mono\',monospace; font-size:11px; color:#e11d48; background:rgba(225,29,72,0.1); padding:2px 8px; border-radius:12px;">▶ Video Lessons</span>' : ''}
      </div>
      <h3>${course.icon ? `<span style="margin-right:6px;">${escapeHtml(course.icon)}</span>` : ""}${escapeHtml(course.title)}</h3>
      <p>${escapeHtml(course.description || "Structured written lesson pathway for beginners.")}</p>
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:auto; padding-top:12px; border-top:1px dashed var(--paper-line);">
        <span style="font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--ink-soft);">
          ${lessonCount} ${lessonCount === 1 ? "lesson" : "lessons"}
        </span>
        <a href="${targetUrl}" class="go">Start course</a>
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
