# ApplyFlow

Modern, ATS-safe job application workspace built with Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Firebase, and an AI provider layer (OpenAI-ready, Azure-friendly).

## Features
- Firebase Auth (email/password + Google), protected routes, auth context.
- Dashboard overview with status cards and recent activity.
- Job Tracker with CRUD, filters, status badges, and metrics.
- Resume Manager with PDF uploads to Firebase Storage, parsed text stub for future AI optimization.
- Settings for profile, preferred titles/locations, and visa status.
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
- Resume parsing is a stub (file text slice) to keep the API surface ready for AI-based optimizations.
- UI components are built with shadcn/ui and a premium, ATS-safe styling system.***
# applyflow
