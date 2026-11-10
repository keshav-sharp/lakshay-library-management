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
6. **App Launch & Gesture-Based Exit Confirmation Animations**:
   - Branded launch splash animation (`AppLaunchSplash`) on startup and an interactive Exit Confirmation dialog (`ExitAppModal`) with a farewell animation triggered when the user performs an Android Back gesture or edge back-swipe on the home screen.
7. **Native Mobile Ergonomics & Design (`v2.0.3` Production Release)**:
   - Swipe-to-switch gestures between navigation tabs, custom warm-toned empty state illustrations, zero pre-populated demo records (`0` students on clean install), 1-tap Master Sync Key for cross-account sharing, and a left-sliding Navigation Drawer with embedded GitHub version link (`v2.0.3`).

---

## 📂 Project Architecture

```tree
├── public/                     # App icons, illustrations & PWA manifest
├── scripts/
│   └── apply-android-icon.cjs  # Capacitor Android icon, WebView OAuth & back-gesture patcher
├── src/
│   ├── components/             # Modular React UI components, modals & lifecycle animations
│   ├── config/                 # Firebase & Google OAuth configuration
│   ├── context/                # Theme & state management context
│   ├── data/                   # Production defaults & shift configurations
│   ├── services/               # Storage, export, Google Drive sync, presence & crash logs
│   ├── types/                  # TypeScript interfaces (Student, Shift, Seat, Theme)
│   ├── App.tsx                 # Root application component & gesture navigation handler
│   ├── main.tsx                # React DOM entry point
│   └── index.css               # Tailwind CSS imports & custom slide animations
├── capacitor.config.json       # Capacitor Android configuration (com.lakshaylibrary.app)
├── CHANGELOG.md                # Version history & direct APK release links
├── ENGINEERING_LOG.md          # Post-mortem log of all 10 engineering & security fixes
├── package.json                # Dependencies & build scripts (v2.0.3)
└── vite.config.ts              # Vite bundler configuration
```

---

## ☁️ Multi-Phone Google Drive Sync Guide (`Lakshay_Library_Master`)

Lakshay Library uses a **Primary (Master Writer)** and **Secondary (Read-Only Follower)** device model so multiple phones can stay in sync without overwriting each other's student records.

### Scenario A: Using the **Same Gmail Account** on Both Phones
1. **On the Primary Phone**:
   - Open the **3-bar menu (`☰`)** → **Google Drive Daily Sync & Primary Role**.
   - Select **Primary Phone**, sign in with your Google account, and tap **Push Primary Snapshot to Drive**.
2. **On the Secondary Phone**:
   - Open the **3-bar menu (`☰`)** → **Google Drive Daily Sync & Primary Role**.
   - Select **Secondary Phone**, sign in with the **same Google account**, and tap **Pull Daily Snapshot from Primary**.

### Scenario B: Using a **Different Gmail Account** on the Secondary Phone (No `Error 403` Block)
1. **On the Primary Phone**:
   - Open **Google Drive Daily Sync & Primary Role** and tap **Push Primary Snapshot to Drive** once.
   - Under **Section 1 ("Share with Secondary Phone")**, tap **Copy Sync Key** and send that key to your Secondary Phone (e.g. via WhatsApp).
