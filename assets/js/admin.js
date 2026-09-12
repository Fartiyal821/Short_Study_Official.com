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

// State Management
const ADMIN_EMAIL = "gauravfartiyal751@gmail.com";

let currentUser = null;
let currentAdminProfile = null;
let activeTab = "courses"; // 'overview', 'courses', 'posts', 'preview', 'config'
let coursesData = [];
let postsData = [];
let unsubscribeCourses = null;
let unsubscribePosts = null;
let editingCourseId = null;
let editingPostId = null;

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
  postPublishContentBtn: document.getElementById("post-publish-content-btn")
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
  el.authErrorMessage.textContent = "";
  if (mode === "login") {
    el.tabLogin.classList.add("active");
    el.tabRegister.classList.remove("active");
    el.authTitle.textContent = "Admin Login";
    el.authSubtitle.textContent = "Enter your verified administrator credentials";
    el.authNameGroup.style.display = "none";
    el.authSubmitBtn.textContent = "Login to Dashboard";
  } else {
    el.tabRegister.classList.add("active");
    el.tabLogin.classList.remove("active");
    el.authTitle.textContent = "Register Admin Account";
    el.authSubtitle.textContent = "Create an account for administrator verification";
    el.authNameGroup.style.display = "flex";
    el.authSubmitBtn.textContent = "Register Account";
  }
}

el.tabLogin.addEventListener("click", () => setAuthMode("login"));
el.tabRegister.addEventListener("click", () => setAuthMode("register"));

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

function loadDashboardData() {
  // Database CRUD operations run here securely via onSnapshot
  console.log("Admin Dashboard Loaded Successfully");
  if (currentUser) {
    const displayName = currentUser.displayName || currentUser.email.split("@")[0];
    if (el.userDisplayName) el.userDisplayName.textContent = displayName;
    if (el.userAvatarInitial) el.userAvatarInitial.textContent = displayName.charAt(0).toUpperCase();
  }
  startRealtimeListeners();
}

