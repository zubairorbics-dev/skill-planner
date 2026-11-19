# Smart Skill Planner

Smart Skill Planner is a full-stack AI learning roadmap application with a mobile-first Learner App and an Administrative Console.

## Architecture

- **Frontend (React + Vite + Tailwind CSS + TypeScript)**:
  - **Learner App**: Google Sign-In, 4-step Onboarding Wizard, Dashboard, Phase/Milestone Accordion Roadmap, Daily/Upcoming/Completed Task Tracker, Progress Ring Summary, and Profile Editor.
  - **Admin Console**: Role-protected Users Directory (sortable, searchable, paginated), User Detail drill-down (profile, roadmap history, AI generation history), and AI Generation Logs table with a full Prompt/Response detail modal.
- **Backend (`server.ts`, Express + TypeScript)**:
  - `POST /api/roadmaps/generate`: Authenticated via Firebase ID Token (`Authorization: Bearer`), per-user rate-limited (3 generations/hour), validated with Zod, calls Google Gemini (`gemini-4-hydrogen`) server-side with strict JSON `responseSchema`, sanitizes all output strings, and retries once on malformed JSON.
  - `GET /api/health`: Health check endpoint.
- **Database & Auth (Firebase Auth + Cloud Firestore)**:
  - Real-time document sync across `profiles`, `roadmaps`, `tasks`, `ai_logs`, and `admins` collections protected by hardened `firestore.rules`.

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables in `.env` (see `.env.example`):
   - `GEMINI_API_KEY`: Server-side Gemini API key (never exposed to browser bundles).
   - `PORT`: Defaults to `3000`.
3. Start the full-stack development server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   npm start
   ```

## Packaging for Android (.apk)

This web workspace runs the responsive mobile-first Learner App and Admin Console live on port 3000. To produce a signed Android `.apk` locally from the built web bundle:

1. Build the production frontend: `npm run build`
2. Add Capacitor (`npm i @capacitor/core @capacitor/cli @capacitor/android`), run `npx cap init "Smart Skill Planner" com.smartskillplanner.app --web-dir dist`, then `npx cap add android && npx cap sync`.
3. Open Android Studio (`npx cap open android`) or run `./gradlew assembleRelease` in `android/` to build the `.apk`.
