# Firebase Emulator Workflow

Use this workflow when you want to exercise ApplyFlow locally without touching the live Firebase project.

## What this covers
- Auth emulator
- Firestore emulator
- Storage emulator
- Seed data for a demo user

## Prerequisites
1. Copy `.env.example` to `.env.local`
2. Set these values in `.env.local`:
   - `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`
   - `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`
   - `NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199`
   - `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`
   - `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`
   - `FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199`
3. Install a Java runtime and make sure it is available on `PATH`

You can keep your normal `NEXT_PUBLIC_FIREBASE_*` values. The emulator flag overrides the client connections locally.

## Start the emulators
In one terminal:

```bash
npm run firebase:emulators
```

This starts:
- Auth on `9099`
- Firestore on `8080`
- Storage on `9199`
- Emulator UI on `4000`

If Firestore fails to start with a `java -version` error, install a JRE or JDK and retry.

## Seed demo data
In a second terminal:

```bash
npm run firebase:seed
```

This creates:
- a demo auth user
- a sample profile
- auto-apply settings
- one analytics record
- one pending manual task
- one saved job

Default seeded credentials:
- email: `demo@applyflow.local`
- password: `applyflow-demo`

You can override them with:
- `APPLYFLOW_SEED_EMAIL`
- `APPLYFLOW_SEED_PASSWORD`

## Run the app
In a third terminal:

```bash
npm run dev
```

Then log in with the seeded demo credentials and use:
- `/profile`
- `/jobs`
- `/auto-apply`
- `/auto-apply/settings`
- `/auto-apply/pending-tasks`

## Safety guard
`npm run firebase:seed` refuses to run unless the Firestore and Auth emulator hosts are set. It is designed for local emulator use only.