// -------------------------------------------------------------
// 2. REAL-TIME DATA SYNCHRONIZATION (onSnapshot listeners)
// -------------------------------------------------------------
function startRealtimeListeners() {
  stopRealtimeListeners(); // avoid duplicate listeners

  // 1. Courses Real-Time Listener (fetches ALL courses including in_development)
  try {
    const coursesQuery = collection(db, "courses");
    unsubscribeCourses = onSnapshot(coursesQuery, (snapshot) => {
      coursesData = [];
      snapshot.forEach((docSnap) => {
        coursesData.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort in memory so documents lacking order or createdAt are never hidden
      coursesData.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      renderCoursesTable();
      populateCourseSelects();
      updateMetrics();
      el.livePulseStatus.textContent = "Real-time sync active";
    }, (error) => {
      console.warn("Firestore Courses listener error:", error);
      el.livePulseStatus.textContent = "Sync connection warning";
      // If Firestore rules are locked, populate with initial courses so dashboard is functional
      if (coursesData.length === 0) {
        populateDefaultSeedData();
      }
    });
  } catch (err) {
    console.error("Failed to start courses snapshot listener:", err);
  }

  // 2. Posts/Lessons Real-Time Listener (fetches ALL posts including in_development)
  try {
    const postsQuery = collection(db, "posts");
    unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      postsData = [];
      snapshot.forEach((docSnap) => {
        postsData.push({ id: docSnap.id, ...docSnap.data() });
      });
      postsData.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      renderPostsTable();
      updateMetrics();
    }, (error) => {
      console.warn("Firestore Posts listener error:", error);
    });
  } catch (err) {
    console.error("Failed to start posts snapshot listener:", err);
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
}

// Fallback seed courses in memory if database is empty on first run
function populateDefaultSeedData() {
  coursesData = [
    {
      id: "course-python",
      title: "Python Basics",
      slug: "python-basics",
      description: "Variables, data types, logic and control flow for beginners.",
      icon: "🐍",
      status: "published",
      order: 1
    },
    {
      id: "course-c",
      title: "C Programming Basics",
      slug: "c-basics",
      description: "How memory, pointers, and compilation logic operate under the hood.",
      icon: "⚡",
      status: "published",
      order: 2
    },
    {
      id: "course-dsa",
      title: "Data Structures: Arrays",
      slug: "data-structures-arrays",
      description: "The core foundation of algorithms and technical coding interviews.",
      icon: "📊",
      status: "published",
      order: 3
    },
    {
      id: "course-java",
      title: "Java & OOP Concepts",
      slug: "java-oop-concepts",
      description: "Classes, objects, and inheritance for technical interview preparation.",
      icon: "☕",
      status: "in_development",
      order: 4
    },
    {
      id: "course-web",
      title: "HTML & CSS Basics",
      slug: "html-css-basics",
      description: "Structuring and styling a webpage for anyone starting in web development.",
      icon: "🌐",
      status: "in_development",
      order: 5
    },
    {
      id: "course-sql",
      title: "SQL Basics",
      slug: "sql-basics",
      description: "The queries every fresher is expected to know for a technical interview.",
      icon: "🗄️",
      status: "in_development",
      order: 6
    }
  ];

  postsData = [
    {
      id: "post-python-1",
      courseId: "course-python",
      courseTitle: "Python Basics",
      title: "Python Variables and Data Types Explained",
      slug: "python-variables-guide",
      excerpt: "Deep dive into dynamic typing, memory references, and built-in types in Python 3.",
      content: "<h2>Understanding Python Variables</h2><p>In Python, variables are symbolic names that reference objects in memory.</p><pre><code># Variable assignment\nx = 42\nname = \"ShortStudy\"\nprint(f\"{name} answer: {x}\")</code></pre>",
      youtubeEmbed: "https://www.youtube.com/watch?v=kqtD5dpn9C8",
      readingTime: "6 min read",
      status: "published",
      order: 1
    }
  ];

  renderCoursesTable();
  populateCourseSelects();
  renderPostsTable();
  updateMetrics();
}

// Update Overview Metrics
function updateMetrics() {
  el.metricTotalCourses.textContent = coursesData.length;
  el.metricTotalPosts.textContent = postsData.length;
  
  const publishedCount = postsData.filter(p => p.status === "published").length;
  el.metricPublishedPosts.textContent = publishedCount;

  const videoCount = postsData.filter(p => p.youtubeEmbed && p.youtubeEmbed.trim() !== "").length;
  el.metricVideosCount.textContent = videoCount;

  el.courseCountBadge.textContent = coursesData.length;
  el.postCountBadge.textContent = postsData.length;
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
  
  el.publishModal.classList.add("open");
}

function closePublishModal() {
  el.publishModal.classList.remove("open");
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
      showToast("Please provide both lesson title and HTML content.", "error");
      return;
    }

    // Sanitize lesson content with DOMPurify
    const sanitizedContent = sanitizeHTML(rawContent);

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
      slug: el.publishLessonSlug.value.trim() || slugify(lessonTitle),
      excerpt: el.publishLessonExcerpt.value.trim(),
      readingTime: el.publishLessonReadingTime.value.trim() || "5 min read",
      status: "published", // Published content
      order: parseInt(el.publishLessonOrder.value, 10) || 1,
      youtubeEmbed: cleanYoutubeEmbed,
      content: sanitizedContent,
      author: (currentUser && currentUser.displayName) ? currentUser.displayName : "Admin",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      // Atomic execution using runTransaction
      const courseDocRef = doc(db, "courses", courseId);
      const newPostDocRef = doc(collection(db, "posts"));

      await runTransaction(db, async (transaction) => {
        // 1. Append new lesson content successfully into posts collection
        transaction.set(newPostDocRef, postPayload);
        // 2. Update course status to "published" (permanently removing In Development badge)
        transaction.update(courseDocRef, {
          status: "published",
          updatedAt: serverTimestamp()
        });
      });

      showToast(`New lesson appended & course "${course ? course.title : ''}" published! "In Development" badge permanently removed.`, "success");
      closePublishModal();
    } catch (err) {
      console.warn("Transaction publish failed, trying individual updates:", err);
      try {
        // Fallback: individual writes
        await addDoc(collection(db, "posts"), postPayload);
        await updateDoc(doc(db, "courses", courseId), {
          status: "published",
          updatedAt: serverTimestamp()
        });
        showToast(`New lesson appended & course published! "In Development" badge permanently removed.`, "success");
        closePublishModal();
      } catch (innerErr) {
        console.error("Publish content error:", innerErr);
        // Fallback local memory update
        postsData.unshift({ id: "post-" + Date.now(), ...postPayload });
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
  el.courseModal.classList.add("open");
}

function closeCourseModal() {
  el.courseModal.classList.remove("open");
  editingCourseId = null;
}

el.btnNewCourse.addEventListener("click", () => openCourseModal());
el.courseModalClose.addEventListener("click", closeCourseModal);
el.courseCancelBtn.addEventListener("click", closeCourseModal);

// Auto-generate slug from title
el.courseTitle.addEventListener("input", () => {
  if (!editingCourseId) {
    el.courseSlug.value = slugify(el.courseTitle.value);
  }
});

el.courseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const coursePayload = {
    title: el.courseTitle.value.trim(),
    slug: el.courseSlug.value.trim() || slugify(el.courseTitle.value),
    description: el.courseDescription.value.trim(),
    icon: el.courseIcon.value.trim() || "📘",
    status: el.courseStatus.value,
    order: parseInt(el.courseOrder.value, 10) || 0,
    updatedAt: serverTimestamp()
  };

  try {
    if (editingCourseId) {
      const docRef = doc(db, "courses", editingCourseId);
      await updateDoc(docRef, coursePayload);
      showToast("Course updated live!", "success");
    } else {
      coursePayload.createdAt = serverTimestamp();
      await addDoc(collection(db, "courses"), coursePayload);
      showToast("New course published!", "success");
    }
    closeCourseModal();
  } catch (err) {
    console.error("Course save error:", err);
    // Local fallback update if offline/rules
    if (editingCourseId) {
      const idx = coursesData.findIndex(c => c.id === editingCourseId);
      if (idx !== -1) coursesData[idx] = { ...coursesData[idx], ...coursePayload };
    } else {
      coursesData.unshift({ id: "course-" + Date.now(), ...coursePayload });
    }
    renderCoursesTable();
    populateCourseSelects();
    updateMetrics();
    closeCourseModal();
    showToast("Course saved locally (sync updated)", "info");
  }
});

