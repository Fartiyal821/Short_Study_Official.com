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
  serverTimestamp,
  getDoc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { auth, db, firebaseConfig } from "./firebase-config.js";
import { sanitizeHTML, processYouTubeEmbed, extractYouTubeId } from "./sanitizer.js";
import { 
  parseAndFormatLessonContent, 
  calculateReadingTime, 
  generateExcerpt, 
  slugify 
} from "./content-format.js";
import { 
  PRE_EXISTING_COURSES, 
  PRE_EXISTING_LESSONS,
  PRE_EXISTING_PAID_COURSES,
  DEFAULT_COURSE_IDS,
  DEFAULT_POST_IDS
} from "./catalog-data.js";

// State Management
const ADMIN_EMAIL = "gauravfartiyal751@gmail.com";

const deletedCourseIds = new Set([
  ...JSON.parse(localStorage.getItem("deletedCourseIds") || "[]"),
  ...Array.from(DEFAULT_COURSE_IDS)
]);
const deletedPostIds = new Set([
  ...JSON.parse(localStorage.getItem("deletedPostIds") || "[]"),
  ...Array.from(DEFAULT_POST_IDS)
]);
const deletedPaidCourseIds = new Set([
  ...JSON.parse(localStorage.getItem("deletedPaidCourseIds") || "[]"),
  ...Array.from(DEFAULT_COURSE_IDS)
]);

try {
  const cachedCourses = JSON.parse(localStorage.getItem("shortstudy_cached_courses") || "[]");
  if (Array.isArray(cachedCourses)) {
    const cleaned = cachedCourses.filter(c => c && !DEFAULT_COURSE_IDS.has(c.id) && !DEFAULT_COURSE_IDS.has(c.slug));
    localStorage.setItem("shortstudy_cached_courses", JSON.stringify(cleaned));
  }
  const cachedPaid = JSON.parse(localStorage.getItem("shortstudy_cached_paid_courses") || "[]");
  if (Array.isArray(cachedPaid)) {
    const cleaned = cachedPaid.filter(c => c && !DEFAULT_COURSE_IDS.has(c.id) && !DEFAULT_COURSE_IDS.has(c.slug));
    localStorage.setItem("shortstudy_cached_paid_courses", JSON.stringify(cleaned));
  }
} catch (e) {}

let currentUser = null;
let currentAdminProfile = null;
let activeTab = "courses"; // 'overview', 'courses', 'posts', 'preview', 'config'
let coursesData = [...PRE_EXISTING_COURSES].filter(c => !deletedCourseIds.has(c.id) && !DEFAULT_COURSE_IDS.has(c.id));
let postsData = [...PRE_EXISTING_LESSONS].filter(p => !deletedPostIds.has(p.id) && !DEFAULT_POST_IDS.has(p.id));
let paidCoursesData = [...(PRE_EXISTING_PAID_COURSES || [])].filter(c => !deletedPaidCourseIds.has(c.id) && !DEFAULT_COURSE_IDS.has(c.id));
let ordersData = [];

let currentPostVideos = [];

let unsubscribeCourses = null;
let unsubscribePosts = null;
let unsubscribeLessons = null;
let unsubscribePaidCourses = null;
let unsubscribeOrders = null;

const firestoreCoursesMap = new Map();
const firestorePostsMap = new Map();
const firestoreLessonsMap = new Map();
const firestorePaidCoursesMap = new Map();
const serverPaidCoursesMap = new Map();
const firestoreOrdersMap = new Map();

let editingCourseId = null;
let editingPostId = null;
let editingPaidCourseId = null;
let currentOrderFilter = "all";

// DOM Elements
const loginSection = document.getElementById('login-section') || document.getElementById('auth-guard-screen');
const dashboardSection = document.getElementById('dashboard-section') || document.getElementById('admin-dashboard-screen');
const loginForm = document.getElementById('login-form') || document.getElementById('auth-form');
const authError = document.getElementById('auth-error') || document.getElementById('auth-error-message');
const logoutBtn = document.getElementById('logout-btn') || document.getElementById('btn-signout');

// DOM Elements Cache
const el = {
  authGuardScreen: loginSection,
  accessDeniedScreen: document.getElementById("access-denied-screen"),
  adminDashboard: dashboardSection,
  
  // Auth Form Elements
  authForm: loginForm,
  authTitle: document.getElementById("auth-title"),
  authSubtitle: document.getElementById("auth-subtitle"),
  authEmail: document.getElementById("login-email") || document.getElementById("auth-email"),
  authPassword: document.getElementById("login-password") || document.getElementById("auth-password"),
  authNameGroup: document.getElementById("auth-name-group"),
  authName: document.getElementById("auth-name"),
  authSubmitBtn: document.getElementById("auth-submit-btn"),
  authErrorMessage: authError,
  tabLogin: document.getElementById("tab-login"),
  tabRegister: document.getElementById("tab-register"),
  
  // Denied Screen Elements
  deniedEmail: document.getElementById("denied-email"),
  deniedUid: document.getElementById("denied-uid"),
  btnCopyUid: document.getElementById("btn-copy-uid"),
  btnCheckApproval: document.getElementById("btn-check-approval"),
  btnDeniedSignout: document.getElementById("btn-denied-signout"),
  btnDevClaimAdmin: document.getElementById("btn-dev-claim-admin"),

  // Topbar & Sidebar
  userDisplayName: document.getElementById("user-display-name"),
  userAvatarInitial: document.getElementById("user-avatar-initial"),
  btnSignOut: logoutBtn,
  livePulseStatus: document.getElementById("live-status-text"),
  navLinks: document.querySelectorAll(".nav-link"),
  viewSections: document.querySelectorAll(".view-section"),
  menuBurger: document.getElementById("menu-burger"),
  sidebar: document.querySelector(".admin-sidebar"),

  // Metrics
  metricTotalCourses: document.getElementById("metric-total-courses"),
  metricTotalPosts: document.getElementById("metric-total-posts"),
  metricPublishedPosts: document.getElementById("metric-published-posts"),
  metricVideosCount: document.getElementById("metric-videos-count"),
  courseCountBadge: document.getElementById("course-count-badge"),
  postCountBadge: document.getElementById("post-count-badge"),

  // Course Elements
  coursesTableBody: document.getElementById("courses-table-body"),
  btnNewCourse: document.getElementById("btn-new-course"),
  courseModal: document.getElementById("course-modal"),
  courseModalTitle: document.getElementById("course-modal-title"),
  courseForm: document.getElementById("course-form"),
  courseTitle: document.getElementById("course-title"),
  courseSlug: document.getElementById("course-slug"),
  courseDescription: document.getElementById("course-description"),
  courseIcon: document.getElementById("course-icon"),
  courseStatus: document.getElementById("course-status"),
  courseOrder: document.getElementById("course-order"),
  courseModalClose: document.getElementById("course-modal-close"),
  courseCancelBtn: document.getElementById("course-cancel-btn"),
  courseSearch: document.getElementById("course-search"),

  // Post/Lesson Elements
  postsTableBody: document.getElementById("posts-table-body"),
  btnNewPost: document.getElementById("btn-new-post"),
  postModal: document.getElementById("post-modal"),
  postModalTitle: document.getElementById("post-modal-title"),
  postForm: document.getElementById("post-form"),
  postCourseSelect: document.getElementById("post-course-select"),
  postTitle: document.getElementById("post-title"),
  postSlug: document.getElementById("post-slug"),
  postExcerpt: document.getElementById("post-excerpt"),
  postReadingTime: document.getElementById("post-reading-time"),
  postStatus: document.getElementById("post-status"),
  postOrder: document.getElementById("post-order"),
  postYoutubeInput: document.getElementById("post-youtube-input"),
  postYoutubePreview: document.getElementById("post-youtube-preview"),
  postContent: document.getElementById("post-content"),
  postModalClose: document.getElementById("post-modal-close"),
  postCancelBtn: document.getElementById("post-cancel-btn"),
  postSearch: document.getElementById("post-search"),
  tabContentEditor: document.getElementById("tab-content-editor"),
  tabContentPreview: document.getElementById("tab-content-preview"),
  editorPane: document.getElementById("editor-pane"),
  previewPane: document.getElementById("preview-pane"),

  // Delete Confirm Modal
  deleteModal: document.getElementById("delete-modal"),
  deleteModalText: document.getElementById("delete-modal-text"),
  deleteConfirmBtn: document.getElementById("delete-confirm-btn"),
  deleteCancelBtn: document.getElementById("delete-cancel-btn"),

  // API Config Modal / Settings
  apiKeyInput: document.getElementById("config-api-key"),
  btnSaveApiKey: document.getElementById("btn-save-api-key"),
  toastContainer: document.getElementById("toast-container"),

  // Dedicated Publish Content Modal
  publishModal: document.getElementById("publish-modal"),
  publishModalTitle: document.getElementById("publish-modal-title"),
  publishModalClose: document.getElementById("publish-modal-close"),
  publishModalCancel: document.getElementById("publish-modal-cancel"),
  publishCourseTitle: document.getElementById("publish-course-title"),
  publishCourseIcon: document.getElementById("publish-course-icon"),
  publishCourseBadge: document.getElementById("publish-course-badge"),
  publishTargetCourseId: document.getElementById("publish-target-course-id"),
  btnQuickActivateCourse: document.getElementById("btn-quick-activate-course"),
  publishContentForm: document.getElementById("publish-content-form"),
  publishLessonTitle: document.getElementById("publish-lesson-title"),
  publishLessonSlug: document.getElementById("publish-lesson-slug"),
  publishLessonReadingTime: document.getElementById("publish-lesson-reading-time"),
  publishLessonOrder: document.getElementById("publish-lesson-order"),
  publishLessonExcerpt: document.getElementById("publish-lesson-excerpt"),
  publishLessonYoutube: document.getElementById("publish-lesson-youtube"),
  publishLessonContent: document.getElementById("publish-lesson-content"),
  btnSubmitPublishAndActivate: document.getElementById("btn-submit-publish-and-activate"),

  // Post Modal in-dev course elements
  postCourseInDevAlert: document.getElementById("post-course-in-dev-alert"),
  postPublishContentBtn: document.getElementById("post-publish-content-btn"),

  // Paid Course Management Elements
  paidCourseCountBadge: document.getElementById("paid-course-count-badge"),
  pendingOrdersBadge: document.getElementById("pending-orders-badge"),
  metricTotalPaidCourses: document.getElementById("metric-total-paid-courses"),
  metricPendingOrders: document.getElementById("metric-pending-orders"),
  paidCoursesTableBody: document.getElementById("paid-courses-table-body"),
  btnNewPaidCourse: document.getElementById("btn-new-paid-course"),
  paidCourseSearch: document.getElementById("paid-course-search"),
  paidCourseModal: document.getElementById("paid-course-modal"),
  paidCourseModalHeading: document.getElementById("paid-course-modal-heading"),
  paidCourseForm: document.getElementById("paid-course-form"),
  paidModalTitle: document.getElementById("paid-modal-title"),
  paidModalPrice: document.getElementById("paid-modal-price"),
  paidModalOrigPrice: document.getElementById("paid-modal-orig-price"),
  paidModalDuration: document.getElementById("paid-modal-duration"),
  paidModalBadge: document.getElementById("paid-modal-badge"),
  paidModalStatus: document.getElementById("paid-modal-status"),
  paidModalImage: document.getElementById("paid-modal-image"),
  paidModalVideo: document.getElementById("paid-modal-video"),
  paidModalDesc: document.getElementById("paid-modal-desc"),
  paidCourseModalClose: document.getElementById("paid-course-modal-close"),
  paidCourseModalCancel: document.getElementById("paid-course-modal-cancel"),

  // Orders / Fail-Safe Elements
  ordersTableBody: document.getElementById("orders-table-body"),
  orderFilterBtns: document.querySelectorAll(".order-filter-btn")
};

