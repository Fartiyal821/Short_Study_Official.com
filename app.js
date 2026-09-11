import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore, collection, addDoc, doc, setDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const apiKey = globalThis.apiKey || "";
const firebaseConfig = { apiKey, authDomain: "shortstudy-de7d4.firebaseapp.com", projectId: "shortstudy-de7d4", storageBucket: "shortstudy-de7d4.firebasestorage.app", messagingSenderId: "766812137638", appId: "1:766812137638:web:c6fdff7b473170cd116c67" };
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export { collection, addDoc, doc, setDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, signInWithEmailAndPassword, onAuthStateChanged, signOut };

export const slugify = (value) => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
export const cleanEmbed = (value) => { const html = String(value || '').trim(); if (!html) return ''; const parsed = new DOMParser().parseFromString(html, 'text/html'); const iframe = parsed.querySelector('iframe'); if (!iframe || !/^https:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\//i.test(iframe.src)) throw new Error('Use a YouTube embed iframe URL.'); return iframe.outerHTML; };
export const subscribePublishedCourses = (callback, onError) => onSnapshot(query(collection(db, 'courses'), where('status', '==', 'published'), orderBy('title')), callback, onError);
export const subscribeAllCourses = (callback, onError) => onSnapshot(query(collection(db, 'courses'), orderBy('title')), callback, onError);
export const subscribePosts = (courseId, callback, onError) => onSnapshot(query(collection(db, 'posts'), where('courseId', '==', courseId), orderBy('publishedAt', 'desc')), callback, onError);
export const canonicalOrigin = 'https://shortstudy.in';
export const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));

export function courseCard(course) { const disabled = course.status !== 'published'; return `<article class="class-card dynamic-course-card ${disabled ? 'is-development' : ''}"><span class="num">${escapeHTML(course.category || 'COURSE')}</span><h3>${escapeHTML(course.title)}</h3><p>${escapeHTML(course.description || 'A focused ShortStudy learning path.')}</p><span class="course-status">${disabled ? 'In development' : 'Published'}</span>${disabled ? '<span class="go muted">Coming soon</span>' : `<a class="go" href="lesson.html?course=${encodeURIComponent(course.courseId)}">Open course</a>`}</article>`; }

export function renderLesson(course, posts, root) { document.title = `${course.title} — ShortStudy`; const first = posts[0]; root.innerHTML = `<div class="lesson-shell"><div class="lesson-heading"><span class="kicker">${escapeHTML(course.category || 'Course')}</span><h1>${escapeHTML(course.title)}</h1><p>${escapeHTML(course.description || '')}</p></div>${first ? `<div class="lesson-video">${cleanEmbed(first.videoIframe)}</div><article class="lesson-content"><h2>${escapeHTML(first.title)}</h2><div class="rich-content">${first.content || '<p>This lesson is being prepared.</p>'}</div><p class="lesson-author">Written by ${escapeHTML(first.author || 'ShortStudy')}</p></article>` : '<div class="empty-state">Lessons are being prepared for this course.</div>'}</div>`; }

const catalog = document.querySelector('[data-course-catalog]');
if (catalog) subscribePublishedCourses((snapshot) => { catalog.innerHTML = snapshot.empty ? '<div class="empty-state">Courses are being prepared. Check back soon.</div>' : snapshot.docs.map((item) => courseCard({ id:item.id, ...item.data() })).join(''); }, () => { catalog.innerHTML = '<div class="empty-state">Course catalog is temporarily unavailable.</div>'; });

const lessonRoot = document.querySelector('[data-lesson-root]');
if (lessonRoot) { const params = new URLSearchParams(location.search); const courseId = params.get('course'); if (courseId) onSnapshot(doc(db, 'courses', courseId), (courseSnap) => { if (!courseSnap.exists() || courseSnap.data().status !== 'published') { lessonRoot.innerHTML = '<div class="empty-state">This course is not published yet.</div>'; return; } subscribePosts(courseId, (postsSnap) => renderLesson({ id:courseSnap.id, ...courseSnap.data() }, postsSnap.docs.map((item) => ({ id:item.id, ...item.data() })), lessonRoot), () => { lessonRoot.innerHTML = '<div class="empty-state">Lessons are temporarily unavailable.</div>'; }); }); else lessonRoot.innerHTML = '<div class="empty-state">Choose a course from the catalog.</div>'; }

export { app }; 

// Admin exports are intentionally available through the same browser-safe module.
export const authHelpers = { signInWithEmailAndPassword, onAuthStateChanged, signOut };

