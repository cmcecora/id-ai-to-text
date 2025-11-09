# Unified Project Document

## 1. Project Overview

We are implementing a self-contained, enterprise-ready feature that enables authenticated users to upload a single identity document (driver’s license or state-issued ID) in JPG, PNG, PDF or HEIC format, extract key text fields via an AI-powered OCR (Anthropic API), and review/edit before saving. This streamlines data entry, reduces errors, and integrates smoothly into a larger Angular + Laravel ecosystem.

## 2. In-Scope vs Out-of-Scope (v1)

**In-Scope:**

*   Single-document upload (JPG, PNG, PDF, HEIC) up to 10 MB
*   Client-side image compression with **ngx-image-compress**
*   Preview: `<img>` for images, first page of PDFs via **ng2-pdf-viewer**
*   Server-side HEIC→JPEG conversion with **heic-convert**
*   AI-powered OCR on first page only (Anthropic via Node bridge)
*   Editable data form with inline validation and Save/Edit workflow
*   Persist data to MongoDB via Mongoose
*   Async processing using Laravel queue workers
*   Secure endpoints protected by Laravel Passport
*   Robust loading states, inline errors, global snackbars

**Out-of-Scope:**

*   Multi-page PDF processing
*   Audit trail or version history
*   Long-term file storage or archival policies
*   SMS-based upload flow (future extension)
*   Role-based permissions beyond existing enterprise auth
*   Cloud storage (e.g., S3) for v1

## 3. User Flow & App Structure

1.  **Navigate to Identity Documents**\
    User selects “Identity Documents” from the sidebar; a two-panel upload page appears.

2.  **Upload Panel (Left)**

    *   Drag-and-drop or browse for a single file (JPG, PNG, PDF, HEIC; ≤ 10 MB).
    *   Inline error if file type unsupported or size exceeded.
    *   Client-side compression if image > threshold.
    *   Preview: image renders in `<img>`, PDF first page via ng2-pdf-viewer.
    *   “Upload” button becomes active once preview is shown.

3.  **Server Processing & OCR**

    *   POST `/api/documents/upload` with Laravel Passport token.
    *   Temporarily store file and convert HEIC→JPEG if needed.
    *   Enqueue OCR job; frontend polls `/api/documents/status/{jobId}`.
    *   On network failure, pause polling, show snackbar, resume on reconnect.

4.  **Data Form Panel (Right)**

    *   When OCR completes, form inputs populate with:\
        `LastName`, `FirstName`, `MiddleInitial`, `AddressStreet`, `AddressCity`, `AddressState`, `AddressZip`, `Sex`, `DOB`.
    *   Inline validation rules:\
        • Names: required, alphabetic (MiddleInitial = single letter).\
        • AddressStreet: required, alphanumeric + punctuation.\
        • AddressCity: required, alphabetic + spaces.\
        • AddressState: valid two-letter US code.\
        • AddressZip: 5-digit or 5+4 format.\
        • Sex: ‘M’, ‘F’, or ‘X’.\
        • DOB: valid past date in MM-DD-YYYY.
    *   “Save” disabled until all fields valid.

5.  **Save & Edit Workflow**

    *   On “Save”, disable form, show spinner, POST to `/api/documents/{documentId}` to persist in MongoDB.
    *   On success: show snackbar “Identity information saved”, lock fields, swap to “Edit” button.
    *   On “Edit”, unlock fields; repeat save cycle as needed.
    *   On revisit: fetch stored JPEG preview from `/uploads` and pre-fill locked form.

6.  **Navigation & Settings**

    *   Users access Settings via avatar: Profile, Security, Notifications tabs.
    *   Inline validation and snackbars for saving user preferences.

## 4. Core Features

*   **File Upload & Preview**\
    Drag-drop or browse, client-side compression, inline errors, image/PDF preview.
*   **AI-Powered OCR**\
    Node.js bridge → Anthropic API; extract nine key fields; queue workers for async.
*   **Dynamic Data Form**\
    Angular Material + shadcn/ui; editable inputs with strict validation; Save/Edit toggle.
*   **Persistence & Security**\
    Laravel Passport auth; MongoDB via Mongoose; local temp storage (deleted post-OCR).
*   **Feedback & Resilience**\
    Angular Material snackbars for status; spinners, disabled states; polling with back-off.

## 5. Tech Stack & Tools

**Frontend:**

*   Angular 14.2.x, TypeScript 4.6.4, RxJS 6
*   Angular Material UI, shadcn/ui
*   ng2-pdf-viewer (PDF preview)
*   ngx-image-compress (client-side compression)

**Backend:**

*   Laravel 11 (PHP 8.4) + Laravel Passport
*   Node 18.20.6 bridge for Anthropic OCR
*   Guzzle 7 (HTTP client)
*   heic-convert library
*   Laravel queue workers

**Database & Storage:**

*   MongoDB via Mongoose
*   Local temp folder for v1 file uploads (auto-deleted)

**AI/ML:**

*   Anthropic AI SDK for OCR

## 6. Non-Functional Requirements

*   Performance: upload + OCR ≤ 10 s for a 2 MB JPEG; spinners show within 200 ms
*   Security: HTTPS, JWT/OAuth via Passport, immediate temp file deletion
*   Usability: responsive two-panel layout, ARIA labels, keyboard support, 8 px grid spacing
*   Scalability: horizontally-scalable queue workers, stateless Node bridge

## 7. Constraints & Future Extensions

*   HEIC conversion must be reliable server-side
*   Anthropic API rate limits handled with exponential backoff
*   One document per session; no batch uploads
*   Branding: default Material UI + shadcn/ui with primary #1976d2, secondary #ff9800, Roboto font
*   Future: SMS-based upload endpoints, long-term S3 storage, audit trails/version history

## 8. Error Handling & Potential Pitfalls

*   **Unsupported Files / Oversize:** Inline errors, disable upload button
*   **HEIC Conversion Failures:** Validate headers, show user-friendly error
*   **OCR Rate Limits:** Back-off, queue scheduling
*   **Orphaned Temp Files:** Scheduled cleanup job
*   **Network Interruptions:** Pause polling, show snackbar
*   **Validation Edge Cases:** Prompt manual correction for uncommon formats

**Summary**: This unified document consolidates the PRD, App Flow, and technical summary to guide development of a robust, secure, and user-friendly identity document upload + OCR feature, built with Angular 14, Laravel 11, and Anthropic AI.
