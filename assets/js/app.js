import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { app, db, firebaseConfig } from "./firebase-config.js";
import { PRE_EXISTING_COURSES } from "./catalog-data.js";

export { app, db, firebaseConfig };

// Dynamic Real-time in-memory states synchronized from Firestore
let cachedCourses = [...PRE_EXISTING_COURSES];
let purchasedCourseIdsFromOrders = new Set();
let activeCheckoutCourseId = null;

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Check if a course is unlocked based on real-time Firestore purchase state.
 * Access is STRICTLY granted only if isPurchased: true in Firestore.
 */
export function isCourseUnlocked(courseId, courseDoc = null) {
  if (!courseId) return false;

  // 1. Direct check on provided course object from Firestore snapshot
  if (courseDoc) {
    if (courseDoc.isPurchased === true || courseDoc.purchased === true) {
      return true;
    }
    if (courseDoc.isPurchased === false || courseDoc.purchased === false) {
      return purchasedCourseIdsFromOrders.has(courseId);
    }
  }

  // 2. Direct check in cached Firestore courses collection
  const found = cachedCourses.find((c) => c.id === courseId);
  if (found) {
    if (found.isPurchased === true || found.purchased === true) {
      return true;
    }
    if (found.isPurchased === false || found.purchased === false) {
      return purchasedCourseIdsFromOrders.has(courseId);
    }
  }

  // 3. Check if user or admin granted access via Firestore course_orders snapshot
  return purchasedCourseIdsFromOrders.has(courseId);
}

/**
 * Normalizes course video structures (supporting both multi-video arrays and legacy single video fields).
 */
export function normalizeCourseVideos(course) {
  if (!course) return [];
  if (Array.isArray(course.videos) && course.videos.length > 0) {
    return course.videos.map((v, idx) => ({
      id: v.id || `vid_${idx + 1}`,
      url: v.url || v.videoUrl || v.videoEmbed || v.embedCode || "",
      embedCode: v.embedCode || (String(v.url || "").includes("<iframe") ? v.url : ""),
      embedUrl: v.embedUrl || "",
      videoId: v.videoId || "",
      title: v.title || `Lecture ${idx + 1}`,
      description: v.description || v.videoDescription || v.videoNotes || "",
      order: v.order || idx + 1
    }));
  }

  const rawVideo = course.videoEmbed || course.videoUrl || course.videoEmbedUrl || course.youtubeUrl || "";
  const rawDesc = course.videoDescription || course.videoNotes || course.description || "";
  if (rawVideo || rawDesc) {
    return [{
      id: "vid_1",
      url: rawVideo,
      embedCode: rawVideo.includes("<iframe") ? rawVideo : "",
      embedUrl: "",
      videoId: "",
      title: course.title ? `${course.title} - Main Masterclass Lecture` : "Lecture 1: Full Masterclass",
      description: rawDesc,
      order: 1
    }];
  }

  return [];
}

/**
 * Parses any YouTube embed/iframe code or direct YouTube URL into a responsive, clean player iframe.
 * Disguises standard YouTube branding with clean controls, no related external videos, and privacy-enhanced origin.
 */
