const express = require('express');
const multer = require('multer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs').promises;
const uuid = require('uuid');
const sharp = require('sharp');
const heicConvert = require('heic-convert');

// Import controllers
const IdUploadController = require('./app/Http/Controllers/IdUploadController');
const IdOcrJob = require('./app/Jobs/IdOcrJob');

// Import database connection
const database = require('./config/database');

// Import auth configuration
const { createAuth } = require('./auth');
const { toNodeHandler } = require('better-auth/node');
const { requireAuth } = require('./middleware/authMiddleware');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8010;

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:4200',  // Angular dev server
    'http://localhost:4350',  // Alternative frontend port
  ],
  credentials: true,  // Required for Better-Auth cookies
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use(limiter);

// Storage configuration (simulating Laravel's storage/app/uploads)
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = process.env.UPLOAD_PATH || './storage/app/uploads';
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuid.v4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter (simulating Laravel's validation)
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
    'image/heic'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, PDF, and HEIC files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  }
});

// Initialize controllers
const idUploadController = new IdUploadController();

// Auth instance (initialized after DB connection)
let auth = null;

// Lazy auth middleware - waits for auth to be initialized
const lazyRequireAuth = () => (req, res, next) => {
  if (!auth) {
    return res.status(503).json({
      success: false,
      error: 'Authentication service not initialized. Please try again.'
    });
  }
  return requireAuth(auth)(req, res, next);
};

// Routes (simulating Laravel routes/api.php)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'ID OCR API is running',
    timestamp: new Date().toISOString()
  });
});

// Better Auth routes - handles /api/auth/*
app.all('/api/auth/*', (req, res, next) => {
  if (!auth) {
    return res.status(503).json({ error: 'Auth not initialized' });
  }
  return toNodeHandler(auth)(req, res);
});

// POST /api/id/upload - Main upload endpoint
app.post('/api/id/upload',
  lazyRequireAuth(),
  upload.single('document'),
  idUploadController.upload.bind(idUploadController)
);

// GET /api/id/upload/{jobId} - Get OCR job status
app.get('/api/id/upload/:jobId/status',
  lazyRequireAuth(),
  idUploadController.getStatus.bind(idUploadController)
);

// GET /api/id/upload/{jobId} - Get OCR results
app.get('/api/id/upload/:jobId',
  lazyRequireAuth(),
  idUploadController.getResults.bind(idUploadController)
);

// POST /api/id/documents - Save/update document data
app.post('/api/id/documents',
  lazyRequireAuth(),
  idUploadController.saveDocumentData.bind(idUploadController)
);

// Error handling middleware (simulating Laravel's error handling)
app.use((error, req, res, next) => {
  console.error('Error:', error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(422).json({
        success: false,
        error: 'The file may not be greater than 10MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(422).json({
        success: false,
        error: 'Only one file may be uploaded at a time.'
      });
    }
  }

  // Validation errors
  if (error.message.includes('Invalid file type')) {
    return res.status(422).json({
      success: false,
      error: error.message
    });
  }

  // Generic error
  res.status(500).json({
    success: false,
    error: 'An internal server error occurred.'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found.'
  });
});

// Create necessary directories
const ensureDirectories = async () => {
  const directories = [
    './storage',
    './storage/app',
    './storage/app/uploads',
    './storage/app/temp',
    './storage/logs'
  ];

  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`✓ Created directory: ${dir}`);
    } catch (error) {
      // Directory might already exist
      if (error.code !== 'EEXIST') {
        console.error(`✗ Failed to create directory ${dir}:`, error.message);
      }
    }
  }
};

// Start server
const startServer = async () => {
  try {
    // Ensure directories exist
    await ensureDirectories();

    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await database.connect();

    // Initialize Better Auth after DB connection
    console.log('Initializing Better Auth...');
    auth = createAuth();
    console.log('✅ Better Auth initialized');

    // Create database indexes
    console.log('Creating MongoDB indexes...');
    await database.createIndexes();

    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    ID OCR API Server                          ║
╠══════════════════════════════════════════════════════════════╣
║ Server running on: http://localhost:${PORT}                      ║
║ Environment: ${process.env.NODE_ENV || 'development'}                  ║
║ MongoDB: Connected ✅                                        ║
║                                                              ║
║ Available endpoints:                                         ║
║  POST /api/id/upload             - Upload ID document       ║
║  GET  /api/id/upload/:id         - Get upload results       ║
║  GET  /api/id/upload/:id/status  - Get job status          ║
║  POST /api/id/documents          - Save document data       ║
║  GET  /api/health                - Health check             ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    console.error('Error details:', error.message);

    // If MongoDB connection fails, warn but continue with in-memory storage
    if (error.message && error.message.includes('MongoDB')) {
      console.warn('⚠️  Starting server without MongoDB connection');
      console.warn('⚠️  Using in-memory storage (data will be lost on restart)');

      app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    ID OCR API Server                          ║
╠══════════════════════════════════════════════════════════════╣
║ Server running on: http://localhost:${PORT}                      ║
║ Environment: ${process.env.NODE_ENV || 'development'}                  ║
║ MongoDB: Disconnected ⚠️  (using in-memory storage)          ║
╚══════════════════════════════════════════════════════════════╝
        `);
      });
    } else {
      process.exit(1);
    }
  }
};

startServer();