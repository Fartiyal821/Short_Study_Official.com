import { 
  doc,
  getDoc,
  setDoc,
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { app, db, auth, storage, ref, uploadBytes, getDownloadURL, firebaseConfig } from "./firebase-config.js";
import { PRE_EXISTING_COURSES } from "./catalog-data.js";

const ADMIN_EMAIL = "gauravfartiyal751@gmail.com";
let currentUserUid = null;
let currentUserEmail = null;
let currentUserName = null;
let cachedCourses = [];
let purchasedCourseIdsFromOrders = new Set();
let activeCheckoutCourseId = null;

/* =========================================================
   1. USER PROFILE DATABASE ENTRY ONBOARDING (FIRESTORE)
   ========================================================= */
async function saveUserProfileToDatabase(user, additionalData = {}) {
  if (!user || user.isAnonymous || !db) return;
  try {
    const userRef = doc(db, "users", user.uid);
    const resolvedName = additionalData.name || user.displayName || (user.email ? user.email.split("@")[0] : "Student");
    const profile = {
      uid: user.uid,
      email: user.email || "",
      name: resolvedName,
      displayName: resolvedName,
      photoURL: user.photoURL || "",
      provider: user.providerData && user.providerData[0] ? user.providerData[0].providerId : (additionalData.provider || "password"),
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(userRef, profile, { merge: true });
  } catch (err) {
    console.warn("Could not record user profile to database:", err);
  }
}

/* =========================================================
   2. COMPULSORY AUTHENTICATION GATE LOGIC
   ========================================================= */
function enforceCompulsoryAuth() {
  if (currentUserUid) {
    removeCompulsoryLockOverlay();
    return;
  }

  document.body.classList.add("auth-compulsory-locked");
  let overlay = document.getElementById("auth-compulsory-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "auth-compulsory-overlay";
    overlay.innerHTML = `
      <div style="text-align: center; color: #f2c94c; padding: 24px 20px; max-width: 480px; width: 90%; animation: modalSlideUpFade 0.4s ease-out;">
        <div style="display: inline-flex; width: 72px; height: 72px; border-radius: 50%; background: rgba(242, 201, 76, 0.15); border: 2px solid rgba(242, 201, 76, 0.4); align-items: center; justify-content: center; font-size: 34px; margin-bottom: 16px; animation: goldPulseGlow 2.5s infinite;">
          🔒
        </div>
        <h2 style="font-family: 'Kalam', cursive; font-size: 30px; margin: 0 0 10px; color: #f2c94c;">
          Sign In Required to Enter
        </h2>
        <p style="color: #cbd5e1; font-family: 'Work Sans', sans-serif; font-size: 14.5px; line-height: 1.6; margin: 0 0 22px;">
          ShortStudy coding curriculums, handwritten notes, interview MCQs, and masterclasses require a registered student or developer account.
        </p>
        <button id="overlay-open-auth-btn" type="button" style="background: #f2c94c; color: #1e2b25; border: none; font-weight: 800; font-size: 15px; padding: 13px 30px; border-radius: 26px; cursor: pointer; font-family: 'Work Sans', sans-serif; box-shadow: 0 6px 20px rgba(242, 201, 76, 0.35); transition: transform 0.2s;">
          🔑 Sign In or Create Free Account →
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById("overlay-open-auth-btn")?.addEventListener("click", () => {
      window.openAuthModal("signin");
    });
  }
  overlay.style.display = "flex";
  window.openAuthModal("signin");
}

function removeCompulsoryLockOverlay() {
  document.body.classList.remove("auth-compulsory-locked");
  const overlay = document.getElementById("auth-compulsory-overlay");
  if (overlay) {
    overlay.style.display = "none";
  }
}

/* =========================================================
   3. NAVIGATION AUTH STATUS / MANUAL LOGIN BUTTON
   ========================================================= */
function updateNavAuthUI(user) {
  const navLinks = document.getElementById("navLinks");
  if (!navLinks) return;

  let authNavItem = document.getElementById("nav-auth-item");
  if (!authNavItem) {
    authNavItem = document.createElement("li");
    authNavItem.id = "nav-auth-item";
    authNavItem.style.display = "flex";
    authNavItem.style.alignItems = "center";
    navLinks.appendChild(authNavItem);
  }

  if (user && !user.isAnonymous) {
    const displayName = user.displayName || (user.email ? user.email.split("@")[0] : "Programmer");
    const initial = displayName.charAt(0).toUpperCase();
    authNavItem.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        <button id="nav-benefits-btn" type="button" style="display: inline-flex; align-items: center; gap: 5px; background: rgba(242, 201, 76, 0.12); border: 1px solid rgba(242, 201, 76, 0.45); color: #f2c94c; padding: 6px 12px; border-radius: 20px; font-family: 'Kalam', cursive; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: all 0.2s;" title="Why ShortStudy is beneficial for programmers">
          <span>⚡</span> <span>Why ShortStudy?</span>
        </button>
        <span style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; background: rgba(242, 201, 76, 0.15); border: 1px solid rgba(242, 201, 76, 0.4); color: #f2c94c; font-size: 14px; font-weight: 700; font-family: 'Kalam', cursive;">
          <span style="display: inline-flex; width: 22px; height: 22px; border-radius: 50%; background: #f2c94c; color: #1e2b25; align-items: center; justify-content: center; font-size: 12px; font-weight: 900;">${initial}</span>
          <span style="max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayName}</span>
        </span>
        <button id="nav-signout-btn" type="button" style="background: none; border: none; color: #94a3b8; font-size: 13px; font-weight: 600; cursor: pointer; padding: 6px 8px; border-radius: 6px; transition: color 0.2s;" title="Sign out" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#94a3b8'">
          Sign Out
        </button>
      </div>
    `;
    document.getElementById("nav-benefits-btn")?.addEventListener("click", () => {
      showProgrammerBenefitsShowcase(user, true);
    });
    document.getElementById("nav-signout-btn")?.addEventListener("click", async () => {
      try {
        await signOut(auth);
      } catch (err) {
        console.error("Sign out error:", err);
      }
    });
  } else {
    authNavItem.innerHTML = `
      <button id="nav-auth-login-btn" type="button" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(242, 201, 76, 0.12); border: 1px solid rgba(242, 201, 76, 0.45); color: #f2c94c; padding: 8px 14px; border-radius: 20px; cursor: pointer; font-family: 'Kalam', cursive; font-size: 15px; font-weight: 700; transition: all 0.2s;" onmouseover="this.style.background='rgba(242, 201, 76, 0.25)'" onmouseout="this.style.background='rgba(242, 201, 76, 0.12)'">
        <span>👤</span> <span>Login / Sign Up</span>
      </button>
    `;
    document.getElementById("nav-auth-login-btn")?.addEventListener("click", () => {
      window.openAuthModal("signin");
    });
  }
}

/* =========================================================
   4. AUTH STATE LISTENER & SESSION INITIALIZATION
   ========================================================= */
onAuthStateChanged(auth, async (user) => {
  if (user && !user.isAnonymous) {
    currentUserUid = user.uid;
    currentUserEmail = user.email || null;
    currentUserName = user.displayName || null;
    removeCompulsoryLockOverlay();
    window.closeAuthModal(true);
    await saveUserProfileToDatabase(user);
    updateNavAuthUI(user);
    setupOrdersListener();
    renderCoursesUI(cachedCourses);

    // If user has not seen the Programmer Benefits animation, trigger it smoothly
    const hasSeenBenefits = localStorage.getItem("shortstudy_benefit_animation_seen_" + user.uid);
    if (!hasSeenBenefits) {
      setTimeout(() => {
        showProgrammerBenefitsShowcase(user);
      }, 400);
    }
  } else {
    currentUserUid = null;
    currentUserEmail = null;
    currentUserName = null;
    purchasedCourseIdsFromOrders.clear();
    updateNavAuthUI(null);
    setupOrdersListener();
    renderCoursesUI(cachedCourses);
    enforceCompulsoryAuth();
  }
});

function setupOrdersListener() {
  if (!currentUserUid || !db) return;

  const handleOrderSnapshot = (snapshot) => {
    snapshot.forEach((docSnap) => {
      const order = docSnap.data();
      const isOrderApproved = (order.isPurchased === true || order.purchased === true || order.isCoursePaid === true) && order.status === "approved";
      if (isOrderApproved && order.courseId) {
        purchasedCourseIdsFromOrders.add(order.courseId);
      }
    });

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
    renderCoursesUI(cachedCourses);
  };

  try {
    const q1 = query(collection(db, "course_orders"), where("uid", "==", currentUserUid));
    onSnapshot(q1, handleOrderSnapshot, (err) => console.warn("Course orders listener note:", err));
    const q2 = query(collection(db, "orders"), where("uid", "==", currentUserUid));
    onSnapshot(q2, handleOrderSnapshot, (err) => console.warn("Orders listener note:", err));
  } catch (err) {
    console.warn("Orders listener query error:", err);
  }
}

function isCoursePaid(course) {
  // 100% Paid Policy: Every course on ShortStudy is a paid premium masterclass requiring verified enrollment
  return true;
}

function normalizeCourseVideosList(course) {
  if (!course) return [];
  if (Array.isArray(course.videos) && course.videos.length > 0) {
    return course.videos.filter(v => v && (v.url || v.videoUrl || v.videoEmbed || v.embedCode || v.title));
  }
  const rawVideo = course.videoEmbed || course.videoUrl || course.youtubeUrl || "";
  const rawDesc = course.videoDescription || course.videoNotes || "";
  if (rawVideo || rawDesc) {
    return [{
      id: "vid-1",
      url: rawVideo,
      title: course.title ? `${course.title} - Main Video Lecture` : "Lecture 1",
      description: rawDesc
    }];
  }
  return [];
}

function extractYouTubeVideoId(input) {
  if (!input) return "";
  const str = String(input).trim();

  // Direct 11-char alphanumeric YouTube video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
    return str;
  }

  // YouTube URLs & patterns:
  // - youtu.be/ID
  // - youtube.com/watch?v=ID
  // - youtube.com/embed/ID
  // - youtube.com/v/ID
  // - youtube.com/shorts/ID
  // - youtube.com/live/ID
  // - youtube-nocookie.com/embed/ID
  const patterns = [
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|shorts\/|live\/|watch\?v=|watch\?.+?&v=))([\w-]{11})/i,
    /[?&]v=([\w-]{11})/i,
    /src=["']https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})["']/i
  ];

  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // If iframe has src with any link
  const iframeSrcMatch = str.match(/src=["']([^"']+)["']/i);
  if (iframeSrcMatch && iframeSrcMatch[1]) {
    return extractYouTubeVideoId(iframeSrcMatch[1]);
  }

  return "";
}