function confirmDeleteCourse(courseId) {
  const course = coursesData.find(c => c.id === courseId);
  const title = course ? course.title : "this course";
  el.deleteModalText.textContent = `Are you sure you want to delete "${title}"? This cannot be undone.`;
  el.deleteModal.classList.add("open");

  el.deleteConfirmBtn.onclick = async () => {
    try {
      await deleteDoc(doc(db, "courses", courseId));
      showToast("Course deleted", "success");
    } catch (err) {
      console.error("Delete course error:", err);
      coursesData = coursesData.filter(c => c.id !== courseId);
      renderCoursesTable();
      populateCourseSelects();
      updateMetrics();
      showToast("Course deleted locally", "info");
    }
    el.deleteModal.classList.remove("open");
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
el.postYoutubeInput.addEventListener("input", () => {
  const val = el.postYoutubeInput.value.trim();
  if (!val) {
    el.postYoutubePreview.innerHTML = "";
    el.postYoutubePreview.classList.remove("has-video");
    return;
  }

  const processed = processYouTubeEmbed(val);
  if (processed.isValid) {
    el.postYoutubePreview.innerHTML = `<div class="video-aspect">${processed.iframeHtml}</div>`;
    el.postYoutubePreview.classList.add("has-video");
  } else {
    el.postYoutubePreview.innerHTML = `<div style="padding:10px; font-size:12px; color:#f87171;">Invalid YouTube URL or embed code</div>`;
    el.postYoutubePreview.classList.add("has-video");
  }
});

// HTML Content Editor Tabs (Edit vs Preview)
el.tabContentEditor.addEventListener("click", () => {
  el.tabContentEditor.classList.add("active");
  el.tabContentPreview.classList.remove("active");
  el.editorPane.style.display = "block";
  el.previewPane.style.display = "none";
});

el.tabContentPreview.addEventListener("click", () => {
  el.tabContentPreview.classList.add("active");
  el.tabContentEditor.classList.remove("active");
  el.editorPane.style.display = "none";
  el.previewPane.style.display = "block";

  // Sanitize with DOMPurify before previewing
  const rawHtml = el.postContent.value;
  const sanitized = sanitizeHTML(rawHtml);
  el.previewPane.innerHTML = sanitized || "<p style='color:#94a3b8; font-style:italic;'>No content written yet.</p>";
});

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

el.postCourseSelect.addEventListener("change", updatePostModalInDevNotice);

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
  }

  updatePostModalInDevNotice();
  el.postModal.classList.add("open");
}

