import { 
  doc,
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
  signInAnonymously 
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { app, db, auth, firebaseConfig } from "./firebase-config.js";
import { PRE_EXISTING_COURSES } from "./catalog-data.js";

export { app, db, auth, firebaseConfig };

let currentUserUid = null;
let cachedCourses = [];
let purchasedCourseIdsFromOrders = new Set();
let activeCheckoutCourseId = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUserUid = user.uid;
    setupOrdersListener();
  } else {
    signInAnonymously(auth).catch(err => console.error("Anon auth failed:", err));
  }
});

function setupOrdersListener() {
  if (!currentUserUid || !db) return;
  const qOrders = query(collection(db, "course_orders"), where("uid", "==", currentUserUid));
  onSnapshot(qOrders, (snapshot) => {
    const updatedPurchasedIds = new Set();
    snapshot.forEach((docSnap) => {
      const order = docSnap.data();
      const isOrderApproved = (order.isPurchased === true || order.purchased === true) && order.status === "approved";
      if (isOrderApproved && order.courseId) {
        updatedPurchasedIds.add(order.courseId);
      }
    });

    purchasedCourseIdsFromOrders = updatedPurchasedIds;

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
  }, (err) => console.warn("Orders listener note:", err));
}

function isCoursePaid(course) {
  if (!course) return false;
  if (course.type === "paid") return true;
  if (course.category && (
    String(course.category).toLowerCase().includes("masterclass") ||
    String(course.category).toLowerCase().includes("paid") ||
    String(course.category).toLowerCase().includes("premium")
  )) {
    return true;
  }
  return false;
}

function isCourseUnlocked(courseId) {
  if (purchasedCourseIdsFromOrders.has(courseId)) return true;
  return false;
}