// UI Notification Toast Helper
export function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
  `;
  el.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// -------------------------------------------------------------
// 1. AUTHENTICATION & REGISTRATION GUARD LOGIC
// -------------------------------------------------------------
let authMode = "login"; // 'login' or 'register'

function setAuthMode(mode) {
  authMode = mode;
  if (el.authErrorMessage) el.authErrorMessage.textContent = "";
  if (mode === "login") {
    if (el.tabLogin) el.tabLogin.classList.add("active");
    if (el.tabRegister) el.tabRegister.classList.remove("active");
    if (el.authTitle) el.authTitle.textContent = "Admin Login";
    if (el.authSubtitle) el.authSubtitle.textContent = "Enter your verified administrator credentials";
    if (el.authNameGroup) el.authNameGroup.style.display = "none";
    if (el.authSubmitBtn) el.authSubmitBtn.textContent = "Login to Dashboard";
  } else {
    if (el.tabRegister) el.tabRegister.classList.add("active");
    if (el.tabLogin) el.tabLogin.classList.remove("active");
    if (el.authTitle) el.authTitle.textContent = "Register Admin Account";
    if (el.authSubtitle) el.authSubtitle.textContent = "Create an account for administrator verification";
    if (el.authNameGroup) el.authNameGroup.style.display = "flex";
    if (el.authSubmitBtn) el.authSubmitBtn.textContent = "Register Account";
  }
}

if (el.tabLogin) el.tabLogin.addEventListener("click", () => setAuthMode("login"));
if (el.tabRegister) el.tabRegister.addEventListener("click", () => setAuthMode("register"));

function showAuthError(message, isHtml = false) {
  if (authError) {
    if (isHtml || (typeof message === "string" && message.includes("<"))) {
      authError.innerHTML = message;
      // Bind any copy buttons created inside message
      const btnCopy = authError.querySelector("#btn-copy-domain");
      if (btnCopy) {
        btnCopy.addEventListener("click", () => {
          const domain = window.location.hostname;
          navigator.clipboard.writeText(domain).then(() => {
            showToast(`Copied domain: ${domain}`, "success");
          });
        });
      }
    } else {
      authError.textContent = message;
    }
    authError.classList.remove('hidden');
    authError.style.display = 'block';
  }
  const cleanToastMsg = typeof message === "string" ? message.replace(/<[^>]*>/g, "").slice(0, 80) : "Authentication error";
  showToast(cleanToastMsg, "error");
}

// Check Auth State
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user && user.email === ADMIN_EMAIL) {
    if (loginSection) {
      loginSection.classList.add('hidden');
      loginSection.style.display = 'none';
    }
    if (el.accessDeniedScreen) el.accessDeniedScreen.style.display = 'none';
    if (dashboardSection) {
      dashboardSection.classList.remove('hidden');
      dashboardSection.style.display = 'flex';
    }
    loadDashboardData();
  } else if (user && user.email !== ADMIN_EMAIL) {
    // If logged in with non-admin email
    signOut(auth);
    showAuthError("Access Denied: You are not authorized as Administrator.");
  } else {
    if (loginSection) {
      loginSection.classList.remove('hidden');
      loginSection.style.display = 'flex';
    }
    if (dashboardSection) {
      dashboardSection.classList.add('hidden');
      dashboardSection.style.display = 'none';
    }
    stopRealtimeListeners();
  }
});

// Admin Login Process
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (authError) {
      authError.textContent = "";
      authError.classList.add('hidden');
    }
    const email = (document.getElementById('login-email') || document.getElementById('auth-email') || {}).value?.trim() || "";
    const password = (document.getElementById('login-password') || document.getElementById('auth-password') || {}).value || "";
    const name = (document.getElementById('auth-name') || {}).value?.trim() || "";

    if (!email || !password) {
      showAuthError("Please provide both email and password.");
      return;
    }

    if (email !== ADMIN_EMAIL) {
      showAuthError("Access Denied: Invalid Admin Credentials.");
      return;
    }

    if (el.authSubmitBtn) {
      el.authSubmitBtn.disabled = true;
      el.authSubmitBtn.textContent = "Authenticating...";
    }

    try {
      if (authMode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name && cred.user) {
          await updateProfile(cred.user, { displayName: name });
        }
        showToast("Account registered! Welcome Administrator.", "success");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        showToast("Welcome back, Administrator!", "success");
      }
      if (authError) authError.classList.add('hidden');
    } catch (error) {
      let errorMsg = error.message;
      const isApiKeyError = error.code === "auth/invalid-api-key" || 
                            error.code === "auth/api-key-not-valid" || 
                            (error.message && (error.message.includes("api-key-not-valid") || error.message.includes("API key not valid")));

      const currentHost = window.location.hostname || "fartiyal821.github.io";

      if (error.code === "auth/unauthorized-domain" || (error.message && error.message.includes("unauthorized-domain"))) {
        console.warn("Firebase Auth Notice: Unauthorized Domain", currentHost);
        errorMsg = `
          <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 8px; padding: 12px; margin-top: 4px; text-align: left;">
            <div style="font-weight: 600; color: #fbbf24; margin-bottom: 5px; font-size: 13px;">⚠️ GitHub Domain Authorization Needed</div>
            <div style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 8px;">
              Firebase has blocked authentication from <strong>${currentHost}</strong> because it is not in your Authorized Domains list.
            </div>
            <div style="font-size: 11.5px; color: var(--text-white); background: rgba(0,0,0,0.3); padding: 8px 10px; border-radius: 6px; margin-bottom: 10px; line-height: 1.6;">
              <strong>Step 1:</strong> Open <a href="https://console.firebase.google.com/project/shortstudy-de7d4/authentication/settings" target="_blank" rel="noopener noreferrer" style="color: var(--indigo-light); text-decoration: underline;">Firebase Console &gt; Auth &gt; Settings</a><br>
              <strong>Step 2:</strong> Scroll to <em>Authorized domains</em> &gt; click <em>Add domain</em><br>
              <strong>Step 3:</strong> Enter <code class="font-mono" style="color: #6ee7b7;">${currentHost}</code> and Save.
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-copy-domain" style="font-size: 11px; padding: 5px 10px; width: 100%;">
              📋 Copy Domain (${currentHost})
            </button>
          </div>
        `;
      } else if (isApiKeyError) {
        console.warn("Firebase Auth Notice: API key invalid or unconfigured", error.code);
        errorMsg = "Firebase Web API Key is invalid. Please paste your valid Web API Key from Firebase Console below.";
        const fixPanel = document.getElementById("api-key-fix-panel");
        if (fixPanel) fixPanel.classList.remove("hidden");
      } else if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        console.warn("Auth Notice: Invalid credentials");
        errorMsg = authMode === "login" 
          ? "Invalid email or password. If you have not created your password yet, click the 'Register' tab above." 
          : "Invalid credentials. Please verify your email and password.";
      } else if (error.code === "auth/email-already-in-use") {
        errorMsg = "This admin account is already registered! Please switch to the 'Login' tab to enter your password.";
      } else if (error.code === "auth/weak-password") {
        errorMsg = "Password must be at least 6 characters long.";
      } else if (error.code === "auth/operation-not-allowed") {
        errorMsg = "Email/Password sign-in provider is disabled in Firebase Console. Go to Firebase Console > Authentication > Sign-in method and enable Email/Password.";
      } else if (error.code === "auth/network-request-failed") {
        errorMsg = "Network request failed. Please check your internet connection or disable ad-blockers blocking Google APIs.";
      } else if (error.code === "auth/too-many-requests") {
        errorMsg = "Too many failed attempts. Access to this account has been temporarily disabled. Please wait a few minutes.";
      } else {
        console.error("Auth Error:", error);
      }
      showAuthError(errorMsg, true);
    } finally {
      if (el.authSubmitBtn) {
        el.authSubmitBtn.disabled = false;
        el.authSubmitBtn.textContent = authMode === "login" ? "Login to Dashboard" : "Register Account";
      }
    }
  });
}

// Logout Process
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    signOut(auth).then(() => {
      showToast("Signed out successfully", "info");
      setAuthMode("login");
    });
  });
}

if (el.btnDeniedSignout) {
  el.btnDeniedSignout.addEventListener('click', () => {
    signOut(auth).then(() => {
      showToast("Signed out successfully", "info");
      setAuthMode("login");
    });
  });
}

async function fetchServerCourses() {
  try {
    const res = await fetch('/api/courses');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.courses)) {
        json.courses.forEach(c => {
          if (!deletedCourseIds.has(c.id)) {
            firestoreCoursesMap.set(c.id, c);
          }
        });
        rebuildAndRenderContent();
      }
    }
  } catch (e) {
    console.warn("Server courses sync note:", e);
  }
}

async function fetchServerPaidCourses() {
  try {
    const res = await fetch('/api/paid-courses');
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.courses)) {
        serverPaidCoursesMap.clear();
        json.courses.forEach(c => {
          if (!deletedPaidCourseIds.has(c.id)) serverPaidCoursesMap.set(c.id, c);
        });
        rebuildAndRenderPaidCourses();
      }
    }
  } catch (e) {
    console.warn("Server paid courses sync note:", e);
  }
}

function loadDashboardData() {
  // Database CRUD operations run here securely via onSnapshot
  console.log("Admin Dashboard Loaded Successfully");
  if (currentUser) {
    const displayName = currentUser.displayName || currentUser.email.split("@")[0];
    if (el.userDisplayName) el.userDisplayName.textContent = displayName;
    if (el.userAvatarInitial) el.userAvatarInitial.textContent = displayName.charAt(0).toUpperCase();
  }
  fetchServerCourses();
  fetchServerPaidCourses();
  startRealtimeListeners();
}

// -------------------------------------------------------------
// 2. REAL-TIME DATA SYNCHRONIZATION (Multi-Collection broad listeners)
// -------------------------------------------------------------

/**
 * Synthesizes courses and lessons from base catalog and Firestore maps.
 * Ensures ALL pre-existing courses and lessons appear immediately upon load.
 */
function rebuildAndRenderContent() {
  // 1. Synthesize Courses: start with PRE_EXISTING_COURSES as base
  const courseMap = new Map();
  PRE_EXISTING_COURSES.forEach(c => {
    if (!deletedCourseIds.has(c.id)) courseMap.set(c.id, { ...c });
  });

  firestoreCoursesMap.forEach((cData, docId) => {
    if (deletedCourseIds.has(docId) || cData.isDeleted) return;
    const existing = courseMap.get(docId) || Array.from(courseMap.values()).find(item => item.slug === cData.slug);
    if (existing) {
      courseMap.set(existing.id, { ...existing, ...cData, id: existing.id });
    } else {
      courseMap.set(docId, { id: docId, ...cData });
    }
  });

  coursesData = Array.from(courseMap.values()).filter(c => !deletedCourseIds.has(c.id));
  coursesData.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  // 2. Synthesize Posts & Lessons: start with PRE_EXISTING_LESSONS as base
  const postMap = new Map();
  PRE_EXISTING_LESSONS.forEach(l => {
    if (!deletedPostIds.has(l.id)) postMap.set(l.id, { ...l });
  });

  const normalizeAndMerge = (docId, data) => {
    if (deletedPostIds.has(docId) || data.isDeleted) return;
    const rawContent = data.content || data.body || data.text || "";
    const titleVal = data.title || data.name || data.topic || "Untitled Lesson";
    const courseIdVal = data.courseId || data.parentCourse || data.course || "";

    const normalized = {
      id: docId,
      title: titleVal,
      courseId: courseIdVal,
      courseTitle: data.courseTitle || "",
      content: rawContent,
      formattedHtml: data.formattedHtml || parseAndFormatLessonContent(rawContent),
      order: parseInt(data.order ?? data.sequence ?? data.orderNumber ?? data.seq ?? 1, 10),
      status: data.status || "published",
      slug: data.slug || slugify(titleVal),
      readingTime: data.readingTime || calculateReadingTime(rawContent),
      excerpt: data.excerpt || generateExcerpt(rawContent),
      youtubeEmbed: data.youtubeEmbed || data.youtube || data.video || "",
      videos: Array.isArray(data.videos) ? data.videos : [],
      author: data.author || "ShortStudy Editorial",
      updatedAt: data.updatedAt || null
    };

    // Auto-resolve parent course title if empty
    if (!normalized.courseTitle && normalized.courseId) {
      const parent = coursesData.find(c => c.id === normalized.courseId || c.slug === normalized.courseId);
      if (parent) normalized.courseTitle = parent.title;
    }

    const existing = postMap.get(docId) || Array.from(postMap.values()).find(item => item.slug === normalized.slug && item.courseId === normalized.courseId);
    if (existing) {
      postMap.set(existing.id, { ...existing, ...normalized, id: existing.id });
    } else {
      postMap.set(docId, normalized);
    }
  };

  // Merge both posts and lessons collections without restrictive filters
  firestorePostsMap.forEach((val, key) => normalizeAndMerge(key, val));
  firestoreLessonsMap.forEach((val, key) => normalizeAndMerge(key, val));

  postsData = Array.from(postMap.values()).filter(p => !deletedPostIds.has(p.id));
  postsData.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  // Render UI
  renderCoursesTable();
  populateCourseSelects();
  renderPostsTable();
  rebuildAndRenderPaidCourses();
  rebuildAndRenderOrders();
  updateMetrics();

  // Background sync: write missing catalog items to Firestore
  syncCatalogToFirestore();
}

let isSyncingCatalog = false;
async function syncCatalogToFirestore() {
  if (isSyncingCatalog || !currentUser) return;
  isSyncingCatalog = true;

  try {
    // Purge any default courses and posts that might exist in Firestore
    for (const id of DEFAULT_COURSE_IDS) {
      if (firestoreCoursesMap.has(id)) {
        await deleteDoc(doc(db, "courses", id)).catch(() => {});
        firestoreCoursesMap.delete(id);
      }
      if (firestorePaidCoursesMap.has(id)) {
        await deleteDoc(doc(db, "paid_courses", id)).catch(() => {});
        firestorePaidCoursesMap.delete(id);
      }
    }
    for (const id of DEFAULT_POST_IDS) {
      if (firestorePostsMap.has(id)) {
        await deleteDoc(doc(db, "posts", id)).catch(() => {});
        firestorePostsMap.delete(id);
      }
      if (firestoreLessonsMap.has(id)) {
        await deleteDoc(doc(db, "lessons", id)).catch(() => {});
        firestoreLessonsMap.delete(id);
      }
    }
  } catch (e) {
    console.debug("Catalog purge note:", e);
  } finally {
    isSyncingCatalog = false;
  }
}

function startRealtimeListeners() {
  stopRealtimeListeners(); // avoid duplicate listeners

  // Immediately render from memory / base catalog
  rebuildAndRenderContent();
  el.livePulseStatus.textContent = "Connecting real-time sync...";

  // 1. Broad Courses Listener (fetches ALL courses including in_development)
  try {
    const coursesQuery = collection(db, "courses");
    unsubscribeCourses = onSnapshot(coursesQuery, (snapshot) => {
      firestoreCoursesMap.clear();
      snapshot.forEach((docSnap) => {
        firestoreCoursesMap.set(docSnap.id, docSnap.data());
      });
      rebuildAndRenderContent();
      el.livePulseStatus.textContent = "Real-time sync active";
    }, (error) => {
      console.warn("Firestore Courses listener note:", error);
      el.livePulseStatus.textContent = "Local offline sync active";
    });
  } catch (err) {
    console.error("Failed to start courses snapshot listener:", err);
  }

  // 2. Broad Posts Listener (fetches ALL posts without restrictive where filters)
  try {
    const postsQuery = collection(db, "posts");
    unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      firestorePostsMap.clear();
      snapshot.forEach((docSnap) => {
        firestorePostsMap.set(docSnap.id, docSnap.data());
      });
      rebuildAndRenderContent();
    }, (error) => {
      console.warn("Firestore Posts listener note:", error);
    });
  } catch (err) {
    console.error("Failed to start posts snapshot listener:", err);
  }

  // 3. Broad Lessons Listener (fetches ALL documents from lessons collection)
  try {
    const lessonsQuery = collection(db, "lessons");
    unsubscribeLessons = onSnapshot(lessonsQuery, (snapshot) => {
      firestoreLessonsMap.clear();
      snapshot.forEach((docSnap) => {
        firestoreLessonsMap.set(docSnap.id, docSnap.data());
      });
      rebuildAndRenderContent();
    }, (error) => {
      console.warn("Firestore Lessons listener note:", error);
    });
  } catch (err) {
    console.error("Failed to start lessons snapshot listener:", err);
  }

  // 4. Paid Courses Listener (Live on Programming Video's)
  try {
    const paidQuery = collection(db, "paid_courses");
    unsubscribePaidCourses = onSnapshot(paidQuery, (snapshot) => {
      firestorePaidCoursesMap.clear();
      snapshot.forEach((docSnap) => {
        firestorePaidCoursesMap.set(docSnap.id, docSnap.data());
      });
      rebuildAndRenderPaidCourses();
    }, (error) => {
      console.warn("Firestore paid_courses listener note:", error);
    });
  } catch (err) {
    console.error("Failed to start paid courses listener:", err);
  }

  // 5. Course Orders & Fail-Safe Ledger Listener
  try {
    const ordersQuery = collection(db, "course_orders");
    unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      firestoreOrdersMap.clear();
      snapshot.forEach((docSnap) => {
        firestoreOrdersMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
      });
      rebuildAndRenderOrders();
    }, (error) => {
      console.warn("Firestore course_orders listener note:", error);
    });
  } catch (err) {
    console.error("Failed to start orders listener:", err);
  }
}

function stopRealtimeListeners() {
  if (unsubscribeCourses) {
    unsubscribeCourses();
    unsubscribeCourses = null;
  }
  if (unsubscribePosts) {
    unsubscribePosts();
    unsubscribePosts = null;
  }
  if (unsubscribeLessons) {
    unsubscribeLessons();
    unsubscribeLessons = null;
  }
  if (unsubscribePaidCourses) {
    unsubscribePaidCourses();
    unsubscribePaidCourses = null;
  }
  if (unsubscribeOrders) {
    unsubscribeOrders();
    unsubscribeOrders = null;
  }
}

// Update Overview Metrics
function updateMetrics() {
  if (el.metricTotalCourses) el.metricTotalCourses.textContent = coursesData.length;
  if (el.metricTotalPosts) el.metricTotalPosts.textContent = postsData.length;
  
  const publishedCount = postsData.filter(p => p.status === "published").length;
  if (el.metricPublishedPosts) el.metricPublishedPosts.textContent = publishedCount;

  const videoCount = postsData.filter(p => p.youtubeEmbed && p.youtubeEmbed.trim() !== "").length;
  if (el.metricVideosCount) el.metricVideosCount.textContent = videoCount;

  if (el.courseCountBadge) el.courseCountBadge.textContent = coursesData.length;
  if (el.postCountBadge) el.postCountBadge.textContent = postsData.length;

  if (el.paidCourseCountBadge) el.paidCourseCountBadge.textContent = paidCoursesData.length;
  if (el.metricTotalPaidCourses) el.metricTotalPaidCourses.textContent = paidCoursesData.length;

  // Calculate Pending Access Orders (Fail-Safe)
  const pendingOrdersCount = ordersData.filter(o => 
    !o.accessGranted || o.paymentStatus === "pending_manual_access" || o.failSafeReason
  ).length;

  if (el.pendingOrdersBadge) {
    el.pendingOrdersBadge.textContent = pendingOrdersCount;
    el.pendingOrdersBadge.style.display = pendingOrdersCount > 0 ? "inline-block" : "none";
  }
  if (el.metricPendingOrders) {
    el.metricPendingOrders.textContent = pendingOrdersCount;
  }
}

// -------------------------------------------------------------
// 3. COURSES CRUD OPERATIONS
// -------------------------------------------------------------
function renderCoursesTable(filterQuery = "") {
  el.coursesTableBody.innerHTML = "";
  const queryLower = filterQuery.toLowerCase();
  const filtered = coursesData.filter(c => 
    (c.title || "").toLowerCase().includes(queryLower) ||
    (c.slug || "").toLowerCase().includes(queryLower)
  );

  if (filtered.length === 0) {
    el.coursesTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:32px; color:var(--text-muted);">
          No courses found. Click "+ New Course" to create one.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach((course) => {
    const tr = document.createElement("tr");
    const isInDev = course.status === "in_development";
    const isPublished = course.status === "published" || course.status === "active";
    const postCount = postsData.filter(p => p.courseId === course.id).length;

    let statusBadgeHtml = "";
    if (isInDev) {
      statusBadgeHtml = `<span class="badge badge-in-dev">In Development</span>`;
    } else if (isPublished) {
      statusBadgeHtml = `<span class="badge badge-published">Published</span>`;
    } else {
      statusBadgeHtml = `<span class="badge badge-draft">Draft</span>`;
    }

    // Prominent "In Development" badge next to title
    const titleDevBadge = isInDev 
      ? `<span class="badge badge-in-dev" style="margin-left: 8px;">In Development</span>` 
      : "";

    // Explicit "Publish Content" action button for courses marked "in_development"
    const publishBtnHtml = isInDev 
      ? `<button class="btn btn-success btn-sm publish-course-btn" data-id="${course.id}" title="Publish content and activate course into live status">🚀 Publish Content</button>` 
      : "";

    tr.innerHTML = `
      <td>
        <div style="display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
          <span style="font-size: 18px;">${course.icon || "📘"}</span>
          <strong>${escapeHtml(course.title)}</strong>
          ${titleDevBadge}
        </div>
      </td>
      <td><span class="font-mono" style="color:var(--indigo-light);">${escapeHtml(course.slug)}</span></td>
      <td>${statusBadgeHtml}</td>
      <td><span class="font-mono">${postCount}</span></td>
      <td><span class="font-mono">${course.order ?? 0}</span></td>
      <td>
        <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          ${publishBtnHtml}
          <button class="btn btn-secondary btn-sm edit-course-btn" data-id="${course.id}">Edit</button>
          <button class="btn btn-danger btn-sm delete-course-btn" data-id="${course.id}">Delete</button>
        </div>
      </td>
    `;
    el.coursesTableBody.appendChild(tr);
  });

  // Attach dynamic button listeners
  el.coursesTableBody.querySelectorAll(".publish-course-btn").forEach(btn => {
    btn.addEventListener("click", () => openPublishModal(btn.dataset.id));
  });
  el.coursesTableBody.querySelectorAll(".edit-course-btn").forEach(btn => {
    btn.addEventListener("click", () => openCourseModal(btn.dataset.id));
  });
  el.coursesTableBody.querySelectorAll(".delete-course-btn").forEach(btn => {
    btn.addEventListener("click", () => confirmDeleteCourse(btn.dataset.id));
  });
}

// -------------------------------------------------------------
// DEDICATED PUBLISH COURSE & CONTENT MODAL (In Development Logic)
// -------------------------------------------------------------
function openPublishModal(courseId) {
  const course = coursesData.find(c => c.id === courseId);
  if (!course) {
    showToast("Course not found", "error");
    return;
  }

  el.publishTargetCourseId.value = course.id;
  el.publishCourseTitle.textContent = course.title;
  el.publishCourseIcon.textContent = course.icon || "📘";
  el.publishModalTitle.textContent = `Publish Content: ${course.title}`;
  
  if (el.publishContentForm) el.publishContentForm.reset();
  
  // Calculate next lesson sequence number
  const nextOrder = postsData.filter(p => p.courseId === course.id).length + 1;
  el.publishLessonOrder.value = nextOrder;
  el.publishLessonReadingTime.value = "5 min read";
  
  if (el.publishModal) el.publishModal.classList.add("open");
}

function closePublishModal() {
  if (el.publishModal) el.publishModal.classList.remove("open");
  if (el.publishContentForm) el.publishContentForm.reset();
}

if (el.publishModalClose) el.publishModalClose.addEventListener("click", closePublishModal);
if (el.publishModalCancel) el.publishModalCancel.addEventListener("click", closePublishModal);

// Auto-generate lesson slug in publish modal
if (el.publishLessonTitle) {
  el.publishLessonTitle.addEventListener("input", () => {
    el.publishLessonSlug.value = slugify(el.publishLessonTitle.value);
  });
}

// Action 1: Direct activate course into published status (permanently removes In Development badge)
if (el.btnQuickActivateCourse) {
  el.btnQuickActivateCourse.addEventListener("click", async () => {
    const courseId = el.publishTargetCourseId.value;
    const course = coursesData.find(c => c.id === courseId);
    if (!courseId) return;

    try {
      const docRef = doc(db, "courses", courseId);
      await updateDoc(docRef, {
        status: "published",
        updatedAt: serverTimestamp()
      });
      showToast(`Course "${course ? course.title : ''}" published! "In Development" badge permanently removed.`, "success");
      closePublishModal();
    } catch (err) {
      console.error("Direct publish course error:", err);
      // Fallback local update
      const idx = coursesData.findIndex(c => c.id === courseId);
      if (idx !== -1) {
        coursesData[idx].status = "published";
        renderCoursesTable();
        populateCourseSelects();
      }
      showToast(`Course status updated to Published! "In Development" badge removed.`, "success");
      closePublishModal();
    }
  });
}

// Action 2: Append new lesson content and update course status atomically
if (el.publishContentForm) {
  el.publishContentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const courseId = el.publishTargetCourseId.value;
    const course = coursesData.find(c => c.id === courseId);
    if (!courseId) return;

    const lessonTitle = el.publishLessonTitle.value.trim();
    const rawContent = el.publishLessonContent.value;
    const rawYoutube = el.publishLessonYoutube.value.trim();

    if (!lessonTitle || !rawContent) {
      showToast("Please provide both lesson title and lesson content.", "error");
      return;
    }

    // Automatically align with design system using semantic formatting engine
    const formattedHtml = parseAndFormatLessonContent(rawContent);
    const readingTime = (el.publishLessonReadingTime && el.publishLessonReadingTime.value.trim()) 
      ? el.publishLessonReadingTime.value.trim() 
      : calculateReadingTime(rawContent);
    const excerpt = (el.publishLessonExcerpt && el.publishLessonExcerpt.value.trim())
      ? el.publishLessonExcerpt.value.trim()
      : generateExcerpt(rawContent);

    // Validate and sanitize YouTube embed if present
    let cleanYoutubeEmbed = "";
    if (rawYoutube) {
      const processed = processYouTubeEmbed(rawYoutube);
      cleanYoutubeEmbed = processed.isValid ? processed.iframeHtml : rawYoutube;
    }

    const postPayload = {
      courseId: courseId,
      courseTitle: course ? course.title : "Course",
      title: lessonTitle,
      slug: (el.publishLessonSlug && el.publishLessonSlug.value.trim()) || slugify(lessonTitle),
      excerpt: excerpt,
      readingTime: readingTime,
      status: "published", // Published content
      order: parseInt(el.publishLessonOrder.value, 10) || 1,
      youtubeEmbed: cleanYoutubeEmbed,
      content: rawContent,
      formattedHtml: formattedHtml,
      author: (currentUser && currentUser.displayName) ? currentUser.displayName : "Admin",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      // Atomic execution using runTransaction
      const courseDocRef = doc(db, "courses", courseId);
      const newPostDocRef = doc(collection(db, "posts"));
      const newLessonDocRef = doc(db, "lessons", newPostDocRef.id);

      await runTransaction(db, async (transaction) => {
        // 1. Append new lesson content successfully into both posts and lessons collections
        transaction.set(newPostDocRef, postPayload);
        transaction.set(newLessonDocRef, postPayload);
        // 2. Update course status to "published" (permanently removing In Development badge across Admin & Public)
        transaction.update(courseDocRef, {
          status: "published",
          updatedAt: serverTimestamp(),
          latestLessonTitle: lessonTitle
        });
      });

      // Update in-memory state immediately for instant responsive feedback
      firestorePostsMap.set(newPostDocRef.id, postPayload);
      const cExisting = firestoreCoursesMap.get(courseId) || course;
      firestoreCoursesMap.set(courseId, { ...cExisting, status: "published" });
      rebuildAndRenderContent();

      showToast(`New lesson appended & course "${course ? course.title : ''}" published! "In Development" badge permanently removed.`, "success");
      closePublishModal();
    } catch (err) {
      console.warn("Transaction publish failed, trying individual updates:", err);
      try {
        // Fallback: individual writes
        const addedPost = await addDoc(collection(db, "posts"), postPayload);
        await setDoc(doc(db, "lessons", addedPost.id), postPayload, { merge: true }).catch(() => {});
        await updateDoc(doc(db, "courses", courseId), {
          status: "published",
          updatedAt: serverTimestamp(),
          latestLessonTitle: lessonTitle
        });

        firestorePostsMap.set(addedPost.id, postPayload);
        const cExisting = firestoreCoursesMap.get(courseId) || course;
        firestoreCoursesMap.set(courseId, { ...cExisting, status: "published" });
        rebuildAndRenderContent();

        showToast(`New lesson appended & course published! "In Development" badge permanently removed.`, "success");
        closePublishModal();
      } catch (innerErr) {
        console.error("Publish content error:", innerErr);
        // Fallback local memory update
        const localId = "post-" + Date.now();
        postsData.unshift({ id: localId, ...postPayload });
        const cIdx = coursesData.findIndex(c => c.id === courseId);
        if (cIdx !== -1) {
          coursesData[cIdx].status = "published";
        }
        renderCoursesTable();
        populateCourseSelects();
        renderPostsTable();
        updateMetrics();
        showToast(`Content published locally! "In Development" badge removed.`, "info");
        closePublishModal();
      }
    }
  });
}

function openCourseModal(courseId = null) {
  editingCourseId = courseId;
  el.courseForm.reset();

  if (courseId) {
    const course = coursesData.find(c => c.id === courseId);
    if (course) {
      el.courseModalTitle.textContent = "Edit Course";
      el.courseTitle.value = course.title || "";
      el.courseSlug.value = course.slug || "";
      el.courseDescription.value = course.description || "";
      el.courseIcon.value = course.icon || "📘";
      el.courseStatus.value = course.status || "published";
      el.courseOrder.value = course.order ?? 1;
    }
  } else {
    el.courseModalTitle.textContent = "Create New Course";
    el.courseIcon.value = "📘";
    el.courseStatus.value = "published";
    el.courseOrder.value = coursesData.length + 1;
  }
  if (el.courseModal) el.courseModal.classList.add("open");
}

function closeCourseModal() {
  if (el.courseModal) el.courseModal.classList.remove("open");
  editingCourseId = null;
}

if (el.btnNewCourse) el.btnNewCourse.addEventListener("click", () => openCourseModal());
if (el.courseModalClose) el.courseModalClose.addEventListener("click", closeCourseModal);
if (el.courseCancelBtn) el.courseCancelBtn.addEventListener("click", closeCourseModal);

// Auto-generate slug from title
if (el.courseTitle) {
  el.courseTitle.addEventListener("input", () => {
    if (!editingCourseId && el.courseSlug) {
      el.courseSlug.value = slugify(el.courseTitle.value);
    }
  });
}

if (el.courseForm) {
  el.courseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const coursePayload = {
      title: el.courseTitle.value.trim(),
      slug: el.courseSlug.value.trim() || slugify(el.courseTitle.value),
      description: el.courseDescription.value.trim(),
      icon: el.courseIcon.value.trim() || "📘",
      status: el.courseStatus.value,
      order: parseInt(el.courseOrder.value, 10) || 0,
      updatedAt: new Date().toISOString()
    };

    const targetCourseId = editingCourseId || ("course-" + Date.now());
    coursePayload.id = targetCourseId;

    // 1. INSTANT OPTIMISTIC IN-MEMORY & UI UPDATE (< 1ms)
    firestoreCoursesMap.set(targetCourseId, coursePayload);
    const existingIdx = coursesData.findIndex(c => c.id === targetCourseId);
    if (existingIdx !== -1) {
      coursesData[existingIdx] = { ...coursesData[existingIdx], ...coursePayload };
    } else {
      coursesData.unshift(coursePayload);
    }
    renderCoursesTable();
    populateCourseSelects();
    updateMetrics();
    closeCourseModal();
    showToast(editingCourseId ? "Course updated instantly!" : "New course published instantly!", "success");

    // 2. INSTANT CROSS-TAB & LOCAL STORAGE BROADCAST (< 1ms)
    try {
      localStorage.setItem("shortstudy_cached_courses", JSON.stringify(coursesData));
    } catch (e) {}

    try {
      const syncChannel = new BroadcastChannel("shortstudy_courses_sync");
      syncChannel.postMessage({
        type: "COURSES_UPDATED",
        action: "upsert",
        courseId: targetCourseId,
        course: coursePayload,
        courses: coursesData
      });
      syncChannel.close();
    } catch (e) {}

    // 3. ASYNC BACKGROUND PERSISTENCE (Non-blocking)
    (async () => {
      try {
        await fetch('/api/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(coursePayload)
        });
      } catch (e) {}

      try {
        if (editingCourseId) {
          await updateDoc(doc(db, "courses", editingCourseId), { ...coursePayload, updatedAt: serverTimestamp() });
        } else {
          await setDoc(doc(db, "courses", targetCourseId), { ...coursePayload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        }
      } catch (err) {
        console.warn("Background course Firestore note:", err);
      }
    })();
  });
}

function confirmDeleteCourse(courseId) {
  const course = coursesData.find(c => c.id === courseId);
  const title = course ? course.title : "this course";
  if (el.deleteModalText) el.deleteModalText.textContent = `Are you sure you want to delete "${title}"? This cannot be undone.`;
  if (el.deleteModal) el.deleteModal.classList.add("open");

  el.deleteConfirmBtn.onclick = () => {
    // 1. INSTANT OPTIMISTIC DELETE (< 1ms)
    deletedCourseIds.add(courseId);
    try {
      localStorage.setItem("deletedCourseIds", JSON.stringify(Array.from(deletedCourseIds)));
    } catch (e) {}
    firestoreCoursesMap.delete(courseId);

    coursesData = coursesData.filter(c => c.id !== courseId);
    renderCoursesTable();
    populateCourseSelects();
    updateMetrics();
    showToast(`Course "${title}" deleted instantly.`, "success");
    if (el.deleteModal) el.deleteModal.classList.remove("open");

    // 2. INSTANT CROSS-TAB & LOCAL STORAGE BROADCAST (< 1ms)
    try {
      localStorage.setItem("shortstudy_cached_courses", JSON.stringify(coursesData));
    } catch (e) {}

    try {
      const syncChannel = new BroadcastChannel("shortstudy_courses_sync");
      syncChannel.postMessage({
        type: "COURSES_UPDATED",
        action: "delete",
        courseId: courseId,
        courses: coursesData
      });
      syncChannel.close();
    } catch (e) {}

    // 3. ASYNC BACKGROUND PERSISTENCE (Non-blocking)
    (async () => {
      try {
        await fetch(`/api/courses/${courseId}`, { method: 'DELETE' });
      } catch (e) {}

      try {
        await deleteDoc(doc(db, "courses", courseId));
      } catch (err) {
        console.warn("Background Firestore delete course notice:", err);
      }
    })();
  };
}

// -------------------------------------------------------------
// 4. POSTS & LESSONS CRUD OPERATIONS + YOUTUBE EMBED
// -------------------------------------------------------------
function populateCourseSelects() {
  el.postCourseSelect.innerHTML = `<option value="">-- Select a Course --</option>`;
  coursesData.forEach(course => {
    const opt = document.createElement("option");
    opt.value = course.id;
    const inDevTag = course.status === "in_development" ? " [In Development]" : "";
    opt.textContent = `${course.icon || "📘"} ${course.title}${inDevTag}`;
    el.postCourseSelect.appendChild(opt);
  });
}

function renderPostsTable(filterQuery = "") {
  el.postsTableBody.innerHTML = "";
  const queryLower = filterQuery.toLowerCase();
  const filtered = postsData.filter(p => 
    (p.title || "").toLowerCase().includes(queryLower) ||
    (p.courseTitle || "").toLowerCase().includes(queryLower)
  );

  if (filtered.length === 0) {
    el.postsTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">
          No posts or lessons found. Click "+ New Post / Lesson" to create one.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach((post) => {
    const tr = document.createElement("tr");
    const isInDev = post.status === "in_development";
    const isPublished = post.status === "published" || post.status === "active";
    const hasVideo = post.youtubeEmbed && post.youtubeEmbed.trim() !== "";

    let statusBadgeHtml = "";
    if (isInDev) {
      statusBadgeHtml = `<span class="badge badge-in-dev">In Development</span>`;
    } else if (isPublished) {
      statusBadgeHtml = `<span class="badge badge-published">Published</span>`;
    } else {
      statusBadgeHtml = `<span class="badge badge-draft">Draft</span>`;
    }

    // Prominent "In Development" badge next to lesson title
    const titleDevBadge = isInDev 
      ? `<span class="badge badge-in-dev" style="margin-left: 8px;">In Development</span>` 
      : "";

    // Action button for in_development post
    const publishPostBtnHtml = isInDev 
      ? `<button class="btn btn-success btn-sm publish-single-post-btn" data-id="${post.id}" title="Publish this lesson now">🚀 Publish</button>` 
      : "";

    tr.innerHTML = `
      <td>
        <div style="display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
          <strong>${escapeHtml(post.title)}</strong>
          ${titleDevBadge}
        </div>
      </td>
      <td><span style="color:var(--text-muted);">${escapeHtml(post.courseTitle || "Unassigned")}</span></td>
      <td>${statusBadgeHtml}</td>
      <td>
        ${hasVideo ? '<span class="badge badge-video">▶ Video</span>' : '<span style="color:var(--text-dim);">—</span>'}
      </td>
      <td><span class="font-mono">${escapeHtml(post.readingTime || "5 min read")}</span></td>
      <td><span class="font-mono">${post.order ?? 0}</span></td>
      <td>
        <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          ${publishPostBtnHtml}
          <a href="lesson.html?id=${post.id}" target="_blank" class="btn btn-secondary btn-sm" style="font-size:11px;">View</a>
          <button class="btn btn-secondary btn-sm edit-post-btn" data-id="${post.id}">Edit</button>
          <button class="btn btn-danger btn-sm delete-post-btn" data-id="${post.id}">Delete</button>
        </div>
      </td>
    `;
    el.postsTableBody.appendChild(tr);
  });

  el.postsTableBody.querySelectorAll(".publish-single-post-btn").forEach(btn => {
    btn.addEventListener("click", () => publishSinglePost(btn.dataset.id));
  });
  el.postsTableBody.querySelectorAll(".edit-post-btn").forEach(btn => {
    btn.addEventListener("click", () => openPostModal(btn.dataset.id));
  });
  el.postsTableBody.querySelectorAll(".delete-post-btn").forEach(btn => {
    btn.addEventListener("click", () => confirmDeletePost(btn.dataset.id));
  });
}

// Direct publish a single post/lesson
async function publishSinglePost(postId) {
  const post = postsData.find(p => p.id === postId);
  if (!post) return;

  try {
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, {
      status: "published",
      updatedAt: serverTimestamp()
    });

    // If the associated course is currently in_development, also auto-update it to published
    if (post.courseId) {
      const parentCourse = coursesData.find(c => c.id === post.courseId);
      if (parentCourse && parentCourse.status === "in_development") {
        await updateDoc(doc(db, "courses", post.courseId), {
          status: "published",
          updatedAt: serverTimestamp()
        });
      }
    }

    showToast(`Lesson "${post.title}" published! "In Development" badge removed.`, "success");
  } catch (err) {
    console.error("Publish single post error:", err);
    // Local fallback
    const idx = postsData.findIndex(p => p.id === postId);
    if (idx !== -1) postsData[idx].status = "published";
    if (post.courseId) {
      const cIdx = coursesData.findIndex(c => c.id === post.courseId);
      if (cIdx !== -1 && coursesData[cIdx].status === "in_development") {
        coursesData[cIdx].status = "published";
      }
    }
    renderPostsTable();
    renderCoursesTable();
    updateMetrics();
    showToast(`Lesson published locally!`, "info");
  }
}

// Dedicated YouTube Live Preview Handler
if (el.postYoutubeInput) {
  el.postYoutubeInput.addEventListener("input", () => {
    const val = el.postYoutubeInput.value.trim();
    if (!val) {
      if (el.postYoutubePreview) {
        el.postYoutubePreview.innerHTML = "";
        el.postYoutubePreview.classList.remove("has-video");
      }
      return;
    }

    const processed = processYouTubeEmbed(val);
    if (el.postYoutubePreview) {
      if (processed.isValid) {
        el.postYoutubePreview.innerHTML = `<div class="video-aspect">${processed.iframeHtml}</div>`;
        el.postYoutubePreview.classList.add("has-video");
      } else {
        el.postYoutubePreview.innerHTML = `<div style="padding:10px; font-size:12px; color:#f87171;">Invalid YouTube URL or embed code</div>`;
        el.postYoutubePreview.classList.add("has-video");
      }
    }
  });
}

// HTML Content Editor Tabs (Edit vs Preview)
if (el.tabContentEditor) {
  el.tabContentEditor.addEventListener("click", () => {
    el.tabContentEditor.classList.add("active");
    if (el.tabContentPreview) el.tabContentPreview.classList.remove("active");
    if (el.editorPane) el.editorPane.style.display = "block";
    if (el.previewPane) el.previewPane.style.display = "none";
  });
}

if (el.tabContentPreview) {
  el.tabContentPreview.addEventListener("click", () => {
    el.tabContentPreview.classList.add("active");
    if (el.tabContentEditor) el.tabContentEditor.classList.remove("active");
    if (el.editorPane) el.editorPane.style.display = "none";
    if (el.previewPane) el.previewPane.style.display = "block";

    // Parse and format with semantic formatting engine and DOMPurify
    const rawHtml = el.postContent ? el.postContent.value : "";
    const formattedHtml = parseAndFormatLessonContent(rawHtml);
    if (el.previewPane) {
      el.previewPane.innerHTML = formattedHtml || "<p style='color:#94a3b8; font-style:italic;'>No content written yet.</p>";
    }
  });
}

// Helper to toggle in-development alert & explicit publish button inside Post Modal
function updatePostModalInDevNotice() {
  const selectedCourseId = el.postCourseSelect.value;
  const course = coursesData.find(c => c.id === selectedCourseId);
  const isCourseInDev = course && course.status === "in_development";

  if (el.postCourseInDevAlert) {
    if (isCourseInDev) {
      el.postCourseInDevAlert.classList.remove("hidden");
    } else {
      el.postCourseInDevAlert.classList.add("hidden");
    }
  }

  if (el.postPublishContentBtn) {
    el.postPublishContentBtn.style.display = isCourseInDev ? "inline-flex" : "none";
  }
}

if (el.postCourseSelect) el.postCourseSelect.addEventListener("change", updatePostModalInDevNotice);

function renderPostVideoRows() {
  const container = document.getElementById("post-videos-container");
  if (!container) return;

  container.innerHTML = "";
  if (!currentPostVideos || currentPostVideos.length === 0) {
    container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); font-style:italic; padding:6px 0;">No videos added yet. Click "+ Add Video" to embed videos.</div>`;
    return;
  }

  currentPostVideos.forEach((v, index) => {
    const row = document.createElement("div");
    row.className = "post-video-row";
    row.style.cssText = "background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 6px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px;";
    
    row.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 11.5px; font-weight: 700; color: #f87171;">▶ Video ${index + 1}</span>
        ${currentPostVideos.length > 1 ? `<button type="button" class="btn btn-danger btn-sm remove-post-v-btn" data-index="${index}" style="font-size:10px; padding:2px 6px;">Remove</button>` : ''}
      </div>

      <div class="form-row" style="gap: 8px;">
        <input type="text" class="form-input p-v-title" placeholder="Video Title (e.g. Lesson Video 1)" value="${escapeHtml(v.title || '')}" style="font-size:12.5px; flex:1;">
        <input type="text" class="form-input font-mono p-v-url" placeholder="YouTube URL or Embed code" value="${escapeHtml(v.videoUrl || '')}" style="font-size:12.5px; flex:1.5;">
      </div>

      <div>
        <textarea class="form-textarea p-v-desc" placeholder="Plain-text video description (No HTML required. Layout will format paragraphs automatically)" style="min-height: 50px; font-size:12px; line-height:1.5;">${escapeHtml(v.description || '')}</textarea>
      </div>
    `;

    container.appendChild(row);
  });

  container.querySelectorAll(".remove-post-v-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index, 10);
      currentPostVideos.splice(idx, 1);
      renderPostVideoRows();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const btnAdd = document.getElementById("btn-add-post-video-row");
  if (btnAdd) {
    btnAdd.addEventListener("click", () => {
      currentPostVideos.push({
        id: "v-" + Date.now(),
        title: `Video ${currentPostVideos.length + 1}`,
        videoUrl: "",
        description: ""
      });
      renderPostVideoRows();
    });
  }
});

function openPostModal(postId = null) {
  editingPostId = postId;
  populateCourseSelects();
  el.postForm.reset();
  el.postYoutubePreview.innerHTML = "";
  el.postYoutubePreview.classList.remove("has-video");
  
  // Default to editor tab
  el.tabContentEditor.click();

  if (postId) {
    const post = postsData.find(p => p.id === postId);
    if (post) {
      el.postModalTitle.textContent = "Edit Post / Lesson";
      el.postCourseSelect.value = post.courseId || "";
      el.postTitle.value = post.title || "";
      el.postSlug.value = post.slug || "";
      el.postExcerpt.value = post.excerpt || "";
      el.postReadingTime.value = post.readingTime || "5 min read";
      el.postStatus.value = post.status || "published";
      el.postOrder.value = post.order ?? 1;
      el.postYoutubeInput.value = post.youtubeEmbed || "";
      el.postContent.value = post.content || "";

      if (post.videos && Array.isArray(post.videos) && post.videos.length > 0) {
        currentPostVideos = JSON.parse(JSON.stringify(post.videos));
      } else if (post.youtubeEmbed && post.youtubeEmbed.trim() !== "") {
        currentPostVideos = [{ id: "v-1", title: post.title || "Lesson Video 1", videoUrl: post.youtubeEmbed, description: "" }];
      } else {
        currentPostVideos = [{ id: "v-1", title: "Video 1: Lesson Overview", videoUrl: "", description: "" }];
      }

      // Trigger YouTube preview if video exists
      if (post.youtubeEmbed) {
        el.postYoutubeInput.dispatchEvent(new Event("input"));
      }
    }
  } else {
    el.postModalTitle.textContent = "Create New Post / Lesson";
    el.postStatus.value = "published";
    el.postReadingTime.value = "6 min read";
    el.postOrder.value = postsData.length + 1;
    currentPostVideos = [{ id: "v-1", title: "Video 1: Lesson Overview", videoUrl: "", description: "" }];
  }

  renderPostVideoRows();
  updatePostModalInDevNotice();
  if (el.postModal) el.postModal.classList.add("open");
}

function closePostModal() {
  if (el.postModal) el.postModal.classList.remove("open");
  editingPostId = null;
  if (el.postCourseInDevAlert) el.postCourseInDevAlert.classList.add("hidden");
  if (el.postPublishContentBtn) el.postPublishContentBtn.style.display = "none";
}

if (el.btnNewPost) el.btnNewPost.addEventListener("click", () => openPostModal());
if (el.postModalClose) el.postModalClose.addEventListener("click", closePostModal);
if (el.postCancelBtn) el.postCancelBtn.addEventListener("click", closePostModal);

if (el.postTitle) {
  el.postTitle.addEventListener("input", () => {
    if (!editingPostId && el.postSlug) {
      el.postSlug.value = slugify(el.postTitle.value);
    }
  });
}

function getPostVideosListFromDOM() {
  const videoRows = document.querySelectorAll("#post-videos-container .post-video-row");
  const finalVideosList = [];
  videoRows.forEach((row, i) => {
    const titleVal = row.querySelector(".p-v-title")?.value.trim() || `Video ${i + 1}`;
    const urlVal = row.querySelector(".p-v-url")?.value.trim() || "";
    const descVal = row.querySelector(".p-v-desc")?.value || "";
    if (urlVal || titleVal) {
      let cleanUrl = urlVal;
      if (urlVal) {
        const processed = processYouTubeEmbed(urlVal);
        cleanUrl = processed.isValid ? processed.iframeHtml : urlVal;
      }
      finalVideosList.push({ id: `v-${i + 1}`, title: titleVal, videoUrl: cleanUrl, description: descVal });
    }
  });
  return finalVideosList;
}

// Explicit "Publish Content & Course" button inside Post Modal
if (el.postPublishContentBtn) {
  el.postPublishContentBtn.addEventListener("click", async () => {
    const selectedCourseId = el.postCourseSelect.value;
    const selectedCourse = coursesData.find(c => c.id === selectedCourseId);
    if (!selectedCourseId) {
      showToast("Please select an associated course first.", "error");
      return;
    }

    const titleVal = el.postTitle.value.trim();
    const rawContent = el.postContent.value;
    if (!titleVal || !rawContent) {
      showToast("Please fill in lesson title and lesson content.", "error");
      return;
    }

    const formattedHtml = parseAndFormatLessonContent(rawContent);
    const readingTime = (el.postReadingTime && el.postReadingTime.value.trim())
      ? el.postReadingTime.value.trim()
      : calculateReadingTime(rawContent);
    const excerpt = (el.postExcerpt && el.postExcerpt.value.trim())
      ? el.postExcerpt.value.trim()
      : generateExcerpt(rawContent);

    const rawYoutube = el.postYoutubeInput.value.trim();
    let cleanYoutubeEmbed = "";
    if (rawYoutube) {
      const processed = processYouTubeEmbed(rawYoutube);
      cleanYoutubeEmbed = processed.isValid ? processed.iframeHtml : rawYoutube;
    }

    const videosList = getPostVideosListFromDOM();

    const postPayload = {
      courseId: selectedCourseId,
      courseTitle: selectedCourse ? selectedCourse.title : "General",
      title: titleVal,
      slug: (el.postSlug && el.postSlug.value.trim()) || slugify(titleVal),
      excerpt: excerpt,
      readingTime: readingTime,
      status: "published", // Force published
      order: parseInt(el.postOrder.value, 10) || 1,
      youtubeEmbed: videosList[0]?.videoUrl || cleanYoutubeEmbed,
      videos: videosList,
      content: rawContent,
      formattedHtml: formattedHtml,
      author: (currentUser && currentUser.displayName) ? currentUser.displayName : "Admin",
      updatedAt: serverTimestamp()
    };

    const targetPostId = editingPostId || ("post-" + Date.now());
    postPayload.id = targetPostId;

    // 1. INSTANT OPTIMISTIC IN-MEMORY & UI UPDATE (< 1ms)
    firestorePostsMap.set(targetPostId, postPayload);
    firestoreLessonsMap.set(targetPostId, postPayload);
    const cExisting = firestoreCoursesMap.get(selectedCourseId) || selectedCourse;
    if (cExisting) {
      firestoreCoursesMap.set(selectedCourseId, { ...cExisting, status: "published", latestLessonTitle: titleVal });
    }
    const cIdx = coursesData.findIndex(c => c.id === selectedCourseId);
    if (cIdx !== -1) {
      coursesData[cIdx].status = "published";
      coursesData[cIdx].latestLessonTitle = titleVal;
    }

    rebuildAndRenderContent();
    closePostModal();
    showToast(`Course "${selectedCourse ? selectedCourse.title : ''}" & content published instantly!`, "success");

    // 2. ASYNC BACKGROUND PERSISTENCE (Non-blocking)
    (async () => {
      try {
        const courseDocRef = doc(db, "courses", selectedCourseId);
        if (editingPostId) {
          const postDocRef = doc(db, "posts", editingPostId);
          const lessonDocRef = doc(db, "lessons", editingPostId);
          await updateDoc(postDocRef, postPayload);
          await setDoc(lessonDocRef, postPayload, { merge: true }).catch(() => {});
        } else {
          const newPostDocRef = doc(db, "posts", targetPostId);
          const newLessonDocRef = doc(db, "lessons", targetPostId);
          postPayload.createdAt = serverTimestamp();
          await setDoc(newPostDocRef, postPayload);
          await setDoc(newLessonDocRef, postPayload);
        }
        await updateDoc(courseDocRef, {
          status: "published",
          updatedAt: serverTimestamp(),
          latestLessonTitle: titleVal
        });
      } catch (err) {
        console.warn("Background publish post notice:", err);
      }
    })();
  });
}

// Post Submit Handler with Semantic Formatting
if (el.postForm) {
  el.postForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const selectedCourseId = el.postCourseSelect.value;
  const selectedCourse = coursesData.find(c => c.id === selectedCourseId);
  const rawContent = el.postContent.value;
  const rawYoutube = el.postYoutubeInput.value.trim();

  // 1. Format content using semantic formatting engine
  const formattedHtml = parseAndFormatLessonContent(rawContent);

  // 2. Validate and sanitize YouTube Embed
  let cleanYoutubeEmbed = "";
  if (rawYoutube) {
    const processed = processYouTubeEmbed(rawYoutube);
    if (processed.isValid) {
      cleanYoutubeEmbed = processed.iframeHtml;
    } else {
      showToast("Warning: YouTube embed could not be parsed, saving raw input.", "error");
      cleanYoutubeEmbed = rawYoutube;
    }
  }

  const readingTime = (el.postReadingTime && el.postReadingTime.value.trim())
    ? el.postReadingTime.value.trim()
    : calculateReadingTime(rawContent);
  const excerpt = (el.postExcerpt && el.postExcerpt.value.trim())
    ? el.postExcerpt.value.trim()
    : generateExcerpt(rawContent);
  const titleVal = el.postTitle.value.trim();
  const videosList = getPostVideosListFromDOM();

  const postPayload = {
    courseId: selectedCourseId,
    courseTitle: selectedCourse ? selectedCourse.title : "General",
    title: titleVal,
    slug: (el.postSlug && el.postSlug.value.trim()) || slugify(titleVal),
    excerpt: excerpt,
    readingTime: readingTime,
    status: el.postStatus.value,
    order: parseInt(el.postOrder.value, 10) || 1,
    youtubeEmbed: videosList[0]?.videoUrl || cleanYoutubeEmbed,
    videos: videosList,
    content: rawContent,
    formattedHtml: formattedHtml,
    author: (currentUser && currentUser.displayName) ? currentUser.displayName : "Admin",
    updatedAt: serverTimestamp()
  };

  const targetDocId = editingPostId || ("post-" + Date.now());
  postPayload.id = targetDocId;

  // 1. INSTANT OPTIMISTIC IN-MEMORY & UI UPDATE (< 1ms)
  firestorePostsMap.set(targetDocId, postPayload);
  firestoreLessonsMap.set(targetDocId, postPayload);

  const isPublished = el.postStatus.value === "published";
  if (isPublished && selectedCourse && selectedCourse.status === "in_development") {
    const cExisting = firestoreCoursesMap.get(selectedCourseId) || selectedCourse;
    firestoreCoursesMap.set(selectedCourseId, { ...cExisting, status: "published", latestLessonTitle: titleVal });
    const cIdx = coursesData.findIndex(c => c.id === selectedCourseId);
    if (cIdx !== -1) {
      coursesData[cIdx].status = "published";
      coursesData[cIdx].latestLessonTitle = titleVal;
    }
  }

  rebuildAndRenderContent();
  closePostModal();
  showToast(editingPostId ? "Lesson updated instantly!" : "Lesson published instantly!", "success");

  // 2. ASYNC BACKGROUND PERSISTENCE (Non-blocking)
  (async () => {
    try {
      if (editingPostId) {
        const docRef = doc(db, "posts", editingPostId);
        await updateDoc(docRef, postPayload);
        await setDoc(doc(db, "lessons", editingPostId), postPayload, { merge: true }).catch(() => {});
      } else {
        postPayload.createdAt = serverTimestamp();
        await setDoc(doc(db, "posts", targetDocId), postPayload);
        await setDoc(doc(db, "lessons", targetDocId), postPayload, { merge: true }).catch(() => {});
      }

      if (isPublished && selectedCourse && selectedCourse.status === "in_development") {
        await updateDoc(doc(db, "courses", selectedCourseId), {
          status: "published",
          updatedAt: serverTimestamp(),
          latestLessonTitle: titleVal
        });
      }
    } catch (err) {
      console.warn("Background post save notice:", err);
    }
  })();
});
}

function confirmDeletePost(postId) {
  const post = postsData.find(p => p.id === postId);
  const title = post ? post.title : "this post";
  if (el.deleteModalText) el.deleteModalText.textContent = `Are you sure you want to delete "${title}"? This cannot be undone.`;
  if (el.deleteModal) el.deleteModal.classList.add("open");

  el.deleteConfirmBtn.onclick = () => {
    // 1. INSTANT OPTIMISTIC DELETE (< 1ms)
    deletedPostIds.add(postId);
    try {
      localStorage.setItem("deletedPostIds", JSON.stringify(Array.from(deletedPostIds)));
    } catch (e) {}
    firestorePostsMap.delete(postId);
    firestoreLessonsMap.delete(postId);

    postsData = postsData.filter(p => p.id !== postId);
    renderPostsTable();
    updateMetrics();
    showToast(`Lesson "${title}" deleted instantly.`, "success");
    if (el.deleteModal) el.deleteModal.classList.remove("open");

    // 2. ASYNC BACKGROUND PERSISTENCE (Non-blocking)
    (async () => {
      try {
        await deleteDoc(doc(db, "posts", postId));
        await deleteDoc(doc(db, "lessons", postId));
      } catch (err) {
        console.warn("Background Firestore delete post notice:", err);
      }
    })();
  };
}

if (el.deleteCancelBtn) {
  el.deleteCancelBtn.addEventListener("click", () => {
    if (el.deleteModal) el.deleteModal.classList.remove("open");
  });
}

// Search Filters
if (el.courseSearch) el.courseSearch.addEventListener("input", (e) => renderCoursesTable(e.target.value));
if (el.postSearch) el.postSearch.addEventListener("input", (e) => renderPostsTable(e.target.value));

// -------------------------------------------------------------
// 5. PAID COURSES CRUD OPERATIONS (Programming Video's Store)
// -------------------------------------------------------------
const DUMMY_PAID_COURSE_IDS = new Set(["paid-fullstack-webdev", "paid-python-ai-analytics", "paid-dsa-mastery"]);

function rebuildAndRenderPaidCourses() {
  const map = new Map();

  serverPaidCoursesMap.forEach((val, key) => {
    if (deletedPaidCourseIds.has(key) || val.isDeleted || DUMMY_PAID_COURSE_IDS.has(key)) return;
    map.set(key, { id: key, ...val });
  });

  firestorePaidCoursesMap.forEach((val, key) => {
    if (deletedPaidCourseIds.has(key) || val.isDeleted || DUMMY_PAID_COURSE_IDS.has(key)) return;
    map.set(key, { id: key, ...val });
  });

  paidCoursesData = Array.from(map.values()).filter(c => !deletedPaidCourseIds.has(c.id) && !DUMMY_PAID_COURSE_IDS.has(c.id));
  renderPaidCoursesTable(el.paidCourseSearch ? el.paidCourseSearch.value : "");
  updateMetrics();
}

function renderPaidCoursesTable(filterQuery = "") {
  if (!el.paidCoursesTableBody) return;
  el.paidCoursesTableBody.innerHTML = "";
  const queryLower = (filterQuery || "").toLowerCase();
  const filtered = paidCoursesData.filter(c =>
    (c.title || "").toLowerCase().includes(queryLower) ||
    (c.badge || "").toLowerCase().includes(queryLower) ||
    (c.price || "").toLowerCase().includes(queryLower)
  );

  if (filtered.length === 0) {
    el.paidCoursesTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:32px; color:var(--text-muted);">
          No paid courses found. Click "+ New Paid Course" to add one.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach((course) => {
    const tr = document.createElement("tr");
    const isPublished = course.status === "published";
    const imgUrl = course.image || "https://images.unsplash.com/photo-1516116211227-bbc141e6c38a?auto=format&fit=crop&w=400&q=80";
    const hasVideo = (Array.isArray(course.videos) && course.videos.length > 0) || (course.videoEmbed && course.videoEmbed.trim() !== "");
    const isFeatured = Boolean(course.isFeatured || course.featured);

    const origNum = parseFloat((course.origPrice || course.originalPrice || "").replace(/[^0-9.]/g, "")) || 0;
    const priceNum = parseFloat((course.price || "").replace(/[^0-9.]/g, "")) || 0;
    const discount = (origNum > priceNum && origNum > 0) 
      ? Math.round(((origNum - priceNum) / origNum) * 100) 
      : (course.discountPercent || 0);

    tr.innerHTML = `
      <td>
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="position:relative; width:64px; aspect-ratio:16/9; border-radius:6px; overflow:hidden; border:1px solid var(--border-light); background:var(--bg-slate-800); flex-shrink:0;">
            <img src="${escapeHtml(imgUrl)}" alt="" style="width:100%; height:100%; object-fit:cover;">
            ${discount > 0 ? `<span style="position:absolute; top:2px; left:2px; background:#ef4444; color:#fff; font-size:9px; font-weight:700; padding:1px 4px; border-radius:2px;">${discount}%</span>` : ''}
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <strong style="color:var(--text-white); font-size:13.5px;">${escapeHtml(course.title)}</strong>
              ${isFeatured ? `<span style="background:#eab308; color:#000; font-size:9.5px; font-weight:700; padding:1px 5px; border-radius:3px; text-transform:uppercase;">Featured</span>` : ''}
            </div>
            <div style="font-size:11.5px; color:var(--text-muted); display:flex; gap:8px; margin-top:2px;">
              <span>👨‍🏫 ${escapeHtml(course.instructor || "ShortStudy")}</span>
              <span>•</span>
              <span>🔍 ${escapeHtml(course.level || "Beginner")}</span>
              <span>•</span>
              <span>⏱️ ${escapeHtml(course.duration || "36h 22m")}</span>
            </div>
          </div>
        </div>
      </td>
      <td>
        <span class="badge" style="background:rgba(99, 102, 241, 0.15); color:var(--indigo-light); border-color:rgba(99, 102, 241, 0.3); font-size:11px;">
          ${escapeHtml(course.badge || "Masterclass")}
        </span>
        <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${escapeHtml(course.language || "Hindi")} · ${escapeHtml(course.lessonsCount || "219 lessons")}</div>
      </td>
      <td>
        <div style="display:flex; align-items:baseline; gap:6px;">
          <strong style="color:#ffffff; font-size:15px; font-weight:800;">${escapeHtml(course.price || "₹2599")}</strong>
          ${course.origPrice ? `<span style="font-size:11.5px; color:var(--text-muted); text-decoration:line-through;">${escapeHtml(course.origPrice)}</span>` : ''}
        </div>
        ${discount > 0 ? `<div style="font-size:10.5px; color:#ef4444; font-weight:700; margin-top:2px;">🔥 ${discount}% OFF</div>` : ''}
      </td>
      <td>
        <span class="badge ${isPublished ? 'badge-published' : 'badge-draft'}">
          ${isPublished ? 'Published' : 'Draft'}
        </span>
      </td>
      <td>
        ${hasVideo ? '<span class="badge badge-video">▶ Configured</span>' : '<span style="color:var(--text-dim);">Missing</span>'}
      </td>
      <td>
        <div style="display:flex; gap:6px; align-items:center;">
          <a href="courses.html" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration:none; padding:4px 8px; font-size:12px;" title="View Live Course">View Live</a>
          <button class="btn btn-secondary btn-sm edit-paid-btn" data-id="${course.id}">Edit</button>
          <button class="btn btn-danger btn-sm delete-paid-btn" data-id="${course.id}">Delete</button>
        </div>
      </td>
    `;
    el.paidCoursesTableBody.appendChild(tr);
  });

  // Attach button events
  el.paidCoursesTableBody.querySelectorAll(".edit-paid-btn").forEach(btn => {
    btn.addEventListener("click", () => openPaidCourseModal(btn.dataset.id));
  });

  el.paidCoursesTableBody.querySelectorAll(".delete-paid-btn").forEach(btn => {
    btn.addEventListener("click", () => confirmDeletePaidCourse(btn.dataset.id));
  });
}

let currentCourseVideos = [];

function updateAdminDiscountCalc() {
  const origEl = document.getElementById("paid-modal-orig-price");
  const priceEl = document.getElementById("paid-modal-price");
  const calcBox = document.getElementById("paid-modal-discount-calc");
  const textEl = document.getElementById("paid-modal-discount-text");
  const savingsEl = document.getElementById("paid-modal-discount-savings");

  const prevTitle = document.getElementById("prev-card-title");
  const prevDesc = document.getElementById("prev-card-desc");
  const prevSalePrice = document.getElementById("prev-card-sale-price");
  const prevOrigPrice = document.getElementById("prev-card-orig-price");
  const prevDiscount = document.getElementById("prev-card-discount");
  const prevFeatured = document.getElementById("prev-card-featured");
  const prevImg = document.getElementById("prev-card-img");
  const prevInstructor = document.getElementById("prev-card-instructor");
  const prevLevel = document.getElementById("prev-card-level");
  const prevDuration = document.getElementById("prev-card-duration");
  const prevLessons = document.getElementById("prev-card-lessons");
  const prevLang = document.getElementById("prev-card-lang");

  const titleInput = document.getElementById("paid-modal-title");
  const descInput = document.getElementById("paid-modal-desc");
  const urlInput = document.getElementById("paid-modal-image");
  const instructorInput = document.getElementById("paid-modal-instructor");
  const levelInput = document.getElementById("paid-modal-level");
  const durationInput = document.getElementById("paid-modal-duration");
  const lessonsInput = document.getElementById("paid-modal-lessons");
  const langInput = document.getElementById("paid-modal-language");
  const featuredInput = document.getElementById("paid-modal-featured");

  if (origEl && priceEl) {
    const origNum = parseFloat((origEl.value || "").replace(/[^0-9.]/g, "")) || 0;
    const priceNum = parseFloat((priceEl.value || "").replace(/[^0-9.]/g, "")) || 0;

    let percent = 0;
    if (origNum > priceNum && origNum > 0) {
      percent = Math.round(((origNum - priceNum) / origNum) * 100);
      const savings = origNum - priceNum;
      if (calcBox) calcBox.style.display = "flex";
      if (textEl) textEl.textContent = `🔥 ${percent}% OFF`;
      if (savingsEl) savingsEl.textContent = `Cost Reduction: Student Saves ₹${savings.toLocaleString("en-IN")}`;
      if (prevDiscount) {
        prevDiscount.style.display = "block";
        prevDiscount.textContent = `${percent}% OFF`;
      }
    } else {
      if (calcBox) calcBox.style.display = "none";
      if (prevDiscount) prevDiscount.style.display = "none";
    }

    if (prevSalePrice) prevSalePrice.textContent = priceEl.value || "₹2599";
    if (prevOrigPrice) {
      prevOrigPrice.textContent = origEl.value || "₹3899";
      prevOrigPrice.style.display = origEl.value ? "inline" : "none";
    }
  }

  // Update other live preview elements
  if (prevTitle && titleInput) {
    prevTitle.textContent = titleInput.value.trim() || "Ultimate Job-Ready AI-Powered Data Analytics Course";
  }
  if (prevDesc && descInput) {
    prevDesc.textContent = descInput.value.trim() || "This is a to-the-point, CodeWithHarry style comprehensive course...";
  }
  if (prevImg && urlInput && urlInput.value.trim()) {
    prevImg.src = urlInput.value.trim();
  }
  if (prevInstructor && instructorInput) {
    prevInstructor.textContent = `👨‍🏫 ${instructorInput.value.trim() || "ShortStudy"}`;
  }
  if (prevLevel && levelInput) {
    prevLevel.textContent = `🔍 ${levelInput.value}`;
  }
  if (prevDuration && durationInput) {
    prevDuration.textContent = `⏱️ ${durationInput.value.trim() || "36h 22m"}`;
  }
  if (prevLessons && lessonsInput) {
    prevLessons.textContent = `📚 ${lessonsInput.value.trim() || "219 lessons"}`;
  }
  if (prevLang && langInput) {
    prevLang.textContent = `🗣️ ${langInput.value.trim() || "Hindi"}`;
  }
  if (prevFeatured && featuredInput) {
    prevFeatured.style.display = featuredInput.checked ? "block" : "none";
  }
}

function renderPaidModalVideoRows() {
  const container = document.getElementById("paid-modal-videos-list");
  if (!container) return;
  container.innerHTML = "";

  if (currentCourseVideos.length === 0) {
    currentCourseVideos.push({
      id: "v-" + Date.now(),
      title: "Lesson 1: Complete Video Masterclass",
      videoUrl: "",
      description: ""
    });
  }

  currentCourseVideos.forEach((v, idx) => {
    const row = document.createElement("div");
    row.className = "paid-video-row";
    row.style.cssText = "background: rgba(15, 23, 42, 0.9); border: 1px solid var(--border-light); border-radius: 6px; padding: 12px;";
    row.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 12px; font-weight: 700; color: var(--text-white);">Video #${idx + 1}</span>
        ${currentCourseVideos.length > 1 ? `<button type="button" class="btn btn-sm btn-danger remove-video-btn" style="padding: 2px 8px; font-size: 11px;">Remove Video</button>` : ''}
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <input type="text" class="form-input video-title-input" placeholder="Video Title (e.g. Lesson 1: Introduction & Concepts)" value="${escapeHtml(v.title || '')}">
        <input type="text" class="form-input font-mono video-url-input" placeholder="YouTube Video Link or Embed URL (e.g. https://www.youtube.com/watch?v=...)" value="${escapeHtml(v.videoUrl || '')}">
        <div>
          <label class="form-label" style="font-size: 11px; margin-bottom: 3px; color: var(--text-muted);">Video Description (Written normally in plain text - no HTML tags needed)</label>
          <textarea class="form-textarea video-desc-input" style="min-height: 60px; font-size: 12.5px; font-family: inherit;" placeholder="Write video description normally in plain text...">${escapeHtml(v.description || '')}</textarea>
        </div>
      </div>
    `;

    const removeBtn = row.querySelector(".remove-video-btn");
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        currentCourseVideos.splice(idx, 1);
        renderPaidModalVideoRows();
      });
    }

    container.appendChild(row);
  });
}

