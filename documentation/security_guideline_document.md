# Implementation Guide: ID Document Upload & OCR Feature

This step-by-step plan covers end-to-end implementation—frontend (Angular), backend (Laravel), Node.js OCR bridge, queues, storage, and security. Follow security best practices (least privilege, input validation, secure defaults) throughout.

---

## 1. Project Setup & Configuration

1. Create repos/services:
   • `enterprise-frontend` (Angular 14)
   • `enterprise-backend` (Laravel 11 + Passport)
   • `ocr-bridge` (Node.js 18)
2. Centralize secrets via environment variables and a secrets manager (e.g., AWS Secrets Manager).
   • Do **not** hardcode API keys, DB URIs.
   • Use `.env` files **only** in development; load real secrets in CI/CD.
3. Initialize Git with lockfiles:
   • Angular: `package-lock.json` or `yarn.lock`
   • Node: `package-lock.json`
   • Laravel: `composer.lock`
4. Enforce HTTPS in all environments.
   • Redirect HTTP → HTTPS
   • HSTS header (`Strict-Transport-Security`)

---

## 2. Backend: Laravel Service

### 2.1. Authentication & API Security

• Install and configure Laravel Passport for OAuth2.0. Protect all upload & data endpoints.
• Issue short-lived access tokens; enforce scopes (e.g., `document:upload`, `document:read`, `document:write`).
• CSRF protection is built-in for web routes; for API routes, use stateless tokens.

### 2.2. File Upload Endpoint

1. Define route:
```php
Route::middleware('auth:api')
     ->post('documents/upload', [DocumentController::class, 'upload']);
```
2. In `DocumentController@upload`:
   • Validate request:
     ```php
     $validator = Validator::make($request->all(), [
       'file' => 'required|file|mimes:jpg,png,pdf,heic|max:10240',
     ]);
     if ($validator->fails()) {
       return response()->json(['errors'=>$validator->errors()], 422);
     }
     ```
   • Store file temporarily outside `public` (e.g., `storage/app/temp`).
   • Dispatch a queued job: `ProcessDocumentJob($path, $userId)`.
   • Return job ID for client to poll status.

### 2.3. QUEUE: ProcessDocumentJob

1. Ensure queue driver is robust (Redis or database). Set `retry_after`, visibility timeout.
2. Job steps:
   a. If HEIC, send file to OCR bridge conversion endpoint (`/convert`) over HTTPS with JWT auth.
   b. Receive JPEG, save in `storage/app/temp`.
   c. Send JPEG or first page PDF to `/ocr` endpoint.
   d. Receive JSON with extracted fields.
   e. Validate extracted data (server-side) against rules:
      - Names: alphabetic only
      - State: 2-letter uppercase
      - ZIP: `/^\d{5}(-\d{4})?$/`
      - DOB: valid past date
   f. Store cleaned data in MongoDB (using `jenssegers/mongodb` package).
   g. Delete temp files.
   h. Update job status (e.g., in `jobs` table or a dedicated `document_jobs` collection).

### 2.4. Status & Result Endpoints

• `GET /documents/status/{jobId}` → returns `{ status: pending|processing|complete|failed, data?: {...} }`.
• Secure with Passport; enforce user-job ownership.

---

## 3. OCR Bridge: Node.js Service

### 3.1. Setup & Auth

1. Initialize Express app.
2. Validate incoming JWT from Laravel using shared secret or public key.
3. Rate limit endpoints (e.g., `express-rate-limit`).
4. Accept only `multipart/form-data` for `/convert`; only JSON or base64 for `/ocr`.

### 3.2. HEIC Conversion (`POST /convert`)

1. Use `heic-convert`:
   ```js
   const outputBuffer = await convert({
     buffer: inputBuffer,
     format: 'JPEG',
     quality: 0.9
   });
   ```
2. Return JPEG buffer.

### 3.3. OCR (`POST /ocr`)

