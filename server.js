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

// =========================================================
// FIREBASE AI LOGIC & DOUBT SOLVER ENDPOINTS
// =========================================================

// Express AI Endpoint for Floating Doubt Solver
app.post('/api/ai/doubt-solver', async (req, res) => {
  const { topic = 'General Programming', question = '', pageInfo = {} } = req.body || {};
  const query = question.trim();

  if (!query) {
    return res.status(400).json({ success: false, error: 'Question text is required.' });
  }

  // Strict Rule 1: DEVELOPER IDENTITY
  const devPatterns = /(who (built|made|created|developed|is the developer|is the creator|designed|wrote|owns) (this|the)? (website|site|app|platform|shortstudy)|developer name|who built this|who made this)/i;
  if (devPatterns.test(query)) {
    return res.json({ success: true, answer: "Gaurav Fartiyal" });
  }

  // Strict Rule 2: PRIVATE DATA PROTECTION
  const privatePatterns = /(private|secret|password|credential|backend|database|user data|admin|order log|transaction ledger|payment details|user account|firestore rule|env var)/i;
  if (privatePatterns.test(query)) {
    return res.json({ success: true, answer: "Sorry, The content is not publicly available." });
  }

  const ai = getAI();
  if (!ai) {
    // Fallback response if GEMINI_API_KEY environment variable is not configured yet
    return res.json({
      success: true,
      answer: `ShortStudy AI Tutor (${topic}): To get instant live responses powered by Gemini AI, please configure GEMINI_API_KEY in server environment variables. For now: '${query}' is a great question! Check out our detailed curriculum notes on the site for full code examples.`
    });
  }

  try {
    const pageContextText = pageInfo.title 
      ? `Current Page: ${pageInfo.title}\nPage Menu/Sections: ${Array.isArray(pageInfo.headings) ? pageInfo.headings.join(', ') : ''}`
      : `Topic Context: ${topic}`;

    const systemInstruction = `You are ShortStudy AI Tutor for ShortStudy (https://shortstudy.in/).
STRICT GUARDRAILS:
1. DEVELOPER IDENTITY: If asked "Who is the developer?", "Who built this website?", or variations, respond STRICTLY: "Gaurav Fartiyal".
2. PRIVATE DATA PROTECTION: If asked about personal/private/backend data, database, order logs, or admin secrets, respond STRICTLY: "Sorry, The content is not publicly available.".
3. CONTEXT & COMPREHENSIVE TEACHING: Provide complete, accurate, and easy-to-understand explanations with full code examples in markdown. Never truncate code blocks or leave answers half-finished. Tailor explanations to the current page and topic context.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      config: {
        systemInstruction,
        maxOutputTokens: 1500,
        temperature: 0.3
      },
      contents: [
        { role: 'user', parts: [{ text: `${pageContextText}\nStudent Question: ${query}` }] }
      ]
    });

    const text = response.text || "I couldn't generate a response. Please rephrase your question.";
    return res.json({ success: true, answer: text });
  } catch (err) {
    console.error('Error calling Gemini API for doubt solver:', err);
    return res.json({
      success: true,
      answer: `ShortStudy AI Tutor (${topic}): '${query}' - Here is a quick hint: review the code examples and concepts covered on our ${topic} curriculum page! (AI service momentarily busy).`
    });
  }
});

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

// Serve static files with proper MIME types
app.use(express.static(__dirname, {
  extensions: ['html'],
  index: 'index.html'
}));

// Clean 404 handler with HTTP 404 status code (eliminates soft 404s)
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ShortStudy server running on http://0.0.0.0:${PORT}`);
});