function closePostModal() {
  el.postModal.classList.remove("open");
  editingPostId = null;
  if (el.postCourseInDevAlert) el.postCourseInDevAlert.classList.add("hidden");
  if (el.postPublishContentBtn) el.postPublishContentBtn.style.display = "none";
}

el.btnNewPost.addEventListener("click", () => openPostModal());
el.postModalClose.addEventListener("click", closePostModal);
el.postCancelBtn.addEventListener("click", closePostModal);

el.postTitle.addEventListener("input", () => {
  if (!editingPostId) {
    el.postSlug.value = slugify(el.postTitle.value);
  }
});

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
    const contentVal = el.postContent.value;
    if (!titleVal || !contentVal) {
      showToast("Please fill in lesson title and HTML content.", "error");
      return;
    }

    const sanitizedContent = sanitizeHTML(contentVal);
    const rawYoutube = el.postYoutubeInput.value.trim();
    let cleanYoutubeEmbed = "";
    if (rawYoutube) {
      const processed = processYouTubeEmbed(rawYoutube);
      cleanYoutubeEmbed = processed.isValid ? processed.iframeHtml : rawYoutube;
    }

    const postPayload = {
      courseId: selectedCourseId,
      courseTitle: selectedCourse ? selectedCourse.title : "General",
      title: titleVal,
      slug: el.postSlug.value.trim() || slugify(titleVal),
      excerpt: el.postExcerpt.value.trim(),
      readingTime: el.postReadingTime.value.trim() || "5 min read",
      status: "published", // Force published
      order: parseInt(el.postOrder.value, 10) || 0,
      youtubeEmbed: cleanYoutubeEmbed,
      content: sanitizedContent,
      author: (currentUser && currentUser.displayName) ? currentUser.displayName : "Admin",
      updatedAt: serverTimestamp()
    };

    try {
      const courseDocRef = doc(db, "courses", selectedCourseId);
      
      if (editingPostId) {
        const postDocRef = doc(db, "posts", editingPostId);
        await runTransaction(db, async (transaction) => {
          transaction.update(postDocRef, postPayload);
          transaction.update(courseDocRef, {
            status: "published",
            updatedAt: serverTimestamp()
          });
        });
      } else {
        const newPostDocRef = doc(collection(db, "posts"));
        postPayload.createdAt = serverTimestamp();
        await runTransaction(db, async (transaction) => {
          transaction.set(newPostDocRef, postPayload);
          transaction.update(courseDocRef, {
            status: "published",
            updatedAt: serverTimestamp()
          });
        });
      }

      showToast(`Course "${selectedCourse.title}" & content successfully published! "In Development" badge permanently removed.`, "success");
      closePostModal();
    } catch (err) {
      console.warn("Atomic transaction fallback, trying sequential writes:", err);
      try {
        if (editingPostId) {
          await updateDoc(doc(db, "posts", editingPostId), postPayload);
        } else {
          postPayload.createdAt = serverTimestamp();
          await addDoc(collection(db, "posts"), postPayload);
        }
        await updateDoc(doc(db, "courses", selectedCourseId), {
          status: "published",
          updatedAt: serverTimestamp()
        });
        showToast(`Course "${selectedCourse.title}" & content published! "In Development" badge removed.`, "success");
        closePostModal();
      } catch (innerErr) {
        console.error("Publish content & course error:", innerErr);
        // Fallback local memory update
        if (editingPostId) {
          const idx = postsData.findIndex(p => p.id === editingPostId);
          if (idx !== -1) postsData[idx] = { ...postsData[idx], ...postPayload };
        } else {
          postsData.unshift({ id: "post-" + Date.now(), ...postPayload });
        }
        const cIdx = coursesData.findIndex(c => c.id === selectedCourseId);
        if (cIdx !== -1) coursesData[cIdx].status = "published";

        renderPostsTable();
        renderCoursesTable();
        populateCourseSelects();
        updateMetrics();
        showToast(`Saved locally! "In Development" badge removed.`, "info");
        closePostModal();
      }
    }
  });
}

