# Changelog & Version History

All notable changes and Android `.apk` releases for **Lakshay Library Management (LibTrack)** are documented in this file and published on the [GitHub Releases Page](https://github.com/keshav-sharp/lakshay-library-management/releases).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
