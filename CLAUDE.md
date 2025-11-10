# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **ID Document Upload & OCR Processing System** with:
- **Frontend**: Angular 14.2.x with Material UI (TypeScript 4.7.2)
- **Backend**: Node.js/Express with Laravel-inspired architecture
- **Database**: MongoDB with Mongoose ODM
- **OCR**: Anthropic AI API integration for identity document field extraction

## Essential Commands

### Frontend (Angular)
```bash
cd frontend
npm install --legacy-peer-deps    # Install dependencies
npm start                          # Start dev server (http://localhost:4200)
npm run build                      # Production build
npm test                           # Run Karma/Jasmine tests
ng serve                           # Alternative to npm start
```

### Backend (Node.js/Express)
```bash
cd backend
npm install --legacy-peer-deps    # Install dependencies
npm start                          # Start server (port 8000 by default)
npm run dev                        # Start with nodemon (auto-reload)
npm test                           # Run Jest tests
```

### Environment Setup
```bash
# Backend setup
cd backend
cp .env.example .env
# Edit .env to add ANTHROPIC_API_KEY and MONGODB_URI

# MongoDB (must be running)
mongod                             # Start MongoDB locally
# Or use MongoDB connection string in .env
```

## Architecture Overview

### Backend Structure (Laravel-Inspired)
The backend follows Laravel's directory conventions:

```
backend/
├── app/
│   ├── Http/Controllers/    # Request handlers (IdUploadController.js)
│   ├── Jobs/                 # Async job processors (IdOcrJob.js)
│   └── Models/               # Mongoose schemas (IdentityDocument.js)
├── config/
│   └── database.js           # MongoDB connection config
├── storage/app/uploads/      # File upload directory (auto-created)
└── server.js                 # Express app entry point
```

**Key Architectural Patterns:**
- **Controllers**: Handle HTTP requests, validation, and responses (e.g., `IdUploadController`)
- **Jobs**: Asynchronous OCR processing via `IdOcrJob` (uses in-memory Map; production should use Redis/Bull)
- **Models**: Mongoose schemas define MongoDB collections (e.g., `IdentityDocument`)
- **Middleware**: Auth simulation, rate limiting, CORS, Helmet security headers

### Frontend Structure (Angular)
```
frontend/src/app/
├── upload-page/              # Main container component (two-panel layout)
├── upload-panel/             # File upload, compression, preview
├── data-form/                # Reactive form for OCR data display/editing
└── services/
    └── api.service.ts        # HTTP client for backend API calls
```

**Key Patterns:**
- **Two-Panel Layout**: Upload/preview (left) + Form data (right)
- **Reactive Forms**: Angular FormBuilder with validation
- **Status Polling**: RxJS timer for real-time OCR job status updates
- **File Processing**: Client-side compression (>5MB), HEIC-to-JPEG conversion

### API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/id/upload` | Upload document, start OCR job |
| GET | `/api/id/upload/:jobId/status` | Poll OCR job status |
| GET | `/api/id/upload/:jobId` | Get OCR results |
| GET | `/api/health` | Health check |

**Authentication:** Currently simulated with Bearer token check (see `server.js:95-103`)

### File Processing Flow
1. **Upload** → Validation (type, size) → Storage → HEIC conversion (if needed)
2. **OCR Job** → Anthropic API call → Field extraction → MongoDB persistence
3. **Frontend** → Status polling → Form pre-fill → User review/edit → Save

### Database Schema (MongoDB)
The `IdentityDocument` model stores:
- **Job Tracking**: `jobId` (unique), `status` (pending/processing/completed/failed)
- **File Info**: `filePath`, `originalFileName`, `fileSize`, `mimeType`
- **OCR Data**: `extractedData` object with confidence scores per field
- **Fields Extracted**: lastName, firstName, middleInitial, addressStreet, addressCity, addressState, addressZip, sex, dob

## Key Technologies

### Frontend
- **Angular 14.2.x** with TypeScript 4.7.2
- **Angular Material** for UI components
- **RxJS 7.5** for reactive programming
- **ng2-pdf-viewer** for PDF preview
- **ngx-image-compress** for client-side compression

### Backend
- **Node.js 18+** with Express.js
- **Multer** for file uploads (diskStorage)
- **Sharp** for image processing
- **heic-convert** for HEIC-to-JPEG conversion
- **Mongoose** for MongoDB ODM
- **Joi** for validation
- **Helmet** + **CORS** for security

## Important Configuration

### File Upload Limits
- **Max Size**: 10MB (configurable via `MAX_FILE_SIZE` in `.env`)
- **Accepted Formats**: JPG, PNG, PDF, HEIC
- **Auto-Compression**: Files >5MB are compressed client-side

### Environment Variables (backend/.env)
```env
NODE_ENV=development
PORT=8000
MAX_FILE_SIZE=10485760              # 10MB in bytes
ANTHROPIC_API_KEY=sk-ant-...        # Required for OCR
MONGODB_URI=mongodb://localhost:27017/id_ocr_db
UPLOAD_PATH=./storage/app/uploads   # File storage location
```

## Development Workflow

### Running Both Services
```bash
# Terminal 1 - Backend
cd backend && npm start

# Terminal 2 - Frontend
cd frontend && npm start

# Navigate to http://localhost:4200
```

### Testing Without API Key
The backend includes mock OCR responses for testing without an Anthropic API key. Check `IdOcrJob.js` for mock data logic.

### File Storage
Uploaded files are stored in `backend/storage/app/uploads/`. Each file gets a UUID-based unique name. HEIC files are converted to JPEG and the original HEIC is removed.

## Common Development Tasks

### Adding New OCR Fields
1. Update `IdentityDocument.js` schema (`extractedData` object)
2. Modify `IdOcrJob.js` extraction logic (prompt + parsing)
3. Update frontend `api.service.ts` interfaces (`JobResults.extracted_data`)
4. Add form controls in `data-form.component.ts`

### Modifying Upload Validation
- File type/size validation: `server.js` (fileFilter, multer limits)
- Frontend validation: `upload-panel.component.ts`

### Changing API Endpoints
- Backend routes: `server.js` (lines 92-150)
- Frontend API calls: `api.service.ts`

## Security Considerations

- **Rate Limiting**: 100 requests per 15 minutes per IP (configurable)
- **File Validation**: Type and size checks on both client and server
- **HEIC Conversion**: Server-side to prevent malicious files
- **Authentication**: Currently simulated; integrate with Laravel Passport or JWT in production
- **Secrets**: Never commit `.env` files (use `.env.example` template)

## Documentation

Additional documentation is available in the `documentation/` directory:
- `project_requirements_document.md` - Full feature requirements
- `backend_structure_document.md` - Detailed backend architecture
- `frontend_guidelines_document.md` - Frontend patterns and styling
- `security_guideline_document.md` - Security best practices
- `tech_stack_document.md` - Technology choices and rationale
- `app_flow_document.md` - User flow and state transitions

## Task Management

This project uses a custom task-manager CLI for tracking work. See instructions below.

### Task Management Workflow

#### Discover Tasks
```bash
task-manager list-tasks
```

#### Start a Task
```bash
task-manager start-task <task_id>
```

#### Complete or Cancel a Task
```bash
task-manager complete-task <task_id> "Description of what was implemented"
# or
task-manager cancel-task <task_id> "Reason for cancellation"
```

**Task Workflow Rules:**
1. Always list tasks first
2. Mark task as started before implementation
3. Complete one task fully before starting the next
4. Provide completion details when marking complete
5. Use cancel for tasks that are not required or cannot be completed

Task files are located in `documentation/tasks/` directory.
