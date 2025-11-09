flowchart TD
    A[Start Upload Process] --> B[Select Document\nJPG PNG PDF HEIC]
    B --> C[Client-side Compression]
    C --> D[Preview Document\nImage or PDF]
    D --> E[Submit to Server]
    E --> F[Server-side Conversion\nHEIC to JPEG]
    E --> ER1[Upload Error]
    ER1 --> R1[Show Error Snackbar]
    R1 --> Z[End Process]
    F --> G[Enqueue OCR Task]
    G --> H[OCR via Anthropic AI]
    H --> I[Extracted Data]
    H --> ER2[OCR Error]
    ER2 --> R2[Show Error Snackbar]
    R2 --> Z
    I --> J[Display and Edit Form]
    J --> K{User Action}
    K -->|Save| L[Validate Fields]
    K -->|Edit| J
    L --> M{Validation OK?}
    M -->|Yes| N[Persist to MongoDB]
    M -->|No| O[Show Inline Errors]
    N --> P[Lock Fields and Show Success Snackbar]
    P --> Z
    O --> J