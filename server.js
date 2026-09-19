import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize GoogleGenAI lazily
let aiInstance = null;
function getAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: key });
  }
  return aiInstance;
}

// 301 Redirect from /index.html to / to eliminate duplicate page penalties
app.get('/index.html', (req, res) => {
  res.redirect(301, '/');
});

// Explicit route aliases (mounted before static to prevent directory redirect delays)
app.get(['/programming', '/programming.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'programming.html'));
});

app.get(['/admin', '/admin/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get(['/lesson', '/lesson/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'lesson.html'));
});

app.get(['/programming-videos', '/programming-videos/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'programming-videos.html'));
});

// Robots.txt & Sitemap.xml with strict MIME types
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.sendFile(path.join(__dirname, 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

// Endpoint to retrieve Firebase Web configuration (supports environment variables)
app.get('/api/firebase-config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCtg7gLeHbl1uSIrxx6laxBdxx4zVQP4CQ",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "shortstudy-de7d4.firebaseapp.com",
    projectId: process.env.FIREBASE_PROJECT_ID || "shortstudy-de7d4",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "shortstudy-de7d4.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "766812137638",
    appId: process.env.FIREBASE_APP_ID || "1:766812137638:web:c6fdff7b473170cd116c67"
  });
});

// Endpoint to update Firebase Web API Key dynamically
app.post('/api/save-firebase-key', (req, res) => {
  const { apiKey } = req.body || {};
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim().startsWith('AIzaSy')) {
    return res.status(400).json({ success: false, error: 'Invalid Google Cloud API key format. Key must begin with AIzaSy.' });
  }

  const cleanKey = apiKey.trim();
  const configPath = path.join(__dirname, 'assets', 'js', 'firebase-config.js');
  
  try {
    let currentConfig = fs.readFileSync(configPath, 'utf8');
    const updatedConfig = currentConfig.replace(/apiKey:\s*"[^"]*"/, `apiKey: "${cleanKey}"`);
    fs.writeFileSync(configPath, updatedConfig, 'utf8');
    return res.json({ success: true, message: 'Firebase API key updated successfully on server.' });
  } catch (err) {
    console.error('Error writing firebase-config.js:', err);
    return res.status(500).json({ success: false, error: 'Failed to write updated key to disk.' });
  }
});

// Helper for persistent JSON data access
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJsonFile(filename, defaultValue = []) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content || '[]');
  } catch (e) {
    console.error(`Error reading ${filename}:`, e);
    return defaultValue;
  }
}

function writeJsonFile(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(`Error writing ${filename}:`, e);
    return false;
  }
}

// REST endpoints for Paid Video Courses (Cross-Device & Multi-Tab Persistence)
app.get('/api/paid-courses', (req, res) => {
  const courses = readJsonFile('paid-courses.json', []);
  res.json({ success: true, courses });
});

app.post('/api/paid-courses', (req, res) => {
  const course = req.body;
  if (!course || !course.title) {
    return res.status(400).json({ success: false, error: 'Course title is required.' });
  }
  const id = course.id || ('paid-' + Date.now());
  const courseWithId = { ...course, id, updatedAt: new Date().toISOString() };

  const courses = readJsonFile('paid-courses.json', []);
  const idx = courses.findIndex(c => c.id === id);
  if (idx !== -1) {
    courses[idx] = { ...courses[idx], ...courseWithId };
  } else {
    courses.unshift(courseWithId);
  }
  writeJsonFile('paid-courses.json', courses);
  res.json({ success: true, course: courseWithId, count: courses.length });
});

app.delete('/api/paid-courses/:id', (req, res) => {
  const id = req.params.id;
  let courses = readJsonFile('paid-courses.json', []);
  courses = courses.filter(c => c.id !== id);
  writeJsonFile('paid-courses.json', courses);
  res.json({ success: true, message: 'Deleted successfully' });
});

// REST endpoints for Curriculum Courses
app.get('/api/courses', (req, res) => {
  const courses = readJsonFile('courses.json', []);
  res.json({ success: true, courses });
});

app.post('/api/courses', (req, res) => {
  const course = req.body;
  if (!course || !course.title) {
    return res.status(400).json({ success: false, error: 'Course title is required.' });
  }
  const id = course.id || ('course-' + Date.now());
  const courseWithId = { ...course, id, updatedAt: new Date().toISOString() };

  const courses = readJsonFile('courses.json', []);
  const idx = courses.findIndex(c => c.id === id);
  if (idx !== -1) {
    courses[idx] = { ...courses[idx], ...courseWithId };
  } else {
    courses.push(courseWithId);
  }
  writeJsonFile('courses.json', courses);
  res.json({ success: true, course: courseWithId });
});

app.delete('/api/courses/:id', (req, res) => {
  const id = req.params.id;
  let courses = readJsonFile('courses.json', []);
  courses = courses.filter(c => c.id !== id);
  writeJsonFile('courses.json', courses);
  res.json({ success: true, message: 'Deleted successfully' });
});

// =========================================================
// QUIZ GENERATION ENDPOINTS
// =========================================================

// Express AI Endpoint for Dynamic Quiz Generation
app.post('/api/ai/generate-quiz', async (req, res) => {
  const { language = 'Python', count = 10 } = req.body || {};
  const ai = getAI();

  if (!ai) {
    return res.status(503).json({ success: false, error: 'Gemini API key not configured on server.' });
  }

  try {
    const prompt = `Generate exactly ${count} multiple-choice questions for ${language} programming/CS concepts suitable for student testing.
Return ONLY a valid JSON array of objects with no markdown code blocks or extra text.
Each object MUST have:
- "q": question string
- "options": array of 4 distinct answer string choices
- "correct": integer index (0, 1, 2, or 3) of the correct choice.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt
    });

    let rawText = (response.text || '').trim();
    if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    const questions = JSON.parse(rawText);
    if (Array.isArray(questions) && questions.length > 0) {
      return res.json({ success: true, questions });
    }
    return res.status(500).json({ success: false, error: 'Invalid JSON format from AI.' });
  } catch (err) {
    console.error('Error generating AI quiz:', err);
    return res.status(500).json({ success: false, error: 'AI Quiz generation failed.' });
  }
});

// Legacy path aliases for scripts & assets
app.get('/js/script.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'script.js'));
});

app.get('/logo.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'logo.png'));
});

// Health check endpoints for Cloud Run & load balancer readiness/liveness probes
app.get(['/health', '/healthz', '/api/health', '/_health'], (req, res) => {
  res.status(200).send('OK');
});

// Serve static files with proper MIME types
app.use(express.static(__dirname, {
  extensions: ['html'],
  index: 'index.html'
}));

// Clean 404 handler with HTTP 404 status code (eliminates soft 404s)
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`ShortStudy server running on http://0.0.0.0:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully...');
  server.close(() => {
    console.log('Server closed successfully.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server gracefully...');
  server.close(() => {
    console.log('Server closed successfully.');
    process.exit(0);
  });
});

