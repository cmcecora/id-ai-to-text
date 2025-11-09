# Frontend Guideline Document

This document outlines the frontend setup for the identity-document upload and OCR review feature. It covers architecture, design principles, styling, component structure, state management, routing, performance, testing, and more. The goal is to ensure clarity, consistency, and maintainability for anyone working on or reviewing the frontend.

## 1. Frontend Architecture

### 1.1 Overview
- **Framework**: Angular 14.2.x with TypeScript 4.6.4.  
- **Reactive Library**: RxJS 6 for asynchronous data streams.  
- **UI Components**: Angular Material UI for core components and theming; shadcn/ui for supplementary primitives.  
- **Third-party previewers**: `ng2-pdf-viewer` for PDFs, `ngx-image-compress` for client-side image compression.

### 1.2 Modular Structure
- **Feature Modules**:  
  - `UploadModule` (file picker, compression, preview)  
  - `ReviewModule` (editable form, validation, save/edit controls)  
  - `SharedModule` (common components: buttons, dialogs, snackbars, form controls)  
- **Lazy Loading**: Each feature module is lazy-loaded via the Angular Router to reduce initial bundle size.

### 1.3 Scalability, Maintainability & Performance
- **Separation of Concerns**: Clear boundary between upload, preview, OCR form, and shared utilities.  
- **OnPush Change Detection**: Used in most components to minimize unnecessary view updates.  
- **Service-Driven Logic**: Business logic lives in injectable services (e.g., `OcrService`, `FileService`), making it easy to test and reuse.

## 2. Design Principles

### 2.1 Usability
- **Simple Two-Panel Layout**: Upload/preview on the left, form on the right—users see context and data side by side.  
- **Clear Call-to-Action**: Primary buttons (Upload, Save, Edit) stand out with the primary color.

### 2.2 Accessibility
- **WAI-ARIA Compliance**: Use `aria-*` attributes on custom components and ensure all buttons/links have discernible text.  
- **Keyboard Navigation**: Tab order flows logically from upload to form fields to save/edit controls.  
- **Contrast Ratios**: Colors meet WCAG AA contrast guidelines.

### 2.3 Responsiveness
- **Mobile-First**: Flex Layout and Angular Material Grid List adjust panels into a stacked view on narrow screens (≤600px).  
- **Touch Targets**: Buttons and inputs meet minimum 44×44px touch area.

## 3. Styling and Theming

### 3.1 CSS Methodology
- **View Encapsulation**: Angular’s default encapsulation ensures component styles are scoped.  
- **BEM Naming**: For any global or shared SCSS, use BEM to keep selectors predictable (e.g., `.upload-panel__header`).  
- **Pre-processor**: SCSS is used for variables, nesting, and theming overrides.

### 3.2 Angular Material Theming
- We extend the Angular Material SASS theme:  
  - Define a custom `theme.scss` with color variables.  
  - Include Angular Material mixins to generate palette and typography.

### 3.3 Visual Style
- **Design Style**: Modern flat Material Design with subtle shadows for depth—no heavy glassmorphism.  
- **Elevation**: Use Material elevation classes (`mat-elevation-z2`, `z4`) to separate panels.

### 3.4 Color Palette
| Role          | HEX       | Usage                        |
|---------------|-----------|------------------------------|
| Primary       | #1976D2   | Buttons, active elements     |
| Accent        | #03A9F4   | Links, secondary actions     |
| Warn          | #F44336   | Error states, destructive    |
| Background    | #FAFAFA   | Page background              |
| Surface       | #FFFFFF   | Panel and card backgrounds   |
| Text Primary  | #212121   | Main text                    |
| Text Secondary| #757575   | Hints, disabled text         |

### 3.5 Typography
- **Font Family**: Roboto, sourced via Google Fonts (matches Angular Material defaults).  
- **Font Sizes**: Use Material’s typographic scale (e.g., `h6`, `body-1`, `caption`).

## 4. Component Structure