function initPaidCourseModalEventsOnce() {
  const fileInput = document.getElementById("paid-modal-image-file");
  const urlInput = document.getElementById("paid-modal-image");
  const preview = document.getElementById("paid-modal-image-preview");
  const previewContainer = document.getElementById("paid-modal-image-preview-container");
  const addVideoBtn = document.getElementById("btn-add-paid-video");
  const origEl = document.getElementById("paid-modal-orig-price");
  const priceEl = document.getElementById("paid-modal-price");
  const titleInput = document.getElementById("paid-modal-title");
  const descInput = document.getElementById("paid-modal-desc");
  const instructorInput = document.getElementById("paid-modal-instructor");
  const levelInput = document.getElementById("paid-modal-level");
  const durationInput = document.getElementById("paid-modal-duration");
  const lessonsInput = document.getElementById("paid-modal-lessons");
  const langInput = document.getElementById("paid-modal-language");
  const featuredInput = document.getElementById("paid-modal-featured");

  if (fileInput && !fileInput.dataset.bound) {
    fileInput.dataset.bound = "true";
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const dataUrl = evt.target.result;
          if (urlInput) urlInput.value = dataUrl;
          if (preview) preview.src = dataUrl;
          if (previewContainer) previewContainer.style.display = "block";
          const prevImg = document.getElementById("prev-card-img");
          if (prevImg) prevImg.src = dataUrl;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const liveInputs = [
    urlInput, origEl, priceEl, titleInput, descInput,
    instructorInput, levelInput, durationInput, lessonsInput, langInput, featuredInput
  ];

  liveInputs.forEach(input => {
    if (input && !input.dataset.bound) {
      input.dataset.bound = "true";
      input.addEventListener("input", updateAdminDiscountCalc);
      input.addEventListener("change", updateAdminDiscountCalc);
    }
  });

  if (addVideoBtn && !addVideoBtn.dataset.bound) {
    addVideoBtn.dataset.bound = "true";
    addVideoBtn.addEventListener("click", () => {
      const rows = document.querySelectorAll("#paid-modal-videos-list .paid-video-row");
      const updatedList = [];
      rows.forEach((row, idx) => {
        const t = row.querySelector(".video-title-input")?.value.trim() || "";
        const u = row.querySelector(".video-url-input")?.value.trim() || "";
        const d = row.querySelector(".video-desc-input")?.value.trim() || "";
        updatedList.push({ id: "v-" + (idx + 1), title: t, videoUrl: u, description: d });
      });
      updatedList.push({
        id: "v-" + Date.now(),
        title: `Lesson ${updatedList.length + 1}: Video Topic`,
        videoUrl: "",
        description: ""
      });
      currentCourseVideos = updatedList;
      renderPaidModalVideoRows();
    });
  }
}

function openPaidCourseModal(courseId = null) {
  editingPaidCourseId = courseId;
  if (!el.paidCourseModal) return;

  initPaidCourseModalEventsOnce();

  const preview = document.getElementById("paid-modal-image-preview");
  const previewContainer = document.getElementById("paid-modal-image-preview-container");
  const instructorInput = document.getElementById("paid-modal-instructor");
  const levelInput = document.getElementById("paid-modal-level");
  const lessonsInput = document.getElementById("paid-modal-lessons");
  const langInput = document.getElementById("paid-modal-language");
  const featuredInput = document.getElementById("paid-modal-featured");

  if (courseId) {
    const course = paidCoursesData.find(c => c.id === courseId);
    if (!course) return;
    if (el.paidCourseModalHeading) el.paidCourseModalHeading.textContent = "Edit Paid Video Course";
    if (el.paidModalTitle) el.paidModalTitle.value = course.title || "";
    if (el.paidModalPrice) el.paidModalPrice.value = course.price || "₹2599";
    if (el.paidModalOrigPrice) el.paidModalOrigPrice.value = course.originalPrice || course.origPrice || "₹3899";
    if (el.paidModalDuration) el.paidModalDuration.value = course.duration || "36h 22m";
    if (el.paidModalBadge) el.paidModalBadge.value = course.badge || "Featured Masterclass";
    if (el.paidModalStatus) el.paidModalStatus.value = course.status || "published";
    if (el.paidModalImage) el.paidModalImage.value = course.image || "";
    if (el.paidModalDesc) el.paidModalDesc.value = course.description || "";

    const categoryInput = document.getElementById("paid-modal-category");
    if (categoryInput) categoryInput.value = course.category || "all";
    if (instructorInput) instructorInput.value = course.instructor || "ShortStudy";
    if (levelInput) levelInput.value = course.level || "Beginner";
    if (lessonsInput) lessonsInput.value = course.lessonsCount || "219 lessons";
    if (langInput) langInput.value = course.language || "Hindi";
    if (featuredInput) featuredInput.checked = Boolean(course.isFeatured || course.featured);

    if (course.image && preview && previewContainer) {
      preview.src = course.image;
      previewContainer.style.display = "block";
    } else if (previewContainer) {
      previewContainer.style.display = "none";
    }

    if (Array.isArray(course.videos) && course.videos.length > 0) {
      currentCourseVideos = course.videos.map((v, i) => ({
        id: v.id || `v-${i + 1}`,
        title: v.title || `Video ${i + 1}`,
        videoUrl: v.videoUrl || v.url || course.videoEmbed || "",
        description: v.description || ""
      }));
    } else if (course.videoEmbed || course.videoUrl) {
      currentCourseVideos = [{
        id: "v-1",
        title: course.title ? `${course.title} - Main Video` : "Main Masterclass Video",
        videoUrl: course.videoEmbed || course.videoUrl || "",
        description: course.description || ""
      }];
    } else {
      currentCourseVideos = [];
    }

  } else {
    if (el.paidCourseModalHeading) el.paidCourseModalHeading.textContent = "Add Paid Video Course";
    if (el.paidCourseForm) el.paidCourseForm.reset();
    if (el.paidModalPrice) el.paidModalPrice.value = "₹2599";
    if (el.paidModalOrigPrice) el.paidModalOrigPrice.value = "₹3899";
    if (el.paidModalDuration) el.paidModalDuration.value = "36h 22m";
    if (el.paidModalBadge) el.paidModalBadge.value = "Featured Masterclass";
    if (el.paidModalStatus) el.paidModalStatus.value = "published";
    const categoryInput = document.getElementById("paid-modal-category");
    if (categoryInput) categoryInput.value = "all";
    if (instructorInput) instructorInput.value = "ShortStudy";
    if (levelInput) levelInput.value = "Beginner";
    if (lessonsInput) lessonsInput.value = "219 lessons";
    if (langInput) langInput.value = "Hindi";
    if (featuredInput) featuredInput.checked = true;

    if (previewContainer) previewContainer.style.display = "none";
    currentCourseVideos = [{
      id: "v-1",
      title: "Lesson 1: Introduction & Masterclass Overview",
      videoUrl: "",
      description: ""
    }];
  }

  renderPaidModalVideoRows();
  updateAdminDiscountCalc();
  el.paidCourseModal.classList.add("open");
}

function closePaidCourseModal() {
  if (el.paidCourseModal) el.paidCourseModal.classList.remove("open");
  editingPaidCourseId = null;
}

if (el.btnNewPaidCourse) {
  el.btnNewPaidCourse.addEventListener("click", () => openPaidCourseModal(null));
}

if (el.paidCourseModalClose) {
  el.paidCourseModalClose.addEventListener("click", closePaidCourseModal);
}

if (el.paidCourseModalCancel) {
  el.paidCourseModalCancel.addEventListener("click", closePaidCourseModal);
}

if (el.paidCourseSearch) {
  el.paidCourseSearch.addEventListener("input", (e) => renderPaidCoursesTable(e.target.value));
}

if (el.paidCourseForm) {
  el.paidCourseForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = el.paidModalTitle ? el.paidModalTitle.value.trim() : "";
    const price = el.paidModalPrice ? el.paidModalPrice.value.trim() : "";
    const origPrice = el.paidModalOrigPrice ? el.paidModalOrigPrice.value.trim() : "";
    const duration = el.paidModalDuration ? el.paidModalDuration.value.trim() : "";
    const badge = el.paidModalBadge ? el.paidModalBadge.value.trim() : "";
    const status = el.paidModalStatus ? el.paidModalStatus.value : "published";
    const image = el.paidModalImage ? el.paidModalImage.value.trim() : "";
    const description = el.paidModalDesc ? el.paidModalDesc.value.trim() : "";

    const category = document.getElementById("paid-modal-category")?.value || "all";
    const instructor = document.getElementById("paid-modal-instructor")?.value.trim() || "ShortStudy";
    const level = document.getElementById("paid-modal-level")?.value || "Beginner";
    const lessonsCount = document.getElementById("paid-modal-lessons")?.value.trim() || "219 lessons";
    const language = document.getElementById("paid-modal-language")?.value.trim() || "Hindi";
    const isFeatured = Boolean(document.getElementById("paid-modal-featured")?.checked);

    // Gather videos array from DOM rows
    const videoRows = document.querySelectorAll("#paid-modal-videos-list .paid-video-row");
    const videosList = [];
    videoRows.forEach((row, idx) => {
      const vTitle = (row.querySelector(".video-title-input") || {}).value?.trim() || `Lesson ${idx + 1}`;
      const vUrl = (row.querySelector(".video-url-input") || {}).value?.trim() || "";
      const vDesc = (row.querySelector(".video-desc-input") || {}).value?.trim() || "";

      let cleanUrl = vUrl;
      const proc = processYouTubeEmbed(vUrl);
      if (proc && proc.isValid) {
        cleanUrl = proc.iframeHtml;
      }

      if (vUrl || vTitle) {
        videosList.push({
          id: "v-" + (idx + 1),
          title: vTitle,
          videoUrl: cleanUrl,
          description: vDesc // Plain text description without HTML tags
        });
      }
    });

    if (!title || !price || !description) {
      showToast("Please fill in course title, price, and overall description.", "error");
      return;
    }

    // Backend JS Discount Percentage Calculation
    const origNum = parseFloat((origPrice || "").replace(/[^0-9.]/g, "")) || 0;
    const priceNum = parseFloat((price || "").replace(/[^0-9.]/g, "")) || 0;
    let discountPercent = 0;
    if (origNum > priceNum && origNum > 0) {
      discountPercent = Math.round(((origNum - priceNum) / origNum) * 100);
    }

    const firstVideoEmbed = videosList[0]?.videoUrl || "";

    // If no videos were explicitly created, provide default lesson item so save succeeds seamlessly
    if (videosList.length === 0) {
      videosList.push({
        id: "v-1",
        title: "Lesson 1: Introduction & Masterclass Overview",
        videoUrl: firstVideoEmbed || "https://www.youtube.com/embed/dQw4w9WgXcQ",
        description: description
      });
    }

    const payload = {
      title,
      price,
      originalPrice: origPrice,
      origPrice,
      discountPercent,
      duration,
      badge,
      status,
      category,
      instructor,
      level,
      lessonsCount,
      language,
      isFeatured,
      image: image || "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
      videoEmbed: firstVideoEmbed,
      videoUrl: firstVideoEmbed,
      videos: videosList,
      description,
      updatedAt: new Date().toISOString()
    };

    const targetId = editingPaidCourseId || ("paid-" + Date.now());
    payload.id = targetId;

    // 1. INSTANT OPTIMISTIC IN-MEMORY & UI UPDATE (< 1ms)
    serverPaidCoursesMap.set(targetId, payload);
    firestorePaidCoursesMap.set(targetId, payload);
    rebuildAndRenderPaidCourses();
    closePaidCourseModal();
    showToast(`Paid course "${title}" saved instantly!`, "success");

    // 2. INSTANT CROSS-TAB & LOCAL STORAGE BROADCAST (< 1ms)
    try {
      localStorage.setItem("shortstudy_cached_paid_courses", JSON.stringify(paidCoursesData));
    } catch (e) {}

    try {
      const syncChannel = new BroadcastChannel("shortstudy_paid_courses_sync");
      syncChannel.postMessage({
        type: "PAID_COURSES_UPDATED",
        action: "upsert",
        courseId: targetId,
        course: payload,
        courses: paidCoursesData
      });
      syncChannel.close();
    } catch (e) {}

    // 3. ASYNC BACKGROUND NETWORK PERSISTENCE (Non-blocking)
    (async () => {
      try {
        await fetch('/api/paid-courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        console.warn("Background API paid course save notice:", e);
      }

      try {
        await setDoc(doc(db, "paid_courses", targetId), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) {
        console.warn("Background Firestore write notice for paid course:", err);
      }
    })();
  });
}

function confirmDeletePaidCourse(courseId) {
  const course = paidCoursesData.find(c => c.id === courseId);
  const title = course ? course.title : "this paid course";
  if (el.deleteModalText) el.deleteModalText.textContent = `Are you sure you want to delete "${title}"? Students will no longer see it on the website.`;
  if (el.deleteModal) el.deleteModal.classList.add("open");

  el.deleteConfirmBtn.onclick = () => {
    // 1. INSTANT OPTIMISTIC DELETE (< 1ms)
    deletedPaidCourseIds.add(courseId);
    try {
      localStorage.setItem("deletedPaidCourseIds", JSON.stringify(Array.from(deletedPaidCourseIds)));
    } catch (e) {}
    serverPaidCoursesMap.delete(courseId);
    firestorePaidCoursesMap.delete(courseId);

    paidCoursesData = paidCoursesData.filter(c => c.id !== courseId);
    rebuildAndRenderPaidCourses();
    updateMetrics();

    if (el.deleteModal) el.deleteModal.classList.remove("open");
    showToast(`Paid course "${title}" deleted instantly.`, "success");

    // 2. INSTANT CROSS-TAB & LOCAL STORAGE BROADCAST (< 1ms)
    try {
      localStorage.setItem("shortstudy_cached_paid_courses", JSON.stringify(paidCoursesData));
    } catch (e) {}

    try {
      const syncChannel = new BroadcastChannel("shortstudy_paid_courses_sync");
      syncChannel.postMessage({
        type: "PAID_COURSES_UPDATED",
        action: "delete",
        courseId,
        courses: paidCoursesData
      });
      syncChannel.close();
    } catch (e) {}

    // 3. ASYNC BACKGROUND NETWORK PERSISTENCE (Non-blocking)
    (async () => {
      try {
        await fetch(`/api/paid-courses/${courseId}`, { method: 'DELETE' });
      } catch (e) {
        console.warn("Background server API delete notice:", e);
      }

      try {
        await deleteDoc(doc(db, "paid_courses", courseId));
      } catch (err) {
        console.warn("Background Firestore delete paid course notice:", err);
      }
    })();
  };
}

// -------------------------------------------------------------
// 6. ORDERS & FAIL-SAFE DATABASE SYSTEM (Real-Time Student Ledger)
// -------------------------------------------------------------
function rebuildAndRenderOrders() {
  const ordersMap = new Map();

  // Read local fail-safe logs if any
  try {
    const localPending = JSON.parse(localStorage.getItem("shortstudy_pending_orders") || "[]");
    localPending.forEach(o => { if (o && o.id) ordersMap.set(o.id, o); });
  } catch (e) {}

  try {
    const localUserOrders = JSON.parse(localStorage.getItem("shortstudy_user_orders") || "[]");
    localUserOrders.forEach(o => { if (o && o.id) ordersMap.set(o.id, o); });
  } catch (e) {}

  // Sync with Firestore orders
  firestoreOrdersMap.forEach((val, key) => {
    ordersMap.set(key, { ...val, id: key });
  });

  ordersData = Array.from(ordersMap.values());
  // Sort descending by creation date
  ordersData.sort((a, b) => {
    const timeA = new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt || 0)).getTime();
    const timeB = new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt || 0)).getTime();
    return timeB - timeA;
  });

  renderOrdersTable(currentOrderFilter);
  updateMetrics();
}

