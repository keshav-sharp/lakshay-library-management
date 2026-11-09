# Lakshay Library Management App (LibTrack) 📚✨

[![Latest Release](https://img.shields.io/github/v/release/keshav-sharp/lakshay-library-management?color=d97706&label=Latest%20APK%20Release)](https://github.com/keshav-sharp/lakshay-library-management/releases/latest)
[![Download Android APK](https://img.shields.io/badge/Download-Android%20.APK-16a34a?logo=android&logoColor=white)](https://github.com/keshav-sharp/lakshay-library-management/releases/latest/download/LakshayLibrary.apk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-3.8+-38B2AC.svg)](https://tailwindcss.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-success.svg)](https://web.dev/progressive-web-apps/)

A production-grade, offline-first library and study hall management system built with React, TypeScript, Tailwind CSS, and Progressive Web App (PWA) capabilities. Designed with native mobile ergonomics, real-time analytics, and dual web/Android APK support.

---

## 📲 Quick Download: Android `.APK` & Version History

| Channel | Direct Link | Description |
| :--- | :--- | :--- |
| **Direct 1-Click `.APK` Download (Latest)** | 👉 **[Download `LakshayLibrary.apk` (v1.3.0)](https://github.com/keshav-sharp/lakshay-library-management/releases/latest/download/LakshayLibrary.apk)** | Direct binary download — tap on your Android phone to install immediately (no unzipping required). |
| **All APK Versions & Releases** | 🏷️ **[GitHub Releases Page (`v1.0.0` – `v1.3.0`)](https://github.com/keshav-sharp/lakshay-library-management/releases)** | Browse all historical app versions, release notes, and past APK builds. |
| **GitHub Actions Build Artifacts** | ⚙️ **[Automated CI APK Builds](https://github.com/keshav-sharp/lakshay-library-management/actions/workflows/build-apk.yml)** | Every commit to `main` automatically compiles a fresh `LakshayLibrary-Android-APK` artifact. |
| **Full Changelog** | 📜 **[View `CHANGELOG.md`](CHANGELOG.md)** | Detailed version-by-version history of features, fixes, and improvements. |

---

## 🌟 Key Features

1. **Comprehensive Student & Seat Directory**:
   - Live search, multi-shift filtering (Morning, Evening, All Shifts), and instant fee status tracking (Paid, Due Soon, Overdue).
   - Interactive **Minimalist Desk Matrix** for seat assignment and availability tracking.
2. **Financial & Revenue Analytics**:
   - 6-month historical revenue charts, projected 30-day renewal forecasts, and real-time monthly run-rate calculations.
3. **Reception UPI ID & Payment QR Standee**:
   - Easily attach library UPI ID and payment QR code standees with mandatory warning confirmation dialogs upon editing.
4. **Android WorkManager Background Tasks (Twice Daily)**:
   - Automated periodic worker simulations for daily JSON database backups and **twice-daily** (Morning & Evening) fee due date and overdue status notifications.
5. **Google Drive Organized Master Folder & Conflict-Free Sync (`Lakshay_Library_Master`)**:
   - Automatically creates a structured `Lakshay_Library_Master` root folder in Google Drive with dedicated subfolders:
     - `Lakshay_Library_Master/Master_Sync_Backups/` for primary writer / secondary follower daily database snapshots (`Lakshay_Library_Master_Sync.json`).
     - `Lakshay_Library_Master/Automated_Logs/` for real-time active client presence (`active_clients_status.json`) and automated crash diagnostics (`crash_and_error_logs.json`).
6. **Active Client Presence & Crash Diagnostics**:
   - Real-time active devices heartbeat tracking and automated crash/error logging synced to `Lakshay_Library_Master/Automated_Logs` on Google Drive.
7. **Native Mobile Ergonomics & Design**:
   - Swipe-to-switch gestures between navigation tabs, custom warm-toned empty state illustrations, and a left-sliding Modal Navigation Drawer with embedded GitHub version link (`v1.3.0`).

---

## 📂 Project Architecture

```tree
├── public/                 # Favicons, illustrations & PWA assets
├── src/
│   ├── components/         # Modular React UI components & modals
│   ├── context/            # Theme & state management context
│   ├── data/               # Mock datasets & Kotlin code snippet templates
│   ├── services/           # Storage, export, Google Drive sync, and WorkManager engines
│   ├── types/              # TypeScript interfaces (Student, Shift, Seat, Theme)
│   ├── App.tsx             # Root application component & touch gesture handler
│   ├── main.tsx            # React DOM entry point
│   └── index.css           # Tailwind CSS imports & custom slide animations
├── capacitor.config.json   # Capacitor mobile runtime configuration
├── package.json            # Dependencies & build scripts
└── vite.config.ts          # Vite bundler configuration
```

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js (v18+ recommended)
- npm, yarn, pnpm, or bun

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/keshav-sharp/lakshay-library-management.git
   cd lakshay-library-management
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📱 Download or Build Standalone Android APK

### Option 1: Direct 1-Click APK Download from GitHub Releases (Recommended)
Every tagged version of this app includes a pre-compiled `.apk` attached directly to **[GitHub Releases](https://github.com/keshav-sharp/lakshay-library-management/releases)**:

- **Direct Latest APK URL**:  
  👉 **[`https://github.com/keshav-sharp/lakshay-library-management/releases/latest/download/LakshayLibrary.apk`](https://github.com/keshav-sharp/lakshay-library-management/releases/latest/download/LakshayLibrary.apk)**
- **All Version Releases (`v1.0.0`, `v1.1.0`, etc.)**:  
  👉 **[`https://github.com/keshav-sharp/lakshay-library-management/releases`](https://github.com/keshav-sharp/lakshay-library-management/releases)**

### Option 2: Download from GitHub Actions Build Artifacts
GitHub Actions also compiles the APK automatically on every push to `main`:

1. Open the **[Actions Workflow Runs](https://github.com/keshav-sharp/lakshay-library-management/actions/workflows/build-apk.yml)**.
2. Click on the latest green workflow run (**Build Android APK**).
3. Scroll down to **Artifacts** at the bottom of the page and click **`LakshayLibrary-Android-APK`**.
4. Extract the `.zip` file and tap `app-debug.apk` to install!

### Option 3: 1-Click PWA Install (No APK Needed)
This app is a certified Progressive Web App (PWA):
1. Open the application URL in **Chrome** on your Android phone.
2. Tap the in-app **"Install App"** prompt (or tap Chrome's three dots `⋮` → **"Add to Home Screen"** / **"Install app"**).
3. The app installs immediately with an app icon on your home screen, offline support, and full-screen display.

### Option 4: Compile Locally on Your Laptop
1. Build the production bundle:
   ```bash
   npm run build
   ```
2. Initialize and sync Capacitor Android:
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap add android
   npx cap sync android
   ```
3. Open in Android Studio or compile with Gradle:
   ```bash
   cd android && ./gradlew assembleDebug
   ```
   The compiled APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 📜 Open Source License

This project is open-source software licensed under the **[MIT License](LICENSE)**.

---

*Built with ❤️ for modern study halls and libraries.*