### 4.1 Folder Organization
```
src/app/
├── upload/           # UploadModule
│   ├── components/   # FilePicker, Previewer
│   └── upload-routing.module.ts
├── review/           # ReviewModule
│   ├── components/   # OcrForm, FieldGroup
│   └── review-routing.module.ts
└── shared/           # SharedModule
    ├── components/   # Button, SnackbarWrapper
    └── services/     # FileService, OcrService
```

### 4.2 Smart vs. Presentational
- **Smart Components**: Fetch data, call services, handle routing (e.g., `UploadComponent`, `ReviewComponent`).  
- **Presentational Components**: Pure UI with `@Input()`s and `@Output()`s (e.g., `DocumentPreviewerComponent`, `FormFieldComponent`).

### 4.3 Reusability
- **Shared Form Controls**: Wrap Angular Material `mat-form-field` with validation display logic in a shared component.  
- **Snackbar Service**: Central wrapper around `MatSnackBar` for consistent notification styling.

## 5. State Management

### 5.1 Approach
- **Reactive Services**: Use RxJS subjects/BehaviorSubjects in services (`FileService`, `OcrService`) to hold current file, OCR results, and form lock state.  
- **Component Subscriptions**: Components subscribe to these observables (async pipe) to react to state changes.

### 5.2 Form State
- **Reactive Forms**: Angular’s `FormGroup` and `FormControl` power the review form.  
- **Lock/Unlock Flow**: A `locked$` observable toggles form’s `disable()`/`enable()`.

## 6. Routing and Navigation

### 6.1 Router Setup
- **Routes**:  
  - `/upload` → `UploadModule`  
  - `/review` → `ReviewModule`  
- **Guards**: Optionally add an `AuthGuard` to protect routes (uses Laravel Passport for backend auth).

### 6.2 Navigation Flow
1. User lands on `/upload`.  
2. After successful upload + OCR queue dispatch, app navigates to `/review`.  
3. On save, user remains on `/review` with form locked; “Edit” toggles unlock.

## 7. Performance Optimization

### 7.1 Bundle & Loading
- **Lazy Loading**: Feature modules load only when needed.  
- **Differential Loading**: Angular CLI builds modern and legacy bundles automatically.

### 7.2 Code Splitting & Caching
- **Angular CLI**: Out-of-the-box code splitting by route.  
- **Service Worker (Future)**: Plan to add Angular PWA for asset caching.

### 7.3 Image Optimization
- **Client-Side Compression**: `ngx-image-compress` reduces large images before upload.  
- **Clean-Up**: Temporary files are auto-deleted after OCR in v1.

### 7.4 Change Detection
- **OnPush** everywhere to minimize reflows.

## 8. Testing and Quality Assurance

### 8.1 Unit Testing
- **Framework**: Karma + Jasmine (Angular CLI default).  
- **Scope**: Service logic, pure functions, presentational components.

### 8.2 Integration Testing
- **Angular Testing Library**: For component templates and DOM interactions.  

### 8.3 End-to-End Testing
- **Tool**: Protractor (default) or consider migrating to Cypress for more stable E2E.  
- **Scenarios**: File upload → preview → OCR fill → validation → save/edit.

### 8.4 Linting & Formatting
- **ESLint** with Angular Plugin for code consistency.  
- **Prettier** for automatic formatting on save/CI.

## 9. Conclusion and Overall Frontend Summary

This guideline establishes a clear, modular Angular frontend:  
- **Architecture** driven by feature modules, services, and RxJS.  
- **Design** rooted in usability, accessibility, and responsiveness.  
- **Styling** via Angular Material theming, SCSS, and a modern flat design.  
- **Components** organized into smart and presentational for maintainability.  
- **State** managed through reactive services and Angular Reactive Forms.  
- **Routing** uses lazy loading and guards for secure navigation.  
- **Performance** optimized via OnPush, image compression, and code splitting.  
- **Quality** ensured with unit, integration, and E2E tests alongside linting.

By following these guidelines, the frontend remains intuitive for users, easy for developers to maintain and extend, and performant across devices.