function renderOrdersTable(filter = "all") {
  if (!el.ordersTableBody) return;
  el.ordersTableBody.innerHTML = "";

  let filtered = [...ordersData];
  if (filter === "pending") {
    filtered = filtered.filter(o => !o.accessGranted || o.paymentStatus === "pending_manual_access" || o.failSafeReason);
  } else if (filter === "granted") {
    filtered = filtered.filter(o => o.accessGranted === true);
  }

  if (filtered.length === 0) {
    const filterMsg = filter === "pending"
      ? "Great news! There are no pending or unresolved student orders."
      : "No student course orders logged yet.";
    el.ordersTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:32px; color:var(--text-muted);">
          ${filterMsg}
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach((order) => {
    const tr = document.createElement("tr");
    const isPurchased = order.purchased === true || order.accessGranted === true;
    const isPendingManual = order.purchased === false || !isPurchased || order.paymentStatus === "pending_manual_access" || !!order.failSafeReason;

    // Date formatting
    let dateStr = "Recent";
    if (order.createdAt) {
      const d = order.createdAt.seconds ? new Date(order.createdAt.seconds * 1000) : new Date(order.createdAt);
      dateStr = d.toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    }

    const studentName = order.name || order.studentName || order.fullName || "Student";
    const studentEmail = order.email || order.studentEmail || "—";
    const studentPhone = order.phone || order.studentPhone || "—";
    const utrNumber = order.utr || order.transactionId || order.referenceNo || "—";

    tr.innerHTML = `
      <td>
        <span class="font-mono" style="font-size:11px; color:var(--indigo-light);">${escapeHtml(order.id)}</span>
        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${dateStr}</div>
      </td>
      <td>
        <strong style="color:var(--text-white); font-size:13.5px;">${escapeHtml(studentName)}</strong>
        <div style="font-size:11.5px; color:var(--indigo-light);">${escapeHtml(studentEmail)}</div>
        <div style="font-size:11px; color:var(--text-muted);">📱 ${escapeHtml(studentPhone)}</div>
      </td>
      <td>
        <div style="font-size:11px; color:var(--text-muted); margin-bottom: 2px;">UTR / Ref:</div>
        <span class="font-mono" style="font-size:11px; color:#fbbf24; background:rgba(251,191,36,0.1); padding:2px 6px; border-radius:4px; border: 1px solid rgba(251,191,36,0.25);">
          ${escapeHtml(utrNumber)}
        </span>
      </td>
      <td>
        <div style="font-weight:600; color:var(--text-white); font-size:13px;">${escapeHtml(order.courseTitle || "Premium Course")}</div>
        <span style="color:#F2C94C; font-weight:700; font-size:12px;">${escapeHtml(order.amount || order.coursePrice || "")}</span>
      </td>
      <td>
        ${isPurchased
          ? `<span class="badge badge-published" style="font-size:10.5px;">UPI (+91 9315671951)</span>`
          : `<span class="badge" style="background:rgba(245,158,11,0.2); color:#f59e0b; border:1px solid rgba(245,158,11,0.4); font-size:10px;">
              ⚠️ Verification Needed
            </span>`
        }
      </td>
      <td>
        ${isPurchased
          ? `<span class="badge badge-published" style="font-size:11px; font-weight:700;">purchased: true</span>`
          : `<span class="badge" style="background:rgba(239,68,68,0.2); color:#f87171; border:1px solid rgba(239,68,68,0.4); font-size:11px; font-weight:700;">purchased: false</span>`
        }
      </td>
      <td>
        <div style="display:flex; gap:6px; align-items:center;">
          ${!isPurchased
            ? `<button class="btn btn-success btn-sm btn-grant-order" data-id="${order.id}" style="font-size:11.5px; padding:6px 12px; font-weight:600;">
                ✓ Set purchased = true
              </button>`
            : `<button class="btn btn-secondary btn-sm btn-revoke-order" data-id="${order.id}" style="font-size:11px; color:#f87171;">
                Set purchased = false
              </button>`
          }
        </div>
      </td>
    `;

    el.ordersTableBody.appendChild(tr);
  });

  // Attach Grant / Revoke Access event handlers
  el.ordersTableBody.querySelectorAll(".btn-grant-order").forEach(btn => {
    btn.addEventListener("click", () => handleGrantOrderAccess(btn.dataset.id));
  });

  el.ordersTableBody.querySelectorAll(".btn-revoke-order").forEach(btn => {
    btn.addEventListener("click", () => handleRevokeOrderAccess(btn.dataset.id));
  });
}

async function handleGrantOrderAccess(orderId) {
  const order = ordersData.find(o => o.id === orderId);
  if (!order) return;

  const updateData = {
    purchased: true, // EXACT field set to true
    accessGranted: true,
    paymentStatus: "completed",
    status: "completed",
    manualGrantBy: currentUser ? currentUser.email : "admin@shortstudy.com",
    grantedAt: serverTimestamp()
  };

  try {
    await updateDoc(doc(db, "course_orders", orderId), updateData);
    
    const studentEmail = order.email || order.studentEmail || "user";
    const courseId = order.courseId || "course";
    const accessKey = `${studentEmail}_${courseId}`.replace(/[^a-zA-Z0-9_]/g, "_");
    
    await setDoc(doc(db, "course_access", accessKey), {
      email: studentEmail,
      studentName: order.name || order.studentName || order.fullName,
      courseId: courseId,
      courseTitle: order.courseTitle,
      purchased: true,
      accessGranted: true,
      grantedBy: currentUser ? currentUser.email : "admin",
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(() => {});

    // Update in-memory and local state
    if (firestoreOrdersMap.has(orderId)) {
      firestoreOrdersMap.set(orderId, { ...firestoreOrdersMap.get(orderId), ...updateData });
    }
    const idx = ordersData.findIndex(o => o.id === orderId);
    if (idx !== -1) ordersData[idx] = { ...ordersData[idx], ...updateData };

    renderOrdersTable(currentOrderFilter);
    updateMetrics();
    showToast(`Purchased access set to TRUE for ${order.name || order.studentName || order.email}!`, "success");
  } catch (err) {
    console.warn("Firestore order update fallback:", err);
    const idx = ordersData.findIndex(o => o.id === orderId);
    if (idx !== -1) ordersData[idx] = { ...ordersData[idx], purchased: true, accessGranted: true, paymentStatus: "completed" };
    renderOrdersTable(currentOrderFilter);
    updateMetrics();
    showToast(`Purchased access set to true locally!`, "info");
  }
}

async function handleRevokeOrderAccess(orderId) {
  const order = ordersData.find(o => o.id === orderId);
  if (!order) return;

  const updateData = {
    purchased: false, // EXACT field set to false
    accessGranted: false,
    paymentStatus: "revoked",
    status: "revoked",
    updatedAt: serverTimestamp()
  };

  try {
    await updateDoc(doc(db, "course_orders", orderId), updateData);
    const studentEmail = order.email || order.studentEmail || "user";
    const courseId = order.courseId || "course";
    const accessKey = `${studentEmail}_${courseId}`.replace(/[^a-zA-Z0-9_]/g, "_");
    
    await setDoc(doc(db, "course_access", accessKey), { 
      purchased: false, 
      accessGranted: false 
    }, { merge: true }).catch(() => {});

    if (firestoreOrdersMap.has(orderId)) {
      firestoreOrdersMap.set(orderId, { ...firestoreOrdersMap.get(orderId), ...updateData });
    }
    const idx = ordersData.findIndex(o => o.id === orderId);
    if (idx !== -1) ordersData[idx] = { ...ordersData[idx], ...updateData };

    renderOrdersTable(currentOrderFilter);
    updateMetrics();
    showToast(`Purchased status set to FALSE for ${order.name || order.studentName || order.email}.`, "info");
  } catch (err) {
    console.warn("Firestore revoke fallback:", err);
    const idx = ordersData.findIndex(o => o.id === orderId);
    if (idx !== -1) ordersData[idx] = { ...ordersData[idx], purchased: false, accessGranted: false, paymentStatus: "revoked" };
    renderOrdersTable(currentOrderFilter);
    updateMetrics();
    showToast(`Purchased status updated locally.`, "info");
  }
}

// Order Filter Buttons
if (el.orderFilterBtns) {
  el.orderFilterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      el.orderFilterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentOrderFilter = btn.dataset.filter || "all";
      renderOrdersTable(currentOrderFilter);
    });
  });
}

