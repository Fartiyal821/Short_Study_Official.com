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
  getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { auth, db, firebaseConfig } from "./firebase-config.js";
import { sanitizeHTML, processYouTubeEmbed, extractYouTubeId } from "./sanitizer.js";

// State Management
let currentUser = null;
let currentAdminProfile = null;
let activeTab = "courses"; // 'overview', 'courses', 'posts', 'preview', 'config'
let coursesData = [];
let postsData = [];
let unsubscribeCourses = null;
let unsubscribePosts = null;
let editingCourseId = null;
let editingPostId = null;

// DOM Elements Cache
const el = {
  authGuardScreen: document.getElementById("auth-guard-screen"),
  accessDeniedScreen: document.getElementById("access-denied-screen"),
  adminDashboard: document.getElementById("admin-dashboard-screen"),
  
  // Auth Form Elements
  authForm: document.getElementById("auth-form"),
  authTitle: document.getElementById("auth-title"),
  authSubtitle: document.getElementById("auth-subtitle"),
  authEmail: document.getElementById("auth-email"),
  authPassword: document.getElementById("auth-password"),
  authNameGroup: document.getElementById("auth-name-group"),
  authName: document.getElementById("auth-name"),
  authSubmitBtn: document.getElementById("auth-submit-btn"),
  authErrorMessage: document.getElementById("auth-error-message"),
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
  btnSignOut: document.getElementById("btn-signout"),
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
  toastContainer: document.getElementById("toast-container")
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

el.authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  el.authErrorMessage.textContent = "";
  const email = el.authEmail.value.trim();
  const password = el.authPassword.value;
  const name = el.authName.value.trim();

  if (!email || !password) {
    el.authErrorMessage.textContent = "Please fill in all required fields.";
    return;
  }

  el.authSubmitBtn.disabled = true;
  el.authSubmitBtn.textContent = "Authenticating...";

  try {
    if (authMode === "login") {
      await signInWithEmailAndPassword(auth, email, password);
      showToast("Authentication successful", "success");
    } else {
      // Use the term 'Register'
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name && cred.user) {
        await updateProfile(cred.user, { displayName: name });
      }
      showToast("Account registered! Awaiting admin privilege verification.", "info");
    }
  } catch (error) {
    console.error("Auth Error:", error);
    let errorMsg = error.message;
    if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
      errorMsg = "Invalid email or password.";
    } else if (error.code === "auth/email-already-in-use") {
      errorMsg = "An account with this email already exists. Please login instead.";
    } else if (error.code === "auth/weak-password") {
      errorMsg = "Password should be at least 6 characters.";
    } else if (error.code === "auth/invalid-api-key") {
      errorMsg = "Firebase API key is unconfigured. Please update your Firebase API key in config settings.";
    }
    el.authErrorMessage.textContent = errorMsg;
  } finally {
    el.authSubmitBtn.disabled = false;
    el.authSubmitBtn.textContent = authMode === "login" ? "Login to Dashboard" : "Register Account";
  }
});

// Guard Check: Verify whether authenticated UID is in the "admins" collection
async function checkAdminPrivileges(user) {
  if (!user) return false;
  try {
    const adminRef = doc(db, "admins", user.uid);
    const adminSnap = await getDoc(adminRef);

    if (adminSnap.exists()) {
      currentAdminProfile = adminSnap.data();
      return true;
    }
    return false;
  } catch (err) {
    console.warn("Could not query 'admins' collection:", err);
    return false;
  }
}

