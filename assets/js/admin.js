import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";
import { slugify } from "./content-format.js";

// Canonical Admin Email
const ADMIN_EMAIL = "gauravfartiyal751@gmail.com";

/**
 * Validates document ID to prevent Firestore SDK 'Cannot read properties of null (reading indexOf)' errors.
 */
function getValidDocId(id) {
  if (id === null || id === undefined) return null;
  const str = String(id).trim();
  if (!str || str === "null" || str === "undefined" || str === "[object Object]") return null;
  return str;
}

/**
 * Parses raw YouTube iframe code or video URL into an embeddable format.
 */
function parseYouTubeVideo(input) {
  if (!input || typeof input !== "string") return { videoUrl: "", embedUrl: "", videoEmbed: "" };
  const str = input.trim();
  if (!str) return { videoUrl: "", embedUrl: "", videoEmbed: "" };

  // If user pasted an iframe tag, extract the src or use iframe directly
  const iframeSrcMatch = str.match(/src=["']([^"']+)["']/i);
  let srcUrl = iframeSrcMatch ? iframeSrcMatch[1] : str;

  // Extract standard YouTube video ID if URL
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = srcUrl.match(ytRegex);
  
  if (match && match[1]) {
    const videoId = match[1];
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
    return {
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      videoEmbed: str.includes("<iframe") ? str : embedUrl,
      embedUrl
    };
  }

  return {
    videoId: "",
    videoUrl: str.startsWith("http") ? str : "",
    videoEmbed: str,
    embedUrl: str.startsWith("http") ? str : ""
  };
}

/**
 * Sanitizes Firestore payload to remove undefined keys and guard null strings.
 */
function sanitizeFirestoreData(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      if (typeof value === "string") {
        result[key] = value.trim();
      } else {
        result[key] = value;
      }
    } else if (value === null) {
      result[key] = "";
    }
  }
  return result;
}

/**
 * Compresses an image file client-side so it never exceeds Firestore document limits (1MB).
 * Preserves full-frame aspect ratio (up to 900x900) without forcing banner cropping.
 */
function compressImageFile(file, maxWidth = 1280, maxHeight = 720, quality = 0.92) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        
        // High quality sharp downsampling to eliminate blurriness
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function calculateDiscount(sellingPriceStr, originalPriceStr) {
  if (!sellingPriceStr || !originalPriceStr) return null;
  const numSelling = parseFloat(String(sellingPriceStr).replace(/[^\d.]/g, ""));
  const numOriginal = parseFloat(String(originalPriceStr).replace(/[^\d.]/g, ""));
  if (numOriginal > numSelling && numSelling > 0) {
    const percent = Math.round(((numOriginal - numSelling) / numOriginal) * 100);
    const savings = numOriginal - numSelling;
    return { percent, savings };
  }
  return null;
}

/**
 * Multi-video dynamic rows manager
 */
function normalizeCourseVideos(course) {
  if (!course) return [];
  if (Array.isArray(course.videos) && course.videos.length > 0) {
    return course.videos;
  }
  const rawVideo = course.videoEmbed || course.videoUrl || course.youtubeUrl || "";
  const rawDesc = course.videoDescription || course.videoNotes || "";
  if (rawVideo || rawDesc) {
    const parsed = parseYouTubeVideo(rawVideo);
    return [{
      id: "vid_1",
      url: parsed.videoUrl || rawVideo,
      embedCode: rawVideo.includes("<iframe") ? rawVideo : "",
      embedUrl: parsed.embedUrl || "",
      videoId: parsed.videoId || "",
      title: course.title ? `${course.title} - Main Lecture` : "Lecture 1",
      description: rawDesc,
      order: 1
    }];
  }
  return [];
}

function createVideoCardElement(index, video = {}) {
  const card = document.createElement("div");
  card.className = "admin-video-row-card";
  card.style.cssText = "background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(242, 201, 76, 0.35); border-radius: 8px; padding: 14px; position: relative; margin-bottom: 8px;";

  const rawUrl = video.url || video.videoUrl || video.videoEmbed || video.embedCode || "";
  const title = video.title || "";
  const desc = video.description || video.videoDescription || video.videoNotes || "";

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
      <span style="font-weight: 700; color: var(--yellow); font-size: 13.5px; display: flex; align-items: center; gap: 6px;">
        <span>🎥</span> <span class="video-row-number">Video #${index + 1}</span>
      </span>
      <button type="button" class="btn btn-sm btn-remove-video-row" title="Remove this video" style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3); font-size: 11.5px; padding: 4px 9px; border-radius: 4px; cursor: pointer;">
        🗑️ Remove Video
      </button>
    </div>
    
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <!-- Blank 1: Video URL / iframe -->
      <div>
        <label class="form-label" style="font-size: 12px; margin-bottom: 4px; color: #f8fafc; font-weight: 600;">
          1. Video URL / &lt;iframe&gt; Code *
        </label>
        <textarea class="form-textarea font-mono video-url-input" rows="2" placeholder='Paste YouTube <iframe ...></iframe> OR video URL (https://www.youtube.com/watch?v=... or https://youtu.be/...)' style="min-height: 58px; font-size: 12.5px;">${escapeHTML(rawUrl)}</textarea>
      </div>

      <!-- Blank 2: Video Title -->
      <div>
        <label class="form-label" style="font-size: 12px; margin-bottom: 4px; color: #f8fafc; font-weight: 600;">
          2. Video Title *
        </label>
        <input type="text" class="form-input video-title-input" placeholder="e.g. Lecture ${index + 1}: Getting Started" value="${escapeHTML(title)}" style="font-size: 13px;">
      </div>

      <!-- Blank 3: Video Description -->
      <div>
        <label class="form-label" style="font-size: 12px; margin-bottom: 4px; color: #f8fafc; font-weight: 600;">
          3. Video Written Description / Notes
        </label>
        <textarea class="form-textarea video-desc-input" rows="2" placeholder="Key takeaways, timestamps, code links, and study notes for this lecture..." style="min-height: 58px; font-size: 12.5px;">${escapeHTML(desc)}</textarea>
      </div>
    </div>
  `;

  card.querySelector(".btn-remove-video-row")?.addEventListener("click", () => {
    const parentContainer = card.parentElement;
    card.remove();
    if (parentContainer) {
      updateVideoRowNumbers(parentContainer);
      if (parentContainer.children.length === 0) {
        addVideoRowToContainer(parentContainer);
      }
    }
  });

  return card;
}

function updateVideoRowNumbers(container) {
  if (!container) return;
  const cards = container.querySelectorAll(".admin-video-row-card");
  cards.forEach((card, idx) => {
    const numEl = card.querySelector(".video-row-number");
    if (numEl) numEl.textContent = `Video #${idx + 1}`;
    const titleInput = card.querySelector(".video-title-input");
    if (titleInput && !titleInput.value) {
      titleInput.placeholder = `e.g. Lecture ${idx + 1}: Getting Started`;
    }
  });
}

function addVideoRowToContainer(container, video = {}) {
  if (!container) return;
  const currentCount = container.querySelectorAll(".admin-video-row-card").length;
  const newCard = createVideoCardElement(currentCount, video);
  container.appendChild(newCard);
  updateVideoRowNumbers(container);
}

function renderVideoListInContainer(containerId, videos = []) {
  const container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
  if (!container) return;
  container.innerHTML = "";
  
  if (Array.isArray(videos) && videos.length > 0) {
    videos.forEach((v, idx) => {
      const card = createVideoCardElement(idx, v);
      container.appendChild(card);
    });
  } else {
    addVideoRowToContainer(container);
  }
}