// -------------------------------------------------------------
// 5. NAVIGATION & VIEW SWITCHING
// -------------------------------------------------------------
el.navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const targetTab = link.dataset.tab;
    if (!targetTab) return;

    el.navLinks.forEach(l => l.classList.remove("active"));
    link.classList.add("active");

    el.viewSections.forEach(section => {
      if (section.id === `view-${targetTab}`) {
        section.classList.add("active");
      } else {
        section.classList.remove("active");
      }
    });

    // Close mobile drawer if open
    if (el.sidebar) el.sidebar.classList.remove("open");
  });
});

// Mobile drawer & backdrop management
let adminSidebarBackdrop = document.querySelector(".admin-sidebar-backdrop");
if (!adminSidebarBackdrop) {
  adminSidebarBackdrop = document.createElement("div");
  adminSidebarBackdrop.className = "admin-sidebar-backdrop";
  document.body.appendChild(adminSidebarBackdrop);
}

function openMobileAdminSidebar() {
  if (el.sidebar) el.sidebar.classList.add("open");
  if (adminSidebarBackdrop) adminSidebarBackdrop.classList.add("active");
}

function closeMobileAdminSidebar() {
  if (el.sidebar) el.sidebar.classList.remove("open");
  if (adminSidebarBackdrop) adminSidebarBackdrop.classList.remove("active");
}

