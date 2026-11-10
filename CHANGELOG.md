# Changelog & Version History

All notable changes and Android `.apk` releases for **Lakshay Library Management (LibTrack)** are documented in this file and published on the [GitHub Releases Page](https://github.com/keshav-sharp/lakshay-library-management/releases).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v2.0.3] - 2026-11-10 (Fix `Error 403: access_denied` for Secondary Gmail Accounts & Master Sync Key)

### Direct APK Download
- 📦 **[Download `LakshayLibrary-v2.0.3.apk` (Latest)](https://github.com/keshav-sharp/lakshay-library-management/releases/latest/download/LakshayLibrary.apk)**
- 🔗 **[View Release Notes on GitHub (`v2.0.3`)](https://github.com/keshav-sharp/lakshay-library-management/releases/tag/v2.0.3)**

### Fixed & Added
- **Resolved `Error 403: access_denied` (`has not completed the Google verification process`) on Secondary Accounts**:
  - Removed the restricted `https://www.googleapis.com/auth/drive.readonly` OAuth scope from `SCOPES` in `src/services/googleDriveSyncService.ts` (which triggered Google's unverified-app block for non-owner Gmail accounts).
  - Added a **"Sign in with Another Gmail (Bypasses Error 403)"** mode on Secondary phones that requests only standard identity scopes (`email`, `profile`).
  - Added **1-Tap Master Sync Key Copy & Pull (`enableAnyoneReaderPermission` + API Key Fallback)** so the Primary Phone generates a Master Sync Key (`lastDriveFileId`) that any Secondary Phone can paste and pull with **1 tap (`Pull via Sync Key`)** — even without Google OAuth verification!
  - Added a direct in-app link to **Google Cloud OAuth Audience (`gen-lang-client-0586032146`)** to publish the consent screen or add test users in 1 click.

---

## [v2.0.2] - 2026-11-10 (Cross-Account Gmail Sharing & In-App Sync Guide)

### Direct APK Download
- 📦 **[Download `LakshayLibrary-v2.0.2.apk`](https://github.com/keshav-sharp/lakshay-library-management/releases/download/v2.0.2/LakshayLibrary-v2.0.2.apk)**
- 🔗 **[View Release Notes on GitHub (`v2.0.2`)](https://github.com/keshav-sharp/lakshay-library-management/releases/tag/v2.0.2)**

### Added & Improved
- **Cross-Account Gmail Sync (`Lakshay_Library_Master`)**:
  - Added 1-tap **Grant Access (`shareMasterFolderWithEmail`)** on the Primary Phone so owners can share `Lakshay_Library_Master` and `Master_Sync_Backups` with a Secondary phone's Gmail address directly from the app.
  - Added automatic **"Shared with me" Discovery (`drive.readonly` + `includeItemsFromAllDrives`)** and an optional Shared Folder Link/ID input so a Secondary Phone signed in with a different Gmail address automatically locates and pulls `Lakshay_Library_Master_Sync.json`.
- **In-App Sharing & Secondary Setup Guide Note**:
  - Added a dedicated **"📌 Note: How Secondary Phone Accesses `Lakshay_Library_Master`"** guide inside **Google Drive Daily Sync & Primary Role** covering both Same-Gmail and Different-Gmail setup steps.
- **Engineering Challenges & Fixes Log (`ENGINEERING_LOG.md`)**:
  - Added full root-cause post-mortems and linked resolved GitHub Issues `#1`–`#8`.

---

## [v2.0.1] - 2026-11-10 (Google Sign-In Fix, Persistent Auth Storage & Gesture Exit)

### Direct APK Download
- 📦 **[Download `LakshayLibrary-v2.0.1.apk`](https://github.com/keshav-sharp/lakshay-library-management/releases/download/v2.0.1/LakshayLibrary-v2.0.1.apk)**
- 🔗 **[View Release Notes on GitHub (`v2.0.1`)](https://github.com/keshav-sharp/lakshay-library-management/releases/tag/v2.0.1)**

### Fixed & Changed
- **Fixed Google Sign-In `400 Malformed Request` Error on Android APK**:
  - Updated Capacitor WebView navigation rules (`allowNavigation: ["*"]`) and User-Agent (`overrideUserAgent` + native WebView `; wv` token removal) so intermediate Google Sign-In redirects (`accounts.youtube.com/accounts/SetSID`, `*.google.com`, `*.firebaseapp.com`) stay inside the in-app WebView instead of breaking out to external Chrome without session cookies.
  - Enabled native first-party and third-party cookies (`CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)`) and DOM/Database storage in `MainActivity.java`.
- **Persistent Sign-In Session & Storage Location Display**:
  - Added durable Sign-In session storage (`IndexedDB` via Firebase `browserLocalPersistence` + `LocalStorage` key `lakshay_library_google_auth_session_v2`) and added a **Where Sign-In & Sync Data Is Stored** card inside **Google Drive Daily Sync & Primary Role**.
- **Gesture-Only Exit Confirmation & Native Back Integration**:
  - Removed the `"Exit App"` button from the 3-bar Navigation Drawer.
  - Wired Android's native `OnBackPressedDispatcher` (`lakshay-native-back` event + `LakshayNativeBridge.closeApp()`) and screen-edge back-swipe gestures to open the Exit Confirmation dialog & farewell animation when the user gestures to exit the app.
- **Active Client Count, Heartbeat & Crash Logs Under Google Drive Sync**:
  - Integrated live Active Client Count, 20-second Heartbeat monitor, and Crash & Error Logs directly inside the **Google Drive Daily Sync & Primary Role** modal and drawer subtitle.

---

## [v2.0.0] - 2026-11-10 (Google Play Store Production Release)

### Direct APK Download
- 📦 **[Download `LakshayLibrary-v2.0.0.apk`](https://github.com/keshav-sharp/lakshay-library-management/releases/download/v2.0.0/LakshayLibrary-v2.0.0.apk)**
- 🔗 **[View Release Notes on GitHub (`v2.0.0`)](https://github.com/keshav-sharp/lakshay-library-management/releases/tag/v2.0.0)**

### Added
- **App Launch Splash Animation**: Added a smooth, branded launch animation (`AppLaunchSplash`) featuring the Lakshay Library icon, golden-teal ambient glow, and loading progress bar on startup.
- **Exit App Confirmation & Exit Animation**: Added an interactive Exit Confirmation dialog (`ExitAppModal`) triggered by the Android/browser Back gesture at the home screen, followed by a smooth farewell exit animation.
- **Active Client Count, Heartbeat & Crash Logs in Google Drive Sync**: Added 3 sub-tabs (**1. Sync & Role**, **2. Heartbeat & Clients**, **3. Crash Logs**) under **Google Drive Daily Sync & Primary Role**.

### Changed
- **Google Play Store Production Compliance (`com.lakshaylibrary.app`)**:
  - Updated Android application ID from `com.example.lakshaylibrary` to `com.lakshaylibrary.app`.
  - Reset default student, payment, and attendance databases to `0` records on fresh production initialization (`lakshay_library_prod_v2_0_0_clean`), removing sample/demo student seeds and the "Restore Previous Data" button.
  - Removed all pre-shown diagnostic logs, `"1 Active"` header client badges, developer simulator toolbars, and Kotlin source code tabs so the app runs full-screen like a standard consumer Google Play application.

---

## [v1.3.3] - 2026-11-09

### Direct APK Download
- 📦 **[Download `LakshayLibrary-v1.3.3.apk` (Latest)](https://github.com/keshav-sharp/lakshay-library-management/releases/latest/download/LakshayLibrary.apk)**
- 🔗 **[View Release Notes on GitHub (`v1.3.3`)](https://github.com/keshav-sharp/lakshay-library-management/releases/tag/v1.3.3)**

### Fixed
- **Android APK File Manager & Home Screen Icon (`capacitor:sync:after` Hook)**: Hooked `scripts/apply-android-icon.cjs` directly into Capacitor's `capacitor:sync:after` and `capacitor:copy:after` lifecycle events so the custom icon is applied *after* `npx cap add android` creates the `android/app/src/main/res` folder in CI, and removed `mipmap-anydpi-v26` adaptive vector overrides so Android displays the full custom icon in both the File Manager and Home Screen.

---

## [v1.3.2] - 2026-11-09

### Direct APK Download
- 📦 **[Download `LakshayLibrary-v1.3.2.apk` (Latest)](https://github.com/keshav-sharp/lakshay-library-management/releases/latest/download/LakshayLibrary.apk)**
- 🔗 **[View Release Notes on GitHub (`v1.3.2`)](https://github.com/keshav-sharp/lakshay-library-management/releases/tag/v1.3.2)**

### Fixed
- **Android App Launcher Icon & Background**: Overwrote all `ic_launcher*.png` assets across all mipmap densities with `public/app-icon.png` and updated `ic_launcher_background.xml` to deep teal (`#0B192C`) to eliminate default white/blue capacitor icon backgrounds.

---

## [v1.3.1] - 2026-11-09

### Direct APK Download
- 📦 **[Download `LakshayLibrary-v1.3.1.apk` (Latest)](https://github.com/keshav-sharp/lakshay-library-management/releases/latest/download/LakshayLibrary.apk)**
- 🔗 **[View Release Notes on GitHub (`v1.3.1`)](https://github.com/keshav-sharp/lakshay-library-management/releases/tag/v1.3.1)**

### Fixed
- **Android App Launcher Icon**: Replaced default Capacitor builder icons with the new deep-teal open-book custom app icon (`public/app-icon.png`) across all Android mipmap launcher densities via automated CI build hooks (`scripts/apply-android-icon.js`).

---

## [v1.3.0] - 2026-11-09

### Direct APK Download
- 📦 **[Download `LakshayLibrary-v1.3.0.apk` (Latest)](https://github.com/keshav-sharp/lakshay-library-management/releases/latest/download/LakshayLibrary.apk)**
- 🔗 **[View Release Notes on GitHub (`v1.3.0`)](https://github.com/keshav-sharp/lakshay-library-management/releases/tag/v1.3.0)**

### Added
- **Google Drive Master Folder & Subfolder Hierarchy (`Lakshay_Library_Master`)**:
  - Automatic creation of a root master folder `Lakshay_Library_Master` on Google Drive to keep user Drive storage organized and clutter-free.
  - Dedicated `Lakshay_Library_Master/Master_Sync_Backups/` subfolder for daily database sync files (`Lakshay_Library_Master_Sync.json`).
  - Dedicated `Lakshay_Library_Master/Automated_Logs/` subfolder for automated crash logs (`crash_and_error_logs.json`) and active client presence logs (`active_clients_status.json`).
- **App Version & Embedded GitHub Link in Navigation Drawer**:
  - Added clickable App Version (`v1.3.0`) at the bottom of the 3-bar Navigation Drawer with the GitHub repository URL (`https://github.com/keshav-sharp/lakshay-library-management`) embedded directly inside the version link.

### Changed
- **Reworked App Icon Design**: Updated application launcher icons, PWA icons, and header logos to the new deep-teal open-book icon with golden "L" monogram and illuminated archway portal.
- **Navigation Drawer Cleanup**: Removed the `"Build Standalone .APK"` section from the 3-bar Navigation Drawer since compiled APKs are published directly on GitHub Releases.

---

## [v1.2.0] - 2026-11-09

### Direct APK Download
- 📦 **[Download `LakshayLibrary-v1.2.0.apk`](https://github.com/keshav-sharp/lakshay-library-management/releases/download/v1.2.0/LakshayLibrary-v1.2.0.apk)**
- 🔗 **[View Release Notes on GitHub (`v1.2.0`)](https://github.com/keshav-sharp/lakshay-library-management/releases/tag/v1.2.0)**

### Fixed
- **Post-Sign-In White Screen in Android APK**: Replaced `signInWithPopup` with `signInWithRedirect` when running inside the single-window Android WebView / Capacitor container. Previously, `signInWithPopup` navigated the main WebView frame and attempted `window.close()` with no `window.opener`, leaving a blank white screen after granting Google Drive consent.
- **Automatic Modal Restoration After Redirect**: Automatically re-opens the Google Drive Sync modal and refreshes remote `Lakshay_Library_Master_Sync.json` metadata as soon as the OAuth redirect returns to the app.

---

## [v1.1.0] - 2026-11-09

### Direct APK Download
- 📦 **[Download `LakshayLibrary-v1.1.0.apk`](https://github.com/keshav-sharp/lakshay-library-management/releases/latest/download/LakshayLibrary.apk)**
- 🔗 **[View Release Notes on GitHub (`v1.1.0`)](https://github.com/keshav-sharp/lakshay-library-management/releases/tag/v1.1.0)**

### Added
- Automated GitHub Actions Android `.APK` build pipeline (`.github/workflows/build-apk.yml`).
- Official GitHub Releases integration with direct 1-click `.APK` binary downloads.
- Safe environment & Firebase configuration loader (`src/config/firebaseConfig.ts`).
- `CHANGELOG.md` and semantic versioning (`v1.1.0`) for tracking all future updates.

### Fixed
- **Google Drive Sign-In on Android APK**: Configured authorized Firebase domain hostname (`server.hostname`) and navigation whitelist in `capacitor.config.json` to resolve `"The requested action is invalid"` during OAuth popups/redirects on mobile.
- **Mobile OAuth Redirect Support**: Added automatic fallback to `signInWithRedirect` and `getRedirectResult` in `googleDriveSyncService.ts` for Android WebView compatibility.
- **CI Build & Dependencies**: Pinned `@capacitor/cli`, `@capacitor/core`, and `@capacitor/android` to `v6.2.3` for Node.js 20 compatibility, added `react-is`, and configured `.npmrc`.

---

## [v1.0.0] - 2026-11-09

### Added
- **Student & Seat Directory**: Full student CRUD, camera photo capture during student registration, shift filtering (Morning, Evening, Full Day), and interactive Seat Matrix.
- **Financial & Revenue Analytics**: 6-month revenue charts, 30-day fee collection forecasts, and monthly email/CSV reporting.
- **Reception UPI ID & Payment QR Standee**: Custom UPI QR code generator and payment confirmation workflows.
- **Google Drive Multi-Device Sync**: Conflict-free Primary Writer / Secondary Follower daily database synchronization (`Lakshay_Library_Master_Sync.json`).
- **PWA & Offline Support**: Service worker caching, installable Web App Manifest, and Android APK export scripts.
