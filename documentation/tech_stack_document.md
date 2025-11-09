# Tech Stack Document

This document outlines the key technology choices for the ID Document Upload feature. Each section explains the tools and frameworks used, why they were selected, and how they work together to deliver a reliable, user-friendly experience.

## Frontend Technologies

**Technologies Used:**
- Angular 14.2.x (with its built-in CLI)
- TypeScript 4.6.4
- RxJS 6
- Angular Material UI
- shadcn/ui
- ng2-pdf-viewer
- ngx-image-compress

**Role and Benefits:**
- **Angular 14.2.x** provides a robust single-page application framework that enforces structure and best practices.
- **TypeScript** adds static typing and clearer code documentation, reducing runtime errors.
- **RxJS** handles asynchronous data streams (file uploads, status polling) in a declarative way.
- **Angular Material UI** and **shadcn/ui** supply pre-built, accessible components and a consistent design language, speeding up UI development.
- **ng2-pdf-viewer** enables in-browser PDF previews of the first page, keeping users in context.
- **ngx-image-compress** reduces large image file sizes on the client, optimizing upload performance and minimizing bandwidth.
- **Two-panel layout** separates the upload/preview area from the editable data form, giving users a clear, step-by-step workflow.

## Backend Technologies

**Technologies Used:**
- Laravel 11 (PHP 8.4)
- Laravel Passport (authentication)
- Guzzle 7 (HTTP client)
- Node.js 18.20.6 (Anthropic API bridge)
- Anthropic AI SDK
- heic-convert (HEIC→JPEG)
- Laravel queue workers
- MongoDB (data store)
- Mongoose (ODM)

**Role and Benefits:**
- **Laravel 11** offers a familiar MVC framework for building secure API endpoints and handling file uploads.
- **Laravel Passport** secures all endpoints with OAuth2 tokens, ensuring only authenticated users can upload or edit documents.
- **Guzzle 7** and the **Anthropic AI SDK** work together: Laravel uses Guzzle to forward requests to a Node bridge, which in turn calls the Anthropic OCR API.
- **Node.js bridge** isolates the AI integration, simplifying future swaps to a different OCR provider if needed.
- **heic-convert** normalizes HEIC images to JPEG, standardizing input for the OCR engine.
- **Laravel queue workers** offload time-consuming tasks (file conversion, OCR) to background jobs, keeping the API responsive under load.
- **MongoDB** stores structured user data and links to processed images; **Mongoose** provides a schema layer and object mapping for easy CRUD operations.

## Infrastructure and Deployment

**Key Components:**
- Git (version control) with a central repo (e.g., GitHub/GitLab)
- CI/CD pipelines (unit tests, linting, and automated deployments)
- Node.js and PHP runtimes (hosted on existing server infrastructure)
- Local temporary file storage (version 1)
- Static `/uploads` route for serving converted JPEGs

**How It Supports Reliability:**
- **Version Control (Git):** tracks all code changes, enabling rollbacks and collaboration.
- **CI/CD Pipelines:** automatically run tests and deploy updates, reducing human error and speeding delivery.
- **Background Queues:** allow horizontal scaling of OCR and conversion tasks without slowing down the user’s HTTP requests.
- **Temp Storage + Static Route:** meets initial storage requirements; a future phase will swap to a cloud service like S3 for long-term persistence.

## Third-Party Integrations

**Integrated Services:**
- Anthropic OCR API (via Node.js bridge)
- (Future) Twilio SMS Gateway for mobile uploads
- (Future) AWS S3 or similar cloud storage for image archival

**Benefits:**
- **Anthropic OCR** delivers AI-powered text extraction, reducing manual data entry and human error.
- **Twilio (planned)** opens a new channel for users to upload photos via SMS, broadening accessibility.
- **Cloud Storage (planned)** provides durable, scalable file storage once the feature moves beyond temporary processing.

## Security and Performance Considerations

**Security Measures:**
- **OAuth2 Authentication** with Laravel Passport guards all upload and data-submission endpoints.
- **Input Validation** both client-side (Angular forms) and server-side (Laravel request rules) ensure fields meet strict patterns (e.g., ZIP codes, date formats).
- **File Size Limit (10 MB)** prevents excessively large uploads.
- **Temporary Storage** deletes raw files after OCR, reducing data retention risks in version 1.
- **Role-Based Access** is inherited from the main application, so only authorized users can view or edit records.

**Performance Optimizations:**
- **Client-Side Compression** shrinks images before sending, cutting down upload times.
- **Background Queues** keep the API responsive by deferring CPU-intensive tasks.
- **Loading States and Polling** with RxJS ensure users receive real-time feedback without blocking the UI.
- **Preview-First Approach** loads only the first page of PDFs, avoiding unnecessary processing.

## Conclusion and Overall Tech Stack Summary

This feature leverages proven, modular technologies to deliver a smooth, secure identity-document workflow:

- Frontend: Angular + TypeScript + Material UI + shadcn/ui + specialized viewers and compressors
- Backend: Laravel for core APIs, Node.js bridge for AI, MongoDB for storage, and queues for scalability
- Infrastructure: Git-driven CI/CD, temporary file hosting, and a static route, with clear paths to S3 deployment
- Integrations: Anthropic for OCR today, Twilio and cloud storage as future extensions
- Security & Performance: OAuth2, strict validation, client compression, and async processing

These choices align with the project’s goals—fast, user-friendly uploads; accurate AI extraction; and easy integration into a larger enterprise application—while leaving room for future enhancements like SMS uploads and long-term archival. No component was selected lightly: each plays a clear role in making the system reliable, maintainable, and extensible.