2. **On the Secondary Phone**:
   - Open **Google Drive Daily Sync & Primary Role** and switch the role to **Secondary Phone**.
   - Paste the **Master Sync Key** into the box in **Section 1** and tap **Pull via Sync Key** (you can also sign in with your other Gmail using **Sign in with Another Gmail (Bypasses Error 403)**).
   - *(Optional for Cloud Console Admin)*: To allow any Gmail account to use full Google Drive OAuth without adding individual test users, open [Google Cloud OAuth Audience (`gen-lang-client-0586032146`)](https://console.cloud.google.com/auth/audience?project=gen-lang-client-0586032146) and click **Publish App**.

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

- **Direct Latest APK URL (`v2.0.3`)**:  
  👉 **[`https://github.com/keshav-sharp/lakshay-library-management/releases/latest/download/LakshayLibrary.apk`](https://github.com/keshav-sharp/lakshay-library-management/releases/latest/download/LakshayLibrary.apk)**
- **All Version Releases (`v1.0.0` – `v2.0.3`)**:  
  👉 **[`https://github.com/keshav-sharp/lakshay-library-management/releases`](https://github.com/keshav-sharp/lakshay-library-management/releases)**

### Option 2: Download from GitHub Actions Build Artifacts
GitHub Actions also compiles and publishes the APK automatically on every push to `main`:

1. Open the **[Actions Workflow Runs](https://github.com/keshav-sharp/lakshay-library-management/actions/workflows/build-apk.yml)**.
2. Click on the latest green workflow run (**Build & Publish Android APK Release**).
3. Scroll down to **Artifacts** at the bottom of the page and click **`LakshayLibrary-Android-APK`**.
4. Extract the `.zip` file and tap `LakshayLibrary.apk` to install!

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

## 🛠️ Engineering Challenges & Fixes Log

Curious about the technical challenges we solved while building this app across Web (PWA) and Android (`.apk`)? We maintain a full post-mortem log and closed issue tracker covering every bug, root cause, and architectural fix:

- 📖 **[Read the Full `ENGINEERING_LOG.md`](ENGINEERING_LOG.md)**
- 🐛 **[Browse Resolved GitHub Issues (`#1` – `#10`)](https://github.com/keshav-sharp/lakshay-library-management/issues?q=is%3Aissue+is%3Aclosed)**

| Issue | Category | Summary of Challenge & Fix | Fixed In |
| :--- | :--- | :--- | :--- |
| **[#1](https://github.com/keshav-sharp/lakshay-library-management/issues/1)** | Cloud Sync | Prevented multi-phone Google Drive overwrite conflicts via **Primary (Master Writer)** vs. **Secondary (Follower)** device roles | `v1.2.0` |
| **[#2](https://github.com/keshav-sharp/lakshay-library-management/issues/2)** | Drive Architecture | Organized cloud files into `Lakshay_Library_Master/Master_Sync_Backups/` & `Automated_Logs/` with live Heartbeat & Crash Logs | `v1.3.0` |
| **[#3](https://github.com/keshav-sharp/lakshay-library-management/issues/3)** | Android Build | Fixed custom launcher icon (`app-icon.png`) in Android File Manager & Home Screen via `capacitor:sync:after` hooks | `v1.3.3` |
| **[#4](https://github.com/keshav-sharp/lakshay-library-management/issues/4)** | Android OAuth | Resolved `403: disallowed_useragent` in Android WebView by stripping `; wv` and setting a standard Chrome Mobile User-Agent | `v1.3.2` |
| **[#5](https://github.com/keshav-sharp/lakshay-library-management/issues/5)** | Play Store Release | Reset default student database to `0` records (`com.lakshaylibrary.app`), added launch splash animation, and removed dev toolbars | `v2.0.0` |
| **[#6](https://github.com/keshav-sharp/lakshay-library-management/issues/6)** | OAuth Redirects | Fixed `400 Malformed Request` during Google Sign-In on Android APK via `allowNavigation: ["*"]` and WebView third-party cookie support | `v2.0.1` |
| **[#7](https://github.com/keshav-sharp/lakshay-library-management/issues/7)** | Native Gestures | Replaced menu-based exit button with native Android `OnBackPressedDispatcher` gesture interception & exit confirmation animation | `v2.0.1` |
| **[#8](https://github.com/keshav-sharp/lakshay-library-management/issues/8)** | Security (CodeQL) | Resolved CodeQL High-severity alert (`CWE-312`) by keeping OAuth access tokens strictly in memory instead of `localStorage` | `v2.0.1` |
| **[#9](https://github.com/keshav-sharp/lakshay-library-management/issues/9)** | Cross-Account Sync | Enabled Secondary phones signed in with a different Gmail to pull `Lakshay_Library_Master` via 1-tap Drive sharing & "Shared with me" discovery | `v2.0.2` |
| **[#10](https://github.com/keshav-sharp/lakshay-library-management/issues/10)** | OAuth `Error 403` Fix | Resolved `Error 403: access_denied` on secondary Gmail accounts by removing restricted `drive.readonly` scope & adding **1-Tap Master Sync Key Pull** | `v2.0.3` |

---

## 📲 Quick Download: Android `.APK` & Version History

| Channel | Direct Link | Description |
| :--- | :--- | :--- |
| **Direct 1-Click `.APK` Download (Latest)** | 👉 **[Download `LakshayLibrary.apk` (v2.0.3)](https://github.com/keshav-sharp/lakshay-library-management/releases/latest/download/LakshayLibrary.apk)** | Direct binary download — tap on your Android phone to install immediately (no unzipping required). |
| **All APK Versions & Releases** | 🏷️ **[GitHub Releases Page (`v1.0.0` – `v2.0.3`)](https://github.com/keshav-sharp/lakshay-library-management/releases)** | Browse all historical app versions, release notes, and past APK builds. |
| **Engineering Issues & Fixes Log** | 🛠️ **[View `ENGINEERING_LOG.md`](ENGINEERING_LOG.md)** | Root-cause analysis and fixes for all 10 engineering & security challenges solved during development. |
| **Full Changelog** | 📜 **[View `CHANGELOG.md`](CHANGELOG.md)** | Detailed version-by-version history of features, fixes, and improvements. |

---

## 📜 Open Source License

This project is open-source software licensed under the **[MIT License](LICENSE)**.

---

*Built with ❤️ for modern study halls and libraries.*