if (adminSidebarBackdrop) {
  adminSidebarBackdrop.addEventListener("click", closeMobileAdminSidebar);
}

if (el.menuBurger) {
  el.menuBurger.addEventListener("click", () => {
    if (el.sidebar && el.sidebar.classList.contains("open")) {
      closeMobileAdminSidebar();
    } else {
      openMobileAdminSidebar();
    }
  });
}

// Close sidebar on navigation item click on mobile
el.navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    if (window.innerWidth <= 1024) {
      closeMobileAdminSidebar();
    }
  });
});

// API Key Custom Configuration
const quickApiKeyInput = document.getElementById("quick-api-key-input");
const btnSaveQuickApiKey = document.getElementById("btn-save-quick-api-key");
const btnToggleApiKey = document.getElementById("btn-toggle-api-key");
const apiKeyFixPanel = document.getElementById("api-key-fix-panel");

if (btnToggleApiKey && apiKeyFixPanel) {
  btnToggleApiKey.addEventListener("click", (e) => {
    e.preventDefault();
    apiKeyFixPanel.classList.toggle("hidden");
  });
}

async function saveApiKeyToSystem(rawKey) {
  const key = rawKey.trim();
  if (!key.startsWith("AIzaSy")) {
    showToast("Invalid key format: Google API keys must begin with AIzaSy", "error");
    return;
  }

  localStorage.setItem("shortstudy_firebase_api_key", key);

  try {
    const res = await fetch("/api/save-firebase-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: key })
    });
    const data = await res.json();
    if (data.success) {
      showToast("Firebase API Key updated successfully! Reloading...", "success");
    } else {
      showToast("Key saved locally. Reloading...", "info");
    }
  } catch (err) {
    showToast("Key saved in browser. Reloading...", "info");
  }

  setTimeout(() => window.location.reload(), 900);
}