1. Validate file size and content type in middleware.
2. Call Anthropic API via official SDK:
   ```js
   const {Anthropic} = require('@anthropic-ai/sdk');
   const client = new Anthropic(process.env.ANTHROPIC_API_KEY);
   const response = await client.completions.create({
     prompt: buildPrompt(imageBase64),
     model: 'ocr-model',
     max_tokens: 512,
   });
   ```
3. Parse and structure fields; return JSON:
   ```json
   { "LastName":"Doe", "FirstName":"John", … }
   ```

---

## 4. Frontend: Angular Module

### 4.1. Module & Routing

• Create `DocumentsModule` lazy-loaded at `/upload-id`.
• Secure route with a guard that checks Passport token existence.

### 4.2. UploadPanel Component

1. File input accepts: `accept="image/jpeg,image/png,application/pdf,image/heic"`.
2. Pre-validate size: `<input (change)="onFileSelected($event)" />`.
3. Use `ngx-image-compress` for JPG/PNG >2MB.
4. Show preview:
   • Images: `<img [src]="dataUrl" />`
   • PDF: `<ng2-pdf-viewer [src]="fileBlob" [page]="1"></ng2-pdf-viewer>`.
5. On “Upload”:
   • Disable button, show progress bar (Angular Material ProgressBar).
   • POST `FormData` to `documents/upload`; attach Authorization header.
   • On success, begin polling `/documents/status/{jobId}` every 2s.

### 4.3. DataForm Component

1. Build a reactive form with validators:
   ```ts
   this.form = this.fb.group({
     LastName: ['',[Validators.required, Validators.pattern(/^[A-Za-z]+$/)]],
     FirstName: ['',[Validators.required, Validators.pattern(/^[A-Za-z]+$/)]],
     MiddleInitial: ['',[Validators.required, Validators.pattern(/^[A-Za-z]$/)]],
     AddressStreet: ['',[Validators.required, Validators.pattern(/^[A-Za-z0-9 .,'-]+$/)]],
     AddressCity: ['',[Validators.required, Validators.pattern(/^[A-Za-z ]+$/)]],
     AddressState: ['',[Validators.required, Validators.pattern(/^[A-Z]{2}$/)]],
     AddressZip: ['',[Validators.required, Validators.pattern(/^\d{5}(-\d{4})?$/)]],
     Sex: ['',[Validators.required, Validators.pattern(/^(M|F|X)$/)]],
     DOB: ['',[Validators.required, dobValidator]]
   });
   ```
2. Disable fields until OCR completes; show spinner.
3. Inline error messages under each field.
4. Buttons:
   • **Edit**: enable fields
   • **Save**: POST to `/documents/{id}` with Bearer token
5. On success/failure: use Angular Material snackbars.

---

## 5. Data Persistence & Cleanup

• Use MongoDB with a scoped user account (`least privilege`).
• Collections:
  - `documents`: store userId, extractedData, timestamps.
  - `document_jobs`: track status.
• Index on `userId`, `jobId` for fast lookups.
• After successful save, purge any temp data associated with that job.

---

## 6. Security Hardening

• Enable CSP, X-Frame-Options, X-Content-Type-Options via server headers.
• Secure cookies (HttpOnly, Secure, SameSite=Strict).
• Strict CORS: only allow enterprise front-end origin.
• Validate all inputs server-side; encode outputs.
• Fail securely: catch exceptions in controllers/jobs; return generic error messages.

---

## 7. Testing & Deployment

1. **Unit Tests**
   • Angular: cover components, services, form validators.
   • Laravel: test controllers, validation rules, jobs.
   • Node: test conversion and OCR endpoints (mock Anthropic).
2. **Integration Tests**
   • Full flow: upload → queue → OCR → form → save.
3. **Security Scans**
   • SCA tooling (Dependabot, Snyk) on all repos.
   • Static analysis (PHPStan, ESLint).
4. **CI/CD**
   • Build pipelines enforce linting, tests, security scans.
   • Deploy via containers/Helm with secrets injected at runtime.
   • Monitor logs; set alerts for job failures or high error rates.

---

By following this structured guide and embedding security at every layer, you’ll deliver a robust, compliant ID document upload & OCR feature that integrates cleanly with your enterprise application.  

Good luck!