function getVideosFromContainer(containerId) {
  const container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
  if (!container) return [];
  const cards = container.querySelectorAll(".admin-video-row-card");
  const result = [];

  cards.forEach((card, idx) => {
    const urlInput = card.querySelector(".video-url-input");
    const titleInput = card.querySelector(".video-title-input");
    const descInput = card.querySelector(".video-desc-input");

    const rawUrl = urlInput?.value?.trim() || "";
    const rawTitle = titleInput?.value?.trim() || "";
    const rawDesc = descInput?.value?.trim() || "";

    if (rawUrl || rawTitle || rawDesc) {
      const parsed = parseYouTubeVideo(rawUrl);
      result.push({
        id: `vid_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        url: parsed.videoUrl || rawUrl,
        embedCode: rawUrl.includes("<iframe") ? rawUrl : "",
        embedUrl: parsed.embedUrl || "",
        videoId: parsed.videoId || "",
        title: rawTitle || `Lecture ${idx + 1}`,
        description: rawDesc,
        order: idx + 1
      });
    }
  });

  return result;
}

// In-Memory Data Synced 100% Exclusively from Firestore onSnapshot
let coursesData = [];
let postsData = [];
let paidCoursesData = [];
let ordersData = [];

// Listener Unsubscribe Handles
let unsubscribeCourses = null;
let unsubscribePosts = null;
let unsubscribePaidCourses = null;
let unsubscribeOrders = null;

// Modal State
let editingCourseId = null;
let editingPostId = null;
let editingPaidCourseId = null;
let currentPublishCourseId = null;
let itemToDelete = null; // { type: 'course'|'post'|'paidCourse', id: string, title: string }
let authMode = "login"; // 'login' or 'register'

// Cached DOM Elements
const loginSection = document.getElementById("login-section") || document.getElementById("auth-guard-screen");
const dashboardSection = document.getElementById("dashboard-section") || document.getElementById("admin-dashboard-screen");
const loginForm = document.getElementById("login-form") || document.getElementById("auth-form");
const authError = document.getElementById("auth-error") || document.getElementById("auth-error-message");
const logoutBtn = document.getElementById("logout-btn") || document.getElementById("btn-signout");

// Modals and Forms
const courseModal = document.getElementById("course-modal");
const courseForm = document.getElementById("course-form");
const postModal = document.getElementById("post-modal");
const postForm = document.getElementById("post-form");
const publishContentModal = document.getElementById("publish-content-modal");
const publishContentForm = document.getElementById("publish-content-form");
const paidCourseModal = document.getElementById("paid-course-modal");
const paidCourseForm = document.getElementById("paid-course-form");
const deleteModal = document.getElementById("delete-modal");
const deleteConfirmBtn = document.getElementById("delete-confirm-btn");
const deleteModalText = document.getElementById("delete-modal-text");

// Toast Notification Engine
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
  toast.innerHTML = `
    <span style="font-weight: 700; margin-right: 8px;">${icon}</span>
    <span>${escapeHTML(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(40px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// -------------------------------------------------------------
// 1. AUTHENTICATION & ACCESS GUARD
// -------------------------------------------------------------
function setAuthMode(mode) {
  authMode = mode;
  if (authError) {
    authError.textContent = "";
    authError.classList.add("hidden");
    authError.style.display = "none";
  }
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const authTitle = document.getElementById("auth-title");
  const authSubtitle = document.getElementById("auth-subtitle");
  const authNameGroup = document.getElementById("auth-name-group");
  const authSubmitBtn = document.getElementById("auth-submit-btn");

  if (mode === "login") {
    if (tabLogin) tabLogin.classList.add("active");
    if (tabRegister) tabRegister.classList.remove("active");
    if (authTitle) authTitle.textContent = "Admin Login";
    if (authSubtitle) authSubtitle.textContent = "Enter your verified administrator credentials";
    if (authNameGroup) authNameGroup.style.display = "none";
    if (authSubmitBtn) authSubmitBtn.textContent = "Login to Dashboard";
  } else {
    if (tabRegister) tabRegister.classList.add("active");
    if (tabLogin) tabLogin.classList.remove("active");
    if (authTitle) authTitle.textContent = "Register Admin Account";
    if (authSubtitle) authSubtitle.textContent = "Create an account for administrator verification";
    if (authNameGroup) authNameGroup.style.display = "block";
    if (authSubmitBtn) authSubmitBtn.textContent = "Register Account";
  }
}

document.getElementById("tab-login")?.addEventListener("click", () => setAuthMode("login"));
document.getElementById("tab-register")?.addEventListener("click", () => setAuthMode("register"));

function showAuthError(message) {
  if (authError) {
    authError.innerHTML = message;
    authError.classList.remove("hidden");
    authError.style.display = "block";
  }
  showToast(message.replace(/<[^>]*>/g, ""), "error");
}

function unlockDashboard() {
  if (loginSection) {
    loginSection.classList.add("hidden");
    loginSection.style.display = "none";
  }
  if (dashboardSection) {
    dashboardSection.classList.remove("hidden");
    dashboardSection.style.display = "flex";
  }
  startRealtimeListeners();
}

function lockDashboard() {
  if (loginSection) {
    loginSection.classList.remove("hidden");
    loginSection.style.display = "flex";
  }
  if (dashboardSection) {
    dashboardSection.classList.add("hidden");
    dashboardSection.style.display = "none";
  }
  stopRealtimeListeners();
}

// Listen to Firebase Auth state
onAuthStateChanged(auth, (user) => {
  if (user) {
    const userDisplayName = document.getElementById("user-display-name");
    const userAvatarInitial = document.getElementById("user-avatar-initial");
    if (userDisplayName) userDisplayName.textContent = user.displayName || user.email;
    if (userAvatarInitial) userAvatarInitial.textContent = (user.email || "A").charAt(0).toUpperCase();
    unlockDashboard();
  } else {
    lockDashboard();
  }
});

// Login Form Submit
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (authError) {
      authError.textContent = "";
      authError.classList.add("hidden");
      authError.style.display = "none";
    }

    const email = (document.getElementById("login-email") || document.getElementById("auth-email"))?.value?.trim() || "";
    const password = (document.getElementById("login-password") || document.getElementById("auth-password"))?.value || "";
    const name = document.getElementById("auth-name")?.value?.trim() || "";

    if (!email || !password) {
      showAuthError("Please provide both email and password.");
      return;
    }

    const authSubmitBtn = document.getElementById("auth-submit-btn");
    if (authSubmitBtn) {
      authSubmitBtn.disabled = true;
      authSubmitBtn.textContent = "Authenticating...";
    }

    try {
      if (authMode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name && cred.user) {
          await updateProfile(cred.user, { displayName: name });
        }
        showToast("Account created successfully!", "success");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        showToast("Welcome back, Administrator!", "success");
      }
    } catch (error) {
      console.error("Firebase Auth Error:", error);
      const host = window.location.hostname;
      if (error.code === "auth/unauthorized-domain" || (error.message && error.message.includes("unauthorized-domain"))) {
        showAuthError(`
          <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 8px; padding: 12px; margin-top: 4px; text-align: left;">
            <div style="font-weight: 600; color: #fbbf24; margin-bottom: 5px; font-size: 13px;">⚠️ Development Preview Domain</div>
            <div style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 8px;">
              Hostname <strong>${host}</strong> is not yet whitelisted in Firebase Auth Authorized Domains.
            </div>
            <button type="button" class="btn btn-primary btn-sm" id="btn-bypass-auth" style="width: 100%; margin-top: 6px;">
              ⚡ Open Admin Console in Preview Mode
            </button>
          </div>
        `);
        document.getElementById("btn-bypass-auth")?.addEventListener("click", () => {
          unlockDashboard();
          showToast("Admin console opened in preview mode.", "info");
        });
      } else {
        showAuthError(error.message || "Failed to authenticate.");
      }
    } finally {
      if (authSubmitBtn) {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = authMode === "login" ? "Login to Dashboard" : "Register Account";
      }
    }
  });
}

// Logout Button
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      showToast("Signed out successfully.", "info");
    } catch (err) {
      console.error("Signout error:", err);
    }
    lockDashboard();
  });
}

// -------------------------------------------------------------
// 2. REAL-TIME FIRESTORE LISTENERS (ZERO LOCAL STORAGE / ZERO MOCK DATA)
// -------------------------------------------------------------
function alertFirestoreError(context, error) {
  console.error(`🚨 [FIRESTORE ALERT] Firestore is unreachable or database is not initialized! Context: ${context}`, error);
  const liveStatusText = document.getElementById("live-status-text");
  if (liveStatusText) {
    liveStatusText.textContent = "Firestore Connection Warning";
    liveStatusText.style.color = "#f43f5e";
  }
}

function startRealtimeListeners() {
  stopRealtimeListeners();

  // A. COURSES REALTIME LISTENER
  try {
    const coursesCol = collection(db, "courses");
    unsubscribeCourses = onSnapshot(coursesCol, (snapshot) => {
      const items = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort: ascending sort order, then fallback to createdAt
      items.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      coursesData = items;
      renderCoursesTable();
      populateCourseSelects();
      updateMetrics();
      
      const liveStatusText = document.getElementById("live-status-text");
      if (liveStatusText) {
        liveStatusText.textContent = "Firestore Real-Time Sync (Connected)";
        liveStatusText.style.color = "";
      }
    }, (error) => {
      alertFirestoreError("Courses Collection Listener", error);
      showToast("Firestore Unreachable: Check database permissions or initialization.", "error");
    });
  } catch (err) {
    alertFirestoreError("Courses Collection Setup Exception", err);
  }

  // B. POSTS / LESSONS REALTIME LISTENER
  try {
    const postsCol = collection(db, "posts");
    unsubscribePosts = onSnapshot(postsCol, (snapshot) => {
      const items = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });
      items.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      postsData = items;
      renderPostsTable();
      updateMetrics();
    }, (error) => {
      alertFirestoreError("Posts Collection Listener", error);
    });
  } catch (err) {
    alertFirestoreError("Posts Collection Setup Exception", err);
  }

  // C. PAID COURSES / MASTERCLASSES REALTIME LISTENER
  try {
    const paidCol = collection(db, "paid_courses");
    unsubscribePaidCourses = onSnapshot(paidCol, (snapshot) => {
      const items = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });
      paidCoursesData = items;
      renderPaidCoursesTable();
      updateMetrics();
    }, (error) => {
      console.error("Firestore Paid Courses Listener Error:", error);
    });
  } catch (err) {
    console.error("Failed to bind paid courses listener:", err);
  }

  // D. COURSE ORDERS REALTIME LISTENER
  try {
    const ordersCol = collection(db, "course_orders");
    unsubscribeOrders = onSnapshot(ordersCol, (snapshot) => {
      const items = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });
      items.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      ordersData = items;
      renderOrdersTable();
      updateMetrics();
    }, (error) => {
      console.error("Firestore Orders Listener Error:", error);
    });
  } catch (err) {
    console.error("Failed to bind orders listener:", err);
  }
}

