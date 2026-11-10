# 🛠️ Engineering Challenges, Root-Cause Analysis & Fixes Log

This document records the real-world engineering challenges, platform bugs, OAuth WebView edge cases, multi-device data synchronization conflicts, and security advisories encountered while building and shipping **Lakshay Library Management (LibTrack)** across Web (PWA) and Android (`.apk` via Capacitor).

All tracked issues are also logged and closed in the **[GitHub Issues Tracker](https://github.com/keshav-sharp/lakshay-library-management/issues?q=is%3Aissue+is%3Aclosed)**.

---

## 📊 Summary Matrix of Resolved Engineering Issues

| Issue # | Category | Problem / Symptom | Root Cause | Resolution Applied | Version Fixed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **[#1](https://github.com/keshav-sharp/lakshay-library-management/issues/1)** | **Cloud Sync & Data Integrity** | Multi-phone Google Drive sync overwrote student records when two devices synced on the same day | Both devices had unconditional write access to the cloud backup file without a leader/follower role guard | Implemented **Primary (Master Writer)** vs. **Secondary (Read-Only Follower)** device roles + explicit overwrite confirmation | `v1.2.0` |
| **[#2](https://github.com/keshav-sharp/lakshay-library-management/issues/2)** | **Cloud Storage Architecture** | Unorganized backup & diagnostic files cluttering the user's root Google Drive | Backup snapshots and diagnostic logs were uploaded to the root Drive directory without folder hierarchy | Created structured `Lakshay_Library_Master` root directory with `Master_Sync_Backups/` and `Automated_Logs/` subfolders | `v1.3.0` |
| **[#3](https://github.com/keshav-sharp/lakshay-library-management/issues/3)** | **Android Build & CI/CD** | Custom app launcher icon (`app-icon.png`) did not appear in Android File Manager or Home Screen | `npx cap add android` ran *after* `npm install` in CI, and Android 8+ `mipmap-anydpi-v26` adaptive vector XMLs overrode custom PNGs | Hooked `scripts/apply-android-icon.cjs` into `capacitor:sync:after` and deleted `mipmap-anydpi-v26` vector overrides | `v1.3.3` |
| **[#4](https://github.com/keshav-sharp/lakshay-library-management/issues/4)** | **Android WebView OAuth** | Google Sign-In failed with `Error 403: disallowed_useragent` inside the Android APK | Google OAuth blocks embedded Android WebViews that include the `; wv` token in their `User-Agent` header | Stripped `; wv` in `MainActivity.java` and configured standard Chrome Mobile `overrideUserAgent` in `capacitor.config.json` | `v1.3.2` |
| **[#5](https://github.com/keshav-sharp/lakshay-library-management/issues/5)** | **Google Play Production Readiness** | Pre-populated sample students and diagnostic developer toolbars appeared on fresh install | Initial prototype seeded demo student records and displayed a top developer status bar by default | Reset default database to `0` records (`lakshay_library_prod_v2_0_0_clean`), changed application ID to `com.lakshaylibrary.app`, and moved telemetry into Google Drive Sync settings | `v2.0.0` |
| **[#6](https://github.com/keshav-sharp/lakshay-library-management/issues/6)** | **Android OAuth Redirects** | Google Sign-In failed with `400. That's an error. The server cannot process the request because it is malformed` | Intermediate Google OAuth redirects (`accounts.youtube.com/accounts/SetSID`, `*.google.com`) were kicked out to external Chrome by Capacitor's `BridgeWebViewClient`, losing WebView session cookies | Set `allowNavigation: ["*"]` in `capacitor.config.json` and enabled native first-party & third-party cookies (`CookieManager.setAcceptThirdPartyCookies`) in `MainActivity.java` | `v2.0.1` |
| **[#7](https://github.com/keshav-sharp/lakshay-library-management/issues/7)** | **Android Native Gestures** | Android system Back gesture closed the app immediately instead of prompting the Exit Confirmation animation | Chromium ignores `history.pushState` entries created without prior user activation, causing Android's `OnBackPressedDispatcher` to finish the Activity immediately | Registered a native `OnBackPressedCallback(true)` in `MainActivity.java` that dispatches `lakshay-native-back` to React + added `@JavascriptInterface` `LakshayNativeBridge.closeApp()` | `v2.0.1` |
| **[#8](https://github.com/keshav-sharp/lakshay-library-management/issues/8)** | **Security / CodeQL (CWE-312)** | GitHub CodeQL flagged High-severity alert: `Clear text storage of sensitive information` (`js/clear-text-storage-of-sensitive-data`) | Serializing OAuth `accessToken` / `oauthAccessToken` into `localStorage` exposed bearer credentials in clear text | Kept OAuth access tokens strictly in runtime memory (`cachedAccessToken`) while persisting only non-sensitive profile & folder metadata in `localStorage` | `v2.0.1` |
| **[#9](https://github.com/keshav-sharp/lakshay-library-management/issues/9)** | **Cross-Account Cloud Sync** | Secondary device signed in with a different Gmail address could not see the Primary device's `Lakshay_Library_Master` folder | `drive.file` scope only exposes files created by the signed-in user's own account, and `findMasterSyncFileOnDrive()` created a new empty folder before checking "Shared with me" | Added `drive.readonly` scope, 1-tap `shareMasterFolderWithEmail()` permissions API helper on Primary, global "Shared with me" file discovery (`includeItemsFromAllDrives=true`), and an in-app sharing guide | `v2.0.2` |

---

## 🔍 Detailed Post-Mortems & Technical Solutions

### Issue #1: Multi-Phone Google Drive Sync Overwrite Conflicts (`v1.2.0`)
- **Symptom**: When a library owner used two phones (e.g., Front Desk Phone and Owner's Home Phone) connected to the same Google Drive account, the second phone could accidentally push an older local state and overwrite newly registered students.
- **Root Cause**: Both devices executed bidirectional sync without distinguishing between a primary writer and a secondary reader.
- **Fix Applied**:
  1. Added a **Device Sync Role (`PRIMARY` vs. `SECONDARY`)** selector in `src/services/googleDriveSyncService.ts` and `src/components/GoogleDriveSyncModal.tsx`.
  2. Enforced a strict conflict guard inside `pushPrimarySnapshotToGoogleDrive()` that rejects uploads from any device set to `SECONDARY`.
  3. Added a mandatory confirmation modal before overwriting an existing `Lakshay_Library_Master_Sync.json` file on Google Drive.

---

### Issue #2: Structured Google Drive Folder Hierarchy & Automated Telemetry Logs (`v1.3.0` – `v2.0.0`)
- **Symptom**: Storing backup files in the root of Google Drive made it difficult for library administrators to locate master backups vs. diagnostic logs.
- **Root Cause**: Drive API upload calls did not specify `parents` folder IDs.
- **Fix Applied**:
  1. Built `ensureDriveFolderExists()` and `ensureMasterSyncFolderHierarchy()` in `src/services/googleDriveSyncService.ts` to automatically provision a clean directory tree:
     - `Lakshay_Library_Master/Master_Sync_Backups/Lakshay_Library_Master_Sync.json`
     - `Lakshay_Library_Master/Automated_Logs/active_clients_status.json`
     - `Lakshay_Library_Master/Automated_Logs/crash_and_error_logs.json`
  2. Consolidated **Active Client Count**, **20-Second Heartbeat Monitor**, and **Crash & Error Logs** into 3 dedicated sub-tabs inside the **Google Drive Daily Sync & Primary Role** modal (`src/components/GoogleDriveSyncModal.tsx`).

---

### Issue #3: Custom Android APK Icon Missing in File Manager & Home Screen (`v1.3.1` – `v1.3.3`)
- **Symptom**: Even after adding `public/app-icon.png` and an icon copy script in `postinstall`, the compiled `.apk` downloaded on Android still displayed the default Capacitor blue/white generic icon in the Android File Manager and launcher.
- **Root Cause**:
  1. In the GitHub Actions workflow, `npm install` (which runs `postinstall`) executed *before* `npx cap add android`, so the `android/` directory did not exist yet when `postinstall` ran.
  2. Android 8.0+ (API 26+) prioritizes adaptive vector XML files inside `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` and `ic_launcher_round.xml` over the PNG files in `mipmap-hdpi` through `mipmap-xxxhdpi`.
- **Fix Applied**:
  1. Added `"capacitor:copy:after"` and `"capacitor:sync:after"` npm lifecycle scripts in `package.json` pointing to `scripts/apply-android-icon.cjs`, which Capacitor automatically invokes *after* `npx cap add android` and `npx cap sync android`.
  2. Updated `scripts/apply-android-icon.cjs` to delete `mipmap-anydpi-v26/ic_launcher.xml` and `ic_launcher_round.xml` so Android uses the custom high-resolution `public/app-icon.png` across both the File Manager `.apk` preview and the device Home Screen.

---

### Issue #4: Google Sign-In `403: disallowed_useragent` in Android APK (`v1.3.2`)
- **Symptom**: Tapping **Sign in with Google** inside the installed Android APK returned Google's `403: disallowed_useragent` error screen.
- **Root Cause**: Android's system `WebView` appends `; wv` to the default `User-Agent` string (e.g., `Mozilla/5.0 (Linux; Android 14; ...; wv) AppleWebKit/537.36 ...`). Google's OAuth 2.0 endpoint rejects requests containing the `; wv` WebView token.
- **Fix Applied**:
  1. Added `"overrideUserAgent"` in `capacitor.config.json` with a standard Chrome Mobile User-Agent string.
  2. Patched `MainActivity.java` via `scripts/apply-android-icon.cjs` to strip `; wv` and `Version/\d+\.\d+` from `WebSettings.getUserAgentString()` during `onCreate()`.

---

### Issue #5: Google Play Store Production Readiness & Clean-Slate Database (`v2.0.0`)
- **Symptom**: Fresh installations contained pre-seeded sample students, a "Restore Previous Data" demo button, and developer status bars/code inspection tabs.
- **Root Cause**: Development scaffolding and mock data seeds were active in the default initialization path.
- **Fix Applied**:
  1. Updated the Android package identifier in `capacitor.config.json` to `com.lakshaylibrary.app`.
  2. Initialized `DEFAULT_STUDENTS = []` (`0` records) with a clean-slate production migration marker (`lakshay_library_prod_v2_0_0_clean`) in `src/services/storageService.ts`.
  3. Removed all developer simulation toolbars and code inspection tabs from the main UI so the app launches directly into the full-screen library dashboard with a branded launch splash animation (`AppLaunchSplash`).

---

### Issue #6: Google Sign-In `400. That's an error (Malformed Request)` on Android Redirect (`v2.0.1`)
- **Symptom**: After selecting a Google account during sign-in on the Android APK, the screen redirected to Chrome showing: `400. That's an error. The server cannot process the request because it is malformed.`
- **Root Cause**:
  1. `capacitor.config.json` previously restricted `server.allowNavigation` to `["accounts.google.com", "*.firebaseapp.com", "*.googleapis.com"]`.
  2. During Google OAuth sign-in, Google chains intermediate redirects through `accounts.youtube.com/accounts/SetSID` and regional `*.google.com` domains. When Capacitor's `BridgeWebViewClient` encountered a host not in `allowNavigation`, it cancelled the WebView navigation and launched an external Chrome intent (`Intent.ACTION_VIEW`), which lacked the WebView's OAuth state/session cookies and triggered a `400 Malformed Request`.
  3. Android WebView blocks third-party cookies by default across cross-origin OAuth redirects (`firebaseapp.com` ↔ `accounts.google.com`).
- **Fix Applied**:
  1. Updated `server.allowNavigation` in `capacitor.config.json` to `["*"]` so the entire OAuth redirect chain remains inside the authenticated Capacitor WebView.
  2. Patched `MainActivity.java` in `scripts/apply-android-icon.cjs` to enable `CookieManager.getInstance().setAcceptCookie(true)` and `CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)` along with `setDomStorageEnabled(true)` and `setDatabaseEnabled(true)`.

---

### Issue #7: Gesture-Triggered Exit Confirmation & Farewell Animation (`v2.0.1`)
- **Symptom**: Having an `"Exit App"` item inside the 3-bar Navigation Drawer felt non-standard, whereas swiping Back on the Android home screen closed the APK immediately without showing the Exit Confirmation modal.
- **Root Cause**:
  1. Modern Chromium WebViews ignore `window.history.pushState` entries pushed on page load before the user interacts with the page (History Manipulation Intervention), so `webView.canGoBack()` returned `false` and Android's native `OnBackPressedDispatcher` closed the Activity immediately.
- **Fix Applied**:
  1. Removed the `"Exit App"` item from the 3-bar Navigation Drawer (`src/components/NavigationDrawer.tsx`).
  2. Patched `MainActivity.java` (`scripts/apply-android-icon.cjs`) to register an AndroidX `OnBackPressedCallback(true)` on `getOnBackPressedDispatcher()` that dispatches `window.dispatchEvent(new CustomEvent('lakshay-native-back'))` into the WebView when at the root history entry.
  3. Exposed `@JavascriptInterface` `LakshayNativeBridge.closeApp()` (`finishAndRemoveTask()`) so confirming exit in `ExitAppModal` plays the farewell animation and cleanly closes the native Android task.

---

### Issue #8: GitHub CodeQL High-Severity Alert — Clear-Text Storage of Sensitive Information (`v2.0.1`)
- **Symptom**: GitHub Code Scanning (CodeQL) raised a **High** severity alert (`js/clear-text-storage-of-sensitive-data`, CWE-312) at `src/services/googleDriveSyncService.ts:177`: *"This stores sensitive data returned by an access to oauthAccessToken as clear text."*
- **Root Cause**: `saveStoredGoogleAuthSession()` serialized the raw OAuth `accessToken` alongside the user's profile metadata into `localStorage.setItem()`.
- **Fix Applied**:
  1. Refactored `src/services/googleDriveSyncService.ts` so OAuth access tokens (`cachedAccessToken`) are held **strictly in runtime memory** and never written to `localStorage` or `sessionStorage`.
  2. Restricted `localStorage` (`lakshay_library_google_profile_meta_v2`) to non-sensitive profile & folder metadata (`uid`, `email`, `displayName`, `photoURL`, `savedAtISO`, `signInFlow`, and Google Drive folder paths), while delegating session persistence to Firebase Authentication's IndexedDB (`browserLocalPersistence`).
  3. Verified via GitHub CodeQL re-scan on `main` (commit `6e4c5d0`) that Alert #2 transitioned automatically to **`fixed`** (`0 Open` alerts).

---

### Issue #9: Cross-Account Gmail Sync (`Lakshay_Library_Master` Shared-With-Me Discovery & 1-Tap Folder Sharing) (`v2.0.2`)
- **Symptom**: When a library owner signed in with `owner@gmail.com` on the Primary Phone and wanted a Secondary Phone to sign in with a *different* Gmail address (`partner@gmail.com`), the Secondary Phone created a separate empty `Lakshay_Library_Master` folder in `partner@gmail.com`'s own Drive instead of pulling the master database from `owner@gmail.com`'s `Lakshay_Library_Master` folder.
- **Root Cause**:
  1. Using only the `https://www.googleapis.com/auth/drive.file` OAuth scope restricts visibility exclusively to files created by the currently signed-in account (`partner@gmail.com`), hiding folders shared by `owner@gmail.com`.
  2. `findMasterSyncFileOnDrive()` previously called `ensureMasterSyncFolderHierarchy()` first, which created a new empty `Lakshay_Library_Master` folder in the Secondary account's root Drive instead of searching Google Drive's **"Shared with me"** items.
- **Fix Applied**:
  1. Added `'https://www.googleapis.com/auth/drive.readonly'` to `SCOPES` in `src/services/googleDriveSyncService.ts` so a Secondary device signed in with a different Gmail account can read shared Drive files.
  2. Built `shareMasterFolderWithEmail(accessToken, targetEmail)` using the Google Drive Permissions v3 API (`POST /drive/v3/files/{folderId}/permissions`) so the Primary Phone can grant Viewer (`reader`) access to any Secondary Gmail address with 1 tap inside the app.
  3. Updated `findMasterSyncFileOnDrive()` to search across all accessible Drive items (`includeItemsFromAllDrives=true&supportsAllDrives=true`), automatically discovering `Lakshay_Library_Master_Sync.json` inside **"Shared with me"** (or via an optional pasted Shared Folder Link/ID) and displaying an in-app sharing guide note (`src/components/GoogleDriveSyncModal.tsx`).