function buildYouTubeIframeHtml(videoInput) {
  if (!videoInput || !String(videoInput).trim()) return null;
  const raw = String(videoInput).trim();

  // Case 1: Raw iframe code pasted by user
  if (raw.includes("<iframe")) {
    const srcMatch = raw.match(/src=["']([^"']+)["']/i);
    if (srcMatch && srcMatch[1]) {
      let src = srcMatch[1];
      if (src.includes("youtube.com") || src.includes("youtu.be")) {
        // Disguise YouTube params for clean studio playback
        const joiner = src.includes("?") ? "&" : "?";
        src += `${joiner}autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&showinfo=0&playsinline=1&controls=1&color=white`;
      }
      return `<iframe src="${escapeHTML(src)}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    }
    return raw.replace(/<iframe/i, '<iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"');
  }

  // Case 2: Extract YouTube video ID
  let videoId = "";
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|shorts\/)([^"&?\/\s]{11})/i;
  const match = raw.match(regExp);
  if (match && match[1]) {
    videoId = match[1];
  } else if (raw.length === 11 && !raw.includes("/") && !raw.includes(".")) {
    videoId = raw;
  }

  if (videoId) {
    // Studio-grade clean embed without distracting recommended videos or branding overlays
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&showinfo=0&playsinline=1&controls=1&color=white`;
    return `<iframe src="${escapeHTML(embedUrl)}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
  }

  // Case 3: Other direct video URL or custom stream
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return `<iframe src="${escapeHTML(raw)}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
  }

  return null;
}

/**
 * Injects the chalkboard-themed multi-video player modal into the DOM.
 * Left Side: Active video player + active lecture description.
 * Right Side: Interactive playlist of all course videos (including first and subsequent videos).
 */
function ensureVideoModal() {
  if (document.getElementById("student-course-video-modal")) return;

  const videoOverlay = document.createElement("div");
  videoOverlay.id = "student-course-video-modal";
  videoOverlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(10, 15, 12, 0.94);
    backdrop-filter: blur(10px);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    padding: 16px;
    box-sizing: border-box;
  `;

  videoOverlay.innerHTML = `
    <div id="student-course-video-card" style="
      background: #18221B;
      color: #F5F3EA;
      border: 2px solid #F2C94C;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.9);
      border-radius: 14px;
      width: 100%;
      max-width: 1220px;
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-sizing: border-box;
    ">
      <!-- Modal Header -->
      <div style="padding: 14px 20px; background: #23312A; border-bottom: 2px solid #F2C94C; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
          <span style="font-size: 22px; flex-shrink: 0;">🎬</span>
          <div style="min-width: 0;">
            <h3 id="student-video-course-title" style="color: #F2C94C; font-family: 'Kalam', cursive, sans-serif; font-size: 19px; margin: 0; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Course Title</h3>
            <div id="student-video-course-subtitle" style="color: #F5F3EA; font-size: 12px; opacity: 0.9;">ShortStudy Masterclass • Full Video Access Unlocked</div>
          </div>
        </div>
        <button type="button" id="close-student-video-modal" aria-label="Close" style="background: rgba(242, 201, 76, 0.15); border: 1px solid rgba(242, 201, 76, 0.4); color: #F2C94C; font-size: 18px; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0;" title="Close">✕</button>
      </div>

      <!-- Split Stage Layout (Player Left + Playlist Right) -->
      <div id="student-video-split-container" style="
        display: flex;
        flex-direction: row;
        flex: 1;
        overflow: hidden;
        min-height: 480px;
      ">
        <!-- LEFT: Active Video Stage & Notes -->
        <div style="
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          background: #131c16;
          border-right: 2px solid rgba(242, 201, 76, 0.35);
        ">
          <!-- 16:9 Cinema Player Box -->
          <div id="student-video-player-box" style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; background: #060a08; overflow: hidden; flex-shrink: 0;">
            <!-- Video Iframe will be injected here -->
          </div>

          <!-- Active Lecture Details -->
          <div style="padding: 20px; background: #18221B; flex: 1;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid rgba(242, 201, 76, 0.25); padding-bottom: 10px; flex-wrap: wrap; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span id="active-lecture-badge" style="background: #F2C94C; color: #18221B; font-weight: 800; font-size: 12px; padding: 3px 8px; border-radius: 4px;">Lecture 1</span>
                <h4 id="active-lecture-title" style="color: #F2C94C; font-family: 'Kalam', cursive, sans-serif; font-size: 18px; margin: 0; font-weight: 700;">Lecture Overview</h4>
              </div>
              <span id="student-video-instructor-badge" style="background: rgba(242, 201, 76, 0.15); color: #F2C94C; font-size: 12px; padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(242, 201, 76, 0.3);">🧑‍🏫 ShortStudy</span>
            </div>

            <div style="font-size: 13px; color: #F2C94C; font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <span>📝</span>
              <span>Lecture Description &amp; Study Notes:</span>
            </div>
            <div id="student-video-description-body" style="color: #F5F3EA; font-size: 14px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              Course study notes and chapter resources.
            </div>
          </div>
        </div>

        <!-- RIGHT: Interactive Course Playlist Sidebar -->
        <div style="
          width: 340px;
          min-width: 280px;
          flex-shrink: 0;
          background: #1b2620;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        ">
          <div style="padding: 14px 16px; background: #23312A; border-bottom: 1px solid rgba(242, 201, 76, 0.3); display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px;">📚</span>
              <span style="font-weight: 700; color: #F2C94C; font-size: 14px;">Course Lectures</span>
            </div>
            <span id="student-video-playlist-count" style="background: rgba(242, 201, 76, 0.2); color: #F2C94C; font-size: 11.5px; font-weight: 700; padding: 2px 7px; border-radius: 12px; border: 1px solid rgba(242, 201, 76, 0.35);">1 Video</span>
          </div>

          <div style="padding: 8px 16px; background: rgba(0,0,0,0.2); font-size: 11.5px; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.05);">
            Select any lecture below to play immediately:
          </div>

          <div id="student-video-playlist-container" style="
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
          ">
            <!-- Dynamic playlist items rendered here -->
          </div>
        </div>
      </div>
    </div>
  `;

  // Inject responsive breakpoint style for mobile/stacked screens
  const responsiveStyle = document.createElement("style");
  responsiveStyle.textContent = `
    @media (max-width: 860px) {
      #student-video-split-container {
        flex-direction: column !important;
      }
      #student-video-split-container > div:last-child {
        width: 100% !important;
        min-height: 260px !important;
        max-height: 320px !important;
        border-left: none !important;
        border-top: 2px solid #F2C94C !important;
      }
    }
  `;
  document.head.appendChild(responsiveStyle);

  document.body.appendChild(videoOverlay);

  const closeBtn = document.getElementById("close-student-video-modal");
  const closeModal = () => {
    videoOverlay.style.display = "none";
    // Stop video playback by wiping the player container
    const playerBox = document.getElementById("student-video-player-box");
    if (playerBox) playerBox.innerHTML = "";
  };

  closeBtn?.addEventListener("click", closeModal);
  videoOverlay.addEventListener("click", (e) => {
    if (e.target === videoOverlay) {
      closeModal();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && videoOverlay.style.display === "flex") {
      closeModal();
    }
  });
}

/**
 * Opens the Course Video popup window displaying the attached video on the left,
 * with the full interactive playlist displayed on the right.
 * The first video opens automatically.
 */
export function openCourseVideoPopup(course) {
  if (!course) return;
  ensureVideoModal();

  const modal = document.getElementById("student-course-video-modal");
  const courseTitleEl = document.getElementById("student-video-course-title");
  const courseSubtitleEl = document.getElementById("student-video-course-subtitle");
  const instructorBadge = document.getElementById("student-video-instructor-badge");
  const playlistContainer = document.getElementById("student-video-playlist-container");
  const playlistCountEl = document.getElementById("student-video-playlist-count");
  const playerBox = document.getElementById("student-video-player-box");
  const activeLectureBadge = document.getElementById("active-lecture-badge");
  const activeLectureTitle = document.getElementById("active-lecture-title");
  const activeLectureNotes = document.getElementById("student-video-description-body");

  const courseTitle = course.title || "Masterclass Course";
  const instructor = course.instructor || "ShortStudy";
  const videos = normalizeCourseVideos(course);

  if (courseTitleEl) courseTitleEl.textContent = courseTitle;
  if (courseSubtitleEl) courseSubtitleEl.textContent = `${instructor} Masterclass • ${videos.length} Lecture(s) Available`;
  if (instructorBadge) instructorBadge.textContent = `🧑‍🏫 ${instructor}`;
  if (playlistCountEl) playlistCountEl.textContent = `${videos.length} Video${videos.length === 1 ? '' : 's'}`;

  // Helper to switch active playing video
  let currentActiveIndex = 0;

  function loadActiveVideo(index) {
    if (!videos || videos.length === 0) {
      if (playerBox) {
        playerBox.innerHTML = `
          <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0f172a; color: #F2C94C; text-align: center; padding: 24px; box-sizing: border-box;">
            <span style="font-size: 48px; margin-bottom: 12px;">🎬</span>
            <h4 style="font-size: 18px; margin: 0 0 8px 0; color: #ffffff;">Video Lecture Coming Soon</h4>
            <p style="color: #cbd5e1; font-size: 14px; max-width: 480px; margin: 0; line-height: 1.5;">
              The instructor is preparing the high-resolution masterclass stream. Review the course notes below.
            </p>
          </div>
        `;
      }
      if (activeLectureBadge) activeLectureBadge.textContent = "Part 1";
      if (activeLectureTitle) activeLectureTitle.textContent = courseTitle;
      if (activeLectureNotes) activeLectureNotes.textContent = course.description || "Course study notes and resources.";
      return;
    }

    const safeIndex = Math.max(0, Math.min(index, videos.length - 1));
    currentActiveIndex = safeIndex;
    const currentVideo = videos[safeIndex];

    if (activeLectureBadge) activeLectureBadge.textContent = `Lecture ${safeIndex + 1}`;
    if (activeLectureTitle) activeLectureTitle.textContent = currentVideo.title || `Lecture ${safeIndex + 1}`;
    if (activeLectureNotes) activeLectureNotes.textContent = currentVideo.description || course.description || "Course study notes and chapter resources.";

    const rawUrl = currentVideo.embedCode || currentVideo.url || currentVideo.embedUrl || "";
    const iframeHtml = buildYouTubeIframeHtml(rawUrl);

    if (playerBox) {
      if (iframeHtml) {
        playerBox.innerHTML = iframeHtml;
      } else {
        playerBox.innerHTML = `
          <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0f172a; color: #F2C94C; text-align: center; padding: 24px; box-sizing: border-box;">
            <span style="font-size: 48px; margin-bottom: 12px;">🎬</span>
            <h4 style="font-size: 18px; margin: 0 0 8px 0; color: #ffffff;">Lecture ${safeIndex + 1} Stream</h4>
            <p style="color: #cbd5e1; font-size: 14px; max-width: 480px; margin: 0; line-height: 1.5;">
              ${escapeHTML(currentVideo.title || "Video lecture stream")} is ready.
            </p>
          </div>
        `;
      }
    }

    // Update highlight on right playlist
    if (playlistContainer) {
      const items = playlistContainer.querySelectorAll(".student-playlist-item");
      items.forEach((item, idx) => {
        if (idx === safeIndex) {
          item.style.background = "#23312A";
          item.style.borderColor = "#F2C94C";
          item.style.boxShadow = "0 0 12px rgba(242, 201, 76, 0.25)";
          const statusBadge = item.querySelector(".playlist-status-badge");
          if (statusBadge) {
            statusBadge.textContent = "▶ Playing";
            statusBadge.style.background = "#F2C94C";
            statusBadge.style.color = "#18221B";
          }
        } else {
          item.style.background = "#18221B";
          item.style.borderColor = "rgba(242, 201, 76, 0.25)";
          item.style.boxShadow = "none";
          const statusBadge = item.querySelector(".playlist-status-badge");
          if (statusBadge) {
            statusBadge.textContent = `#${idx + 1}`;
            statusBadge.style.background = "rgba(242, 201, 76, 0.15)";
            statusBadge.style.color = "#F2C94C";
          }
        }
      });
    }
  }

  // Render the Right Playlist
  if (playlistContainer) {
    playlistContainer.innerHTML = "";

    if (videos.length === 0) {
      playlistContainer.innerHTML = `
        <div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">
          No video lectures attached yet.
        </div>
      `;
    } else {
      videos.forEach((vid, idx) => {
        const item = document.createElement("div");
        item.className = "student-playlist-item";
        item.style.cssText = `
          padding: 10px 12px;
          background: ${idx === 0 ? '#23312A' : '#18221B'};
          border: 1px solid ${idx === 0 ? '#F2C94C' : 'rgba(242, 201, 76, 0.25)'};
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          gap: 4px;
        `;

        const titleText = vid.title || `Lecture ${idx + 1}`;
        const descPreview = vid.description ? vid.description.slice(0, 65) + (vid.description.length > 65 ? '...' : '') : 'Click to watch this lecture';

        item.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span class="playlist-status-badge" style="
              font-size: 11px;
              font-weight: 800;
              padding: 2px 6px;
              border-radius: 4px;
              background: ${idx === 0 ? '#F2C94C' : 'rgba(242, 201, 76, 0.15)'};
              color: ${idx === 0 ? '#18221B' : '#F2C94C'};
              flex-shrink: 0;
            ">
              ${idx === 0 ? '▶ Playing' : `#${idx + 1}`}
            </span>
            <span style="font-size: 13.5px; font-weight: 700; color: #F5F3EA; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${escapeHTML(titleText)}
            </span>
          </div>
          <div style="font-size: 11.5px; color: #cbd5e1; line-height: 1.4; padding-left: 2px;">
            ${escapeHTML(descPreview)}
          </div>
        `;

        item.addEventListener("click", () => {
          loadActiveVideo(idx);
        });

        item.addEventListener("mouseenter", () => {
          if (idx !== currentActiveIndex) {
            item.style.background = "rgba(35, 49, 42, 0.7)";
            item.style.borderColor = "rgba(242, 201, 76, 0.5)";
          }
        });
        item.addEventListener("mouseleave", () => {
          if (idx !== currentActiveIndex) {
            item.style.background = "#18221B";
            item.style.borderColor = "rgba(242, 201, 76, 0.25)";
          }
        });

        playlistContainer.appendChild(item);
      });
    }
  }

  // Load the first video (index 0) upon opening
  loadActiveVideo(0);

  modal.style.display = "flex";
}

/**
 * Injects the chalkboard-themed checkout & payment modal into the DOM.
 * Strictly adheres to #2B3A32 / #F2C94C chalkboard aesthetics and 'Kalam' font.
 * NOTE: Direct bypass and "Proceed for Learning" buttons are completely removed.
 */
function ensureCheckoutModal() {
  if (document.getElementById("chalkboard-checkout-modal")) return;

  const modalOverlay = document.createElement("div");
  modalOverlay.id = "chalkboard-checkout-modal";
  modalOverlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(15, 23, 19, 0.88);
    backdrop-filter: blur(5px);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    padding: 16px;
    box-sizing: border-box;
  `;

  modalOverlay.innerHTML = `
    <div id="chalkboard-checkout-card" style="
      background: #23312A;
      color: #F5F3EA;
      border: 2px solid #F2C94C;
      box-shadow: 8px 8px 0px rgba(242, 201, 76, 0.35);
      border-radius: 14px;
      width: 100%;
      max-width: 520px;
      max-height: 90vh;
      overflow-y: auto;
      padding: 28px;
      position: relative;
      font-family: 'Kalam', cursive !important;
      box-sizing: border-box;
    ">
      <button type="button" id="close-checkout-modal" aria-label="Close" style="
        position: absolute;
        top: 16px;
        right: 16px;
        background: transparent;
        border: none;
        color: #F2C94C;
        font-size: 26px;
        line-height: 1;
        cursor: pointer;
        font-weight: 700;
      ">✕</button>

      <!-- STEP 1: CREDENTIALS & PAY NOW FORM -->
      <div id="checkout-step-form">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
          <span style="font-size: 26px;">⭐</span>
          <h2 style="color: #F2C94C; font-size: 26px; margin: 0; font-family: 'Kalam', cursive !important; font-weight: 700;">
            Enroll &amp; Unlock Course
          </h2>
        </div>
        <p style="color: #F5F3EA; opacity: 0.95; font-size: 15px; margin: 0 0 16px 0; line-height: 1.4;">
          Please enter your credentials below. Access to course materials will be granted once your payment is verified to <strong>+91 9315671951</strong>.
        </p>

        <!-- Course Summary Box -->
        <div id="checkout-course-summary" style="
          background: #1b2620;
          border: 1px dashed rgba(242, 201, 76, 0.4);
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 18px;
          display: flex;
          align-items: center;
          gap: 14px;
        ">
          <img id="checkout-summary-img" src="" alt="Course Photo" style="width: 64px; height: 64px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(242, 201, 76, 0.5); display: none;">
          <div id="checkout-summary-icon" style="font-size: 34px; line-height: 1;">⭐</div>
          <div style="flex-grow: 1;">
            <div id="checkout-summary-title" style="color: #F2C94C; font-size: 18px; font-weight: 700; line-height: 1.3;">Course Title</div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
              <span id="checkout-summary-price" style="color: #10b981; font-weight: 700; font-size: 19px;">₹499</span>
              <span style="background: rgba(242, 201, 76, 0.2); color: #F2C94C; padding: 2px 8px; border-radius: 4px; font-size: 12px; border: 1px solid rgba(242, 201, 76, 0.3);">Paid Masterclass</span>
            </div>
          </div>
        </div>

        <!-- Official Payment Instruction -->
        <div style="
          background: rgba(242, 201, 76, 0.12);
          border-left: 4px solid #F2C94C;
          border-radius: 6px;
          padding: 10px 14px;
          margin-bottom: 18px;
          font-size: 14px;
          line-height: 1.5;
        ">
          <div style="color: #F2C94C; font-weight: 700; margin-bottom: 2px;">
            📱 Direct Payment Destination:
          </div>
          <div>Mobile / UPI: <strong style="color: #F2C94C; font-size: 16px;">+91 9315671951</strong></div>
          <div style="font-size: 13px; opacity: 0.9;">UPI ID: <strong style="color: #F2C94C;">9315671951@upi</strong> (Google Pay, PhonePe, Paytm)</div>
        </div>

        <!-- Credentials Form -->
        <form id="chalkboard-checkout-form" style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label for="checkout-input-name" style="display: block; color: #F2C94C; font-size: 15px; font-weight: 700; margin-bottom: 4px;">
              Your Full Name *
            </label>
            <input type="text" id="checkout-input-name" required placeholder="Enter your full name" style="
              width: 100%;
              padding: 10px 14px;
              background: #1b2620;
              border: 1px solid rgba(242, 201, 76, 0.5);
              border-radius: 8px;
              color: #F5F3EA;
              font-family: 'Kalam', cursive !important;
              font-size: 16px;
              box-sizing: border-box;
              outline: none;
            ">
          </div>

          <div>
            <label for="checkout-input-email" style="display: block; color: #F2C94C; font-size: 15px; font-weight: 700; margin-bottom: 4px;">
              Your Email ID *
            </label>
            <input type="email" id="checkout-input-email" required placeholder="Enter your email ID" style="
              width: 100%;
              padding: 10px 14px;
              background: #1b2620;
              border: 1px solid rgba(242, 201, 76, 0.5);
              border-radius: 8px;
              color: #F5F3EA;
              font-family: 'Kalam', cursive !important;
              font-size: 16px;
              box-sizing: border-box;
              outline: none;
            ">
          </div>

          <div>
            <label for="checkout-input-phone" style="display: block; color: #F2C94C; font-size: 15px; font-weight: 700; margin-bottom: 4px;">
              Your Phone Number (Optional)
            </label>
            <input type="tel" id="checkout-input-phone" placeholder="Enter mobile number" style="
              width: 100%;
              padding: 10px 14px;
              background: #1b2620;
              border: 1px solid rgba(242, 201, 76, 0.5);
              border-radius: 8px;
              color: #F5F3EA;
              font-family: 'Kalam', cursive !important;
              font-size: 16px;
              box-sizing: border-box;
              outline: none;
            ">
          </div>

          <button type="submit" id="checkout-submit-button" class="btn-buy-course" style="
            margin-top: 10px;
            width: 100%;
            justify-content: center;
            font-size: 18px;
            padding: 14px 20px;
            cursor: pointer;
            border: none;
            background: #F2C94C;
            color: #1b2620;
            font-weight: 700;
            border-radius: 8px;
          ">
            <span>⚡ Pay Now to +91 9315671951</span>
            <span style="font-size: 20px;">→</span>
          </button>
        </form>
      </div>

      <!-- STEP 2: PAYMENT INTERFACE (QR CODE & PAY WITH APP ONLY - NO BYPASS BUTTON) -->
      <div id="checkout-step-success" style="display: none; text-align: center; padding: 10px 0;">
        <div style="font-size: 48px; margin-bottom: 8px;">💳</div>
        <h2 style="color: #F2C94C; font-size: 26px; margin: 0 0 8px 0; font-family: 'Kalam', cursive !important;">
          Scan QR or Pay with UPI
        </h2>
        <p id="checkout-success-desc" style="color: #F5F3EA; font-size: 15px; line-height: 1.5; margin: 0 auto 18px auto; max-width: 440px;">
          Scan the QR code below using Google Pay, PhonePe, or Paytm, or click <strong>Pay with App</strong> to send payment to <strong>+91 9315671951</strong>.
        </p>

        <!-- QR Code Display -->
        <div style="background: #1b2620; border: 1px dashed rgba(242, 201, 76, 0.4); border-radius: 12px; padding: 16px; display: inline-block; margin-bottom: 18px;">
          <img id="checkout-qr-img" src="" alt="Payment QR Code" style="width: 170px; height: 170px; border-radius: 8px; background: #fff; padding: 6px; display: block; margin: 0 auto 8px auto;">
          <div style="font-size: 13px; color: #F2C94C; font-weight: 700;">Scan with GPay / PhonePe / Paytm</div>
          <div style="font-size: 12px; color: #F5F3EA; opacity: 0.9;">Pay to: +91 9315671951 (9315671951@upi)</div>
        </div>

        <!-- ONLY Payment Action Options: Pay with App (UPI) -->
        <div style="display: flex; flex-direction: column; gap: 10px; max-width: 360px; margin: 0 auto;">
          <a id="checkout-reopen-upi-btn" href="#" class="btn-buy-course" style="justify-content: center; font-size: 16px; padding: 12px; border-radius: 8px;">
            <span>📱 Pay with App (Open UPI)</span>
            <span>↗</span>
          </a>
        </div>

        <!-- Access Gating Status Notice -->
        <div id="checkout-access-status" style="margin-top: 20px; padding: 12px 14px; background: rgba(242, 201, 76, 0.1); border: 1px solid rgba(242, 201, 76, 0.3); border-radius: 8px; font-size: 13.5px; color: #F5F3EA; line-height: 1.5; text-align: left;">
          <div style="color: #F2C94C; font-weight: 700; margin-bottom: 3px;">🔒 Access Gating Enforced:</div>
          <div>Materials will unlock as <strong>Access Course / Start Learning</strong> immediately once payment is verified (Firestore <code>isPurchased: true</code>).</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  const closeBtn = document.getElementById("close-checkout-modal");
  closeBtn?.addEventListener("click", () => {
    modalOverlay.style.display = "none";
    activeCheckoutCourseId = null;
  });
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.style.display = "none";
      activeCheckoutCourseId = null;
    }
  });
}

/**
 * Open the checkout modal for a selected paid course.
 */
function openCheckoutForCourse(course) {
  ensureCheckoutModal();
  activeCheckoutCourseId = course.id;

  const modal = document.getElementById("chalkboard-checkout-modal");
  const stepForm = document.getElementById("checkout-step-form");
  const stepSuccess = document.getElementById("checkout-step-success");
  
  stepForm.style.display = "block";
  stepSuccess.style.display = "none";

  const imgEl = document.getElementById("checkout-summary-img");
  const iconEl = document.getElementById("checkout-summary-icon");
  const coursePhoto = course.imageUrl || course.courseImage || course.image || "";

  if (coursePhoto && coursePhoto.trim()) {
    imgEl.src = coursePhoto.trim();
    imgEl.style.display = "block";
    iconEl.style.display = "none";
  } else {
    imgEl.style.display = "none";
    iconEl.style.display = "block";
    iconEl.textContent = course.icon || "⭐";
  }

  document.getElementById("checkout-summary-title").textContent = course.title || "Masterclass";
  document.getElementById("checkout-summary-price").textContent = course.price || "₹499";

  const form = document.getElementById("chalkboard-checkout-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById("checkout-input-name").value.trim();
    const email = document.getElementById("checkout-input-email").value.trim();
    const phone = document.getElementById("checkout-input-phone").value.trim();
    const submitBtn = document.getElementById("checkout-submit-button");

    submitBtn.disabled = true;
    submitBtn.innerHTML = "<span>Registering Order...</span>";

    const cleanAmount = (course.price || "499").replace(/[^0-9.]/g, "") || "499";
    const upiUri = `upi://pay?pa=9315671951@upi&pn=ShortStudy&am=${encodeURIComponent(cleanAmount)}&cu=INR&tn=${encodeURIComponent((course.title || "Course").slice(0, 25))}`;

    try {
      // Create pending order in Firestore with isPurchased: false (Real Access Gating)
      const orderPayload = {
        name,
        studentName: name,
        userName: name,
        email,
        studentEmail: email,
        userEmail: email,
        phone,
        studentPhone: phone,
        userPhone: phone,
        courseId: course.id,
        courseTitle: course.title || "Course",
        amount: course.price || "₹499",
        coursePrice: course.price || "₹499",
        paymentTo: "+91 9315671951",
        upiId: "9315671951@upi",
        isPurchased: false,
        purchased: false,
        status: "pending",
        accessGranted: false,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, "course_orders"), orderPayload);
      console.log("⚡ [ORDER REGISTERED IN FIRESTORE]:", docRef.id, orderPayload);

      // Transition to Step 2: Payment options (QR code and UPI app only)
      stepForm.style.display = "none";
      stepSuccess.style.display = "block";

      const qrImg = document.getElementById("checkout-qr-img");
      if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`;
      }

      const reopenBtn = document.getElementById("checkout-reopen-upi-btn");
      if (reopenBtn) {
        const paymentAppUrl = course.paymentLink || upiUri;
        reopenBtn.href = paymentAppUrl;
        if (course.paymentLink) reopenBtn.target = "_blank";
      }

      // Automatically launch payment app if on supported mobile device
      const targetPaymentAppUrl = course.paymentLink || upiUri;
      window.location.href = targetPaymentAppUrl;

    } catch (err) {
      console.error("Order registration error:", err);
      // Even on error, show the direct UPI instructions without bypassing access
      stepForm.style.display = "none";
      stepSuccess.style.display = "block";
      const qrImg = document.getElementById("checkout-qr-img");
      if (qrImg) {
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`;
      }
      const reopenBtn = document.getElementById("checkout-reopen-upi-btn");
      if (reopenBtn) {
        reopenBtn.href = course.paymentLink || upiUri;
      }
      window.location.href = upiUri;
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>⚡ Pay Now to +91 9315671951</span><span style="font-size: 20px;">→</span>`;
    }
  };

  modal.style.display = "flex";
}

/**
 * Helper to check if a course is a paid course.
 */
export function isCoursePaid(course) {
  if (!course) return false;
  if (course.type === "paid") return true;
  if (course.category && (
    String(course.category).toLowerCase().includes("masterclass") ||
    String(course.category).toLowerCase().includes("paid") ||
    String(course.category).toLowerCase().includes("premium")
  )) {
    return true;
  }
  if (course.originalPrice && String(course.originalPrice).trim()) return true;
  if (course.price) {
    const p = String(course.price).toLowerCase().trim();
    if (p && p !== "0" && p !== "free" && p !== "₹0" && p !== "$0" && !p.includes("free")) {
      return true;
    }
  }
  // Default to true if type is not explicitly set to 'free' and it was saved from admin with a custom title
  if (course.type !== "free" && course.createdAt) {
    return true;
  }
  return false;
}

/**
 * Dynamic UI renderer: wipes the container and injects course cards
 * using the chalkboard theme (#2B3A32 / #F2C94C) and 'Kalam' font.
 * Per user request: ONLY paid courses are displayed on Home and Courses menus.
 */
export function renderCoursesUI(courses) {
  cachedCourses = courses || [];
  const homeGrid = document.getElementById("homepage-courses-grid");
  const paidGrid = document.getElementById("paid-courses-grid");
  const genericGrid = document.getElementById("courses-grid");

  // Only paid courses are displayed on the Courses menu and Home menu
  const paidOnlyCourses = cachedCourses.filter(isCoursePaid);

  if (homeGrid) {
    renderGridCourses(homeGrid, paidOnlyCourses, "No Paid Masterclasses Available Yet");
  }
  if (paidGrid) {
    renderGridCourses(paidGrid, paidOnlyCourses, "No Paid Masterclasses Published Yet");
  }
  if (genericGrid) {
    renderGridCourses(genericGrid, paidOnlyCourses, "No Paid Courses Published Yet");
  }

  // Attach event listeners to all Buy Course buttons
  document.querySelectorAll(".js-trigger-buy-course").forEach((btn) => {
    btn.addEventListener("click", () => {
      const courseId = btn.getAttribute("data-course-id");
      const course = cachedCourses.find((c) => c.id === courseId);
      if (course) {
        openCheckoutForCourse(course);
      }
    });
  });

  // Attach event listeners to all View Course Video buttons for paid/unlocked courses
  document.querySelectorAll(".js-open-course-video").forEach((btn) => {
    btn.addEventListener("click", () => {
      const courseId = btn.getAttribute("data-course-id");
      const course = cachedCourses.find((c) => c.id === courseId);
      if (course) {
        openCourseVideoPopup(course);
      }
    });
  });
}

function renderGridCourses(container, coursesList, emptyMessage = "No Paid Courses Published Yet") {
  if (!container) return;
  container.innerHTML = "";

  if (!coursesList || coursesList.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 24px; background: #23312A; border-radius: 12px; border: 1px dashed rgba(242, 201, 76, 0.4); color: #F2C94C; box-shadow: 4px 4px 0px rgba(242, 201, 76, 0.2);">
        <span style="font-size: 40px; display: block; margin-bottom: 12px;">⭐</span>
        <h3 style="font-family: 'Kalam', cursive !important; font-size: 26px; color: #F2C94C; margin-bottom: 8px;">${emptyMessage}</h3>
        <p style="color: #F5F3EA; font-family: 'Kalam', cursive !important; font-size: 16px; max-width: 480px; margin: 0 auto; line-height: 1.6;">
          Paid courses created in the Admin Panel will appear here live in real time.
        </p>
      </div>
    `;
    return;
  }

  const cardsHtml = coursesList.map((course) => {
    const isPaid = course.type === "paid" || Boolean(
      course.price && 
      course.price !== "0" && 
      !String(course.price).toLowerCase().includes("free")
    );

    const priceText = course.price && course.price.trim()
      ? course.price.trim()
      : (isPaid ? "₹2599" : "Free");

    const originalPriceText = course.originalPrice && course.originalPrice.trim()
      ? course.originalPrice.trim()
      : (isPaid ? "₹3899" : "");

    // Calculate discount
    let discountPercent = 0;
    let savingsAmount = 0;
    if (isPaid && priceText && originalPriceText) {
      const pNum = parseFloat(priceText.replace(/[^\d.]/g, ""));
      const origNum = parseFloat(originalPriceText.replace(/[^\d.]/g, ""));
      if (origNum > pNum && pNum > 0) {
        discountPercent = Math.round(((origNum - pNum) / origNum) * 100);
        savingsAmount = origNum - pNum;
      }
    }

    const instructor = course.instructor || "ShortStudy";
    const level = course.level || "Beginner";
    const duration = course.duration || "36h 22m";
    const lessons = course.lessons || "219 lessons";
    const language = course.language || "Hindi";
    const isFeatured = course.featured !== false;
    const badgeText = course.badge || (isFeatured ? "Featured" : "");

    const title = course.title || "Untitled Course";
    const desc = course.description || "Master core concepts with in-depth structured modules and interactive chalkboard notes.";
    const courseLink = course.link && course.link.trim()
      ? course.link.trim()
      : (course.slug ? `${course.slug}.html` : `lesson.html?course=${encodeURIComponent(course.id)}`);

    // Dynamic check for Firestore isPurchased state
    const isPurchased = isPaid ? isCourseUnlocked(course.id, course) : true;

    const imageUrl = course.imageUrl || course.courseImage || course.image || "";
    const hasImage = Boolean(imageUrl && imageUrl.trim());

    const discountBadgeHtml = discountPercent > 0
      ? `<span style="position: absolute; top: 10px; left: 10px; background: #ef4444; color: #ffffff; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 4px; text-transform: uppercase; z-index: 3; box-shadow: 0 2px 5px rgba(0,0,0,0.4); letter-spacing: 0.3px;">${discountPercent}% OFF</span>`
      : '';

    const featuredBadgeHtml = (isFeatured || badgeText)
      ? `<span style="position: absolute; top: 10px; right: 10px; background: #f59e0b; color: #111827; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 4px; z-index: 3; box-shadow: 0 2px 5px rgba(0,0,0,0.4); letter-spacing: 0.3px;">${escapeHTML(badgeText || "Featured")}</span>`
      : '';

    let imageContainerHtml = "";
    if (hasImage) {
      imageContainerHtml = `
        <div class="cwh-card-media" style="width: 100%; aspect-ratio: 16 / 9; position: relative; overflow: hidden; background: #070d19; border-bottom: 1px solid rgba(255,255,255,0.08); border-radius: 10px 10px 0 0; line-height: 0;">
          ${discountBadgeHtml}
          ${featuredBadgeHtml}
          <img src="${escapeHTML(imageUrl.trim())}" alt="${escapeHTML(title)}" style="width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;" onerror="this.onerror=null; this.parentElement.innerHTML='${discountBadgeHtml}${featuredBadgeHtml}<div style=\\'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#1e293b;color:#F2C94C;padding:16px;\\'><span style=\\'font-size:38px;\\'>${escapeHTML(course.icon || (isPaid ? '⭐' : '📘'))}</span><span style=\\'font-size:12px; margin-top:4px; font-weight:600;\\'>ShortStudy</span></div>';">
        </div>
      `;
    } else {
      imageContainerHtml = `
        <div class="cwh-card-media" style="width: 100%; aspect-ratio: 16 / 9; position: relative; overflow: hidden; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-bottom: 1px solid rgba(255,255,255,0.08); border-radius: 10px 10px 0 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 16px; box-sizing: border-box;">
          ${discountBadgeHtml}
          ${featuredBadgeHtml}
          <div style="font-size: 38px; line-height: 1; margin-bottom: 6px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${escapeHTML(course.icon || (isPaid ? "⭐" : "📘"))}</div>
          <div style="font-size: 14px; color: #F2C94C; font-weight: 700; letter-spacing: 0.04em;">${isPaid ? 'ShortStudy Masterclass' : 'ShortStudy Curriculum'}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Premium Video Tutorials</div>
        </div>
      `;
    }

    let actionButtonHtml = "";
    if (!isPaid) {
      actionButtonHtml = `
        <a href="${courseLink}" class="cwh-enroll-btn btn-start-learning" id="start-learning-${course.id || ''}" style="width: 100%; background: #ffffff !important; color: #000000 !important; font-weight: 700 !important; font-size: 15px !important; padding: 12px 18px !important; border-radius: 6px !important; text-decoration: none !important; display: flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important; transition: all 0.2s !important; box-shadow: 0 3px 10px rgba(255, 255, 255, 0.2) !important; letter-spacing: 0.3px !important; font-family: 'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important; border: none !important;">
          <span style="color: #000000 !important; font-weight: 700 !important; font-size: 15px !important;">Enroll Now</span>
        </a>
      `;
    } else if (isPurchased) {
      // If purchased/paid, clicking this button pops up the course video with written description
      actionButtonHtml = `
        <button type="button" class="cwh-enroll-btn btn-access-course js-open-course-video" data-course-id="${escapeHTML(course.id || '')}" id="access-course-${course.id || ''}" style="width: 100%; background: #ffffff !important; color: #000000 !important; font-weight: 700 !important; font-size: 15px !important; padding: 12px 18px !important; border-radius: 6px !important; border: none !important; cursor: pointer !important; text-decoration: none !important; display: flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important; transition: all 0.2s !important; box-shadow: 0 3px 10px rgba(255, 255, 255, 0.2) !important; letter-spacing: 0.3px !important; font-family: 'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;">
          <span style="color: #000000 !important; font-weight: 700 !important; font-size: 15px !important;">Enroll Now</span>
        </button>
      `;
    } else {
      actionButtonHtml = `
        <button type="button" class="cwh-enroll-btn btn-buy-course js-trigger-buy-course" data-course-id="${escapeHTML(course.id || '')}" id="buy-course-${course.id || ''}" style="width: 100%; background: #ffffff !important; color: #000000 !important; font-weight: 700 !important; font-size: 15px !important; padding: 12px 18px !important; border-radius: 6px !important; border: none !important; cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important; transition: all 0.15s ease !important; box-shadow: 0 3px 10px rgba(255, 255, 255, 0.2) !important; letter-spacing: 0.3px !important; font-family: 'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;">
          <span style="color: #000000 !important; font-weight: 700 !important; font-size: 15px !important;">Enroll Now</span>
        </button>
      `;
    }

    return `
      <div class="cwh-course-card" style="background: #0f172a; color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4); position: relative; transition: transform 0.2s, box-shadow 0.2s; width: 100%; box-sizing: border-box;">
        ${imageContainerHtml}
        <div style="padding: 16px; display: flex; flex-direction: column; flex-grow: 1;">
          <h3 style="color: #ffffff; font-size: 16px; font-weight: 700; margin: 0 0 8px 0; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 44px;">
            ${escapeHTML(title)}
          </h3>
          <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0 0 12px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 38px;">
            ${escapeHTML(desc)}
          </p>
          
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #cbd5e1; margin-bottom: 6px;">
            <span>🧑‍🏫 ${escapeHTML(instructor)}</span>
            <span style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-size: 11px;">🔍 ${escapeHTML(level)}</span>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #94a3b8; margin-bottom: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 10px; flex-wrap: wrap;">
            <span>⏱ ${escapeHTML(duration)}</span>
            <span>•</span>
            <span>📚 ${escapeHTML(lessons)}</span>
            <span>•</span>
            <span>🗣 ${escapeHTML(language)}</span>
          </div>

          <div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 14px; margin-top: auto;">
            <span style="font-size: 20px; font-weight: 800; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              ${priceText}
            </span>
            ${originalPriceText ? `
              <span style="font-size: 13.5px; text-decoration: line-through; color: #64748b; font-weight: 500;">
                ${escapeHTML(originalPriceText)}
              </span>
            ` : ''}
          </div>

          <div>
            ${actionButtonHtml}
          </div>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = cardsHtml;
}

/**
 * Pure onSnapshot realtime listener connecting to Firestore:
 * 1. Synchronizes "courses" and "paid_courses" collections in real-time.
 * 2. Synchronizes "course_orders" collection to track verified purchases live.
 * 3. Never skips documents even if custom fields like order or createdAt are absent.
 */
export function initRealtimeSync() {
  // Render initial catalog courses immediately
  renderCoursesUI(cachedCourses);

  const firestoreCoursesMap = new Map();

  const updateAndRenderMergedCourses = () => {
    const combinedMap = new Map();
    // 1. Static base courses
    PRE_EXISTING_COURSES.forEach(c => combinedMap.set(c.id, c));
    // 2. Firestore courses override
    firestoreCoursesMap.forEach((val, key) => combinedMap.set(key, val));
    
    cachedCourses = Array.from(combinedMap.values());
    cachedCourses.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    renderCoursesUI(cachedCourses);
  };

  try {
    // 1. Listen to Courses collection in real-time (No strict orderBy query so no document is ever omitted)
    onSnapshot(collection(db, "courses"), (snapshot) => {
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (!d.isDeleted && d.status !== "draft" && d.status !== "inactive") {
          firestoreCoursesMap.set(docSnap.id, { id: docSnap.id, ...d });
        } else {
          firestoreCoursesMap.delete(docSnap.id);
        }
      });
      updateAndRenderMergedCourses();
    }, (error) => {
      console.warn("Error listening to courses collection:", error);
    });

    // 2. Also listen to "paid_courses" collection in real-time to guarantee 100% sync
    onSnapshot(collection(db, "paid_courses"), (snapshot) => {
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (!d.isDeleted && d.status !== "draft" && d.status !== "inactive") {
          firestoreCoursesMap.set(docSnap.id, { id: docSnap.id, type: "paid", ...d });
        }
      });
      updateAndRenderMergedCourses();
    }, (error) => {
      console.warn("Error listening to paid_courses collection:", error);
    });

    // 3. Listen to Course Orders collection in real-time to detect isPurchased states
    const qOrders = query(collection(db, "course_orders"));
    onSnapshot(qOrders, (snapshot) => {
      const updatedPurchasedIds = new Set();
      snapshot.forEach((docSnap) => {
        const order = docSnap.data();
        const isOrderApproved = order.isPurchased === true || order.purchased === true || (order.purchased !== false && order.status === "approved");
        if (isOrderApproved && order.courseId) {
          updatedPurchasedIds.add(order.courseId);
        }
      });

      purchasedCourseIdsFromOrders = updatedPurchasedIds;

      // If active checkout modal is currently open and course was just unlocked:
      if (activeCheckoutCourseId && isCourseUnlocked(activeCheckoutCourseId)) {
        const statusEl = document.getElementById("checkout-access-status");
        if (statusEl) {
          const course = cachedCourses.find((c) => c.id === activeCheckoutCourseId);
          const courseLink = course?.link?.trim() || (course?.slug ? `${course.slug}.html` : `lesson.html?course=${encodeURIComponent(activeCheckoutCourseId)}`);
          statusEl.style.background = "rgba(16, 185, 129, 0.2)";
          statusEl.style.borderColor = "#10b981";
          statusEl.innerHTML = `
            <div style="color: #10b981; font-weight: 700; margin-bottom: 4px;">✓ Payment Verified! Access Unlocked:</div>
            <a href="${courseLink}" class="btn-start-learning" style="display: flex; justify-content: center; background: #10b981; color: #fff; border-color: #10b981; margin-top: 8px; padding: 10px; border-radius: 6px; text-decoration: none;">
              <span>Access Course / Start Learning Now →</span>
            </a>
          `;
        }
      }

      // Re-render UI to update card buttons across all grids live
      renderCoursesUI(cachedCourses);
    }, (err) => {
      console.warn("Orders listener note:", err);
    });

  } catch (err) {
    console.error("Firestore Listener Setup Error:", err);
  }
}

// Hook filter buttons on homepage if present
function setupFilterButtons() {
  const filterBtns = document.querySelectorAll("#courses .cwh-filter-btn");
  if (!filterBtns || filterBtns.length === 0) return;

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const activeFilter = btn.getAttribute("data-filter") || "all";
      const cards = document.querySelectorAll("#homepage-courses-grid .class-card");
      cards.forEach((card) => {
        if (activeFilter === "all") {
          card.style.display = "flex";
        } else {
          const text = (card.textContent || "").toLowerCase();
          const match = text.includes(activeFilter) || 
            (activeFilter === "programming" && (text.includes("python") || text.includes("c ") || text.includes("java"))) ||
            (activeFilter === "dsa" && (text.includes("data") || text.includes("array"))) ||
            (activeFilter === "web" && (text.includes("html") || text.includes("css") || text.includes("sql")));
          card.style.display = match ? "flex" : "none";
        }
      });
    });
  });
}

// Auto-run on page load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initRealtimeSync();
    setupFilterButtons();
  });
} else {
  initRealtimeSync();
  setupFilterButtons();
}
