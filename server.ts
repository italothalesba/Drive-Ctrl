import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import checkDiskSpace from 'check-disk-space';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
// Default to F:\ for the user, but fallback to ./data for safety in this env
const STORAGE_ROOT = path.resolve(process.env.STORAGE_ROOT || 'F:\\');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';

// Ensure storage root exists
if (!existsSync(STORAGE_ROOT)) {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
}

const app = express();
app.use(cors());
app.use(express.json());

// Auth Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Safe Path Helper
const getSafePath = (relativePath: string = '') => {
  const resolvedPath = path.resolve(STORAGE_ROOT, relativePath);
  if (!resolvedPath.startsWith(STORAGE_ROOT)) {
    throw new Error('Access denied: Path outside storage root');
  }
  return resolvedPath;
};

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
  }
  
  res.status(401).json({ message: 'Invalid credentials' });
});

// File Management Routes
app.get('/api/files', authenticateToken, async (req, res) => {
  try {
    const relativePath = (req.query.path as string) || '';
    const safePath = getSafePath(relativePath);
    
    const stats = await fs.stat(safePath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ message: 'Path is not a directory' });
    }

    const files = await fs.readdir(safePath);
    const items = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(safePath, file);
        const fileStats = await fs.stat(filePath);
        return {
          name: file,
          isDirectory: fileStats.isDirectory(),
          size: fileStats.size,
          updatedAt: fileStats.mtime,
          extension: path.extname(file).toLowerCase().replace('.', '')
        };
      })
    );

    res.json({
      currentPath: relativePath,
      items: items.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
      })
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/mkdir', authenticateToken, async (req, res) => {
  try {
    const { currentPath, folderName } = req.body;
    const safePath = getSafePath(path.join(currentPath, folderName));
    await fs.mkdir(safePath, { recursive: true });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/delete', authenticateToken, async (req, res) => {
  try {
    const { targetPath } = req.body;
    const safePath = getSafePath(targetPath);
    await fs.rm(safePath, { recursive: true, force: true });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/rename', authenticateToken, async (req, res) => {
  try {
    const { oldPath, newName } = req.body;
    const oldSafePath = getSafePath(oldPath);
    const newSafePath = path.join(path.dirname(oldSafePath), newName);
    
    // Safety check for new path
    if (!newSafePath.startsWith(STORAGE_ROOT)) {
       throw new Error('Access denied: Target path outside storage root');
    }

    await fs.rename(oldSafePath, newSafePath);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Upload Setup
const storage = multer.diskStorage({
  destination: (req: any, file, cb) => {
    const folderPath = req.query.folderPath || '';
    try {
      const safePath = getSafePath(folderPath);
      cb(null, safePath);
    } catch (error: any) {
      cb(error, '');
    }
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

app.post('/api/upload', authenticateToken, upload.array('files'), (req, res) => {
  res.json({ success: true });
});

// Storage Info Route
app.get('/api/storage-info', authenticateToken, async (req, res) => {
  try {
    const diskSpace = await checkDiskSpace(STORAGE_ROOT);
    res.json({
      total: diskSpace.size,
      free: diskSpace.free,
      used: diskSpace.size - diskSpace.free,
      label: path.parse(STORAGE_ROOT).root
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Recent Files Route (Scan recursively, limited to 50 items for performance)
app.get('/api/recent-files', authenticateToken, async (req, res) => {
  try {
    const allFiles: any[] = [];
    
    async function scan(dir: string, relativeDir: string = '') {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (allFiles.length > 200) break; // Limit scan for performance
        const fullPath = path.join(dir, file);
        const relPath = path.join(relativeDir, file);
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          // Skip system folders
          if (file.startsWith('.')) continue;
          await scan(fullPath, relPath);
        } else {
          allFiles.push({
            name: file,
            path: relPath.replace(/\\/g, '/'),
            isDirectory: false,
            size: stats.size,
            updatedAt: stats.mtime,
            extension: path.extname(file).toLowerCase().replace('.', '')
          });
        }
      }
    }

    await scan(STORAGE_ROOT);
    
    const sorted = allFiles
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 50);

    res.json(sorted);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Download & Stream
app.get('/api/download', authenticateToken, (req, res) => {
  try {
    const filePath = req.query.path as string;
    const safePath = getSafePath(filePath);
    res.download(safePath);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/preview', (req, res) => {
  try {
    const token = req.query.token as string;
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any) => {
      if (err) return res.sendStatus(403);
      
      const filePath = req.query.path as string;
      const safePath = getSafePath(filePath);
      
      // Set appropriate content type based on extension
      const ext = path.extname(safePath).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
      };
      
      if (contentTypes[ext]) {
        res.setHeader('Content-Type', contentTypes[ext]);
      }

      res.sendFile(safePath);
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/stream', authenticateToken, async (req, res) => {
  try {
    const filePath = req.query.path as string;
    const safePath = getSafePath(filePath);
    const stat = await fs.stat(safePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = createReadStream(safePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4', // Default to mp4, can be improved
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      createReadStream(safePath).pipe(res);
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Vite Integration
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