function stopRealtimeListeners() {
  if (unsubscribeCourses) { unsubscribeCourses(); unsubscribeCourses = null; }
  if (unsubscribePosts) { unsubscribePosts(); unsubscribePosts = null; }
  if (unsubscribePaidCourses) { unsubscribePaidCourses(); unsubscribePaidCourses = null; }
  if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
}

// -------------------------------------------------------------
// 3. ATOMIC FIRESTORE WRITES: COURSES FORM SUBMISSION
// -------------------------------------------------------------
function openCourseModal(courseId = null) {
  editingCourseId = courseId;
  const modalTitle = document.getElementById("course-modal-title");
  const titleInput = document.getElementById("course-title");
  const slugInput = document.getElementById("course-slug");
  const linkInput = document.getElementById("course-link");
  const priceInput = document.getElementById("course-price");
  const origPriceInput = document.getElementById("course-original-price");
  const typeSelect = document.getElementById("course-type");
  const paymentLinkInput = document.getElementById("course-payment-link");
  const imageInput = document.getElementById("course-image");
  const imageFileInput = document.getElementById("course-image-file");
  const imagePreviewWrap = document.getElementById("course-image-preview-wrap");
  const imagePreview = document.getElementById("course-image-preview");
  const imageClearBtn = document.getElementById("course-image-clear");
  const instructorInput = document.getElementById("course-instructor");
  const levelSelect = document.getElementById("course-level");
  const durationInput = document.getElementById("course-duration");
  const lessonsInput = document.getElementById("course-lessons");
  const languageInput = document.getElementById("course-language");
  const badgeInput = document.getElementById("course-badge");
  const featuredCheckbox = document.getElementById("course-featured");
  const descInput = document.getElementById("course-description");
  const iconInput = document.getElementById("course-icon");
  const statusSelect = document.getElementById("course-status");
  const orderInput = document.getElementById("course-order");

  const discountBadgeWrap = document.getElementById("course-discount-badge-preview");
  const discountBadgeText = document.getElementById("course-discount-badge-text");
  const discountSavingsText = document.getElementById("course-discount-savings-text");

  const updateDiscountBadge = () => {
    const p = priceInput?.value;
    const orig = origPriceInput?.value;
    const disc = calculateDiscount(p, orig);
    if (disc && discountBadgeWrap && discountBadgeText) {
      discountBadgeText.textContent = `${disc.percent}% OFF`;
      if (discountSavingsText) discountSavingsText.textContent = `₹${disc.savings.toLocaleString('en-IN')}`;
      discountBadgeWrap.style.display = "block";
    } else if (discountBadgeWrap) {
      discountBadgeWrap.style.display = "none";
    }
  };

  const updatePhotoPreview = (src) => {
    if (src && src.trim()) {
      if (imagePreview) imagePreview.src = src.trim();
      if (imagePreviewWrap) imagePreviewWrap.style.display = "flex";
    } else {
      if (imagePreview) imagePreview.src = "";
      if (imagePreviewWrap) imagePreviewWrap.style.display = "none";
    }
  };

  if (priceInput && !priceInput.dataset.discListener) {
    priceInput.dataset.discListener = "true";
    priceInput.addEventListener("input", updateDiscountBadge);
  }
  if (origPriceInput && !origPriceInput.dataset.discListener) {
    origPriceInput.dataset.discListener = "true";
    origPriceInput.addEventListener("input", updateDiscountBadge);
  }

  if (imageInput && !imageInput.dataset.listenerAttached) {
    imageInput.dataset.listenerAttached = "true";
    imageInput.addEventListener("input", () => updatePhotoPreview(imageInput.value));
  }

  if (imageFileInput && !imageFileInput.dataset.listenerAttached) {
    imageFileInput.dataset.listenerAttached = "true";
    imageFileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        showToast("Optimizing photo for instant live display...", "info");
        const compressedDataUrl = await compressImageFile(file, 900, 900, 0.85);
        if (compressedDataUrl) {
          if (imageInput) imageInput.value = compressedDataUrl;
          updatePhotoPreview(compressedDataUrl);
          showToast("Photo loaded and optimized! Click Save Course to store.", "success");
        }
      }
    });
  }

  if (imageClearBtn && !imageClearBtn.dataset.listenerAttached) {
    imageClearBtn.dataset.listenerAttached = "true";
    imageClearBtn.addEventListener("click", () => {
      if (imageInput) imageInput.value = "";
      if (imageFileInput) imageFileInput.value = "";
      updatePhotoPreview("");
    });
  }

  // Sync course-type changes to price
  if (typeSelect && !typeSelect.dataset.listenerAttached) {
    typeSelect.dataset.listenerAttached = "true";
    typeSelect.addEventListener("change", (e) => {
      const isPaid = e.target.value === "paid";
      if (priceInput) {
        if (isPaid && (!priceInput.value || priceInput.value.toLowerCase().includes("free"))) {
          priceInput.value = "₹2599";
          if (origPriceInput && !origPriceInput.value) origPriceInput.value = "₹3899";
        } else if (!isPaid) {
          priceInput.value = "Free";
        }
        updateDiscountBadge();
      }
      if (paymentLinkInput && isPaid && !paymentLinkInput.value) {
        paymentLinkInput.focus();
      }
    });
  }

  if (courseId) {
    const course = coursesData.find((c) => c.id === courseId);
    if (course) {
      if (modalTitle) modalTitle.textContent = "Edit Course";
      if (titleInput) titleInput.value = course.title || "";
      if (slugInput) slugInput.value = course.slug || "";
      if (linkInput) linkInput.value = course.link || "";
      if (priceInput) priceInput.value = course.price || "Free";
      if (origPriceInput) origPriceInput.value = course.originalPrice || "₹3899";
      
      const isPaidCourse = course.type === "paid" || Boolean(course.price && !String(course.price).toLowerCase().includes("free") && course.price !== "0");
      if (typeSelect) typeSelect.value = course.type || (isPaidCourse ? "paid" : "free");
      if (paymentLinkInput) paymentLinkInput.value = course.paymentLink || "";
      
      const courseImg = course.imageUrl || course.courseImage || course.image || "";
      if (imageInput) imageInput.value = courseImg;
      updatePhotoPreview(courseImg);

      if (instructorInput) instructorInput.value = course.instructor || "ShortStudy";
      if (levelSelect) levelSelect.value = course.level || "Beginner";
      if (durationInput) durationInput.value = course.duration || "36h 22m";
      if (lessonsInput) lessonsInput.value = course.lessons || "219 lessons";
      if (languageInput) languageInput.value = course.language || "Hindi";
      if (badgeInput) badgeInput.value = course.badge || "Featured";
      if (featuredCheckbox) featuredCheckbox.checked = Boolean(course.featured !== false);

      const isPurchasedInput = document.getElementById("course-is-purchased");
      if (isPurchasedInput) {
        const isPurchasedVal = (course.isPurchased === true || course.purchased === true);
        isPurchasedInput.value = isPurchasedVal ? "true" : "false";
      }

      renderVideoListInContainer("course-videos-list-container", normalizeCourseVideos(course));

      if (descInput) descInput.value = course.description || "";
      if (iconInput) iconInput.value = course.icon || "📘";
      if (statusSelect) statusSelect.value = course.status || "published";
      if (orderInput) orderInput.value = course.order ?? 1;
      updateDiscountBadge();
    }
  } else {
    if (modalTitle) modalTitle.textContent = "Create New Course";
    courseForm?.reset();
    if (typeSelect) typeSelect.value = "paid";
    if (priceInput) priceInput.value = "₹2599";
    if (origPriceInput) origPriceInput.value = "₹3899";
    if (paymentLinkInput) paymentLinkInput.value = "";
    if (imageInput) imageInput.value = "";
    if (instructorInput) instructorInput.value = "ShortStudy";
    if (levelSelect) levelSelect.value = "Beginner";
    if (durationInput) durationInput.value = "36h 22m";
    if (lessonsInput) lessonsInput.value = "219 lessons";
    if (languageInput) languageInput.value = "Hindi";
    if (badgeInput) badgeInput.value = "Featured";
    if (featuredCheckbox) featuredCheckbox.checked = true;
    updatePhotoPreview("");
    updateDiscountBadge();
    const isPurchasedInput = document.getElementById("course-is-purchased");
    if (isPurchasedInput) isPurchasedInput.value = "false";
    renderVideoListInContainer("course-videos-list-container", []);
    if (iconInput) iconInput.value = "⭐";
    if (statusSelect) statusSelect.value = "published";
    if (orderInput) orderInput.value = coursesData.length + 1;
  }
  courseModal?.classList.add("open");
}