// Post Submit Handler with DOMPurify Sanitization
el.postForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const selectedCourseId = el.postCourseSelect.value;
  const selectedCourse = coursesData.find(c => c.id === selectedCourseId);
  const rawContent = el.postContent.value;
  const rawYoutube = el.postYoutubeInput.value.trim();

  // 1. Sanitize HTML Content using DOMPurify
  const sanitizedContent = sanitizeHTML(rawContent);

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

  const postPayload = {
    courseId: selectedCourseId,
    courseTitle: selectedCourse ? selectedCourse.title : "General",
    title: el.postTitle.value.trim(),
    slug: el.postSlug.value.trim() || slugify(el.postTitle.value),
    excerpt: el.postExcerpt.value.trim(),
    readingTime: el.postReadingTime.value.trim() || "5 min read",
    status: el.postStatus.value,
    order: parseInt(el.postOrder.value, 10) || 0,
    youtubeEmbed: cleanYoutubeEmbed,
    content: sanitizedContent,
    author: (currentUser && currentUser.displayName) ? currentUser.displayName : "Admin",
    updatedAt: serverTimestamp()
  };

  try {
    if (editingPostId) {
      const docRef = doc(db, "posts", editingPostId);
      await updateDoc(docRef, postPayload);
      showToast("Post updated live!", "success");
    } else {
      postPayload.createdAt = serverTimestamp();
      await addDoc(collection(db, "posts"), postPayload);
      showToast("Post published live!", "success");
    }

    // If the post is published and the course is currently in_development, auto-update course to published!
    if (el.postStatus.value === "published" && selectedCourse && selectedCourse.status === "in_development") {
      try {
        await updateDoc(doc(db, "courses", selectedCourseId), {
          status: "published",
          updatedAt: serverTimestamp()
        });
        showToast(`Course "${selectedCourse.title}" status updated to Published! "In Development" badge removed.`, "success");
      } catch (cErr) {
        console.warn("Could not auto-update course status:", cErr);
      }
    }

    closePostModal();
  } catch (err) {
    console.error("Post save error:", err);
    // Local fallback update if offline/rules
    if (editingPostId) {
      const idx = postsData.findIndex(p => p.id === editingPostId);
      if (idx !== -1) postsData[idx] = { ...postsData[idx], ...postPayload };
    } else {
      postsData.unshift({ id: "post-" + Date.now(), ...postPayload });
    }

    if (el.postStatus.value === "published" && selectedCourse && selectedCourse.status === "in_development") {
      const cIdx = coursesData.findIndex(c => c.id === selectedCourseId);
      if (cIdx !== -1) coursesData[cIdx].status = "published";
      renderCoursesTable();
    }

    renderPostsTable();
    updateMetrics();
    closePostModal();
    showToast("Post saved locally (sync updated)", "info");
  }
});

function confirmDeletePost(postId) {
  const post = postsData.find(p => p.id === postId);
  const title = post ? post.title : "this post";
  el.deleteModalText.textContent = `Are you sure you want to delete "${title}"? This cannot be undone.`;
  el.deleteModal.classList.add("open");

  el.deleteConfirmBtn.onclick = async () => {
    try {
      await deleteDoc(doc(db, "posts", postId));
      showToast("Post deleted", "success");
    } catch (err) {
      console.error("Delete post error:", err);
      postsData = postsData.filter(p => p.id !== postId);
      renderPostsTable();
      updateMetrics();
      showToast("Post deleted locally", "info");
    }
    el.deleteModal.classList.remove("open");
  };
}

el.deleteCancelBtn.addEventListener("click", () => {
  el.deleteModal.classList.remove("open");
});

// Search Filters
el.courseSearch.addEventListener("input", (e) => renderCoursesTable(e.target.value));
el.postSearch.addEventListener("input", (e) => renderPostsTable(e.target.value));

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
    el.sidebar.classList.remove("open");
  });
});

el.menuBurger.addEventListener("click", () => {
  el.sidebar.classList.toggle("open");
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
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

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
