# ApplyFlow

Modern, ATS-safe job application workspace built with Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Firebase, and an AI provider layer (OpenAI-ready, Azure-friendly).

## Features
- Firebase Auth (email/password + Google), protected routes, auth context.
- Dashboard overview with status cards and recent activity.
- Job Tracker with CRUD, filters, status badges, JD field, metrics, deep-link to Tailor + Job Workspace.
- Resume Manager with PDF uploads to Firebase Storage and server-side text extraction (human-readable preview, 10MB limit).
- Tailor Copilot with JD parsing, keyword chips, per-bullet editor, history/regenerate/compare, and export pack.
- Profile Builder (manual) with readiness checklist + Document Vault (transcripts/degrees/certifications to Storage + Firestore metadata).
- Job Search MVP with provider-based search (SerpAPI/Adzuna) and save-to-tracker flow.
- Job Recommendations (Phase 2) with curated, profile-matched roles and daily refresh cache.
- Polished UI with shadcn/ui, Lucide icons, Tailwind, and subtle Framer Motion animation.

## Getting Started
1) Install dependencies
```bash
npm install
```

2) Create an `.env.local` from the example
```bash
cp .env.example .env.local
# fill in Firebase client keys, Firebase Admin credentials, and optional OPENAI_API_KEY
```

3) Run the dev server
```bash
npm run dev
```
App runs at http://localhost:3000.

## Firebase Setup
- Enable Email/Password and Google providers in Firebase Auth.
- Create a Firestore database (rules should require authenticated users).
- Configure Firebase Storage for resume uploads.
- Generate a service account key for Admin SDK and set `FIREBASE_PRIVATE_KEY` (with `\n` newlines), `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PROJECT_ID`, and `FIREBASE_STORAGE_BUCKET`.

## Environment Variables (Vercel)
Set these for **Production + Preview**:
- Firebase client: `NEXT_PUBLIC_FIREBASE_*`
- Firebase admin: `FIREBASE_ADMIN_CREDENTIAL` or `FIREBASE_ADMIN_CREDENTIALS`
- AI: `OPENAI_API_KEY` (if missing, AI features return `AI_NOT_CONFIGURED`)
- Job search: `JOB_SEARCH_PROVIDER`, `SERPAPI_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`
- Recommendations: `RECOMMENDATIONS_PROVIDER` (mock or adzuna), `RECOMMENDATIONS_USE_OPENAI` (optional)
- Limits: `DAILY_*` vars

## Tech Stack
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Lucide, Framer Motion
- **Backend:** Firebase Auth, Firestore, Firebase Storage, Firebase Admin SDK
- **AI:** Service layer with OpenAI provider (easy swap to Azure OpenAI)

## Key Paths
- Auth UI & routing: `app/(auth)/*`, `components/auth/*`
- Protected shell: `app/(dashboard)/layout.tsx`, `components/layout/*`
- Job tracker logic: `app/(dashboard)/jobs/page.tsx`, `app/actions/jobs.ts`, `components/jobs/*`
- Resume manager: `app/(dashboard)/resume/page.tsx`, `app/actions/resumes.ts`, `components/resume/*`
- Profile/settings: `app/(dashboard)/settings/page.tsx`, `app/actions/profile.ts`
- Firebase setup: `lib/firebase/*`, auth context `lib/auth/auth-provider.tsx`
- AI provider layer: `lib/ai/*`

## Notes
- Server actions use Firebase Admin; client calls pass the Firebase ID token from the Auth context.
- Resume extraction runs server-side via `/api/resume/extract` (Node runtime, 10MB limit, sanitized text, 12k char cap).
- Document uploads live at `users/{uid}/documents/*` with metadata in Firestore `users/{uid}/documents`.
- UI components are built with shadcn/ui and a premium, ATS-safe styling system.

## CHANGELOG (Sprint 1)
- Fixed resume extraction reliability on Vercel (worker-less PDF text extraction + safer sanitization).
- Added resume delete (Storage + Firestore) with confirmation dialog.
- Added Job Search MVP + Save to Tracker.
- Enhanced Job Workspace with guided apply checklist and profile helper panel.
- Added AI status banner and safer AI error handling when key is missing/invalid.

## CHANGELOG (Phase 2)
- Added Recommendations page with curated matches and match explanations.
- Implemented provider interface with Adzuna or mock fallback.
- Cached daily recommendations per user with hide/save actions.

## Smoke Test Checklist
1) Auth: Sign in (email or Google).
2) Resume: Upload PDF -> extraction preview -> delete -> confirm removal.
3) Search: Run job search (provider or URL fallback) -> save to tracker.
4) Recommendations: Set preferences in Settings -> load recommendations -> save one to tracker.
5) Tracker: Open job workspace -> view JD + checklist -> open application URL.
6) Tailor: JD parse chips -> generate tailored pack (if AI enabled).
7) Profile: Save manual profile -> readiness score updates.

## Firestore Rules (recommended)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
      match /profile/{docId} { allow read, write: if request.auth != null && request.auth.uid == uid; }
      match /jobs/{jobId} { allow read, write, delete: if request.auth != null && request.auth.uid == uid; }
      match /generations/{genId} { allow read, write, delete: if request.auth != null && request.auth.uid == uid; }
      match /resumes/{resumeId} { allow read, write, delete: if request.auth != null && request.auth.uid == uid; }
      match /documents/{docId} { allow read, write, delete: if request.auth != null && request.auth.uid == uid; }
      match /recommendations/{dateKey} { allow read, write: if request.auth != null && request.auth.uid == uid; }
      match /usage/{dateKey} { allow read, write: if request.auth != null && request.auth.uid == uid; }
      match /logs/{logId} { allow read, write: if request.auth != null && request.auth.uid == uid; }
    }
    match /{document=**} { allow read, write: if false; }
  }
}
```

## Storage Rules (recommended)
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{uid}/resumes/{fileName} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if request.auth != null && request.auth.uid == uid && request.resource.size < 10 * 1024 * 1024;
    }
    match /users/{uid}/documents/{fileName} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if request.auth != null && request.auth.uid == uid && request.resource.size < 10 * 1024 * 1024;
    }
    match /{allPaths=**} { allow read, write: if false; }
  }
}
```