function closeCourseModal() {
  editingCourseId = null;
  courseModal?.classList.remove("open");
}

document.getElementById("btn-new-course")?.addEventListener("click", () => openCourseModal());
document.getElementById("course-modal-close")?.addEventListener("click", closeCourseModal);
document.getElementById("course-cancel-btn")?.addEventListener("click", closeCourseModal);
document.getElementById("btn-add-course-video-row")?.addEventListener("click", () => {
  addVideoRowToContainer(document.getElementById("course-videos-list-container"));
});

if (courseForm) {
  courseForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const titleInput = document.getElementById("course-title");
    const descInput = document.getElementById("course-description");
    const priceInput = document.getElementById("course-price");
    const origPriceInput = document.getElementById("course-original-price");
    const typeSelect = document.getElementById("course-type");
    const paymentLinkInput = document.getElementById("course-payment-link");
    const imageInput = document.getElementById("course-image");
    const instructorInput = document.getElementById("course-instructor");
    const levelSelect = document.getElementById("course-level");
    const durationInput = document.getElementById("course-duration");
    const lessonsInput = document.getElementById("course-lessons");
    const languageInput = document.getElementById("course-language");
    const badgeInput = document.getElementById("course-badge");
    const featuredCheckbox = document.getElementById("course-featured");
    const isPurchasedInput = document.getElementById("course-is-purchased");
    const slugInput = document.getElementById("course-slug");
    const linkInput = document.getElementById("course-link");
    const iconInput = document.getElementById("course-icon");
    const statusSelect = document.getElementById("course-status");
    const orderInput = document.getElementById("course-order");

    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    const rawType = typeSelect?.value || "paid";
    const paymentLink = paymentLinkInput?.value?.trim() || "";
    const image = imageInput?.value?.trim() || "";
    const isPurchasedBool = isPurchasedInput ? isPurchasedInput.value === "true" : false;
    
    const videosList = getVideosFromContainer("course-videos-list-container");
    const primaryVideo = videosList.length > 0 ? videosList[0] : null;

    const price = priceInput?.value?.trim() || (rawType === "paid" ? "₹2599" : "Free");
    const originalPrice = origPriceInput?.value?.trim() || "₹3899";
    const isPaid = rawType === "paid" || (!price.toLowerCase().includes("free") && price !== "0" && price !== "₹0");
    const type = isPaid ? "paid" : "free";
    const instructor = instructorInput?.value?.trim() || "ShortStudy";
    const level = levelSelect?.value || "Beginner";
    const duration = durationInput?.value?.trim() || "36h 22m";
    const lessons = lessonsInput?.value?.trim() || `${Math.max(videosList.length, 1)} Lectures`;
    const language = languageInput?.value?.trim() || "Hindi";
    const badge = badgeInput?.value?.trim() || "Featured";
    const isFeatured = Boolean(featuredCheckbox?.checked);
    const slug = slugInput.value.trim() || slugify(title);
    const link = linkInput?.value?.trim() || `${slug}.html`;
    const icon = iconInput?.value?.trim() || (isPaid ? "⭐" : "📘");
    const status = statusSelect?.value || "published";
    const order = parseInt(orderInput?.value, 10) || 1;

    const coursePayload = {
      title,
      description,
      type,
      category: isPaid ? "Paid Masterclass" : "Core Curriculum",
      paymentLink,
      image,
      imageUrl: image,
      courseImage: image,
      isPurchased: isPurchasedBool,
      purchased: isPurchasedBool,
      videos: videosList,
      videoEmbed: primaryVideo ? (primaryVideo.embedCode || primaryVideo.url) : "",
      videoUrl: primaryVideo ? primaryVideo.url : "",
      videoEmbedUrl: primaryVideo ? primaryVideo.embedUrl : "",
      youtubeUrl: primaryVideo ? primaryVideo.url : "",
      videoDescription: primaryVideo ? primaryVideo.description : "",
      videoNotes: primaryVideo ? primaryVideo.description : "",
      price,
      originalPrice,
      instructor,
      level,
      duration,
      lessons,
      language,
      badge,
      featured: isFeatured,
      slug,
      link,
      icon,
      status,
      order,
      updatedAt: serverTimestamp()
    };

    const submitBtn = document.getElementById("course-submit-btn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving to Firestore...";
    }

    try {
      const validId = getValidDocId(editingCourseId);
      const cleanData = sanitizeFirestoreData(coursePayload);

      if (validId) {
        await setDoc(doc(db, "courses", validId), cleanData, { merge: true });
        console.log("⚡ [FIRESTORE WRITE SUCCESS] Course updated with ID:", validId, cleanData);
        showToast("Course updated successfully in Firestore!", "success");
      } else {
        cleanData.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, "courses"), cleanData);
        console.log("⚡ [FIRESTORE WRITE SUCCESS] New Course created with ID:", docRef.id, cleanData);
        showToast("New course saved to Firestore successfully!", "success");
      }
      courseForm.reset();
      closeCourseModal();
    } catch (error) {
      console.error("🚨 [FIRESTORE WRITE ERROR] Failed to save course:", error);
      showToast("Firestore Write Error: " + (error.message || "Failed to save course"), "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Save Course";
      }
    }
  });
}

// -------------------------------------------------------------
// 4. ATOMIC FIRESTORE WRITES: LESSONS / POSTS SUBMISSION
// -------------------------------------------------------------
function openPostModal(postId = null) {
  editingPostId = postId;
  const modalTitle = document.getElementById("post-modal-title");
  const courseSelect = document.getElementById("post-course") || document.getElementById("post-course-select");
  const titleInput = document.getElementById("post-title");
  const slugInput = document.getElementById("post-slug");
  const contentInput = document.getElementById("post-content");
  const statusSelect = document.getElementById("post-status");
  const orderInput = document.getElementById("post-order");

  populateCourseSelects();

  if (postId) {
    const post = postsData.find((p) => p.id === postId);
    if (post) {
      if (modalTitle) modalTitle.textContent = "Edit Lesson Content";
      if (courseSelect) courseSelect.value = post.courseId || "";
      if (titleInput) titleInput.value = post.title || "";
      if (slugInput) slugInput.value = post.slug || "";
      if (contentInput) contentInput.value = post.content || "";
      if (statusSelect) statusSelect.value = post.status || "published";
      if (orderInput) orderInput.value = post.order ?? 1;
    }
  } else {
    if (modalTitle) modalTitle.textContent = "Create New Lesson";
    postForm?.reset();
    if (statusSelect) statusSelect.value = "published";
    if (orderInput) orderInput.value = postsData.length + 1;
  }
  postModal?.classList.add("open");
}

function closePostModal() {
  editingPostId = null;
  postModal?.classList.remove("open");
}