// Master Auth State Observer
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) {
    // Non-authenticated user -> Force Login or Register screen
    el.authGuardScreen.style.display = "flex";
    el.accessDeniedScreen.style.display = "none";
    el.adminDashboard.style.display = "none";
    stopRealtimeListeners();
    return;
  }

  // User is authenticated, now verify admin collection membership
  const isAdmin = await checkAdminPrivileges(user);

  if (isAdmin) {
    // Fully authorized Admin
    el.authGuardScreen.style.display = "none";
    el.accessDeniedScreen.style.display = "none";
    el.adminDashboard.style.display = "flex";
    
    // Set user info
    const displayName = user.displayName || user.email.split("@")[0];
    el.userDisplayName.textContent = displayName;
    el.userAvatarInitial.textContent = displayName.charAt(0).toUpperCase();

    // Start real-time listeners for Courses and Posts
    startRealtimeListeners();
  } else {
    // Authenticated, but not yet authorized in 'admins' collection
    el.authGuardScreen.style.display = "none";
    el.adminDashboard.style.display = "none";
    el.accessDeniedScreen.style.display = "flex";

    el.deniedEmail.textContent = user.email;
    el.deniedUid.textContent = user.uid;
    stopRealtimeListeners();
  }
});

// Access Denied Screen Actions
el.btnCopyUid.addEventListener("click", () => {
  if (currentUser) {
    navigator.clipboard.writeText(currentUser.uid).then(() => {
      showToast("Admin UID copied to clipboard", "success");
    });
  }
});

el.btnCheckApproval.addEventListener("click", async () => {
  if (!currentUser) return;
  el.btnCheckApproval.textContent = "Checking...";
  const isAdmin = await checkAdminPrivileges(currentUser);
  el.btnCheckApproval.textContent = "Check Approval Status";
  if (isAdmin) {
    showToast("Admin access confirmed!", "success");
    el.accessDeniedScreen.style.display = "none";
    el.adminDashboard.style.display = "flex";
    startRealtimeListeners();
  } else {
    showToast("UID is not yet in the 'admins' collection. Please add it in Firestore.", "error");
  }
});

// Self-provision initial Admin document (for initial setup & sandbox validation)
el.btnDevClaimAdmin.addEventListener("click", async () => {
  if (!currentUser) return;
  try {
    await setDoc(doc(db, "admins", currentUser.uid), {
      email: currentUser.email,
      role: "admin",
      displayName: currentUser.displayName || "Administrator",
      createdAt: serverTimestamp()
    });
    showToast("Admin privileges assigned successfully!", "success");
    el.accessDeniedScreen.style.display = "none";
    el.adminDashboard.style.display = "flex";
    startRealtimeListeners();
  } catch (err) {
    console.error("Error setting admin role:", err);
    showToast(`Failed to claim admin: ${err.message}`, "error");
  }
});

function handleSignOut() {
  signOut(auth).then(() => {
    showToast("Signed out successfully", "info");
    setAuthMode("login");
  });
}

el.btnSignOut.addEventListener("click", handleSignOut);
el.btnDeniedSignout.addEventListener("click", handleSignOut);

