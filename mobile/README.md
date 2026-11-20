# Smart Skill Planner — Mobile App (React Native / Android APK)

This folder contains the standalone **React Native (Expo SDK 52 + TypeScript + React Navigation + Zustand + Axios)** mobile app for learners. It connects directly to your live Express AI backend (`/api/roadmaps/generate`) and your shared Firebase Firestore database (`ai-studio-ce529039-d1ac-4548-978e-779165263fd7`), so every learner who signs up and generates a roadmap on Android immediately appears in your Web Admin Panel (`/admin`).

## One-Time Firebase Setup (Email/Password)
1. Open the [Firebase Console](https://console.firebase.google.com/project/gen-lang-client-0637292374/authentication/providers) for project `gen-lang-client-0637292374`.
2. Go to **Authentication → Sign-in method**.
3. Enable **Email/Password**.

New accounts require a strong password: 8+ characters with uppercase, lowercase, a number, and a special character.

## Setup
```bash
cd mobile
npm install
cp .env.example .env
```

Set `EXPO_PUBLIC_API_URL` to a backend that actually serves `/api/roadmaps/generate` as JSON.

For local development (phone/emulator on the same Wi‑Fi as this PC):
```
EXPO_PUBLIC_API_URL=http://192.168.20.15:3000
```

Then in the repo root run `npm run dev` so Express listens on `0.0.0.0:3000`.

> Note: the old AI Studio host `ais-pre-...run.app` returns **404** for `/api/*`, so roadmap generation will fail if the app still points there. Use your LAN IP for dev, or a real public deploy for production APKs.

---

## Generating an Android `.apk`

### Option 1: Easiest — Cloud APK Build via Expo EAS (No Android Studio Required)
`eas.json` is already preconfigured with `"buildType": "apk"` under the `preview` profile.

```bash
npm install -g eas-cli
eas login
cd mobile
eas build --platform android --profile preview
```
When the build finishes, Expo prints a direct download link and QR code for your installable `.apk` file.

### Option 2: Local React Native CLI / Gradle APK Build (Android Studio + JDK 17 Required)
Generate the native `android/` project folder and compile the release APK locally:

```bash
cd mobile
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```
Your generated APK will be at:
```
mobile/android/app/build/outputs/apk/release/app-release.apk
```

### Run on an Android Emulator or Connected Phone (Dev Mode)
```bash
cd mobile
npx expo start --android
```