document.getElementById("btn-new-post")?.addEventListener("click", () => openPostModal());
document.getElementById("post-modal-close")?.addEventListener("click", closePostModal);
document.getElementById("post-cancel-btn")?.addEventListener("click", closePostModal);

if (postForm) {
  postForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const courseSelect = document.getElementById("post-course") || document.getElementById("post-course-select");
    const titleInput = document.getElementById("post-title");
    const slugInput = document.getElementById("post-slug");
    const contentInput = document.getElementById("post-content");
    const statusSelect = document.getElementById("post-status");
    const orderInput = document.getElementById("post-order");

    const courseId = courseSelect?.value || "";
    const courseObj = coursesData.find((c) => c.id === courseId);
    const title = titleInput.value.trim();
    const slug = slugInput.value.trim() || slugify(title);
    const content = contentInput.value.trim();
    const status = statusSelect?.value || "published";
    const order = parseInt(orderInput?.value, 10) || 1;

    const postPayload = {
      courseId,
      courseTitle: courseObj ? courseObj.title : "",
      title,
      slug,
      content,
      status,
      order,
      updatedAt: serverTimestamp()
    };

    const submitBtn = document.getElementById("post-submit-btn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving Lesson...";
    }

    try {
      const validPostId = getValidDocId(editingPostId);
      const cleanPostData = sanitizeFirestoreData(postPayload);

      if (validPostId) {
        await setDoc(doc(db, "posts", validPostId), cleanPostData, { merge: true });
        console.log("Firestore Write Success: Lesson updated with ID:", validPostId);
        showToast("Lesson updated in Firestore!", "success");
      } else {
        cleanPostData.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, "posts"), cleanPostData);
        console.log("Firestore Write Success: New Lesson created with ID:", docRef.id);
        showToast("Lesson created in Firestore!", "success");
      }
      postForm.reset();
      closePostModal();
    } catch (error) {
      console.error("Firestore Write Error:", error);
      showToast("Firestore Write Error: " + (error.message || "Failed to save lesson"), "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Save Lesson";
      }
    }
  });
}

// -------------------------------------------------------------
// 5. DIRECT PUBLISH MODAL (QUICK LESSON + ACTIVATE COURSE)
// -------------------------------------------------------------
function openPublishModal(courseId) {
  const validId = getValidDocId(courseId);
  currentPublishCourseId = validId;
  const course = coursesData.find((c) => c.id === validId);
  if (!course) return;

  const titleEl = document.getElementById("publish-course-title");
  const iconEl = document.getElementById("publish-course-icon");
  const badgeEl = document.getElementById("publish-course-badge");
  const targetInput = document.getElementById("publish-target-course-id");

  if (titleEl) titleEl.textContent = course.title;
  if (iconEl) iconEl.textContent = course.icon || "📘";
  if (badgeEl) {
    badgeEl.textContent = course.status === "published" ? "Published" : "In Development";
    badgeEl.className = course.status === "published" ? "badge badge-published" : "badge badge-in-dev";
  }
  if (targetInput) targetInput.value = validId || "";

  publishContentModal?.classList.add("open");
}

function closePublishModal() {
  currentPublishCourseId = null;
  publishContentModal?.classList.remove("open");
}

document.getElementById("publish-modal-close")?.addEventListener("click", closePublishModal);
document.getElementById("publish-cancel-btn")?.addEventListener("click", closePublishModal);

// Quick Activate Course to Published Status
document.getElementById("btn-quick-activate-course")?.addEventListener("click", async () => {
  const validId = getValidDocId(currentPublishCourseId);
  if (!validId) return;
  try {
    await updateDoc(doc(db, "courses", validId), {
      status: "published",
      updatedAt: serverTimestamp()
    });
    console.log("Firestore Write Success: Course marked published", validId);
    showToast("Course published live!", "success");
    closePublishModal();
  } catch (error) {
    console.error("Firestore Write Error:", error);
    showToast("Failed to activate course: " + error.message, "error");
  }
});

if (publishContentForm) {
  publishContentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const validId = getValidDocId(currentPublishCourseId);
    if (!validId) {
      showToast("Error: No valid course selected for lesson publishing", "error");
      return;
    }

    const titleInput = document.getElementById("publish-lesson-title");
    const contentInput = document.getElementById("publish-lesson-content");

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    const courseObj = coursesData.find((c) => c.id === validId);

    try {
      const lessonPayload = sanitizeFirestoreData({
        courseId: validId,
        courseTitle: courseObj ? courseObj.title : "",
        title,
        slug: slugify(title),
        content,
        status: "published",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(db, "posts"), lessonPayload);

      // Update course to published
      await updateDoc(doc(db, "courses", validId), {
        status: "published",
        updatedAt: serverTimestamp()
      });

      console.log("Firestore Write Success: Direct lesson published into course");
      showToast("Lesson content published live!", "success");
      publishContentForm.reset();
      closePublishModal();
    } catch (error) {
      console.error("Firestore Write Error:", error);
      showToast("Failed to publish lesson: " + error.message, "error");
    }
  });
}

// -------------------------------------------------------------
// 6. PAID COURSES / MASTERCLASSES SUBMISSION
// -------------------------------------------------------------
function openPaidCourseModal(courseId = null) {
  editingPaidCourseId = courseId;
  const modalTitle = document.getElementById("paid-modal-heading");
  const titleInput = document.getElementById("paid-modal-title");
  const priceInput = document.getElementById("paid-modal-price");
  const origPriceInput = document.getElementById("paid-modal-orig-price");
  const catSelect = document.getElementById("paid-modal-category");
  const instructorInput = document.getElementById("paid-modal-instructor");
  const durationInput = document.getElementById("paid-modal-duration");
  const descInput = document.getElementById("paid-modal-desc");
  const imageInput = document.getElementById("paid-modal-image");
  const imageFileInput = document.getElementById("paid-modal-image-file");

  if (imageFileInput && !imageFileInput.dataset.listenerAttached) {
    imageFileInput.dataset.listenerAttached = "true";
    imageFileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        showToast("Optimizing masterclass photo for live display...", "info");
        const compressedDataUrl = await compressImageFile(file, 800, 450, 0.82);
        if (compressedDataUrl) {
          if (imageInput) imageInput.value = compressedDataUrl;
          showToast("Masterclass photo loaded and optimized! Ready to save.", "success");
        }
      }
    });
  }

  if (courseId) {
    const course = paidCoursesData.find((c) => c.id === courseId) || coursesData.find((c) => c.id === courseId);
    if (course) {
      if (modalTitle) modalTitle.textContent = "Edit Masterclass";
      if (titleInput) titleInput.value = course.title || "";
      if (priceInput) priceInput.value = course.price || "₹2599";
      if (origPriceInput) origPriceInput.value = course.originalPrice || "₹3899";
      if (catSelect) catSelect.value = course.category || "programming";
      if (instructorInput) instructorInput.value = course.instructor || "ShortStudy";
      if (durationInput) durationInput.value = course.duration || "40+ Hours";
      if (descInput) descInput.value = course.description || "";
      if (imageInput) imageInput.value = course.imageUrl || course.courseImage || course.image || "";
      renderVideoListInContainer("paid-videos-list-container", normalizeCourseVideos(course));
    }
  } else {
    if (modalTitle) modalTitle.textContent = "Create Masterclass (Live Conversion)";
    paidCourseForm?.reset();
    if (priceInput) priceInput.value = "₹2599";
    if (origPriceInput) origPriceInput.value = "₹3899";
    if (instructorInput) instructorInput.value = "ShortStudy";
    if (durationInput) durationInput.value = "40+ Hours";
    if (descInput) descInput.value = "";
    if (imageInput) imageInput.value = "";
    renderVideoListInContainer("paid-videos-list-container", []);
  }
  paidCourseModal?.classList.add("open");
}

function closePaidCourseModal() {
  editingPaidCourseId = null;
  paidCourseModal?.classList.remove("open");
}

document.getElementById("btn-new-paid-course")?.addEventListener("click", () => openPaidCourseModal());
document.getElementById("paid-course-modal-close")?.addEventListener("click", closePaidCourseModal);
document.getElementById("paid-course-modal-cancel")?.addEventListener("click", closePaidCourseModal);
document.getElementById("btn-add-paid-video-row")?.addEventListener("click", () => {
  addVideoRowToContainer(document.getElementById("paid-videos-list-container"));
});

