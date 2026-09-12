import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Serve static files with proper MIME types
app.use(express.static(__dirname, {
  extensions: ['html'],
  index: 'index.html'
}));

// Route aliases
app.get(['/admin', '/admin/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/lesson', (req, res) => {
  res.sendFile(path.join(__dirname, 'lesson.html'));
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

// Fallback to index.html if file not found
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ShortStudy server running on http://0.0.0.0:${PORT}`);
});
