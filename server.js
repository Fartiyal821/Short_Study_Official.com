import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

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

// Fallback to index.html if file not found
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ShortStudy server running on http://0.0.0.0:${PORT}`);
});