function processEmbedCode(raw) {
  if (!raw) {
    return `
      <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #16201b; color: #f2c94c; padding: 20px; text-align: center;">
        <span style="font-size: 36px; margin-bottom: 8px;">🎬</span>
        <p style="font-size: 15px; font-weight: 700; margin: 0 0 6px 0; color: #f5f3ea;">Video Lecture Coming Soon</p>
        <p style="font-size: 13px; color: #94a3b8; margin: 0;">No video URL is linked yet for this lecture.</p>
      </div>
    `;
  }

  const videoId = extractYouTubeVideoId(raw);

  if (!videoId) {
    return `
      <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #16201b; color: #f2c94c; padding: 20px; text-align: center;">
        <span style="font-size: 36px; margin-bottom: 8px;">⚠️</span>
        <p style="font-size: 15px; font-weight: 700; margin: 0 0 6px 0; color: #f5f3ea;">Video Link Unavailable</p>
        <p style="font-size: 13px; color: #94a3b8; margin: 0 0 12px 0;">The lecture video URL could not be formatted. Please update the YouTube link in Admin.</p>
      </div>
    `;
  }

  // STRICT PRIVACY-ENHANCED EMBED (youtube-nocookie.com)
  // Essential for mobile devices to prevent "Please sign out and sign in again in a new tab" error
  // playsinline=1 allows inline playback on iOS and Android
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;

  return `
    <iframe 
      src="${embedUrl}" 
      title="Course Video Player" 
      style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; border-radius: 10px;" 
      frameborder="0" 
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
      referrerpolicy="no-referrer-when-downgrade" 
      allowfullscreen 
      loading="lazy">
    </iframe>
  `;
}

function closeCourseVideosModal() {
  const modal = document.getElementById("chalkboard-course-videos-modal");
  if (modal) {
    modal.style.display = "none";
  }
  // Immediately clear the player DOM so the video and audio stop completely!
  const container = document.getElementById("cv-player-container");
  if (container) {
    container.innerHTML = "";
  }
}
window.closeCourseVideosModal = closeCourseVideosModal;

function ensureCourseVideosModal() {
  if (document.getElementById("chalkboard-course-videos-modal")) return;
  const modalHtml = `
    <div id="chalkboard-course-videos-modal" style="display: none; position: fixed; inset: 0; z-index: 99999; background: rgba(0,0,0,0.85); backdrop-filter: blur(10px); align-items: center; justify-content: center; padding: 16px;">
      <div style="background: #1b2620; width: 100%; max-width: 1060px; max-height: 92vh; border-radius: 16px; border: 1px solid rgba(242, 201, 76, 0.45); box-shadow: 0 24px 60px rgba(0,0,0,0.6); position: relative; display: flex; flex-direction: column; overflow: hidden; color: #f5f3ea; font-family: 'Work Sans', sans-serif;">
        
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 22px; background: #233129; border-bottom: 1px solid rgba(242, 201, 76, 0.25);">
          <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
            <span style="font-size: 24px;">🎬</span>
            <div>
              <h2 id="cv-modal-title" style="color: #f2c94c; font-family: 'Kalam', cursive; font-size: 22px; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Course Videos & Lectures</h2>
              <span id="cv-modal-badge" style="font-size: 11.5px; color: #10b981; font-weight: 600; text-transform: uppercase;">Full Masterclass Access</span>
            </div>
          </div>
          <button id="cv-modal-close" style="background: rgba(242, 201, 76, 0.15); border: 1px solid rgba(242, 201, 76, 0.3); color: #f2c94c; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; transition: background 0.2s;">✕</button>
        </div>

        <!-- Body Grid -->
        <div style="display: grid; grid-template-columns: minmax(0, 1.8fr) minmax(0, 1.2fr); gap: 18px; padding: 20px; overflow-y: auto; flex: 1;" id="cv-modal-grid">
          
          <!-- Left: Active Player & Details -->
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <div id="cv-player-container" style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 10px; background: #000; border: 1px solid rgba(242, 201, 76, 0.3); box-shadow: 0 4px 16px rgba(0,0,0,0.5);">
              <!-- Active iframe inserted here -->
            </div>
            
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(242, 201, 76, 0.2); border-radius: 10px; padding: 16px;">
              <h3 id="cv-active-video-title" style="color: #f2c94c; font-size: 18px; margin: 0 0 8px 0; font-weight: 700;">Lecture Title</h3>
              <div id="cv-active-video-desc" style="font-size: 13.5px; color: #e2e8f0; line-height: 1.6; white-space: pre-line; max-height: 160px; overflow-y: auto;"></div>
            </div>

            <!-- Nav Controls -->
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
              <button id="cv-btn-prev" class="btn" style="background: rgba(255,255,255,0.06); color: #f5f3ea; border: 1px solid rgba(242,201,76,0.25); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">← Previous Video</button>
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <span id="cv-video-counter" style="font-size: 12.5px; color: #94a3b8; font-weight: 600;">Video 1 of 1</span>
                <a id="cv-watch-on-youtube" href="#" target="_blank" rel="noopener noreferrer" style="color: #f2c94c; background: rgba(242, 201, 76, 0.15); border: 1px solid rgba(242, 201, 76, 0.35); padding: 5px 10px; border-radius: 6px; font-size: 12px; text-decoration: none; display: none; align-items: center; gap: 5px; font-weight: 600;">
                  <span>📺 Open in YouTube</span> ↗
                </a>
              </div>
              <button id="cv-btn-next" class="btn" style="background: rgba(242, 201, 76, 0.2); color: #f2c94c; border: 1px solid rgba(242,201,76,0.4); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 700;">Next Video →</button>
            </div>
          </div>

          <!-- Right: Playlist -->
          <div style="background: #233129; border: 1px solid rgba(242, 201, 76, 0.25); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; overflow: hidden; max-height: 520px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(242, 201, 76, 0.2);">
              <span style="font-weight: 700; color: #f2c94c; font-size: 14px;">📋 Course Lectures & Playlist</span>
              <span id="cv-playlist-count" style="font-size: 12px; background: rgba(242,201,76,0.15); color: #f2c94c; padding: 2px 8px; border-radius: 12px; font-weight: 700;">0 videos</span>
            </div>
            <div id="cv-playlist-container" style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto; flex: 1; padding-right: 4px;">
              <!-- Playlist items -->
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="padding: 12px 20px; background: #233129; border-top: 1px solid rgba(242, 201, 76, 0.2); display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
          <span style="color: #94a3b8;">ShortStudy Direct Video Player</span>
          <button type="button" onclick="closeCourseVideosModal()" style="background: rgba(242, 201, 76, 0.2); color: #f2c94c; border: 1px solid rgba(242, 201, 76, 0.4); padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12.5px;">Close Video</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  // Add responsive CSS for mobile
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    @media (max-width: 768px) {
      #cv-modal-grid {
        grid-template-columns: 1fr !important;
      }
    }
  `;
  document.head.appendChild(styleEl);

  const modalEl = document.getElementById("chalkboard-course-videos-modal");
  document.getElementById("cv-modal-close").addEventListener("click", closeCourseVideosModal);

  // Stop video and close if background overlay is clicked
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) {
      closeCourseVideosModal();
    }
  });

  // Stop video on Escape key
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalEl.style.display === "flex") {
      closeCourseVideosModal();
    }
  });
}

let activeModalCourse = null;
let activeModalVideos = [];
let activeVideoIndex = 0;

function renderActiveModalVideo() {
  const container = document.getElementById("cv-player-container");
  const titleEl = document.getElementById("cv-active-video-title");
  const descEl = document.getElementById("cv-active-video-desc");
  const counterEl = document.getElementById("cv-video-counter");
  const prevBtn = document.getElementById("cv-btn-prev");
  const nextBtn = document.getElementById("cv-btn-next");
  const ytLink = document.getElementById("cv-watch-on-youtube");

  if (!activeModalVideos || activeModalVideos.length === 0) {
    if (container) container.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #94a3b8; font-size: 14px;">No videos attached to this course yet.</div>`;
    if (titleEl) titleEl.textContent = "No Videos Available";
    if (descEl) descEl.textContent = "Check back soon or explore the companion course notes.";
    if (counterEl) counterEl.textContent = "0 of 0";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    if (ytLink) ytLink.style.display = "none";
    return;
  }

  const v = activeModalVideos[activeVideoIndex] || activeModalVideos[0];
  const rawUrl = v.url || v.videoUrl || v.videoEmbed || v.embedCode || "";
  const title = v.title || `Lecture ${activeVideoIndex + 1}`;
  const desc = v.description || v.videoDescription || v.videoNotes || "No extra study notes provided for this lecture.";

  if (container) {
    container.innerHTML = processEmbedCode(rawUrl);
  }
  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = desc;
  if (counterEl) counterEl.textContent = `Video ${activeVideoIndex + 1} of ${activeModalVideos.length}`;

  const vidId = extractYouTubeVideoId(rawUrl);
  if (ytLink) {
    if (vidId) {
      ytLink.href = `https://www.youtube.com/watch?v=${vidId}`;
      ytLink.style.display = "inline-flex";
    } else {
      ytLink.style.display = "none";
    }
  }

  if (prevBtn) {
    prevBtn.disabled = activeVideoIndex <= 0;
    prevBtn.style.opacity = activeVideoIndex <= 0 ? "0.5" : "1";
  }
  if (nextBtn) {
    nextBtn.disabled = activeVideoIndex >= activeModalVideos.length - 1;
    nextBtn.style.opacity = activeVideoIndex >= activeModalVideos.length - 1 ? "0.5" : "1";
  }

  // Highlight active playlist item
  document.querySelectorAll(".cv-playlist-item").forEach((btn, idx) => {
    if (idx === activeVideoIndex) {
      btn.style.background = "rgba(242, 201, 76, 0.25)";
      btn.style.borderColor = "#f2c94c";
    } else {
      btn.style.background = "rgba(255, 255, 255, 0.04)";
      btn.style.borderColor = "rgba(242, 201, 76, 0.15)";
    }
  });
}

