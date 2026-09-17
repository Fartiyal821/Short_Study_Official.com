import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  initializeFirestore,
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Exact production Firebase credentials
const firebaseConfig = {
  apiKey: "AIzaSyCtg7gLeHbl1uSIrxx6laxBdxx4zVQP4CQ",
  authDomain: "shortstudy-de7d4.firebaseapp.com",
  projectId: "shortstudy-de7d4",
  storageBucket: "shortstudy-de7d4.firebasestorage.app",
  messagingSenderId: "766812137638",
  appId: "1:766812137638:web:c6fdff7b473170cd116c67"
};

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true
});

// Known static pages mapping as safe fallback when specific links aren't defined
const staticPageMap = {
  "python-basics": "python-basics.html",
  "python-operators-conditionals": "python-operators-conditionals.html",
  "c-basics": "c-basics.html",
  "data-structures-arrays": "data-structures-arrays.html",
  "java-oop-concepts": "java-oop-basics.html",
  "java-oop-basics": "java-oop-basics.html",
  "html-css-basics": "html-css-basics.html",
  "sql-basics": "sql-basics.html"
};

function resolveCourseLink(course) {
  if (course.link && course.link.trim()) return course.link.trim();
  if (course.slug && staticPageMap[course.slug]) return staticPageMap[course.slug];
  if (course.id && staticPageMap[course.id]) return staticPageMap[course.id];
  if (course.slug) return `${course.slug}.html`;
  return `course.html?id=${encodeURIComponent(course.id || "")}`;
}

function initPublicCourseDisplay() {
  // Target containers for public course display
  const homeGrid = document.getElementById("homepage-courses-grid");
  const coursesGrid = document.getElementById("paid-courses-grid") || document.getElementById("courses-grid");
  const grids = [homeGrid, coursesGrid].filter(Boolean);

  if (grids.length === 0) return;

  const filterBtns = document.querySelectorAll("#courses .cwh-filter-btn");
  let activeFilter = "all";
  let coursesList = [];

  function renderGrid(container) {
    if (!container) return;

    const isHomepage = container.id === "homepage-courses-grid";

    // Filter courses if on homepage with active filter
    const filtered = coursesList.filter(course => {
      if (!isHomepage || activeFilter === "all") return true;
      const cat = (course.category || "").toLowerCase();
      const slug = (course.slug || "").toLowerCase();
      const title = (course.title || "").toLowerCase();

      if (activeFilter === "programming") {
        return cat.includes("prog") || slug.includes("python") || slug.includes("c-") || slug.includes("java") || title.includes("python") || title.includes("c ") || title.includes("java");
      }
      if (activeFilter === "dsa") {
        return cat.includes("dsa") || slug.includes("data") || slug.includes("array") || title.includes("data") || title.includes("array");
      }
      if (activeFilter === "web") {
        return cat.includes("web") || slug.includes("html") || slug.includes("sql") || title.includes("html") || title.includes("sql") || title.includes("css");
      }
      return cat.includes(activeFilter);
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 24px; background: #2B3A32; border-radius: 12px; border: 1px dashed rgba(242, 201, 76, 0.4); color: #F2C94C; box-shadow: 4px 4px 0px rgba(242, 201, 76, 0.2);">
          <span style="font-size: 40px; display: block; margin-bottom: 12px;">📚</span>
          <h3 style="font-family: 'Kalam', cursive; font-size: 24px; color: #F2C94C; margin-bottom: 8px;">No Courses Published Yet</h3>
          <p style="color: #e2e8f0; font-size: 15px; max-width: 480px; margin: 0 auto; line-height: 1.6;">
            Courses created in the Admin Panel will appear here live in real time.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map((course, idx) => {
      const link = resolveCourseLink(course);
      const isPaid = Boolean(course.price && course.price !== "0" && !String(course.price).toLowerCase().includes("free"));
      const categoryLabel = course.category || (isPaid ? "Masterclass" : "Programming");
      const orderNum = String(course.order || idx + 1).padStart(2, "0");
      const priceBadge = isPaid ? course.price : orderNum;

      return `
        <div class="class-card" style="background: #2B3A32; color: #F2C94C; border: 1px solid rgba(242, 201, 76, 0.4); box-shadow: 4px 4px 0px rgba(242, 201, 76, 0.2); border-radius: 12px; display: flex; flex-direction: column; padding: 24px; position: relative;">
          <div class="tape" style="background: rgba(242, 201, 76, 0.85); border: 1px solid #b98f1f;"></div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <span class="num" style="background: rgba(242, 201, 76, 0.15); color: #F2C94C; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 13px;">${priceBadge}</span>
            <span class="num" style="font-size: 12px; font-weight: 700; color: #F2C94C; text-transform: uppercase; opacity: 0.85;">${categoryLabel}</span>
          </div>
          <h3 style="color: #F2C94C; font-family: 'Kalam', cursive; font-size: 26px; margin: 0 0 10px 0; line-height: 1.3;">${course.title}</h3>
          <p style="color: #e2e8f0; font-family: 'Work Sans', sans-serif; font-size: 14.5px; line-height: 1.6; opacity: 0.92; margin-bottom: 20px; flex-grow: 1;">
            ${course.description || "Master core concepts with structured notes, real-world examples, and step-by-step guidance."}
          </p>
          <a href="${link}" class="go" style="color: #F2C94C; border-top: 1px dashed rgba(242, 201, 76, 0.3); padding-top: 14px; margin-top: auto; font-family: 'Kalam', cursive; font-size: 18px; text-decoration: none; display: flex; align-items: center; justify-content: space-between;">
            <span>${isPaid ? "Enroll Now" : "Start Learning"}</span>
            <span style="font-size: 20px;">→</span>
          </a>
        </div>
      `;
    }).join("");
  }

  function renderAllGrids() {
    grids.forEach(g => renderGrid(g));
  }

  if (filterBtns.length > 0) {
    filterBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        filterBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilter = btn.getAttribute("data-filter") || "all";
        renderAllGrids();
      });
    });
  }

  // Realtime Firestore Listener on 'courses' collection
  try {
    const coursesCol = collection(db, "courses");
    onSnapshot(coursesCol, (snapshot) => {
      const items = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.isDeleted && data.status !== "draft" && data.status !== "inactive") {
          items.push({ id: docSnap.id, ...data });
        }
      });

      // Sort by order ascending
      items.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      coursesList = items;
      renderAllGrids();
    }, (err) => {
      console.warn("Real-time course sync warning:", err);
    });
  } catch (err) {
    console.error("Failed to bind Firestore realtime course listener:", err);
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPublicCourseDisplay);
} else {
  initPublicCourseDisplay();
}

export { db, app, firebaseConfig };
