# Project Requirements Document (PRD)

## 1. Project Overview

We’re building a self-contained feature that lets authenticated users upload a single identity document (driver’s license or state-issued ID) in JPG, PNG, PDF or HEIC format, extracts key text fields via an AI-powered OCR, and presents an editable form for users to review, correct, and save the data. This solves the common hassle of manually typing in personal identification details by automating extraction, reducing errors, and improving user experience.

The feature must be quick, reliable, and secure. Success means users can upload files up to 10 MB, see a preview, get AI-extracted fields (LastName, FirstName, etc.), correct any mistakes against validation rules, and save the results—all in one smooth flow. Future extensibility (SMS uploads, long-term storage) is factored in, but Phase 1 focuses solely on one-at-a-time document upload/OCR and editable data capture.

## 2. In-Scope vs. Out-of-Scope

**In-Scope (v1):**

*   Single-document upload (JPG, PNG, PDF, HEIC) with max 10 MB.
*   Client-side image compression (ngx-image-compress).
*   File preview: images directly, first page of PDFs via ng2-pdf-viewer.
*   Server-side HEIC → JPEG conversion (heic-convert).
*   AI-powered OCR on first page only using Anthropic API (via Node bridge).
*   Data form pre-filled with extracted fields (editable, inline validation).
*   Save and Edit actions: persist to MongoDB, lock/unlock form.
*   Robust loading indicators, inline validation errors, global snackbars.
*   Async processing with Laravel queue workers.
*   Secured endpoints with Laravel Passport.

**Out-of-Scope (v1):**

*   Multi-page PDF processing.
*   Audit trail or version history.
*   Long-term file storage or archival policies.
*   SMS-based upload flow.
*   Role-based access beyond existing enterprise auth.
*   Cloud storage (e.g., S3) for v1.

## 3. User Flow

A user clicks “Upload ID” in the authenticated app and lands on a two-panel page. On the left is the **Upload Panel**: users drag-and-drop or browse for a single JPG, PNG, PDF, or HEIC file (max 10 MB). As soon as the file is selected, a client-side compression step runs if needed, and a live preview appears—images show in an `<img>` tag, PDFs render only the first page. An “Upload” button becomes active.

When Upload is clicked, the panel shows a spinner and disables inputs. The file is sent to a Laravel endpoint, temporarily stored, HEIC files converted, then queued for OCR via the Node/Anthropic bridge. The frontend polls for completion. Once OCR finishes, the **Data Form** on the right populates with fields like LastName, FirstName, DOB, etc., each enforcing validation rules (e.g., ZIP code pattern, MM-DD-YYYY date, two-letter state). Users correct any mistakes inline. When validation passes, the “Save” button activates; clicking it persists the data, locks the form, and shows a success snackbar. An “Edit” button then re-enables fields for future changes.

## 4. Core Features

*   **File Upload Panel**

    *   Drag-and-drop or browse support for JPG, PNG, PDF, HEIC.
    *   Max size 10 MB; client-side compression of large images via ngx-image-compress.
    *   Preview: `<img>` for photos, ng2-pdf-viewer for first PDF page.

*   **Server-Side Processing**

    *   Temporary storage in a local folder.
    *   HEIC → JPEG conversion with heic-convert.
    *   Queue OCR job with Laravel queue workers.

*   **AI-Powered OCR Integration**

    *   Node.js bridge calls Anthropic API.
    *   Extract fields: LastName, FirstName, MiddleInitial, AddressStreet, AddressCity, AddressState, AddressZip, Sex, DOB.

*   **Interactive Data Form**

    *   Built with Angular Material + shadcn/ui.
    *   Inputs for each field; inline validation:\
        • Names: required, alphabetic (MiddleInitial = single letter).\
        • AddressStreet: required, alphanumeric + common punctuation.\
        • AddressCity: required, alphabetic + spaces.\
        • AddressState: required, two-letter US code.\
        • AddressZip: required, 5-digit or 5+4 format.\
        • Sex: required, ‘M’, ‘F’, or ‘X’.\
        • DOB: required, MM-DD-YYYY, not future.
    *   Inline error messages; Save disabled until valid.

*   **Save & Edit Workflow**

    *   Save persists data to MongoDB via Mongoose.
    *   Fields lock on save; “Edit” unlocks for changes.

*   **Feedback & Error Handling**

    *   Angular Material snackbars for success/failure.
    *   Spinners and disabled states on async actions.
    *   Retry options on errors.

*   **Security**

    *   Laravel Passport for auth on all endpoints.
    *   File deletion post-OCR to meet v1 storage policy.

## 5. Tech Stack & Tools

*   **Frontend:**

    *   Angular 14.2.x, TypeScript 4.6.4, RxJS 6
    *   Angular Material UI, shadcn/ui
    *   ng2-pdf-viewer (PDF preview)
    *   ngx-image-compress (client-side compression)

*   **Backend:**

    *   Laravel 11 (PHP 8.4) + Laravel Passport
    *   Node.js 18.20.6 bridge for Anthropic OCR
    *   Guzzle 7 for HTTP where needed
    *   heic-convert library
    *   Laravel queue workers

*   **Database & Storage:**

    *   MongoDB via Mongoose
    *   Local temp folder for v1 uploads (auto-deleted)

*   **AI/ML:**

    *   Anthropic AI SDK (OCR)

*   **IDE & Plugins (optional):**

    *   VSCode with Angular, PHP, JavaScript extensions
    *   Cursors or Windsurf for AI-assisted coding

## 6. Non-Functional Requirements

*   **Performance:**

    *   File upload + OCR round-trip ≤ 10 sec for a typical 2 MB JPEG.
    *   Frontend spinners appear within 200 ms of action.

*   **Security & Privacy:**

    *   All transport over HTTPS.
    *   JWT or OAuth tokens via Passport.
    *   Temporary files deleted immediately after OCR.

*   **Usability:**

    *   Responsive two-panel layout for desktop & tablet.
    *   Accessible form controls (ARIA labels, keyboard navigation).
    *   Clear inline errors and toasts.

*   **Scalability:**

    *   Queue workers can scale horizontally.
    *   Stateless Node bridge for Anthropic calls.

## 7. Constraints & Assumptions

*   HEIC conversion library must run reliably on the server.
*   Anthropic OCR availability and API rate limits are within project needs.
*   One document per user session; no batch uploads.
*   Branding follows Angular Material/shadcn defaults, with primary color #1976d2, secondary #ff9800, Roboto font, 8px grid.
*   Future SMS upload or S3 storage will attach to this modular design but are not needed in v1.

## 8. Known Issues & Potential Pitfalls

*   **API Rate Limits:**\
    • Anthropic plan may throttle high-volume OCR. Mitigate with exponential backoff and queue back-pressure.
*   **HEIC Library Errors:**\
    • Invalid HEIC files could crash conversion. Validate file headers first; fallback with user error message.
*   **Large PDF Files:**\
    • Complex PDFs might render slowly even for a single page. Limit PDF filesize or resolution if timeouts occur.
*   **Network Interruptions:**\
    • Interrupted uploads can leave temp files orphaned. Implement a cleanup cron or queue job to purge stale files.
*   **Validation Edge Cases:**\
    • Uncommon address formats or international IDs may yield extraction errors. Clearly prompt users to fix fields manually.

This PRD lays out the full scope, user journey, features, technical choices, non-functional needs, and potential risks for a reliable, secure, and extendable ID upload & OCR feature. All details are explicit so AI-driven development docs can be generated without ambiguity.