window.openCourseVideosModal = async function(courseId) {
  const course = cachedCourses.find(c => c.id === courseId || c.slug === courseId) || PRE_EXISTING_COURSES.find(c => c.id === courseId || c.slug === courseId);
  if (!course) return;

  const isPaid = isCoursePaid(course);

  // STRICT PAYWALL & ACCESS ENFORCEMENT
  if (isPaid) {
    const isAdminUser = currentUserEmail && currentUserEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    if (!isAdminUser) {
      let isVerified = false;

      // 1. Check live cache of approved orders (check id and slug)
      if (purchasedCourseIdsFromOrders.has(course.id) || (course.slug && purchasedCourseIdsFromOrders.has(course.slug)) || purchasedCourseIdsFromOrders.has(courseId)) {
        isVerified = true;
      } else if (currentUserUid) {
        // 2. Query Firestore order document for verification
        try {
          const checkIds = [course.id, course.slug, courseId].filter(Boolean);
          for (const cid of checkIds) {
            const orderDocRef = doc(db, "course_orders", `${currentUserUid}_${cid}`);
            const orderSnap = await getDoc(orderDocRef);
            if (orderSnap.exists()) {
              const orderData = orderSnap.data();
              const isApproved = orderData.status === "approved";
              const isMarkedPurchased = orderData.isPurchased === true || orderData.purchased === true;
              if (isApproved && isMarkedPurchased) {
                isVerified = true;
                purchasedCourseIdsFromOrders.add(cid);
                purchasedCourseIdsFromOrders.add(course.id);
                if (course.slug) purchasedCourseIdsFromOrders.add(course.slug);
                break;
              }
            }
          }
        } catch (err) {
          console.error("Firestore order verification failed:", err);
        }
      }

      if (!isVerified) {
        // HARD BLOCK: Wipe any player container so no video can be played
        const playerContainer = document.getElementById("cv-player-container");
        if (playerContainer) playerContainer.innerHTML = "";
        closeCourseVideosModal();

        // Automatically trigger the Checkout/Payment Modal demanding payment & UTR verification
        window.openCheckoutModal(courseId);
        return;
      }
    }
  }

  // 3. SANDBOXED VIDEO PLAYER RENDERING (ONLY UPON SUCCESSFUL VERIFICATION)
  ensureCourseVideosModal();
  activeModalCourse = course;
  activeModalVideos = normalizeCourseVideosList(course);
  activeVideoIndex = 0;

  const modal = document.getElementById("chalkboard-course-videos-modal");
  document.getElementById("cv-modal-title").textContent = course.title || "Course Videos";
  document.getElementById("cv-modal-badge").textContent = `${course.category || "Masterclass"} • ${course.duration || "Complete"}`;
  
  const modalLessonLink = document.getElementById("cv-modal-lesson-link");
  if (modalLessonLink) {
    const lessonLink = course.link || (course.slug ? `${course.slug}.html` : `lesson.html?course=${encodeURIComponent(course.id)}`);
    modalLessonLink.href = lessonLink;
  }

  const playlistContainer = document.getElementById("cv-playlist-container");
  document.getElementById("cv-playlist-count").textContent = `${activeModalVideos.length} video(s)`;

  if (activeModalVideos.length > 0) {
    playlistContainer.innerHTML = activeModalVideos.map((vid, idx) => `
      <div class="cv-playlist-item" data-idx="${idx}" style="padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(242,201,76,0.15); background: rgba(255,255,255,0.04); cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 10px;">
        <span style="background: rgba(242,201,76,0.2); color: #f2c94c; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; flex-shrink: 0;">${idx + 1}</span>
        <div style="overflow: hidden; flex: 1;">
          <div style="font-size: 13px; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(vid.title || `Lecture ${idx + 1}`)}</div>
          <div style="font-size: 11px; color: #94a3b8;">${vid.description ? escapeHtml(vid.description.substring(0, 45)) + '...' : 'Interactive lecture'}</div>
        </div>
        <span style="font-size: 14px; color: #f2c94c;">▶</span>
      </div>
    `).join("");

    playlistContainer.querySelectorAll(".cv-playlist-item").forEach(item => {
      item.addEventListener("click", () => {
        activeVideoIndex = parseInt(item.getAttribute("data-idx"), 10) || 0;
        renderActiveModalVideo();
      });
    });
  } else {
    playlistContainer.innerHTML = `<div style="color: #94a3b8; font-size: 13px; padding: 12px; text-align: center;">No video playlist entries added yet.</div>`;
  }

  // Navigation handlers
  document.getElementById("cv-btn-prev").onclick = () => {
    if (activeVideoIndex > 0) {
      activeVideoIndex--;
      renderActiveModalVideo();
    }
  };
  document.getElementById("cv-btn-next").onclick = () => {
    if (activeVideoIndex < activeModalVideos.length - 1) {
      activeVideoIndex++;
      renderActiveModalVideo();
    }
  };

  renderActiveModalVideo();
  modal.style.display = "flex";
};
window.openCourseVideo = window.openCourseVideosModal;

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function isCourseUnlocked(courseId) {
  if (currentUserEmail) {
    const emailLower = currentUserEmail.toLowerCase();
    if (
      emailLower === ADMIN_EMAIL.toLowerCase() ||
      emailLower.startsWith("admin@") ||
      emailLower === "gauravfartiyal751@gmail.com"
    ) {
      return true; // Admin gets direct 100% free access immediately
    }
  }
  if (!courseId) return false;
  if (purchasedCourseIdsFromOrders.has(courseId)) return true;
  const course = (cachedCourses || []).find(c => c.id === courseId || c.slug === courseId);
  if (course) {
    if (purchasedCourseIdsFromOrders.has(course.id) || (course.slug && purchasedCourseIdsFromOrders.has(course.slug))) {
      return true;
    }
  }
  return false;
}