if (btnSaveQuickApiKey && quickApiKeyInput) {
  btnSaveQuickApiKey.addEventListener("click", () => {
    saveApiKeyToSystem(quickApiKeyInput.value);
  });
}

if (el.apiKeyInput) {
  const currentKey = localStorage.getItem("shortstudy_firebase_api_key") || "";
  el.apiKeyInput.value = currentKey;
}

if (el.btnSaveApiKey) {
  el.btnSaveApiKey.addEventListener("click", () => {
    const key = el.apiKeyInput.value.trim();
    if (key) {
      saveApiKeyToSystem(key);
    } else {
      localStorage.removeItem("shortstudy_firebase_api_key");
      showToast("API Key reset to default.", "info");
      setTimeout(() => window.location.reload(), 900);
    }
  });
}

// Helper utilities
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Global initialization
setAuthMode("login");

// Host / Environment Detection & Display
const envHostName = document.getElementById("env-host-name");
const envBadge = document.getElementById("env-badge");
if (envHostName) {
  const host = window.location.hostname;
  if (host.includes("github.io")) {
    envHostName.textContent = `GitHub Pages (${host})`;
    envHostName.style.color = "#818cf8";
  } else if (host === "localhost" || host === "127.0.0.1") {
    envHostName.textContent = `Local Server (${host})`;
  } else if (host.includes("run.app")) {
    envHostName.textContent = `Cloud Preview (${host.slice(0, 18)}...)`;
  } else if (window.location.protocol === "file:") {
    envHostName.textContent = "Local File (file://)";
    envHostName.style.color = "#f43f5e";
  } else {
    envHostName.textContent = host || "Active Host";
  }
}

if (envBadge) {
  envBadge.addEventListener("click", () => {
    const host = window.location.hostname;
    if (host) {
      navigator.clipboard.writeText(host).then(() => {
        showToast(`Domain copied: ${host}`, "success");
      });
    }
  });
}
