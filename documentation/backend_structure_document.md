# Backend Structure Document

## 1. Backend Architecture

Overall, the backend is split into two main parts: a Laravel API server (PHP 8.4) that handles user authentication, file uploads, and business logic, and a Node.js service (v18.20.6) that connects to the Anthropic API for OCR.  

Key design patterns and frameworks:

- Laravel MVC (Models, Views, Controllers) for clear separation of concerns
- Laravel Queues (asynchronous job processing) for non-blocking OCR workflows
- Service layer in Laravel to orchestrate file handling and queue dispatching
- Node.js bridge as a microservice using Express.js and Mongoose to handle OCR and data persistence

How the architecture supports our goals:

- Scalability: queue workers can be scaled horizontally; Node.js OCR service can run in its own container or server pool
- Maintainability: clear boundaries between PHP API and Node.js OCR logic; each service has its own codebase and dependencies
- Performance: heavy CPU work (HEIC conversion, PDF parsing, OCR calls) is offloaded to background jobs, keeping API responses snappy

## 2. Database Management

We use a NoSQL database (MongoDB) accessed via Mongoose ODM in Node.js and through a MongoDB driver in Laravel.  

Data flow and access:

- All document and user‐related data (beyond Laravel Passport tables) lives in MongoDB
- Mongoose models define the shape of each document type and enforce schema at the application level
- Laravel interacts with MongoDB for CRUD operations on document records via a lightweight database driver

Best practices:

- Indexes on `userId` and `createdAt` for fast lookups
- TTL indexes on temporary file metadata (so local temp‐folder entries can auto-expire if needed)
- Strict validation in Mongoose schemas to prevent malformed data

## 3. Database Schema

Because we’re using MongoDB, here’s a human-readable overview of our main collection.

Collection: **documents**

•  _id: unique identifier  
•  userId: references the uploader (string)  
•  fileMeta:  
   – fileName  
   – fileType  
   – fileSize  
   – uploadTimestamp  
•  status: one of ["pending", "processing", "completed", "failed"]  
•  extractedData:  
   – firstName  
   – lastName  
   – middleInitial (optional)  
   – addressStreet  
   – addressCity  
   – addressState  
   – addressZip  
   – sex  
   – dob  
•  validationFlags: captures any rules‐violations (e.g., zip format)  
•  audit:  
   – createdAt  
   – updatedAt  
   – processedAt (when OCR job finished)

## 4. API Design and Endpoints

We follow a RESTful approach in the Laravel API.

Key endpoints:

- **POST /api/documents/upload**  
  Purpose: receive file uploads, validate file type/size, store temporarily, dispatch OCR job  
  Payload: multipart/form-data with `file` field  
  Response: `{ documentId, status }`

- **GET /api/documents/{id}**  
  Purpose: fetch document metadata and extractedData for review  
  Response: full document object from MongoDB

- **PUT /api/documents/{id}**  
  Purpose: update extractedData after user edits and mark record as locked  
  Payload: JSON with updated fields  
  Response: updated document object

- **GET /api/users/{userId}/documents**  
  Purpose: list all uploads for a given user  
  Query params: pagination, status filter  
  Response: array of document summaries

All endpoints require a valid OAuth2 token issued by Laravel Passport.

## 5. Hosting Solutions

We host on Amazon Web Services for reliability and growth:

- **Laravel API and Node.js OCR service:** Dockerized and deployed to AWS Elastic Beanstalk (or ECS/EKS for container orchestration)
- **MongoDB:** MongoDB Atlas (managed, with built-in replication and backups)
- **Temporary file storage:** local EC2 instance storage; future plan to migrate to S3

Benefits:

- High availability via multi-AZ deployments
- Auto-scaling groups for API servers and OCR workers
- Pay-as-you-go pricing reduces costs when usage is low

## 6. Infrastructure Components

- **Load Balancer (ALB):** distributes incoming API traffic across Laravel instances
- **Worker Auto-Scaling:** monitors queue depth to spin up/down OCR workers automatically
- **Content Delivery Network (CloudFront):** serves static assets (Angular bundles, images) with low latency
- **Caching Layer (optional):** Redis for session caching and API rate-limit data
- **Logging & Tracing:** CloudWatch Logs for server logs; X-Ray or OpenTelemetry for distributed tracing

All parts communicate over secure VPC, with private subnets for databases and worker nodes.

## 7. Security Measures

- **Authentication & Authorization:** Laravel Passport (OAuth2) issues JWT-style tokens; role checks in controllers
- **Input Validation:** server-side validation in Laravel; strict file type and size checks; Mongoose schema validation
- **Data Encryption:** HTTPS/TLS for all client-server traffic; encrypted storage at rest for MongoDB Atlas
- **Environment Secrets:** API keys (Anthropic, Twilio) and DB credentials stored in AWS Secrets Manager or Parameter Store
- **File Safety:** sanitize file names; scan for malicious payloads; delete temporary files immediately after OCR

This setup helps us stay compliant with data-protection standards (e.g., GDPR if needed).

## 8. Monitoring and Maintenance

- **Health Checks:** ELB health checks on API endpoints to detect unresponsive instances
- **Queue Monitoring:** Laravel Horizon (or custom scripts) to alert on stalled jobs
- **Error Tracking:** Sentry integrated in Laravel and Node.js for real-time error alerts
- **Performance Metrics:** CloudWatch dashboards for CPU, memory, queue depth, API latency
- **Maintenance Strategy:**  
  • Regular dependency updates via CI pipeline  
  • Nightly backups of MongoDB Atlas  
  • Monthly security audits and penetration tests

## 9. Conclusion and Overall Backend Summary

Our backend is a decoupled, scalable solution that cleanly separates the user-facing Laravel API from the compute-intensive OCR work in Node.js.  

- Laravel handles authentication, file intake, and API CRUD operations  
- A Node.js microservice bridges to Anthropic AI, processes files asynchronously, and writes structured data to MongoDB  
- AWS hosting and managed services ensure reliability, security, and cost control  

This architecture aligns with the project’s goals by providing a responsive upload experience, robust data extraction, and a clear path for future enhancements (SMS uploads, S3 storage).  

Unique strengths:

- Asynchronous, queue-driven OCR keeps the API fast  
- Clear separation of concerns simplifies future maintenance  
- Fully managed cloud services reduce operational burden  

With this setup, developers and stakeholders can be confident in the backend’s ability to grow alongside user needs.