function ensureCheckoutModal() {
  if (document.getElementById("chalkboard-checkout-modal")) return;
  const modalHtml = `
    <div id="chalkboard-checkout-modal" style="display: none; position: fixed; inset: 0; z-index: 99999; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;">
      <div style="background: #2b3a32; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; border-radius: 16px; border: 1px solid rgba(242, 201, 76, 0.4); box-shadow: 0 24px 48px rgba(0,0,0,0.5); position: relative; padding: 24px; color: #f5f3ea; font-family: 'Work Sans', sans-serif;">
        <button id="checkout-close" style="position: absolute; top: 16px; right: 16px; background: rgba(242, 201, 76, 0.1); border: none; color: #f2c94c; width: 32px; height: 32px; border-radius: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; z-index: 5;">✕</button>
        
        <!-- COURSE HEADER -->
        <div style="text-align: center; margin-bottom: 20px;">
          <div id="checkout-summary-icon" style="font-size: 44px; margin-bottom: 6px;"></div>
          <img id="checkout-summary-img" src="" alt="Course Image" style="width: 100px; height: 100px; border-radius: 10px; margin: 0 auto 10px auto; display: none; object-fit: contain; background: #1b2620; border: 2px solid rgba(242,201,76,0.3);">
          <h2 id="checkout-summary-title" style="color: #f2c94c; font-family: 'Kalam', cursive; font-size: 24px; margin: 0 0 4px 0; line-height: 1.2;"></h2>
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 4px;">
            <span style="font-size: 13px; color: #d4d0c2;">Total Payable:</span>
            <span id="checkout-summary-price" style="color: #10b981; font-weight: 800; font-size: 20px;"></span>
          </div>
        </div>

        <!-- ==================== STEP 1: USER DETAILS ==================== -->
        <div id="checkout-step-1" style="display: block;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px dashed rgba(242, 201, 76, 0.3);">
            <span style="background: rgba(242, 201, 76, 0.15); color: #f2c94c; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; border: 1px solid rgba(242, 201, 76, 0.3);">
              Step 1 of 2: Student Details
            </span>
            <span style="font-size: 12px; color: #a8a495;">Next: UPI Payment</span>
          </div>

          <form id="checkout-form-step1" style="display: flex; flex-direction: column; gap: 14px;">
            <div>
              <label style="display: block; font-size: 13px; color: #f2c94c; margin-bottom: 5px; font-weight: 600;">Full Name *</label>
              <input type="text" id="checkout-input-name" required style="width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(242,201,76,0.3); color: #fff; font-size: 15px;" placeholder="e.g. Rahul Sharma">
            </div>
            <div>
              <label style="display: block; font-size: 13px; color: #f2c94c; margin-bottom: 5px; font-weight: 600;">Email Address *</label>
              <input type="email" id="checkout-input-email" required style="width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(242,201,76,0.3); color: #fff; font-size: 15px;" placeholder="e.g. rahul@example.com">
            </div>
            <div>
              <label style="display: block; font-size: 13px; color: #f2c94c; margin-bottom: 5px; font-weight: 600;">Phone / WhatsApp Number *</label>
              <input type="tel" id="checkout-input-phone" required style="width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(242,201,76,0.3); color: #fff; font-size: 15px;" placeholder="e.g. +91 9876543210">
            </div>
            
            <div id="checkout-step1-error" style="display: none; color: #f43f5e; font-size: 13px; background: rgba(244, 63, 94, 0.1); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(244, 63, 94, 0.3);"></div>

            <button id="checkout-btn-to-step-2" type="button" style="background: #f2c94c; color: #1e2b25; font-weight: 800; font-size: 15px; padding: 13px; border-radius: 8px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 6px; transition: transform 0.15s;">
              <span>Next: Proceed to Payment</span>
              <span style="font-size: 18px;">→</span>
            </button>
          </form>
        </div>

        <!-- ==================== STEP 2: PAYMENT & PROOF ==================== -->
        <div id="checkout-step-2" style="display: none;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px dashed rgba(242, 201, 76, 0.3);">
            <span style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; border: 1px solid rgba(16, 185, 129, 0.3);">
              Step 2 of 2: Payment & Proof
            </span>
            <button id="checkout-btn-back" type="button" style="background: transparent; border: none; color: #f2c94c; font-size: 12px; cursor: pointer; text-decoration: underline;">
              ← Back to Details
            </button>
          </div>

          <!-- UPI Details Box -->
          <div style="background: #22302a; border: 1px solid rgba(242,201,76,0.35); border-radius: 10px; padding: 14px; margin-bottom: 14px; text-align: center;">
            <div style="font-size: 13px; color: #f5f3ea; margin-bottom: 8px;">
              Pay using any UPI App (GPay, PhonePe, Paytm, BHIM)
            </div>
            
            <div style="background: rgba(255,255,255,0.06); padding: 8px 12px; border-radius: 6px; display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; border: 1px dashed rgba(242,201,76,0.4);">
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 14px; color: #f2c94c; font-weight: bold; letter-spacing: 0.5px;" id="checkout-upi-text">9315671951@upi</span>
              <button type="button" id="checkout-copy-upi-btn" style="background: #f2c94c; color: #1e2b25; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; cursor: pointer;">
                📋 Copy UPI
              </button>
            </div>

            <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
              <img id="checkout-upi-qr" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi%3A%2F%2Fpay%3Fpa%3D9315671951%40upi%26pn%3DShortStudy%26cu%3DINR" alt="UPI QR Code" style="width: 130px; height: 130px; border-radius: 8px; border: 2px solid rgba(242,201,76,0.5); background: white; padding: 4px; display: block;">
              <span style="font-size: 11px; color: #a8a495;">Scan with any UPI app to pay</span>
            </div>
          </div>

          <form id="chalkboard-checkout-form" style="display: flex; flex-direction: column; gap: 14px;">
            <!-- 12-Digit UTR -->
            <div>
              <label style="display: block; font-size: 13px; color: #10b981; margin-bottom: 5px; font-weight: 700;">
                12-Digit UTR / Transaction ID *
              </label>
              <input type="text" id="checkout-input-utr" required pattern="[0-9]{12}" maxlength="12" minlength="12" style="width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1.5px solid #10b981; color: #fff; font-size: 15px; font-family: 'JetBrains Mono', monospace;" placeholder="e.g. 401234567890">
              <span style="font-size: 11px; color: #a8a495; margin-top: 3px; display: block;">Found in your UPI payment receipt details (exactly 12 digits)</span>
            </div>

            <!-- Screenshot Upload -->
            <div>
              <label style="display: block; font-size: 13px; color: #f2c94c; margin-bottom: 5px; font-weight: 700;">
                Upload Payment Screenshot Proof *
              </label>
              <input type="file" id="checkout-input-screenshot" accept="image/*" required style="width: 100%; box-sizing: border-box; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px dashed rgba(242,201,76,0.4); color: #fff; font-size: 13px; cursor: pointer;">
              
              <div id="checkout-screenshot-preview" style="display: none; margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.25); border-radius: 8px; border: 1px solid rgba(242,201,76,0.2); align-items: center; gap: 10px;">
                <img id="checkout-preview-img" src="" alt="Proof Preview" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(242,201,76,0.4);">
                <div style="flex: 1; min-width: 0;">
                  <div id="checkout-preview-name" style="font-size: 12px; color: #f5f3ea; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
                  <div style="font-size: 11px; color: #10b981;">✓ Ready to upload</div>
                </div>
              </div>
            </div>

            <div id="checkout-step2-error" style="display: none; color: #f43f5e; font-size: 13px; background: rgba(244, 63, 94, 0.1); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(244, 63, 94, 0.3);"></div>

            <button id="checkout-submit-button" type="submit" style="background: #10b981; color: #ffffff; font-weight: 800; font-size: 15px; padding: 14px; border-radius: 8px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 4px; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">
              <span>⚡ Submit Proof & UTR for Verification</span>
              <span style="font-size: 18px;">→</span>
            </button>
          </form>
        </div>

        <!-- ==================== STEP 3: SUCCESS CONFIRMATION ==================== -->
        <div id="checkout-step-success" style="display: none; text-align: center; padding: 16px 0;">
          <div style="font-size: 48px; margin-bottom: 8px;">⏳</div>
          <h2 style="color: #F2C94C; font-size: 24px; margin: 0 0 8px 0; font-family: 'Kalam', cursive;">Order Submitted!</h2>
          <p style="color: #F5F3EA; font-size: 14.5px; margin-bottom: 16px; line-height: 1.5;">
            Admin will verify your UTR and screenshot proof and grant access shortly.
          </p>
          <div id="checkout-access-status" style="margin-top: 16px; padding: 14px; background: rgba(242, 201, 76, 0.1); border: 1px solid rgba(242, 201, 76, 0.3); border-radius: 8px; font-size: 13.5px; color: #F5F3EA; text-align: left;">
            <div style="color: #F2C94C; font-weight: 700; margin-bottom: 4px;">🔒 Verification in Progress:</div>
            <div>Materials will unlock automatically as soon as the Admin approves your payment proof.</div>
          </div>
        </div>

      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  // Close handler
  document.getElementById("checkout-close").addEventListener("click", () => {
    document.getElementById("chalkboard-checkout-modal").style.display = "none";
    activeCheckoutCourseId = null;
  });

  // Copy UPI button
  document.getElementById("checkout-copy-upi-btn")?.addEventListener("click", () => {
    navigator.clipboard?.writeText("9315671951@upi").then(() => {
      const btn = document.getElementById("checkout-copy-upi-btn");
      if (btn) {
        btn.textContent = "✓ Copied!";
        setTimeout(() => { btn.textContent = "📋 Copy UPI"; }, 2000);
      }
    }).catch(() => {
      prompt("Copy UPI ID:", "9315671951@upi");
    });
  });

  // Screenshot input preview
  const screenshotInput = document.getElementById("checkout-input-screenshot");
  screenshotInput?.addEventListener("change", () => {
    const file = screenshotInput.files && screenshotInput.files[0];
    const previewContainer = document.getElementById("checkout-screenshot-preview");
    const previewImg = document.getElementById("checkout-preview-img");
    const previewName = document.getElementById("checkout-preview-name");
    if (file) {
      previewName.textContent = file.name;
      const objectUrl = URL.createObjectURL(file);
      previewImg.src = objectUrl;
      previewContainer.style.display = "flex";
    } else {
      previewContainer.style.display = "none";
    }
  });

  // Step 1 -> Step 2 Navigation
  document.getElementById("checkout-btn-to-step-2").addEventListener("click", () => {
    const name = document.getElementById("checkout-input-name").value.trim();
    const email = document.getElementById("checkout-input-email").value.trim();
    const phone = document.getElementById("checkout-input-phone").value.trim();
    const errEl = document.getElementById("checkout-step1-error");

    if (!name || name.length < 2) {
      errEl.textContent = "Please enter your full name.";
      errEl.style.display = "block";
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errEl.textContent = "Please enter a valid email address.";
      errEl.style.display = "block";
      return;
    }
    if (!phone || phone.replace(/\D/g, "").length < 7) {
      errEl.textContent = "Please enter a valid phone/WhatsApp number.";
      errEl.style.display = "block";
      return;
    }

    errEl.style.display = "none";
    document.getElementById("checkout-step-1").style.display = "none";
    document.getElementById("checkout-step-2").style.display = "block";
  });

  // Step 2 -> Step 1 Back Navigation
  document.getElementById("checkout-btn-back").addEventListener("click", () => {
    document.getElementById("checkout-step-2").style.display = "none";
    document.getElementById("checkout-step-1").style.display = "block";
  });
}

window.openCheckoutModal = function(courseId) {
  ensureCheckoutModal();
  const course = cachedCourses.find(c => c.id === courseId || c.slug === courseId) || PRE_EXISTING_COURSES.find(c => c.id === courseId || c.slug === courseId);
  if (!course) return;

  activeCheckoutCourseId = courseId;
  const modal = document.getElementById("chalkboard-checkout-modal");
  const step1 = document.getElementById("checkout-step-1");
  const step2 = document.getElementById("checkout-step-2");
  const stepSuccess = document.getElementById("checkout-step-success");
  
  step1.style.display = "block";
  step2.style.display = "none";
  stepSuccess.style.display = "none";

  const imgEl = document.getElementById("checkout-summary-img");
  const iconEl = document.getElementById("checkout-summary-icon");
  const photo = course.imageUrl || course.courseImage || course.image || "";
  
  if (photo) {
    imgEl.src = photo;
    imgEl.style.display = "block";
    iconEl.style.display = "none";
  } else {
    imgEl.style.display = "none";
    iconEl.style.display = "block";
    iconEl.textContent = course.icon || "⭐";
  }
  
  document.getElementById("checkout-summary-title").textContent = course.title || "Masterclass";
  document.getElementById("checkout-summary-price").textContent = course.price || "₹499";

  const emailInput = document.getElementById("checkout-input-email");
  const nameInput = document.getElementById("checkout-input-name");
  if (emailInput && currentUserEmail) {
    emailInput.value = currentUserEmail;
  }
  if (nameInput && currentUserName) {
    nameInput.value = currentUserName;
  }

  // Clear errors and inputs for step 2
  const errStep1 = document.getElementById("checkout-step1-error");
  const errStep2 = document.getElementById("checkout-step2-error");
  if (errStep1) errStep1.style.display = "none";
  if (errStep2) errStep2.style.display = "none";
  const utrInput = document.getElementById("checkout-input-utr");
  if (utrInput) utrInput.value = "";
  const screenshotInput = document.getElementById("checkout-input-screenshot");
  if (screenshotInput) screenshotInput.value = "";
  const previewContainer = document.getElementById("checkout-screenshot-preview");
  if (previewContainer) previewContainer.style.display = "none";

  const form = document.getElementById("chalkboard-checkout-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById("checkout-input-name").value.trim();
    const email = document.getElementById("checkout-input-email").value.trim();
    const phone = document.getElementById("checkout-input-phone").value.trim();
    const utr = document.getElementById("checkout-input-utr").value.trim();
    const fileInput = document.getElementById("checkout-input-screenshot");
    const file = fileInput?.files && fileInput.files[0];
    
    if (!/^\d{12}$/.test(utr)) {
      if (errStep2) {
        errStep2.textContent = "Please enter a valid 12-digit UTR number.";
        errStep2.style.display = "block";
      } else {
        alert("Please enter a valid 12-digit UTR number.");
      }
      return;
    }

    if (!file) {
      if (errStep2) {
        errStep2.textContent = "Please upload your payment screenshot image proof.";
        errStep2.style.display = "block";
      } else {
        alert("Please upload your payment screenshot image proof.");
      }
      return;
    }

    if (errStep2) errStep2.style.display = "none";

    const submitBtn = document.getElementById("checkout-submit-button");
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>⏳ Uploading Proof & Submitting...</span>`;

    try {
      if (!db) throw new Error("Database not initialized.");

      // 1. Upload Screenshot to Firebase Storage (with Data URL fallback)
      let screenshotURL = "";
      try {
        if (storage && ref && uploadBytes && getDownloadURL) {
          const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storagePath = `payment_proofs/${Date.now()}_${cleanFileName}`;
          const proofStorageRef = ref(storage, storagePath);
          const uploadSnapshot = await uploadBytes(proofStorageRef, file);
          screenshotURL = await getDownloadURL(uploadSnapshot.ref);
        } else {
          screenshotURL = await readFileAsDataURL(file);
        }
      } catch (storageErr) {
        console.warn("Storage upload note, saving fallback proof:", storageErr);
        screenshotURL = await readFileAsDataURL(file);
      }

      // 2. Save Order Payload to Firestore collection "orders" and "course_orders"
      const orderPayload = {
        userName: name,
        userEmail: email,
        userPhone: phone,
        name: name,
        email: email,
        phone: phone,
        studentName: name,
        studentEmail: email,
        studentPhone: phone,
        courseId: course.id,
        courseTitle: course.title || "Course",
        amount: course.price || "₹499",
        utrNumber: utr,
        utr: utr,
        screenshotURL: screenshotURL,
        status: "pending",
        isPurchased: false,
        purchased: false,
        uid: currentUserUid || "",
        createdAt: serverTimestamp()
      };
      
      const uniqueTimestamp = Date.now();
      const orderId = `${currentUserUid || 'order'}_${course.id}_${uniqueTimestamp}`;
      const legacyOrderId = currentUserUid ? `${currentUserUid}_${course.id}` : orderId;

      // Save to "orders"
      await setDoc(doc(db, "orders", orderId), orderPayload);
      
      // Save to "course_orders"
      await setDoc(doc(db, "course_orders", legacyOrderId), orderPayload, { merge: true });

      // 3. Trigger confirmation alert
      alert("Order submitted! Admin will verify and grant access shortly.");
      
      step2.style.display = "none";
      stepSuccess.style.display = "block";
    } catch (err) {
      console.error("Order submission failed:", err);
      alert("Failed to submit order. Please try again: " + (err.message || ""));
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>⚡ Submit Proof & UTR for Verification</span><span style="font-size: 18px;">→</span>`;
    }
  };

  modal.style.display = "flex";
}

/* =========================================================
   5. AUTH MODAL (EMAIL & PASSWORD + GOOGLE SIGN-IN OAUTH)
   ========================================================= */
let authModalMode = "signin"; // "signin" or "signup"

function ensureAuthModal() {
  if (document.getElementById("chalkboard-auth-modal")) return;

  const modalHtml = `
    <div id="chalkboard-auth-modal" style="display: none; position: fixed; inset: 0; z-index: 999999; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;">
      <div style="background: #1e2b25; border: 2px solid #f2c94c; border-radius: 14px; width: 100%; max-width: 440px; box-shadow: 0 24px 60px rgba(0,0,0,0.85); overflow: hidden; display: flex; flex-direction: column; font-family: 'Work Sans', sans-serif; position: relative;">
        
        <!-- Header -->
        <div style="background: #16201b; padding: 18px 22px; border-bottom: 1px solid rgba(242, 201, 76, 0.25); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 26px;">🎓</span>
            <div>
              <h3 id="auth-modal-title" style="color: #f2c94c; font-family: 'Kalam', cursive; font-size: 22px; margin: 0; line-height: 1.2;">Welcome to ShortStudy</h3>
              <p id="auth-modal-subtitle" style="color: #94a3b8; font-size: 12.5px; margin: 2px 0 0 0;">Sign in to access tutorials & masterclasses</p>
            </div>
          </div>
          <button id="auth-modal-close" type="button" aria-label="Close" style="background: rgba(242, 201, 76, 0.15); border: 1px solid rgba(242, 201, 76, 0.3); color: #f2c94c; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold; transition: background 0.2s;">✕</button>
        </div>

        <!-- Auth Tabs: Sign In / Create Account -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; background: #16201b; border-bottom: 1px solid rgba(255,255,255,0.08);">
          <button id="auth-tab-signin" type="button" style="padding: 12px; font-family: 'Work Sans', sans-serif; font-weight: 700; font-size: 14px; background: transparent; color: #f2c94c; border: none; border-bottom: 2px solid #f2c94c; cursor: pointer; transition: all 0.2s;">
            Sign In
          </button>
          <button id="auth-tab-signup" type="button" style="padding: 12px; font-family: 'Work Sans', sans-serif; font-weight: 700; font-size: 14px; background: transparent; color: #94a3b8; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.2s;">
            Create Account
          </button>
        </div>

        <div style="padding: 22px 24px;">
          <!-- Error / Status Notice -->
          <div id="auth-status-message" style="display: none; padding: 10px 14px; border-radius: 6px; font-size: 13px; line-height: 1.4; margin-bottom: 14px;"></div>

          <!-- Auth Form -->
          <form id="auth-form" style="display: flex; flex-direction: column; gap: 14px;">
            <!-- Name Field (Only in Sign Up mode) -->
            <div id="auth-field-name-wrap" style="display: none;">
              <label for="auth-input-name" style="display: block; font-size: 13px; color: #f5f3ea; margin-bottom: 6px; font-weight: 600;">Full Name</label>
              <input type="text" id="auth-input-name" placeholder="e.g. Rahul Sharma" style="width: 100%; padding: 11px 14px; border-radius: 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(242, 201, 76, 0.25); color: #fff; font-size: 14.5px; box-sizing: border-box;">
            </div>

            <div>
              <label for="auth-input-email" style="display: block; font-size: 13px; color: #f5f3ea; margin-bottom: 6px; font-weight: 600;">Email Address</label>
              <input type="email" id="auth-input-email" required placeholder="you@example.com" style="width: 100%; padding: 11px 14px; border-radius: 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(242, 201, 76, 0.25); color: #fff; font-size: 14.5px; box-sizing: border-box;">
            </div>

            <div>
              <label for="auth-input-password" style="display: block; font-size: 13px; color: #f5f3ea; margin-bottom: 6px; font-weight: 600;">Password</label>
              <input type="password" id="auth-input-password" required minlength="6" placeholder="•••••••• (min 6 characters)" style="width: 100%; padding: 11px 14px; border-radius: 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(242, 201, 76, 0.25); color: #fff; font-size: 14.5px; box-sizing: border-box;">
            </div>

            <button id="auth-submit-btn" type="submit" style="background: #f2c94c; color: #1e2b25; font-weight: 700; font-size: 15px; padding: 12px; border-radius: 8px; border: none; cursor: pointer; margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 8px; transition: opacity 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
              <span id="auth-submit-text">Sign In to Account</span>
            </button>
          </form>

          <!-- Toggle Mode Link -->
          <div style="text-align: center; margin-top: 16px; font-size: 13px; color: #94a3b8;">
            <span id="auth-toggle-prompt">Don't have an account?</span>
            <button id="auth-toggle-btn" type="button" style="background: none; border: none; color: #f2c94c; font-weight: 700; cursor: pointer; text-decoration: underline; margin-left: 4px; font-size: 13px; font-family: inherit;">
              Create Free Account
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  // Shake animation helper
  window.shakeAuthModal = function() {
    const box = document.querySelector("#chalkboard-auth-modal > div");
    if (box) {
      box.classList.remove("modal-shake");
      void box.offsetWidth;
      box.classList.add("modal-shake");
    }
  };

  // Close handlers
  const modalEl = document.getElementById("chalkboard-auth-modal");
  document.getElementById("auth-modal-close")?.addEventListener("click", () => {
    if (!currentUserUid) {
      showAuthStatus("Sign in or account registration is compulsory to access ShortStudy.", "error");
      window.shakeAuthModal();
      return;
    }
    window.closeAuthModal(true);
  });
  modalEl?.addEventListener("click", (e) => {
    if (e.target === modalEl) {
      if (!currentUserUid) {
        showAuthStatus("Sign in or account registration is compulsory to access ShortStudy.", "error");
        window.shakeAuthModal();
        return;
      }
      window.closeAuthModal(true);
    }
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalEl && modalEl.style.display === "flex") {
      if (!currentUserUid) {
        showAuthStatus("Sign in or account registration is compulsory to access ShortStudy.", "error");
        window.shakeAuthModal();
        return;
      }
      window.closeAuthModal(true);
    }
  });

  // Tab buttons
  document.getElementById("auth-tab-signin")?.addEventListener("click", () => setAuthModalMode("signin"));
  document.getElementById("auth-tab-signup")?.addEventListener("click", () => setAuthModalMode("signup"));
  document.getElementById("auth-toggle-btn")?.addEventListener("click", () => {
    setAuthModalMode(authModalMode === "signin" ? "signup" : "signin");
  });

  // Email/Password Form Submit
  document.getElementById("auth-form")?.addEventListener("submit", handleEmailAuthSubmit);
}