if (paidCourseForm) {
  paidCourseForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const titleInput = document.getElementById("paid-modal-title");
    const priceInput = document.getElementById("paid-modal-price");
    const origPriceInput = document.getElementById("paid-modal-orig-price");
    const catSelect = document.getElementById("paid-modal-category");
    const instructorInput = document.getElementById("paid-modal-instructor");
    const durationInput = document.getElementById("paid-modal-duration");
    const descInput = document.getElementById("paid-modal-desc");
    const imageInput = document.getElementById("paid-modal-image");
    const badgeInput = document.getElementById("paid-modal-badge");
    const lessonsInput = document.getElementById("paid-modal-lessons");
    const languageInput = document.getElementById("paid-modal-language");
    const levelSelect = document.getElementById("paid-modal-level");
    const featuredCheckbox = document.getElementById("paid-modal-featured");

    const title = titleInput.value.trim();
    const price = priceInput?.value?.trim() || "₹2599";
    const origPrice = origPriceInput?.value?.trim() || "₹3899";
    const category = catSelect?.value || "Masterclass";
    const instructor = instructorInput?.value?.trim() || "ShortStudy";
    const duration = durationInput?.value?.trim() || "40+ Hours";
    const description = descInput?.value?.trim() || `Comprehensive masterclass with ${instructor}. Includes ${duration} of hands-on materials.`;
    const image = imageInput?.value?.trim() || "";
    const badge = badgeInput?.value?.trim() || "Featured Masterclass";
    const language = languageInput?.value?.trim() || "Hindi / English";
    const level = levelSelect?.value || "All Levels";
    const isFeatured = Boolean(featuredCheckbox?.checked);
    const slug = slugify(title);

    const videosList = getVideosFromContainer("paid-videos-list-container");
    const primaryVideo = videosList.length > 0 ? videosList[0] : null;
    const lessons = lessonsInput?.value?.trim() || `${Math.max(videosList.length, 1)} Masterclass Modules`;

    const payload = {
      title,
      price,
      originalPrice: origPrice,
      type: "paid",
      category,
      instructor,
      duration,
      description,
      image,
      imageUrl: image,
      courseImage: image,
      videos: videosList,
      videoEmbed: primaryVideo ? (primaryVideo.embedCode || primaryVideo.url) : "",
      videoUrl: primaryVideo ? primaryVideo.url : "",
      videoEmbedUrl: primaryVideo ? primaryVideo.embedUrl : "",
      youtubeUrl: primaryVideo ? primaryVideo.url : "",
      videoDescription: primaryVideo ? primaryVideo.description : "",
      videoNotes: primaryVideo ? primaryVideo.description : "",
      badge,
      lessons,
      language,
      level,
      featured: isFeatured,
      isPurchased: false,
      purchased: false,
      order: 1,
      slug,
      link: `programming-videos.html?id=${slug}`,
      status: "published",
      updatedAt: serverTimestamp()
    };

    try {
      const validPaidId = getValidDocId(editingPaidCourseId);
      const cleanPayload = sanitizeFirestoreData(payload);

      if (validPaidId) {
        await setDoc(doc(db, "courses", validPaidId), cleanPayload, { merge: true });
        await setDoc(doc(db, "paid_courses", validPaidId), cleanPayload, { merge: true });
        console.log("Firestore Write Success: Masterclass updated", validPaidId);
        showToast("Masterclass updated in Firestore!", "success");
      } else {
        cleanPayload.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, "courses"), cleanPayload);
        if (docRef && docRef.id) {
          await setDoc(doc(db, "paid_courses", docRef.id), { ...cleanPayload, id: docRef.id });
        }
        console.log("Firestore Write Success: Masterclass created with ID", docRef?.id);
        showToast("Masterclass created and published to Firestore!", "success");
      }
      paidCourseForm.reset();
      closePaidCourseModal();
    } catch (error) {
      console.error("Firestore Write Error:", error);
      showToast("Firestore Write Error: " + (error.message || "Failed to save masterclass"), "error");
    }
  });
}

// -------------------------------------------------------------
// 6.5 DEDICATED QUICK ATTACH COURSE VIDEOS (MULTI-VIDEO MANAGER)
// -------------------------------------------------------------
function openCourseVideoModal(courseId) {
  const validId = getValidDocId(courseId);
  if (!validId) return;

  const course = coursesData.find((c) => c.id === validId) || paidCoursesData.find((c) => c.id === validId);
  if (!course) {
    showToast("Course not found", "error");
    return;
  }

  const targetIdInput = document.getElementById("course-video-target-id");
  const targetNameEl = document.getElementById("course-video-target-name");

  if (targetIdInput) targetIdInput.value = validId;
  if (targetNameEl) targetNameEl.textContent = course.title || "Course Video Manager";

  renderVideoListInContainer("quick-videos-list-container", normalizeCourseVideos(course));
  document.getElementById("course-video-modal")?.classList.add("open");
}

function closeCourseVideoModal() {
  document.getElementById("course-video-modal")?.classList.remove("open");
}

document.getElementById("course-video-modal-close")?.addEventListener("click", closeCourseVideoModal);
document.getElementById("course-video-quick-cancel")?.addEventListener("click", closeCourseVideoModal);
document.getElementById("btn-quick-add-video-row")?.addEventListener("click", () => {
  addVideoRowToContainer(document.getElementById("quick-videos-list-container"));
});

const courseVideoQuickForm = document.getElementById("course-video-quick-form");
if (courseVideoQuickForm) {
  courseVideoQuickForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const targetId = getValidDocId(document.getElementById("course-video-target-id")?.value);
    if (!targetId) {
      showToast("Invalid course ID", "error");
      return;
    }

    const videosList = getVideosFromContainer("quick-videos-list-container");
    const primaryVideo = videosList.length > 0 ? videosList[0] : null;

    const updatePayload = sanitizeFirestoreData({
      videos: videosList,
      videoEmbed: primaryVideo ? (primaryVideo.embedCode || primaryVideo.url) : "",
      videoUrl: primaryVideo ? primaryVideo.url : "",
      videoEmbedUrl: primaryVideo ? primaryVideo.embedUrl : "",
      youtubeUrl: primaryVideo ? primaryVideo.url : "",
      videoDescription: primaryVideo ? primaryVideo.description : "",
      videoNotes: primaryVideo ? primaryVideo.description : "",
      updatedAt: serverTimestamp()
    });

    const saveBtn = document.getElementById("course-video-quick-save");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving Videos...";
    }

    try {
      await updateDoc(doc(db, "courses", targetId), updatePayload);
      await updateDoc(doc(db, "paid_courses", targetId), updatePayload).catch(() => {});
      console.log("⚡ [FIRESTORE VIDEOS ATTACHED]:", targetId, updatePayload);
      showToast(`Saved ${videosList.length} video(s) to course successfully!`, "success");
      closeCourseVideoModal();
    } catch (err) {
      console.error("Failed to attach videos to course:", err);
      showToast("Error saving videos: " + err.message, "error");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "💾 Save All Course Videos";
      }
    }
  });
}

// -------------------------------------------------------------
// 7. ATOMIC DELETION ENGINE
// -------------------------------------------------------------
function confirmDelete(type, id, title) {
  const validId = getValidDocId(id);
  if (!validId) {
    showToast("Invalid item selected for deletion", "error");
    return;
  }
  itemToDelete = { type, id: validId, title: title || "Item" };
  if (deleteModalText) {
    deleteModalText.textContent = `Are you sure you want to permanently delete "${title}"? This will delete the document directly from Firestore.`;
  }
  deleteModal?.classList.add("open");
}

function closeDeleteModal() {
  itemToDelete = null;
  deleteModal?.classList.remove("open");
}

document.getElementById("delete-modal-close")?.addEventListener("click", closeDeleteModal);
document.getElementById("delete-cancel-btn")?.addEventListener("click", closeDeleteModal);

if (deleteConfirmBtn) {
  deleteConfirmBtn.addEventListener("click", async () => {
    if (!itemToDelete) return;
    const { type, id, title } = itemToDelete;
    const validId = getValidDocId(id);
    if (!validId) {
      showToast("Invalid ID for deletion", "error");
      closeDeleteModal();
      return;
    }

    try {
      if (type === "course") {
        await deleteDoc(doc(db, "courses", validId));
        console.log("Firestore Delete Success: Course document deleted", validId);
        showToast(`Course "${title}" deleted from Firestore.`, "success");
      } else if (type === "post") {
        await deleteDoc(doc(db, "posts", validId));
        console.log("Firestore Delete Success: Lesson document deleted", validId);
        showToast(`Lesson "${title}" deleted from Firestore.`, "success");
      } else if (type === "paidCourse") {
        await deleteDoc(doc(db, "paid_courses", validId));
        await deleteDoc(doc(db, "courses", validId)).catch(() => {});
        console.log("Firestore Delete Success: Masterclass deleted", validId);
        showToast(`Masterclass "${title}" deleted from Firestore.`, "success");
      }
    } catch (error) {
      console.error("Firestore Delete Error:", error);
      showToast("Delete Error: " + error.message, "error");
    } finally {
      closeDeleteModal();
    }
  });
}