function ensureCheckoutModal() {
  if (document.getElementById("chalkboard-checkout-modal")) return;
  const modalHtml = `
    <div id="chalkboard-checkout-modal" style="display: none; position: fixed; inset: 0; z-index: 99999; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); align-items: center; justify-content: center; padding: 16px;">
      <div style="background: #2b3a32; width: 100%; max-width: 480px; border-radius: 16px; border: 1px solid rgba(242, 201, 76, 0.4); box-shadow: 0 24px 48px rgba(0,0,0,0.4); position: relative; overflow: hidden; padding: 24px; color: #f5f3ea; font-family: 'Work Sans', sans-serif;">
        <button id="checkout-close" style="position: absolute; top: 16px; right: 16px; background: rgba(242, 201, 76, 0.1); border: none; color: #f2c94c; width: 32px; height: 32px; border-radius: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px;">✕</button>
        
        <!-- STEP 1: FORM -->
        <div id="checkout-step-form">
          <div style="text-align: center; margin-bottom: 24px;">
            <div id="checkout-summary-icon" style="font-size: 48px; margin-bottom: 8px;"></div>
            <img id="checkout-summary-img" src="" alt="Course Image" style="width: 120px; height: 120px; border-radius: 12px; margin: 0 auto 12px auto; display: none; object-fit: contain; background: #1b2620; border: 2px solid rgba(242,201,76,0.3);">
            <h2 id="checkout-summary-title" style="color: #f2c94c; font-family: 'Kalam', cursive; font-size: 26px; margin: 0 0 4px 0;"></h2>
            <div id="checkout-summary-price" style="color: #10b981; font-weight: 700; font-size: 22px;"></div>
          </div>
          <form id="chalkboard-checkout-form" style="display: flex; flex-direction: column; gap: 16px;">
            <div>
              <label style="display: block; font-size: 13px; color: rgba(245,243,234,0.7); margin-bottom: 6px;">Full Name</label>
              <input type="text" id="checkout-input-name" required style="width: 100%; padding: 12px 14px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(242,201,76,0.2); color: #fff; font-size: 15px;" placeholder="John Doe">
            </div>
            <div>
              <label style="display: block; font-size: 13px; color: rgba(245,243,234,0.7); margin-bottom: 6px;">Email Address</label>
              <input type="email" id="checkout-input-email" required style="width: 100%; padding: 12px 14px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(242,201,76,0.2); color: #fff; font-size: 15px;" placeholder="john@example.com">
            </div>
            <div>
              <label style="display: block; font-size: 13px; color: rgba(245,243,234,0.7); margin-bottom: 6px;">Phone Number (WhatsApp)</label>
              <input type="tel" id="checkout-input-phone" required style="width: 100%; padding: 12px 14px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(242,201,76,0.2); color: #fff; font-size: 15px;" placeholder="+91 9876543210">
            </div>
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px dashed #10b981; padding: 12px; border-radius: 8px; margin-top: 4px;">
              <label style="display: block; font-size: 13px; color: #10b981; margin-bottom: 6px; font-weight: bold;">Pay via UPI to 9315671951@upi first, then enter the 12-digit UTR here:</label>
              <input type="text" id="checkout-input-utr" required pattern="\\d{12}" maxlength="12" minlength="12" title="Please enter exactly 12 digits" style="width: 100%; padding: 12px 14px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid #10b981; color: #fff; font-size: 15px;" placeholder="e.g. 301234567890">
            </div>
            <button id="checkout-submit-button" type="submit" style="background: #f2c94c; color: #2b3a32; font-weight: 700; font-size: 16px; padding: 14px; border-radius: 8px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; margin-top: 8px;">
              <span>⚡ Submit UTR for Verification</span><span style="font-size: 20px;">→</span>
            </button>
          </form>
        </div>

        <!-- STEP 2: SUCCESS -->
        <div id="checkout-step-success" style="display: none; text-align: center; padding: 10px 0;">
          <div style="font-size: 48px; margin-bottom: 8px;">⏳</div>
          <h2 style="color: #F2C94C; font-size: 26px; margin: 0 0 8px 0; font-family: 'Kalam', cursive;">Payment Submitted!</h2>
          <p style="color: #F5F3EA; font-size: 15px; margin-bottom: 18px;">Your UTR is under manual verification by Admin.</p>
          <div id="checkout-access-status" style="margin-top: 20px; padding: 12px 14px; background: rgba(242, 201, 76, 0.1); border: 1px solid rgba(242, 201, 76, 0.3); border-radius: 8px; font-size: 13.5px; color: #F5F3EA; text-align: left;">
            <div style="color: #F2C94C; font-weight: 700; margin-bottom: 3px;">🔒 Access Gating Enforced:</div>
            <div>Materials will unlock automatically here once the Admin verifies your UTR. Please wait.</div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", modalHtml);

  document.getElementById("checkout-close").addEventListener("click", () => {
    document.getElementById("chalkboard-checkout-modal").style.display = "none";
    activeCheckoutCourseId = null;
  });
}

window.openCheckoutModal = function(courseId) {
  ensureCheckoutModal();
  const course = cachedCourses.find(c => c.id === courseId) || PRE_EXISTING_COURSES.find(c => c.id === courseId);
  if (!course) return;

  activeCheckoutCourseId = courseId;
  const modal = document.getElementById("chalkboard-checkout-modal");
  const stepForm = document.getElementById("checkout-step-form");
  const stepSuccess = document.getElementById("checkout-step-success");
  stepForm.style.display = "block";
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

  const form = document.getElementById("chalkboard-checkout-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById("checkout-input-name").value.trim();
    const email = document.getElementById("checkout-input-email").value.trim();
    const phone = document.getElementById("checkout-input-phone").value.trim();
    const utr = document.getElementById("checkout-input-utr").value.trim();
    
    if (!/^\\d{12}$/.test(utr)) {
      alert("Please enter a valid 12-digit UTR number.");
      return;
    }

    const submitBtn = document.getElementById("checkout-submit-button");

    submitBtn.disabled = true;
    submitBtn.innerHTML = "<span>Submitting Order...</span>";

    try {
      if (!db || !currentUserUid) throw new Error("Database or User not initialized.");
      const payload = {
        name, email, phone, utrNumber: utr, uid: currentUserUid,
        courseId: course.id, courseTitle: course.title || "Course",
        amount: course.price || "₹499", status: "pending",
        isPurchased: false, purchased: false,
        createdAt: serverTimestamp()
      };
      
      const orderId = `${currentUserUid}_${course.id}`;
      await setDoc(doc(db, "course_orders", orderId), payload, { merge: true });
      
      stepForm.style.display = "none";
      stepSuccess.style.display = "block";
    } catch (err) {
      console.error(err);
      alert("Failed to submit order. Please try again.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>⚡ Submit UTR for Verification</span><span style="font-size: 20px;">→</span>`;
    }
  };

  modal.style.display = "flex";
}

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
  
  let freeHtml = "";
  let paidHtml = "";
  
  courses.forEach(course => {
    const isPaid = isCoursePaid(course);
    const hasAccess = !isPaid || isCourseUnlocked(course.id);
    const link = course.link || (course.slug ? `${course.slug}.html` : `lesson.html?course=${encodeURIComponent(course.id)}`);
    const pricing = getCoursePricingInfo(course);
    
    let btnHtml;
    if (hasAccess) {
      btnHtml = `<a href="${link}" class="go" style="color: #f2c94c; border-top: 1px dashed rgba(242, 201, 76, 0.3); padding-top: 12px; margin-top: auto; text-decoration: none; display: block;">Start Course →</a>`;
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
          <span style="font-size: 44px;">${course.icon || (isPaid ? '⭐' : '📘')}</span>
        </div>
      `;
    }

    const card = `
      <div class="class-card" style="background: #2b3a32; color: #f2c94c; border: 1px solid rgba(242, 201, 76, 0.4); box-shadow: 4px 4px 0px rgba(242, 201, 76, 0.2); border-radius: 12px; transition: transform 0.2s; padding: 20px; display: flex; flex-direction: column; position: relative;">
        ${imgHtml}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap: wrap; gap: 8px;">
          ${priceHtml}
          <span class="num" style="font-size: 12px; font-weight:700; color: #f2c94c; text-transform:uppercase; opacity: 0.8;">${course.category || "Course"}</span>
        </div>
        <h3 style="color: #f2c94c; font-family: 'Kalam', cursive; font-size: 24px; margin-top: 0;">${course.title}</h3>
        <p style="color: #e2e8f0; font-family: 'Work Sans', sans-serif; opacity: 0.9; font-size: 14px; margin-bottom: 20px;">${course.description || "Comprehensive materials."}</p>
        ${btnHtml}
      </div>
    `;
    
    if (isPaid) paidHtml += card;
    else freeHtml += card;
  });

  if (freeGrid) freeGrid.innerHTML = freeHtml || `<div style="color:white; padding: 20px;">No free courses.</div>`;
  if (paidGrid) paidGrid.innerHTML = paidHtml || `<div style="color:white; padding: 20px;">No premium courses.</div>`;
  if (homepageGrid) homepageGrid.innerHTML = paidHtml || freeHtml || `<div style="color:white; padding: 20px;">No courses available.</div>`;
}

let firestoreCourses = [];
let firestorePaidCourses = [];

function updateAndRenderMergedCourses() {
  const mergedMap = new Map();
  // Base courses first
  PRE_EXISTING_COURSES.forEach(c => mergedMap.set(c.id, c));
  
  // Override/Add Firestore courses
  firestoreCourses.forEach(c => mergedMap.set(c.id, c));
  firestorePaidCourses.forEach(c => mergedMap.set(c.id, c));
  
  cachedCourses = Array.from(mergedMap.values());
  renderCoursesUI(cachedCourses);
}

export function initRealtimeSync() {
  if (!db) return;
  try {
    onSnapshot(collection(db, "courses"), (snapshot) => {
      firestoreCourses = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.isDeleted && data.status !== "draft" && data.status !== "inactive") {
          firestoreCourses.push({ id: docSnap.id, ...data });
        }
      });
      firestoreCourses.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      updateAndRenderMergedCourses();
    });

    onSnapshot(collection(db, "paid_courses"), (snapshot) => {
      firestorePaidCourses = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.isDeleted && data.status !== "draft" && data.status !== "inactive") {
          firestorePaidCourses.push({ id: docSnap.id, ...data });
        }
      });
      firestorePaidCourses.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      updateAndRenderMergedCourses();
    });
  } catch (err) {
    console.error("Firestore Listener Setup Error:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initRealtimeSync();
});
