# Lakshay Library Management App (LibTrack) 📚✨

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-3.8+-38B2AC.svg)](https://tailwindcss.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-success.svg)](https://web.dev/progressive-web-apps/)
[![Android APK](https://img.shields.io/badge/Android-Jetpack%20Compose-3DDC84.svg)](https://developer.android.com/jetpack/compose)

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
5. **Google Drive Conflict-Free Multi-Device Sync**:
   - Primary writer / secondary follower roles ensuring conflict-free database synchronization across multiple tablets and phones.
6. **Active Client Presence & Crash Diagnostics**:
   - Real-time active devices heartbeat tracking and automated crash/error logging synced to `Lakshay_Library_Logs` on Google Drive.
7. **Native Mobile Ergonomics & Design**:
   - Swipe-to-switch gestures between navigation tabs, custom warm-toned empty state illustrations, and a left-sliding Modal Navigation Drawer.
8. **Standalone Android .APK Generator**:
   - Built-in companion code viewer and builder scripts for compiling a 100% standalone offline Android APK using Capacitor or Jetpack Compose.

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
   git clone https://github.com/your-username/lakshay-library-management.git
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

## 📱 Building Standalone Android APK

To compile this web application into a native standalone Android `.APK`:

1. Build the production web assets:
   ```bash
   npm run build
   ```
2. Initialize Capacitor & Android platform:
   ```bash
   npx cap add android
   npx cap copy android
   ```
3. Open in Android Studio or build via CLI:
   ```bash
   npx cap open android
   ```
   Or use the built-in APK Builder script inside the app's **Build Standalone .APK** drawer menu.

---

## 📜 Open Source License

This project is open-source software licensed under the **[MIT License](LICENSE)**.

---

*Built with ❤️ for modern study halls and libraries.*