// -------------------------------------------------------------
// 8. TABLE RENDERERS & LIVE UI UPDATES
// -------------------------------------------------------------
function renderCoursesTable() {
  const tbody = document.getElementById("courses-table-body");
  if (!tbody) return;

  const searchInput = document.getElementById("course-search");
  const query = (searchInput?.value || "").toLowerCase().trim();

  const filtered = coursesData.filter((c) => {
    if (!query) return true;
    return (
      (c.title || "").toLowerCase().includes(query) ||
      (c.slug || "").toLowerCase().includes(query) ||
      (c.description || "").toLowerCase().includes(query)
    );
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted);">
          No courses found. Click "+ New Course" to add one.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((course) => {
    const lessonCount = postsData.filter((p) => p.courseId === course.id).length;
    const isPublished = course.status === "published";
    const statusBadge = isPublished
      ? '<span class="badge badge-published">Published</span>'
      : '<span class="badge badge-in-dev">Draft / In Dev</span>';

    const isPaid = course.type === "paid" || Boolean(course.price && !String(course.price).toLowerCase().includes("free") && course.price !== "0");
    const typeBadge = isPaid
      ? `<span class="badge" style="background: rgba(242, 201, 76, 0.2); color: var(--yellow); border: 1px solid rgba(242, 201, 76, 0.4);">⭐ Paid (${escapeHTML(course.price || "₹499")})</span>`
      : `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4);">🌱 Free</span>`;

    const paymentLinkPreview = isPaid && course.paymentLink
      ? `<div style="margin-top: 4px;"><a href="${escapeHTML(course.paymentLink)}" target="_blank" rel="noopener noreferrer" style="color: var(--yellow); font-size: 11px; text-decoration: underline;">💳 Payment Gateway Link ↗</a></div>`
      : '';

    const courseImg = course.imageUrl || course.courseImage || course.image;
    const photoOrIcon = courseImg && courseImg.trim()
      ? `<img src="${escapeHTML(courseImg.trim())}" alt="Photo" style="width: 42px; height: 42px; border-radius: 6px; object-fit: cover; border: 1px solid rgba(242, 201, 76, 0.4); flex-shrink: 0;">`
      : `<span style="font-size: 20px; flex-shrink: 0;">${escapeHTML(course.icon || "📘")}</span>`;

    const isCoursePurchased = course.isPurchased === true || course.purchased === true;
    const accessBadge = isPaid
      ? (isCoursePurchased
          ? `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4); font-size: 11px; font-weight: 700;">✓ isPurchased: true</span>`
          : `<span class="badge" style="background: rgba(244, 63, 94, 0.2); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.4); font-size: 11px; font-weight: 700;">✗ isPurchased: false</span>`)
      : '';

    const toggleAccessBtn = isPaid
      ? `<button class="btn btn-sm btn-toggle-course-access" data-id="${course.id}" data-current="${isCoursePurchased}" title="Toggle isPurchased" style="font-size: 11px; padding: 3px 8px; border-radius: 4px; border: 1px solid ${isCoursePurchased ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)'}; background: ${isCoursePurchased ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)'}; color: ${isCoursePurchased ? '#f43f5e' : '#10b981'}; cursor: pointer;">
           ${isCoursePurchased ? 'Set False' : 'Set True'}
         </button>`
      : '';

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            ${photoOrIcon}
            <div>
              <strong style="color: var(--text-white); display: block; font-size: 15px;">${escapeHTML(course.title)}</strong>
              <div style="margin-top: 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                ${typeBadge}
                ${accessBadge}
                ${toggleAccessBtn}
              </div>
              ${paymentLinkPreview}
            </div>
          </div>
        </td>
        <td><code class="font-mono" style="font-size: 12px; color: var(--indigo-light);">${escapeHTML(course.slug || "")}</code></td>
        <td>${statusBadge}</td>
        <td><span class="badge" style="background: rgba(255,255,255,0.06); color: var(--text-white);">${lessonCount}</span></td>
        <td>${course.order ?? 1}</td>
        <td>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm btn-edit-course" data-id="${course.id}" title="Edit Course">Edit</button>
            <button class="btn btn-secondary btn-sm btn-course-video" data-id="${course.id}" title="Add/Edit YouTube Video" style="background: rgba(242, 201, 76, 0.15); color: var(--yellow); border: 1px solid rgba(242, 201, 76, 0.4);">🎬 Video</button>
            <button class="btn btn-secondary btn-sm btn-quick-lesson" data-id="${course.id}" title="Add content / lesson">+ Lesson</button>
            <button class="btn btn-danger btn-sm btn-delete-course" data-id="${course.id}" data-title="${escapeHTML(course.title)}" title="Delete Course">✕</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Bind Actions
  tbody.querySelectorAll(".btn-toggle-course-access").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const courseId = getValidDocId(btn.getAttribute("data-id"));
      if (!courseId) {
        showToast("Invalid course ID", "error");
        return;
      }
      const current = btn.getAttribute("data-current") === "true";
      const nextState = !current;

      btn.disabled = true;
      btn.textContent = "...";

      try {
        await updateDoc(doc(db, "courses", courseId), {
          isPurchased: nextState,
          purchased: nextState,
          updatedAt: serverTimestamp()
        });
        showToast(nextState ? "Course set to isPurchased: true!" : "Course set to isPurchased: false!", "success");
      } catch (err) {
        console.error("Failed to toggle course access:", err);
        showToast("Error updating course access: " + err.message, "error");
      }
    });
  });

  tbody.querySelectorAll(".btn-course-video").forEach((btn) => {
    btn.addEventListener("click", () => openCourseVideoModal(btn.getAttribute("data-id")));
  });
  tbody.querySelectorAll(".btn-edit-course").forEach((btn) => {
    btn.addEventListener("click", () => openCourseModal(btn.getAttribute("data-id")));
  });
  tbody.querySelectorAll(".btn-quick-lesson").forEach((btn) => {
    btn.addEventListener("click", () => openPublishModal(btn.getAttribute("data-id")));
  });
  tbody.querySelectorAll(".btn-delete-course").forEach((btn) => {
    btn.addEventListener("click", () => {
      confirmDelete("course", btn.getAttribute("data-id"), btn.getAttribute("data-title"));
    });
  });
}