function setAuthModalMode(mode) {
  authModalMode = mode;
  const titleEl = document.getElementById("auth-modal-title");
  const subtitleEl = document.getElementById("auth-modal-subtitle");
  const tabSignIn = document.getElementById("auth-tab-signin");
  const tabSignUp = document.getElementById("auth-tab-signup");
  const nameWrap = document.getElementById("auth-field-name-wrap");
  const submitText = document.getElementById("auth-submit-text");
  const togglePrompt = document.getElementById("auth-toggle-prompt");
  const toggleBtn = document.getElementById("auth-toggle-btn");
  const statusMsg = document.getElementById("auth-status-message");

  if (statusMsg) {
    statusMsg.style.display = "none";
    statusMsg.textContent = "";
  }

  if (mode === "signup") {
    if (titleEl) titleEl.textContent = "Create Free Account";
    if (subtitleEl) subtitleEl.textContent = "Start tracking your coding progress & masterclasses";
    if (tabSignUp) {
      tabSignUp.style.color = "#f2c94c";
      tabSignUp.style.borderBottom = "2px solid #f2c94c";
    }
    if (tabSignIn) {
      tabSignIn.style.color = "#94a3b8";
      tabSignIn.style.borderBottom = "2px solid transparent";
    }
    if (nameWrap) nameWrap.style.display = "block";
    if (submitText) submitText.textContent = "Create Free Account";
    if (togglePrompt) togglePrompt.textContent = "Already have an account?";
    if (toggleBtn) toggleBtn.textContent = "Sign In";
  } else {
    if (titleEl) titleEl.textContent = "Welcome Back";
    if (subtitleEl) subtitleEl.textContent = "Sign in to access your saved courses & lectures";
    if (tabSignIn) {
      tabSignIn.style.color = "#f2c94c";
      tabSignIn.style.borderBottom = "2px solid #f2c94c";
    }
    if (tabSignUp) {
      tabSignUp.style.color = "#94a3b8";
      tabSignUp.style.borderBottom = "2px solid transparent";
    }
    if (nameWrap) nameWrap.style.display = "none";
    if (submitText) submitText.textContent = "Sign In to Account";
    if (togglePrompt) togglePrompt.textContent = "Don't have an account?";
    if (toggleBtn) toggleBtn.textContent = "Create Free Account";
  }
}

function showAuthStatus(message, type) {
  const statusEl = document.getElementById("auth-status-message");
  if (!statusEl) return;
  if (type === "hide") {
    statusEl.style.display = "none";
    statusEl.textContent = "";
    return;
  }
  statusEl.style.display = "block";
  if (type === "success") {
    statusEl.style.background = "rgba(16, 185, 129, 0.18)";
    statusEl.style.border = "1px solid #10b981";
    statusEl.style.color = "#34d399";
  } else {
    statusEl.style.background = "rgba(239, 68, 68, 0.18)";
    statusEl.style.border = "1px solid #ef4444";
    statusEl.style.color = "#f87171";
  }
  statusEl.textContent = message;
}