// -------------------------------------------------------------
// 2. REAL-TIME DATA SYNCHRONIZATION (onSnapshot listeners)
// -------------------------------------------------------------
function startRealtimeListeners() {
  stopRealtimeListeners(); // avoid duplicate listeners

  // 1. Courses Real-Time Listener
  try {
    const coursesQuery = query(collection(db, "courses"), orderBy("createdAt", "desc"));
    unsubscribeCourses = onSnapshot(coursesQuery, (snapshot) => {
      coursesData = [];
      snapshot.forEach((docSnap) => {
        coursesData.push({ id: docSnap.id, ...docSnap.data() });
      });
      renderCoursesTable();
      populateCourseSelects();
      updateMetrics();
      el.livePulseStatus.textContent = "Real-time sync active";
    }, (error) => {
      console.warn("Firestore Courses listener error:", error);
      el.livePulseStatus.textContent = "Sync connection warning";
      // If Firestore rules are locked, populate with initial mock courses so dashboard is functional
      if (coursesData.length === 0) {
        populateDefaultSeedData();
      }
    });
  } catch (err) {
    console.error("Failed to start courses snapshot listener:", err);
  }

  // 2. Posts/Lessons Real-Time Listener
  try {
    const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      postsData = [];
      snapshot.forEach((docSnap) => {
        postsData.push({ id: docSnap.id, ...docSnap.data() });
      });
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
    const isPublished = course.status === "published";
    const postCount = postsData.filter(p => p.courseId === course.id).length;

    tr.innerHTML = `
      <td>
        <span style="font-size: 18px; margin-right: 8px;">${course.icon || "📘"}</span>
        <strong>${escapeHtml(course.title)}</strong>
      </td>
      <td><span class="font-mono" style="color:var(--indigo-light);">${escapeHtml(course.slug)}</span></td>
      <td><span class="badge ${isPublished ? "badge-published" : "badge-draft"}">${isPublished ? "Published" : "Draft"}</span></td>
      <td><span class="font-mono">${postCount}</span></td>
      <td><span class="font-mono">${course.order ?? 0}</span></td>
      <td>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary btn-sm edit-course-btn" data-id="${course.id}">Edit</button>
          <button class="btn btn-danger btn-sm delete-course-btn" data-id="${course.id}">Delete</button>
        </div>
      </td>
    `;
    el.coursesTableBody.appendChild(tr);
  });

  // Attach dynamic button listeners
  el.coursesTableBody.querySelectorAll(".edit-course-btn").forEach(btn => {
    btn.addEventListener("click", () => openCourseModal(btn.dataset.id));
  });
  el.coursesTableBody.querySelectorAll(".delete-course-btn").forEach(btn => {
    btn.addEventListener("click", () => confirmDeleteCourse(btn.dataset.id));
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
    opt.textContent = `${course.icon || "📘"} ${course.title}`;
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
    const isPublished = post.status === "published";
    const hasVideo = post.youtubeEmbed && post.youtubeEmbed.trim() !== "";

    tr.innerHTML = `
      <td><strong>${escapeHtml(post.title)}</strong></td>
      <td><span style="color:var(--text-muted);">${escapeHtml(post.courseTitle || "Unassigned")}</span></td>
      <td><span class="badge ${isPublished ? "badge-published" : "badge-draft"}">${isPublished ? "Published" : "Draft"}</span></td>
      <td>
        ${hasVideo ? '<span class="badge badge-video">▶ Video</span>' : '<span style="color:var(--text-dim);">—</span>'}
      </td>
      <td><span class="font-mono">${escapeHtml(post.readingTime || "5 min read")}</span></td>
      <td><span class="font-mono">${post.order ?? 0}</span></td>
      <td>
        <div style="display:flex; gap:8px;">
          <a href="lesson.html?id=${post.id}" target="_blank" class="btn btn-secondary btn-sm" style="font-size:11px;">View</a>
          <button class="btn btn-secondary btn-sm edit-post-btn" data-id="${post.id}">Edit</button>
          <button class="btn btn-danger btn-sm delete-post-btn" data-id="${post.id}">Delete</button>
        </div>
      </td>
    `;
    el.postsTableBody.appendChild(tr);
  });

  el.postsTableBody.querySelectorAll(".edit-post-btn").forEach(btn => {
    btn.addEventListener("click", () => openPostModal(btn.dataset.id));
  });
  el.postsTableBody.querySelectorAll(".delete-post-btn").forEach(btn => {
    btn.addEventListener("click", () => confirmDeletePost(btn.dataset.id));
  });
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

  el.postModal.classList.add("open");
}

function closePostModal() {
  el.postModal.classList.remove("open");
  editingPostId = null;
}

el.btnNewPost.addEventListener("click", () => openPostModal());
el.postModalClose.addEventListener("click", closePostModal);
el.postCancelBtn.addEventListener("click", closePostModal);

el.postTitle.addEventListener("input", () => {
  if (!editingPostId) {
    el.postSlug.value = slugify(el.postTitle.value);
  }
});

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
if (el.apiKeyInput) {
  const currentKey = localStorage.getItem("shortstudy_firebase_api_key") || "";
  el.apiKeyInput.value = currentKey;
}

if (el.btnSaveApiKey) {
  el.btnSaveApiKey.addEventListener("click", () => {
    const key = el.apiKeyInput.value.trim();
    if (key) {
      localStorage.setItem("shortstudy_firebase_api_key", key);
      showToast("API Key saved. Refreshing to re-initialize...", "success");
      setTimeout(() => window.location.reload(), 1200);
    } else {
      localStorage.removeItem("shortstudy_firebase_api_key");
      showToast("API Key reset to default.", "info");
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