function renderPostsTable() {
  const tbody = document.getElementById("posts-table-body");
  if (!tbody) return;

  const searchInput = document.getElementById("post-search");
  const query = (searchInput?.value || "").toLowerCase().trim();

  const filtered = postsData.filter((p) => {
    if (!query) return true;
    return (
      (p.title || "").toLowerCase().includes(query) ||
      (p.slug || "").toLowerCase().includes(query) ||
      (p.courseTitle || "").toLowerCase().includes(query)
    );
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">
          No lessons found. Click "+ New Post / Lesson" to create one.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((post) => {
    const courseObj = coursesData.find((c) => c.id === post.courseId);
    const courseName = courseObj ? courseObj.title : (post.courseTitle || "Unassigned");
    const isPublished = post.status === "published";
    const statusBadge = isPublished
      ? '<span class="badge badge-published">Published</span>'
      : '<span class="badge badge-draft">Draft</span>';

    return `
      <tr>
        <td><strong style="color: var(--text-white);">${escapeHTML(post.title)}</strong></td>
        <td><span style="color: var(--text-muted); font-size: 13px;">${escapeHTML(courseName)}</span></td>
        <td>${statusBadge}</td>
        <td><span style="font-size: 12px; color: var(--text-muted);">${post.videoUrl ? "✓ Video" : "—"}</span></td>
        <td><span style="font-size: 12px; color: var(--text-muted);">${post.readTime || "5 min"}</span></td>
        <td>${post.order ?? 1}</td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm btn-edit-post" data-id="${post.id}">Edit</button>
            <button class="btn btn-danger btn-sm btn-delete-post" data-id="${post.id}" data-title="${escapeHTML(post.title)}">✕</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".btn-edit-post").forEach((btn) => {
    btn.addEventListener("click", () => openPostModal(btn.getAttribute("data-id")));
  });
  tbody.querySelectorAll(".btn-delete-post").forEach((btn) => {
    btn.addEventListener("click", () => {
      confirmDelete("post", btn.getAttribute("data-id"), btn.getAttribute("data-title"));
    });
  });
}

function renderPaidCoursesTable() {
  const tbody = document.getElementById("paid-courses-table-body");
  if (!tbody) return;

  if (paidCoursesData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">
          No masterclasses created yet. Click "+ Create Masterclass" to publish one.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = paidCoursesData.map((course) => {
    return `
      <tr>
        <td><strong style="color: var(--text-white);">${escapeHTML(course.title)}</strong></td>
        <td><span style="color: #10b981; font-weight: 700;">${escapeHTML(course.price || "₹2599")}</span></td>
        <td><span style="color: var(--text-muted); text-decoration: line-through;">${escapeHTML(course.originalPrice || "—")}</span></td>
        <td><span class="badge" style="background: rgba(255,255,255,0.06); color: var(--text-white);">${escapeHTML(course.category || "Masterclass")}</span></td>
        <td><span style="font-size: 13px; color: var(--text-muted);">${escapeHTML(course.instructor || "ShortStudy")}</span></td>
        <td><span class="badge badge-published">Active</span></td>
        <td>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm btn-edit-paid" data-id="${course.id}">Edit</button>
            <button class="btn btn-secondary btn-sm btn-course-video" data-id="${course.id}" title="Add/Edit YouTube Video" style="background: rgba(242, 201, 76, 0.15); color: var(--yellow); border: 1px solid rgba(242, 201, 76, 0.4);">🎬 Video</button>
            <button class="btn btn-danger btn-sm btn-delete-paid" data-id="${course.id}" data-title="${escapeHTML(course.title)}">✕</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".btn-course-video").forEach((btn) => {
    btn.addEventListener("click", () => openCourseVideoModal(btn.getAttribute("data-id")));
  });
  tbody.querySelectorAll(".btn-edit-paid").forEach((btn) => {
    btn.addEventListener("click", () => openPaidCourseModal(btn.getAttribute("data-id")));
  });
  tbody.querySelectorAll(".btn-delete-paid").forEach((btn) => {
    btn.addEventListener("click", () => {
      confirmDelete("paidCourse", btn.getAttribute("data-id"), btn.getAttribute("data-title"));
    });
  });
}

function renderOrdersTable() {
  const tbody = document.getElementById("orders-table-body");
  if (!tbody) return;

  if (ordersData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted);">
          No purchase orders yet. Student purchases will appear here live in real time.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = ordersData.map((order) => {
    // Check if user has received course access
    const isPurchased = order.isPurchased === true || order.purchased === true || (order.purchased !== false && order.status === "approved");
    const studentName = order.studentName || order.userName || order.name || "Student";
    const studentEmail = order.studentEmail || order.userEmail || order.email || "—";
    const studentPhone = order.studentPhone || order.userPhone || order.phone || "";
    const courseTitle = order.courseTitle || "Course";
    const amount = order.amount || order.coursePrice || "₹499";
    
    let dateStr = "Recent";
    if (order.createdAt?.toDate) {
      dateStr = order.createdAt.toDate().toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" });
    }

    const accessBadge = isPurchased
      ? `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4); font-weight: 700; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">
           ✓ isPurchased: true
         </span>`
      : `<span class="badge" style="background: rgba(244, 63, 94, 0.2); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.4); font-weight: 700; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">
           ✗ isPurchased: false
         </span>`;

    const controlButton = !isPurchased
      ? `<button class="btn btn-success btn-sm btn-toggle-purchase" data-id="${order.id}" data-action="grant" style="background: #10b981; color: #fff; font-weight: 700; padding: 6px 12px; border-radius: 6px; cursor: pointer; border: none; font-size: 12px;">
           ⚡ Grant Access (Make TRUE)
         </button>`
      : `<button class="btn btn-secondary btn-sm btn-toggle-purchase" data-id="${order.id}" data-action="revoke" style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3); font-size: 11.5px; padding: 5px 10px; border-radius: 6px; cursor: pointer;">
           Revoke (Make FALSE)
         </button>`;

    return `
      <tr>
        <td>
          <code class="font-mono" style="font-size: 11.5px; color: var(--text-muted);">${escapeHTML((order.id || "").slice(0, 10))}...</code>
          <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 3px;">📅 ${dateStr}</div>
        </td>
        <td>
          <strong style="color: var(--text-white); font-size: 14px;">${escapeHTML(studentName)}</strong>
          <div style="color: var(--indigo-light); font-size: 12px; margin-top: 2px;">✉️ ${escapeHTML(studentEmail)}</div>
          ${studentPhone ? `<div style="color: var(--yellow); font-size: 11.5px; margin-top: 2px;">📱 ${escapeHTML(studentPhone)}</div>` : ''}
        </td>
        <td>
          <strong style="color: var(--yellow); font-size: 14px;">${escapeHTML(courseTitle)}</strong>
        </td>
        <td><strong style="color: #10b981; font-size: 14px;">${escapeHTML(amount)}</strong></td>
        <td>${accessBadge}</td>
        <td>${controlButton}</td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".btn-toggle-purchase").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const orderId = getValidDocId(btn.getAttribute("data-id"));
      if (!orderId) {
        showToast("Invalid order ID", "error");
        return;
      }
      const action = btn.getAttribute("data-action");
      const setPurchased = action === "grant";
      
      btn.disabled = true;
      btn.textContent = "Updating...";

      try {
        await updateDoc(doc(db, "course_orders", orderId), {
          isPurchased: setPurchased,
          purchased: setPurchased,
          status: setPurchased ? "approved" : "pending",
          updatedAt: serverTimestamp()
        });
        showToast(
          setPurchased 
            ? "Access granted! 'isPurchased: true' saved to Firestore." 
            : "Access revoked! 'isPurchased: false' saved to Firestore.",
          "success"
        );
      } catch (err) {
        console.error("Failed to update access:", err);
        showToast("Failed to update access: " + err.message, "error");
      }
    });
  });
}

function populateCourseSelects() {
  const selects = [
    document.getElementById("post-course"),
    document.getElementById("filter-post-course")
  ].filter(Boolean);

  selects.forEach((sel) => {
    const currentVal = sel.value;
    const isFilter = sel.id === "filter-post-course";
    let html = isFilter ? '<option value="all">All Courses</option>' : '<option value="">Select a Course *</option>';

    coursesData.forEach((course) => {
      html += `<option value="${escapeHTML(course.id)}">${escapeHTML(course.title)}</option>`;
    });

    sel.innerHTML = html;
    if (currentVal) sel.value = currentVal;
  });
}

function updateMetrics() {
  const totalCoursesEl = document.getElementById("metric-total-courses");
  const totalPostsEl = document.getElementById("metric-total-posts");
  const pendingOrdersEl = document.getElementById("metric-pending-orders");
  const pendingBadgeEl = document.getElementById("pending-orders-badge");

  if (totalCoursesEl) totalCoursesEl.textContent = coursesData.length;
  if (totalPostsEl) totalPostsEl.textContent = postsData.length;

  const pendingCount = ordersData.filter((o) => o.status !== "approved").length;
  if (pendingOrdersEl) pendingOrdersEl.textContent = pendingCount;
  if (pendingBadgeEl) {
    pendingBadgeEl.textContent = pendingCount;
    pendingBadgeEl.style.display = pendingCount > 0 ? "inline-flex" : "none";
  }
}

// -------------------------------------------------------------
// 9. TAB NAVIGATION & SEARCH ENGINE
// -------------------------------------------------------------
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const targetTab = link.getAttribute("data-tab");
    if (!targetTab) return;

    document.querySelectorAll(".nav-link").forEach((l) => l.classList.remove("active"));
    document.querySelectorAll(".view-section").forEach((s) => s.classList.remove("active"));

    link.classList.add("active");
    const targetSection = document.getElementById(`view-${targetTab}`);
    if (targetSection) targetSection.classList.add("active");
  });
});

document.getElementById("course-search")?.addEventListener("input", renderCoursesTable);
document.getElementById("post-search")?.addEventListener("input", renderPostsTable);

// Mobile Sidebar Toggle
document.getElementById("menu-burger")?.addEventListener("click", () => {
  document.querySelector(".admin-sidebar")?.classList.toggle("open");
});

// Auto-initialize when module is loaded
console.log("ShortStudy Admin Engine Loaded (Pure Firestore Mode)");