async function handleEmailAuthSubmit(e) {
  e.preventDefault();
  const emailInput = document.getElementById("auth-input-email");
  const passwordInput = document.getElementById("auth-input-password");
  const nameInput = document.getElementById("auth-input-name");
  const submitBtn = document.getElementById("auth-submit-btn");
  const submitText = document.getElementById("auth-submit-text");

  const email = emailInput?.value?.trim() || "";
  const password = passwordInput?.value || "";
  const name = nameInput?.value?.trim() || "";

  if (!email || !password) {
    showAuthStatus("Please fill in both email and password.", "error");
    return;
  }

  if (password.length < 6) {
    showAuthStatus("Password must be at least 6 characters long.", "error");
    return;
  }

  showAuthStatus("", "hide");
  if (submitBtn) submitBtn.disabled = true;
  if (submitText) submitText.textContent = authModalMode === "signup" ? "Creating Account..." : "Signing In...";

  try {
    let cred = null;
    if (authModalMode === "signup") {
      cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name) {
        try {
          await updateProfile(cred.user, { displayName: name });
        } catch (e) {
          console.warn("updateProfile error:", e);
        }
      }
      await saveUserProfileToDatabase(cred.user, { name, provider: "password" });
      showAuthStatus("✓ Account created successfully! Welcome to ShortStudy.", "success");
    } else {
      cred = await signInWithEmailAndPassword(auth, email, password);
      await saveUserProfileToDatabase(cred.user, { provider: "password" });
      showAuthStatus("✓ Signed in successfully! Welcome back.", "success");
    }

    const authenticatedUser = cred ? cred.user : auth.currentUser;
    setTimeout(() => {
      window.closeAuthModal(true);
      if (authenticatedUser) {
        showProgrammerBenefitsShowcase(authenticatedUser);
      }
    }, 600);
  } catch (error) {
    console.warn("Email auth note:", error.code || error.message);
    let friendlyMessage = error.message || "Authentication failed.";
    if (error.code === "auth/email-already-in-use") {
      friendlyMessage = "This email is already registered. Please sign in with your password.";
      setAuthModalMode("signin");
      const emailField = document.getElementById("auth-input-email");
      if (emailField) emailField.value = email;
    } else if (
      error.code === "auth/invalid-credential" || 
      error.code === "auth/wrong-password" || 
      error.code === "auth/user-not-found"
    ) {
      friendlyMessage = "Invalid email or password. Please verify your credentials or create a new account.";
    } else if (error.code === "auth/weak-password") {
      friendlyMessage = "Password is too weak. Please use at least 6 characters.";
    } else if (error.code === "auth/invalid-email") {
      friendlyMessage = "Please enter a valid email address.";
    }
    showAuthStatus(friendlyMessage, "error");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (submitText) submitText.textContent = authModalMode === "signup" ? "Create Free Account" : "Sign In to Account";
  }
}

function openAuthModal(mode = "signin") {
  ensureAuthModal();
  setAuthModalMode(mode);
  const modalEl = document.getElementById("chalkboard-auth-modal");
  if (modalEl) {
    modalEl.style.display = "flex";
  }
}
window.openAuthModal = openAuthModal;

function closeAuthModal(force = false) {
  if (!force && !currentUserUid) {
    showAuthStatus("Sign in or account registration is compulsory to access ShortStudy.", "error");
    if (typeof window.shakeAuthModal === "function") {
      window.shakeAuthModal();
    }
    return;
  }
  const modalEl = document.getElementById("chalkboard-auth-modal");
  if (modalEl) {
    modalEl.style.display = "none";
  }
  if (currentUserUid) {
    removeCompulsoryLockOverlay();
  }
}
window.closeAuthModal = closeAuthModal;

// Initialize auth modal into DOM once ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    ensureAuthModal();
    ensureMobileBottomNav();
  });
} else {
  ensureAuthModal();
  ensureMobileBottomNav();
}

/* =========================================================
   PROGRAMMER BENEFITS ANIMATION SHOWCASE
   ========================================================= */
const PROGRAMMER_BENEFITS_DATA = [
  {
    step: 1,
    icon: "🚫 ➡️ 🏗️",
    badge: "BENEFIT 01 • ESCAPE TUTORIAL HELL",
    title: "First-Principles Architecture & Deep Systems",
    subtitle: "Learn the 'Why' behind code instead of blind copy-pasting.",
    desc: "Most tutorials trap developers into passive video watching. ShortStudy focuses on the mechanics of software engineering: memory allocations in C, scalable object-oriented design in Java, clean algorithms in Python, and transactional integrity in SQL.",
    highlights: [
      "Low-level memory safety & pointer architecture",
      "Enterprise OOP patterns (SOLID, Factory, Observer)",
      "Time & space complexity trade-offs for interviews",
      "Zero fluff: 100% focused developer blueprints"
    ],
    codePreview: {
      bad: "// ❌ Passive tutorial trap:\nprint('Hello world!')\n// Copy-pasted with zero architectural context",
      good: "// ✅ ShortStudy Engineering Blueprint:\nclass ConnectionPool {\n  acquire(): ManagedSocket; // Handles backpressure & concurrency\n}"
    }
  },
  {
    step: 2,
    icon: "🧠 ⚡",
    badge: "BENEFIT 02 • ACTIVE KNOWLEDGE RETENTION",
    title: "Instant Interactive MCQ Diagnostics & Edge Cases",
    subtitle: "Passive reading decays fast. Active recall builds permanent skill.",
    desc: "Every tutorial includes instant-scoring diagnostic challenges. Test yourself on tricky compiler pitfalls, variable scoping, pointer arithmetic, and algorithmic edge cases that top tech interviewers test for.",
    highlights: [
      "Instant scoring with detailed reasoning explanations",
      "Curated interview traps & common production bugs",
      "Active recall scientifically proven to boost retention",
      "Diagnostic checkpoints after every core chapter"
    ],
    codePreview: {
      bad: "// ❌ Passive Reading Result:\n\"I watched 30 hours of video, but blanked out on basic pointer questions.\"",
      good: "// ✅ ShortStudy Interactive Diagnostic:\nQ: What is the output of *ptr++ vs (*ptr)++?\n✓ Instant validation & memory retention hook!"
    }
  },
  {
    step: 3,
    icon: "💼 🚀",
    badge: "BENEFIT 03 • CAREER-DEFINING PORTFOLIOS",
    title: "Production Masterclasses That Impress Recruiters",
    subtitle: "Move beyond toy todo-lists to verified production architectures.",
    desc: "Hiring managers look for systems with authentication, database indexes, ACID compliance, and concurrency controls. Our guided masterclasses provide production blueprints you can proudly showcase on your resume.",
    highlights: [
      "Real-world enterprise system architectures",
      "Database schema optimization & query performance",
      "Direct code guidance & handwritten study notes",
      "Verified course credentials & portfolio blueprints"
    ],
    codePreview: {
      bad: "// ❌ Toy portfolio project:\nBasic static todo app in local storage (recruiters ignore this)",
      good: "// ✅ ShortStudy Masterclass Project:\nConcurrent distributed queue with UTR verification & RBAC rules"
    }
  },
  {
    step: 4,
    icon: "🎨 🧘",
    badge: "BENEFIT 04 • ERGONOMIC COGNITIVE FLOW",
    title: "Chalkboard Dark Palette for Deep Focus",
    subtitle: "Built for developers who spend 8+ hours immersed in code.",
    desc: "Our signature Chalkboard Green (#2B3A32) and Chalk Yellow (#F2C94C) aesthetic eliminates eye fatigue. High mathematical contrast, zero annoying popup ads, and lightning-fast loading across all your devices.",
    highlights: [
      "Zero eye burn during late-night debugging marathons",
      "100% Free core handwritten curriculum & notes",
      "Responsive layout optimized for Mobile, Tablet, and Desktop",
      "Distraction-free environment built for deep work"
    ],
    codePreview: {
      bad: "// ❌ Ad-heavy documentation sites:\nFlashing banners, intrusive popups, subscription blockers",
      good: "// ✅ ShortStudy Clean Canvas:\nPure chalkboard elegance & focused developer flow"
    }
  }
];

let currentBenefitSlideIndex = 0;
let benefitAutoPlayTimer = null;
let isBenefitAutoPlaying = false;

function ensureProgrammerBenefitsModal() {
  if (document.getElementById("programmer-benefits-modal")) return;

  const modalHtml = `
    <div id="programmer-benefits-modal" style="display: none; position: fixed; inset: 0; z-index: 999998; background: rgba(14, 22, 18, 0.88); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); align-items: center; justify-content: center; padding: 16px; box-sizing: border-box;">
      <div style="background: #1e2b25; border: 2px solid #f2c94c; border-radius: 16px; width: 100%; max-width: 680px; box-shadow: 0 24px 70px rgba(0,0,0,0.9), 0 0 20px rgba(242,201,76,0.25); overflow: hidden; display: flex; flex-direction: column; font-family: 'Work Sans', sans-serif; position: relative; animation: modalSlideUpFade 0.35s cubic-bezier(0.16, 1, 0.3, 1);">
        
        <!-- Modal Top Bar -->
        <div style="background: #16201b; padding: 16px 20px; border-bottom: 1px solid rgba(242, 201, 76, 0.25); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">💡</span>
            <div>
              <div style="font-size: 11px; font-weight: 800; color: #f2c94c; letter-spacing: 0.08em; text-transform: uppercase;">
                DEVELOPER ARCHITECTURE BRIEFING
              </div>
              <h3 style="color: #f5f3ea; font-family: 'Kalam', cursive; font-size: 20px; margin: 2px 0 0; line-height: 1.2;">
                Why ShortStudy is Beneficial for Programmers
              </h3>
            </div>
          </div>
          <button id="benefit-modal-close" type="button" aria-label="Close" style="background: rgba(242, 201, 76, 0.12); border: 1px solid rgba(242, 201, 76, 0.3); color: #f2c94c; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: bold; transition: background 0.2s;">✕</button>
        </div>

        <!-- Step Progress Bar & Dots -->
        <div style="background: #16201b; padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span id="benefit-step-indicator" style="font-size: 12px; font-weight: 700; color: #f2c94c; font-family: 'Kalam', cursive;">
              Benefit 1 of 4
            </span>
            <button id="benefit-autoplay-toggle" type="button" style="background: none; border: none; color: #94a3b8; font-size: 11.5px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
              <span>▶ Auto-play</span>
            </button>
          </div>
          <div style="width: 100%; height: 5px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
            <div id="benefit-progress-fill" style="height: 100%; width: 25%; background: #f2c94c; border-radius: 4px; transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 0 10px rgba(242,201,76,0.6);"></div>
          </div>
        </div>

        <!-- Dynamic Slide Content Container -->
        <div id="benefit-slide-viewport" style="padding: 22px 24px; min-height: 330px; display: flex; flex-direction: column; justify-content: space-between; overflow-y: auto; max-height: 60vh;">
          <!-- Slide content injected here dynamically -->
        </div>

        <!-- Footer Navigation Controls -->
        <div style="background: #16201b; padding: 14px 20px; border-top: 1px solid rgba(242, 201, 76, 0.2); display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="benefit-dont-show-checkbox" style="cursor: pointer; accent-color: #f2c94c;">
            <label for="benefit-dont-show-checkbox" style="font-size: 12px; color: #94a3b8; cursor: pointer;">Don't show on next login</label>
          </div>

          <div style="display: flex; gap: 10px;">
            <button id="benefit-prev-btn" type="button" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #f5f3ea; font-size: 13.5px; font-weight: 700; padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
              ← Back
            </button>
            <button id="benefit-next-btn" type="button" style="background: #f2c94c; color: #1e2b25; border: none; font-size: 13.5px; font-weight: 800; padding: 8px 20px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(242,201,76,0.3); transition: all 0.2s;">
              <span id="benefit-next-text">Next Benefit →</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  // Close handlers
  const modalEl = document.getElementById("programmer-benefits-modal");
  document.getElementById("benefit-modal-close")?.addEventListener("click", () => {
    closeProgrammerBenefitsShowcase();
  });
  modalEl?.addEventListener("click", (e) => {
    if (e.target === modalEl) {
      closeProgrammerBenefitsShowcase();
    }
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalEl && modalEl.style.display === "flex") {
      closeProgrammerBenefitsShowcase();
    }
  });

  // Next / Prev buttons
  document.getElementById("benefit-prev-btn")?.addEventListener("click", () => {
    stopBenefitAutoPlay();
    if (currentBenefitSlideIndex > 0) {
      renderBenefitSlide(currentBenefitSlideIndex - 1);
    }
  });

  document.getElementById("benefit-next-btn")?.addEventListener("click", () => {
    stopBenefitAutoPlay();
    if (currentBenefitSlideIndex < PROGRAMMER_BENEFITS_DATA.length - 1) {
      renderBenefitSlide(currentBenefitSlideIndex + 1);
    } else {
      triggerBenefitCompletion();
    }
  });

  // Auto-play button
  document.getElementById("benefit-autoplay-toggle")?.addEventListener("click", () => {
    if (isBenefitAutoPlaying) {
      stopBenefitAutoPlay();
    } else {
      startBenefitAutoPlay();
    }
  });
}

function renderBenefitSlide(index) {
  currentBenefitSlideIndex = index;
  const slide = PROGRAMMER_BENEFITS_DATA[index];
  const viewport = document.getElementById("benefit-slide-viewport");
  const stepIndicator = document.getElementById("benefit-step-indicator");
  const progressFill = document.getElementById("benefit-progress-fill");
  const prevBtn = document.getElementById("benefit-prev-btn");
  const nextText = document.getElementById("benefit-next-text");

  if (stepIndicator) {
    stepIndicator.textContent = `Benefit ${index + 1} of ${PROGRAMMER_BENEFITS_DATA.length} — ${slide.badge}`;
  }
  if (progressFill) {
    const pct = ((index + 1) / PROGRAMMER_BENEFITS_DATA.length) * 100;
    progressFill.style.width = pct + "%";
  }
  if (prevBtn) {
    prevBtn.style.visibility = index === 0 ? "hidden" : "visible";
  }
  if (nextText) {
    nextText.textContent = index === PROGRAMMER_BENEFITS_DATA.length - 1 ? "Start Coding Now 🚀" : "Next Benefit →";
  }

  if (viewport && slide) {
    viewport.style.animation = "none";
    void viewport.offsetWidth; // reflow
    viewport.style.animation = "benefitSlideIn 0.3s cubic-bezier(0.2, 0.9, 0.4, 1)";

    viewport.innerHTML = `
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <span style="font-size: 28px;">${slide.icon}</span>
          <span style="display: inline-block; padding: 4px 10px; background: rgba(242, 201, 76, 0.15); border: 1px solid rgba(242, 201, 76, 0.35); border-radius: 12px; color: #f2c94c; font-size: 11.5px; font-weight: 700; letter-spacing: 0.05em;">
            ${slide.badge}
          </span>
        </div>

        <h2 style="color: #f5f3ea; font-family: 'Kalam', cursive; font-size: 24px; margin: 4px 0 6px; line-height: 1.25;">
          ${slide.title}
        </h2>
        <p style="color: #f2c94c; font-size: 13.5px; font-weight: 600; margin: 0 0 10px 0;">
          ${slide.subtitle}
        </p>

        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          ${slide.desc}
        </p>

        <!-- Highlights Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; margin-bottom: 16px;">
          ${slide.highlights.map(h => `
            <div style="display: flex; align-items: center; gap: 7px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); padding: 8px 12px; border-radius: 8px; font-size: 12.5px; color: #f5f3ea;">
              <span style="color: #f2c94c; font-weight: bold;">✓</span>
              <span>${h}</span>
            </div>
          `).join("")}
        </div>

        <!-- Interactive Comparison Code Preview -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; background: #131c17; border: 1px solid rgba(242,201,76,0.25); border-radius: 10px; padding: 12px;">
          <div style="font-family: 'Courier New', monospace; font-size: 11.5px; color: #f87171; line-height: 1.45; white-space: pre-wrap; background: rgba(239,68,68,0.07); padding: 8px 10px; border-radius: 6px; border-left: 3px solid #ef4444;">
${slide.codePreview.bad}
          </div>
          <div style="font-family: 'Courier New', monospace; font-size: 11.5px; color: #4ade80; line-height: 1.45; white-space: pre-wrap; background: rgba(74,222,128,0.07); padding: 8px 10px; border-radius: 6px; border-left: 3px solid #22c55e;">
${slide.codePreview.good}
          </div>
        </div>
      </div>
    `;
  }
}

function startBenefitAutoPlay() {
  isBenefitAutoPlaying = true;
  const toggleBtn = document.getElementById("benefit-autoplay-toggle");
  if (toggleBtn) toggleBtn.innerHTML = "<span>⏸ Pause</span>";

  clearInterval(benefitAutoPlayTimer);
  benefitAutoPlayTimer = setInterval(() => {
    if (currentBenefitSlideIndex < PROGRAMMER_BENEFITS_DATA.length - 1) {
      renderBenefitSlide(currentBenefitSlideIndex + 1);
    } else {
      stopBenefitAutoPlay();
    }
  }, 4500);
}

function stopBenefitAutoPlay() {
  isBenefitAutoPlaying = false;
  clearInterval(benefitAutoPlayTimer);
  const toggleBtn = document.getElementById("benefit-autoplay-toggle");
  if (toggleBtn) toggleBtn.innerHTML = "<span>▶ Auto-play</span>";
}

function triggerBenefitCompletion() {
  stopBenefitAutoPlay();
  const checkbox = document.getElementById("benefit-dont-show-checkbox");
  if (checkbox && checkbox.checked && currentUserUid) {
    try {
      localStorage.setItem("shortstudy_benefit_animation_seen_" + currentUserUid, "true");
    } catch (e) {
      console.warn("Storage note:", e);
    }
  }

  // Celebratory particles
  createChalkCelebrationParticles();

  const nextBtn = document.getElementById("benefit-next-btn");
  if (nextBtn) {
    nextBtn.innerHTML = "<span>🎉 Ready to Code!</span>";
  }

  setTimeout(() => {
    closeProgrammerBenefitsShowcase();
  }, 700);
}

function createChalkCelebrationParticles() {
  const container = document.getElementById("programmer-benefits-modal");
  if (!container) return;
  for (let i = 0; i < 24; i++) {
    const p = document.createElement("div");
    p.style.position = "absolute";
    p.style.width = Math.floor(Math.random() * 8 + 4) + "px";
    p.style.height = p.style.width;
    p.style.backgroundColor = ["#f2c94c", "#4ade80", "#38bdf8", "#f472b6"][i % 4];
    p.style.borderRadius = "50%";
    p.style.left = "50%";
    p.style.top = "50%";
    p.style.zIndex = "999999";
    p.style.pointerEvents = "none";
    p.style.transform = `translate(${(Math.random() - 0.5) * 360}px, ${(Math.random() - 0.5) * 360}px) scale(${Math.random() + 0.5})`;
    p.style.transition = "all 0.8s cubic-bezier(0.25, 1, 0.5, 1)";
    p.style.opacity = "1";
    container.appendChild(p);

    setTimeout(() => {
      p.style.opacity = "0";
      setTimeout(() => p.remove(), 800);
    }, 50);
  }
}

function showProgrammerBenefitsShowcase(user, force = false) {
  if (!force && user && user.uid) {
    const seen = localStorage.getItem("shortstudy_benefit_animation_seen_" + user.uid);
    if (seen === "true") return;
  }

  ensureProgrammerBenefitsModal();
  renderBenefitSlide(0);

  const modalEl = document.getElementById("programmer-benefits-modal");
  if (modalEl) {
    modalEl.style.display = "flex";
  }
}
window.showProgrammerBenefitsShowcase = showProgrammerBenefitsShowcase;

function closeProgrammerBenefitsShowcase() {
  stopBenefitAutoPlay();
  const modalEl = document.getElementById("programmer-benefits-modal");
  if (modalEl) {
    modalEl.style.display = "none";
  }
}
window.closeProgrammerBenefitsShowcase = closeProgrammerBenefitsShowcase;

/* =========================================================
   MOBILE BOTTOM NAVIGATION BAR (10/10 APP EXPERIENCE)
   ========================================================= */
function ensureMobileBottomNav() {
  if (document.getElementById("mobile-bottom-nav")) return;

  const currentPath = window.location.pathname;
  const isHome = currentPath.endsWith("index.html") || currentPath === "/" || currentPath.endsWith("/");
  const isCourses = currentPath.includes("courses.html");
  const isTutorials = currentPath.includes("programming.html") || currentPath.includes("notes.html") || currentPath.includes("lecture.html");
  const isMCQs = currentPath.includes("test.html");

  const navHtml = `
    <nav id="mobile-bottom-nav" aria-label="Mobile Navigation">
      <a href="index.html" class="mobile-bottom-item ${isHome ? 'active' : ''}">
        <span class="mb-icon">🏠</span>
        <span>Home</span>
      </a>
      <a href="courses.html" class="mobile-bottom-item ${isCourses ? 'active' : ''}">
        <span class="mb-icon">🎓</span>
        <span>Courses</span>
      </a>
      <a href="programming.html" class="mobile-bottom-item ${isTutorials ? 'active' : ''}">
        <span class="mb-icon">💻</span>
        <span>Tutorials</span>
      </a>
      <a href="test.html" class="mobile-bottom-item ${isMCQs ? 'active' : ''}">
        <span class="mb-icon">✍️</span>
        <span>MCQs</span>
      </a>
      <button id="mb-nav-benefits-btn" type="button" class="mobile-bottom-item" style="background: none; border: none; cursor: pointer;">
        <span class="mb-icon">⚡</span>
        <span>Why Us</span>
      </button>
    </nav>
  `;

  document.body.insertAdjacentHTML("beforeend", navHtml);

  document.getElementById("mb-nav-benefits-btn")?.addEventListener("click", () => {
    showProgrammerBenefitsShowcase(auth.currentUser, true);
  });
}
window.ensureMobileBottomNav = ensureMobileBottomNav;

function getCoursePricingInfo(course) {
  const isPaid = isCoursePaid(course);
  if (!isPaid) {
    return {
      isPaid: false,
      discountPct: 0,
      origPriceStr: "",
      reducedPriceStr: "Free"
    };
  }

  let rawPrice = String(course.price || "₹499").trim();
  let rawOrig = String(course.originalPrice || course.origPrice || "").trim();

  let priceNum = parseInt(rawPrice.replace(/[^\d]/g, ""), 10);
  if (!priceNum || isNaN(priceNum)) priceNum = 499;

  let origNum = parseInt(rawOrig.replace(/[^\d]/g, ""), 10);
  if (!origNum || isNaN(origNum) || origNum <= priceNum) {
    origNum = Math.round(priceNum * 1.6);
  }

  let discountPct = Math.round(((origNum - priceNum) / origNum) * 100);
  if (course.discount) {
    const customPct = parseInt(String(course.discount).replace(/[^\d]/g, ""), 10);
    if (customPct && !isNaN(customPct)) discountPct = customPct;
  }

  const formatRupee = (num) => "₹" + num.toLocaleString("en-IN");

  return {
    isPaid: true,
    discountPct: discountPct > 0 ? discountPct : 35,
    origPriceStr: formatRupee(origNum),
    reducedPriceStr: formatRupee(priceNum)
  };
}

function renderCoursesUI(courses) {
  const freeGrid = document.getElementById("courses-grid");
  const paidGrid = document.getElementById("paid-courses-grid");
  const homepageGrid = document.getElementById("homepage-courses-grid");
  const curriculumGrid = document.getElementById("curriculum-courses-grid");
  
  let allCardsHtml = "";
  
  courses.forEach(course => {
    const isPaid = isCoursePaid(course);
    const hasAccess = !isPaid || isCourseUnlocked(course.id) || (course.slug && isCourseUnlocked(course.slug));
    const link = course.link || (course.slug ? `${course.slug}.html` : `courses.html`);
    const pricing = getCoursePricingInfo(course);
    
    let btnHtml;
    if (hasAccess) {
      btnHtml = `
        <div style="margin-top: auto; padding-top: 14px; border-top: 1px dashed rgba(242, 201, 76, 0.3);">
          <button type="button" onclick="window.openCourseVideosModal('${course.id}')" style="width: 100%; background: linear-gradient(135deg, #f2c94c 0%, #e5a812 100%); color: #18221b; font-weight: 800; border: none; padding: 12px 18px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 15px; box-shadow: 0 4px 14px rgba(0,0,0,0.25); transition: transform 0.15s, filter 0.15s;">
            <span style="font-size: 18px;">🎬</span> <span>Watch Videos</span>
          </button>
        </div>
      `;
    } else {
      btnHtml = `<div class="go" onclick="window.openCheckoutModal('${course.id}')" style="background: white; border-radius: 8px; padding: 12px; margin-top: auto; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                   <span style="color: #1b2620; font-family: 'Kalam', cursive; font-size: 20px; font-weight: bold;">Enroll Now</span>
                   <span style="font-size: 18px;">🔒</span>
                 </div>`;
    }

    const priceHtml = pricing.isPaid 
      ? `<div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
           <span style="color: #94a3b8; text-decoration: line-through; font-size: 14px; font-weight: 600; opacity: 0.85;">${pricing.origPriceStr}</span>
           <span class="num" style="background:rgba(242, 201, 76, 0.2); color:#f2c94c; padding:4px 10px; border-radius:6px; font-weight:700; font-size: 16px; border: 1px solid rgba(242, 201, 76, 0.3);">${pricing.reducedPriceStr}</span>
         </div>`
      : `<span class="num" style="background:rgba(16, 185, 129, 0.2); color:#10b981; padding:4px 10px; border-radius:6px; font-weight:700;">Free</span>`;
      
    const discountBadgeHtml = pricing.isPaid
      ? `<div style="position: absolute; top: 12px; left: 12px; background: #ef4444; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); font-family: 'JetBrains Mono', monospace; letter-spacing: 0.5px; z-index: 2; display: flex; align-items: center; gap: 4px;">
           <span>🏷️ ${pricing.discountPct}% OFF</span>
         </div>`
      : `<div style="position: absolute; top: 12px; left: 12px; background: #10b981; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.5); font-family: 'JetBrains Mono', monospace; letter-spacing: 0.5px; z-index: 2;">
           100% FREE
         </div>`;

    const imgSrc = course.imageUrl || course.courseImage || course.image;
    let imgHtml = "";
    if (imgSrc) {
      imgHtml = `
        <div style="position: relative; width: 100%; border-radius: 8px; overflow: hidden; margin-bottom: 14px; background: #16201b; border: 1px solid rgba(242, 201, 76, 0.25); display: flex; align-items: center; justify-content: center;">
          ${discountBadgeHtml}
          <img src="${imgSrc}" alt="${course.title || 'Course thumbnail'}" style="width: 100%; height: auto; max-height: none; display: block; object-fit: contain; border-radius: 6px;" loading="lazy">
        </div>
      `;
    } else {
      imgHtml = `
        <div style="position: relative; width: 100%; height: 160px; border-radius: 8px; overflow: hidden; margin-bottom: 14px; background: linear-gradient(135deg, #1b2620, #2b3a32); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(242, 201, 76, 0.25);">
          ${discountBadgeHtml}
          <span style="font-size: 44px;">${course.icon || '🚀'}</span>
        </div>
      `;
    }

    const card = `
      <div class="class-card" style="background: #2b3a32; color: #f2c94c; border: 1px solid rgba(242, 201, 76, 0.4); box-shadow: 4px 4px 0px rgba(242, 201, 76, 0.2); border-radius: 12px; transition: transform 0.2s; padding: 20px; display: flex; flex-direction: column; position: relative;">
        ${imgHtml}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap: wrap; gap: 8px;">
          ${priceHtml}
          <span class="num" style="font-size: 12px; font-weight:700; color: #f2c94c; text-transform:uppercase; opacity: 0.8;">${course.category || "Paid Masterclass"}</span>
        </div>
        <h3 style="color: #f2c94c; font-family: 'Kalam', cursive; font-size: 24px; margin-top: 0;">${course.title}</h3>
        <p style="color: #e2e8f0; font-family: 'Work Sans', sans-serif; opacity: 0.9; font-size: 14px; margin-bottom: 20px;">${course.description || "Comprehensive materials."}</p>
        ${btnHtml}
      </div>
    `;
    
    allCardsHtml += card;
  });

  if (paidGrid) paidGrid.innerHTML = allCardsHtml || `<div style="color:white; padding: 20px;">No masterclasses available.</div>`;
  if (homepageGrid) homepageGrid.innerHTML = allCardsHtml || `<div style="color:white; padding: 20px;">No courses available.</div>`;
}

let firestoreCourses = [];
let firestorePaidCourses = [];

function updateAndRenderMergedCourses() {
  const mergedMap = new Map();
  // Base courses first
  PRE_EXISTING_COURSES.forEach(c => {
    mergedMap.set(c.id, { ...c });
    if (c.slug) mergedMap.set(c.slug, { ...c });
  });
  
  // Override/Add Firestore courses
  firestoreCourses.forEach(c => {
    const existing = mergedMap.get(c.id) || (c.slug ? mergedMap.get(c.slug) : null) || {};
    const updated = { ...existing, ...c, type: "paid", isPaid: true, paid: true };
    mergedMap.set(c.id, updated);
    if (c.slug) mergedMap.set(c.slug, updated);
  });
  firestorePaidCourses.forEach(c => {
    const existing = mergedMap.get(c.id) || (c.slug ? mergedMap.get(c.slug) : null) || {};
    const updated = { ...existing, ...c, type: "paid", isPaid: true, paid: true };
    mergedMap.set(c.id, updated);
    if (c.slug) mergedMap.set(c.slug, updated);
  });
  
  // Deduplicate unique courses
  const uniqueCourses = [];
  const seenKeys = new Set();
  for (const c of mergedMap.values()) {
    const key = (c.slug || c.id || c.title || '').toLowerCase().trim();
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueCourses.push(c);
    }
  }
  uniqueCourses.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  cachedCourses = uniqueCourses;
  renderCoursesUI(cachedCourses);
}

export function initRealtimeSync() {
  if (!db) return;
  try {
    onSnapshot(collection(db, "courses"), (snapshot) => {
      firestoreCourses = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.isDeleted) {
          firestoreCourses.push({ id: docSnap.id, ...data, type: "paid", isPaid: true, paid: true });
        }
      });
      updateAndRenderMergedCourses();
    }, (err) => console.warn("Firestore courses listener error:", err));

    onSnapshot(collection(db, "paid_courses"), (snapshot) => {
      firestorePaidCourses = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.isDeleted) {
          firestorePaidCourses.push({ id: docSnap.id, ...data, type: "paid", isPaid: true, paid: true });
        }
      });
      updateAndRenderMergedCourses();
    }, (err) => console.warn("Firestore paid_courses listener error:", err));
  } catch (err) {
    console.error("Firestore Listener Setup Error:", err);
  }
}

// Run immediately and guarantee execution
updateAndRenderMergedCourses();
initRealtimeSync();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    updateAndRenderMergedCourses();
  });
}

const checkAndTriggerFirstTimePopup = enforceCompulsoryAuth;

export { 
  app, 
  db, 
  auth, 
  firebaseConfig, 
  openAuthModal, 
  closeAuthModal, 
  enforceCompulsoryAuth,
  checkAndTriggerFirstTimePopup, 
  showProgrammerBenefitsShowcase,
  closeProgrammerBenefitsShowcase,
  saveUserProfileToDatabase 
};

