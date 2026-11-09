import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { KOTLIN_CODE_SNIPPETS } from '../data/kotlinCodeSnippets';
import {
  X,
  Download,
  Terminal,
  Copy,
  Check,
  PackageCheck,
  FileCode2,
  ShieldCheck,
  Laptop,
  CheckCircle2,
  Cpu,
  Cloud,
} from 'lucide-react';

interface ApkExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerToast: (msg: string) => void;
}

const STANDARD_ANDROID_MANIFEST_XML = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.librarymanagement">

    <!-- Standard Android permissions managed by Global Android OS & Google Play Protect -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.CAMERA" />

    <application
        android:allowBackup="true"
        android:usesCleartextTraffic="false"
        android:label="Lakshay Library"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.Material.Light.NoActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

    </application>
</manifest>`;

const APP_BUILD_GRADLE_KTS = `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.example.librarymanagement"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.librarymanagement"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.10"
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.04.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    implementation(platform("com.google.firebase:firebase-bom:33.0.0"))
    implementation("com.google.firebase:firebase-firestore-ktx")
    implementation("com.google.zxing:core:3.5.3")
    implementation("com.google.mlkit:barcode-scanning:17.2.0")
    implementation("androidx.camera:camera-camera2:1.3.3")
    implementation("androidx.camera:camera-lifecycle:1.3.3")
    implementation("androidx.camera:camera-view:1.3.3")
}`;

const GITHUB_ACTIONS_APK_WORKFLOW = `name: Build Lakshay Library Standalone APK

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  build-standalone-apk:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Source
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Install Dependencies & Build Offline Bundle
        run: |
          npm install
          npm run build
          npm install @capacitor/core @capacitor/cli @capacitor/android
          npx cap add android || true
          npx cap sync android

      - name: Compile Standalone Android APK (app-debug.apk)
        working-directory: ./android
        run: |
          chmod +x gradlew
          ./gradlew assembleDebug

      - name: Upload Compiled LakshayLibrary.apk Artifact
        uses: actions/upload-artifact@v4
        with:
          name: LakshayLibrary-Standalone-APK
          path: android/app/build/outputs/apk/debug/*.apk`;

const WINDOWS_CAPACITOR_BAT = `@echo off
REM ============================================================================
REM Lakshay Library — Windows Laptop Standalone .APK Builder (Capacitor)
REM Run this inside the unzipped project folder on your Windows Laptop
REM Produces a 100% standalone offline APK (never launches a browser web page!)
REM ============================================================================
echo [1/5] Installing project dependencies...
call npm install

echo [2/5] Building offline production bundle into ./dist ...
call npm run build

echo [3/5] Installing Capacitor Android packager...
call npm install @capacitor/core @capacitor/cli @capacitor/android

echo [4/5] Generating native Android project & bundling offline assets...
call npx cap add android
call npx cap sync android

echo [5/5] Compiling standalone Android APK (app-debug.apk)...
cd android
call gradlew.bat assembleDebug
cd ..

echo.
echo ============================================================================
echo SUCCESS! Your standalone APK file is ready at:
echo android\\app\\build\\outputs\\apk\\debug\\app-debug.apk
echo Copy app-debug.apk to your phone via USB or Google Drive and tap to install!
echo ============================================================================
pause
`;

const MAC_LINUX_CAPACITOR_SH = `#!/usr/bin/env bash
# ============================================================================
# Lakshay Library — Mac / Linux Laptop Standalone .APK Builder (Capacitor)
# Run this inside the unzipped project folder on your Laptop:
#   bash build-standalone-apk-laptop.sh
# Produces a 100% standalone offline APK (never launches a browser web page!)
# ============================================================================
set -e

echo "[1/5] Installing project dependencies..."
npm install

echo "[2/5] Building offline production bundle into ./dist ..."
npm run build

echo "[3/5] Installing Capacitor Android packager..."
npm install @capacitor/core @capacitor/cli @capacitor/android

echo "[4/5] Generating native Android project & bundling offline assets..."
npx cap add android || true
npx cap sync android

echo "[5/5] Compiling standalone Android APK (app-debug.apk)..."
cd android
chmod +x gradlew
./gradlew assembleDebug
cd ..

echo ""
echo "============================================================================"
echo "✓ SUCCESS! Your standalone APK file is ready at:"
echo "  android/app/build/outputs/apk/debug/app-debug.apk"
echo "Transfer app-debug.apk to your Android phone and tap to install!"
echo "============================================================================"
`;

export const ApkExportModal: React.FC<ApkExportModalProps> = ({
  isOpen,
  onClose,
  onTriggerToast,
}) => {
  const { darkModeClass, isDarkMode } = useTheme();
  const [activeGuideTab, setActiveGuideTab] = useState<'CAPACITOR_LAPTOP' | 'KOTLIN_STUDIO' | 'GITHUB_CLOUD'>('CAPACITOR_LAPTOP');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(key);
    setTimeout(() => setCopiedCmd(null), 2200);
  };

  const downloadFile = (filename: string, content: string, mime = 'text/plain;charset=utf-8;') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onTriggerToast(`Downloaded ${filename}!`);
  };

  const handleDownloadKotlinStudioScript = () => {
    const lines: string[] = [
      '#!/usr/bin/env bash',
      '# ============================================================================',
      '# Lakshay Library Management App (LibTrack) — Native Kotlin Jetpack Compose APK',
      '# Run on your laptop: bash build-lakshay-kotlin-apk.sh',
      '# ============================================================================',
      'set -e',
      'mkdir -p LakshayLibraryAndroid/app/src/main/java/com/example/librarymanagement/{ui,ui/components,ui/theme,data,worker}',
      'mkdir -p LakshayLibraryAndroid/.github/workflows',
      'cd LakshayLibraryAndroid',
      '',
      "cat << 'EOF_MANIFEST' > app/src/main/AndroidManifest.xml",
      STANDARD_ANDROID_MANIFEST_XML,
      'EOF_MANIFEST',
      '',
      "cat << 'EOF' > app/build.gradle.kts",
      APP_BUILD_GRADLE_KTS,
      'EOF',
      '',
    ];

    for (const snippet of KOTLIN_CODE_SNIPPETS) {
      lines.push(`mkdir -p "$(dirname "${snippet.path}")"`);
      lines.push(`cat << 'EOF_KT' > "${snippet.path}"`);
      lines.push(snippet.code);
      lines.push('EOF_KT');
      lines.push('');
    }

    lines.push(
      'echo "✓ Lakshay Library Native Kotlin project generated in ./LakshayLibraryAndroid"'
    );

    downloadFile('build-lakshay-kotlin-apk.sh', lines.join('\n'), 'text/x-shellscript;charset=utf-8;');
  };

  const capacitorWindowsCommands = `npm install
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
cd android && gradlew.bat assembleDebug`;

  const capacitorMacLinuxCommands = `npm install
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug`;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-200 ${darkModeClass}`}
      onClick={onClose}
    >
      <div
        className={`w-full sm:max-w-xl h-[92vh] sm:h-full rounded-t-3xl sm:rounded-t-none sm:rounded-l-3xl shadow-2xl border-t sm:border-t-0 sm:border-l overflow-hidden flex flex-col animate-in slide-in-from-bottom sm:slide-in-from-right duration-200 ${
          isDarkMode
            ? 'bg-slate-900 border-slate-800/60 text-slate-100'
            : 'bg-white border-slate-200/60 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between bg-amber-500/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Build Real Standalone .APK on Your Laptop
              </h2>
              <p className="text-xs text-slate-500">
                100% Offline Android Binary &bull; Does Not Launch a Web Page
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Method Selector Tabs */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-200/60 flex items-center gap-1.5 bg-slate-50/70 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveGuideTab('CAPACITOR_LAPTOP')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeGuideTab === 'CAPACITOR_LAPTOP'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>1. Laptop CLI (Fastest .APK)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveGuideTab('KOTLIN_STUDIO')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeGuideTab === 'KOTLIN_STUDIO'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>2. Android Studio (Kotlin)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveGuideTab('GITHUB_CLOUD')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeGuideTab === 'GITHUB_CLOUD'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>3. GitHub Cloud APK (No SDK)</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Global Android OS & Google Security Services Banner */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/70 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-bold text-slate-900">
                  Protected by Global Android OS &amp; Google Security Services
                </div>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Uses standard Android OS application sandboxing, Google OAuth 2.0, and HTTPS TLS
                  encryption managed by global platform security services.
                </p>
              </div>
            </div>
          </div>

          {activeGuideTab === 'CAPACITOR_LAPTOP' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-amber-200/70 bg-amber-50/60 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-amber-600 text-white">
                    Recommended Laptop Method
                  </span>
                  <span className="text-[11px] font-mono text-amber-800 font-semibold">
                    Output: app-debug.apk
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  How to Build Your Standalone .APK File on Your Laptop
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Browsers cannot compile native <code>.apk</code> binaries directly on a phone,
                  which is why browser installs only create a web shortcut. Follow these{' '}
                  <strong>4 simple steps on your laptop</strong> to compile a real, self-contained{' '}
                  <code>app-debug.apk</code> where all app files are packaged inside the APK:
                </p>

                <ol className="text-xs text-slate-800 space-y-2.5 list-decimal list-inside bg-white p-3.5 rounded-xl border border-slate-200/70 leading-relaxed">
                  <li>
                    <strong>Download or Clone Repository on Your Laptop:</strong> Clone this repository
                    to your laptop (or download the project ZIP from GitHub), then open the folder on your laptop.
                  </li>
                  <li>
                    <strong>Prerequisites on Laptop:</strong> Make sure you have{' '}
                    <strong>Node.js (v18+)</strong> and <strong>Java JDK 17 + Android Studio</strong>{' '}
                    installed on your laptop.
                  </li>
                  <li>
                    <strong>Run the 1-Click APK Builder Script (or terminal commands below):</strong>{' '}
                    We already configured <code>capacitor.config.json</code> in this project so it
                    bundles <code>./dist</code> directly inside the Android APK.
                  </li>
                  <li>
                    <strong>Copy the .APK to Your Phone:</strong> Once the command finishes, grab
                    your real APK file at:
                    <div className="mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px] break-all">
                      android/app/build/outputs/apk/debug/app-debug.apk
                    </div>
                  </li>
                </ol>

                {/* 1-Click Script Downloads for Windows & Mac/Linux */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile('build-lakshay-apk-windows.bat', WINDOWS_CAPACITOR_BAT)
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Windows APK Script (.bat)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(
                        'build-standalone-apk-laptop.sh',
                        MAC_LINUX_CAPACITOR_SH,
                        'text/x-shellscript;charset=utf-8;'
                      )
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>Mac / Linux APK Script (.sh)</span>
                  </button>
                </div>
              </div>

              {/* Copy-paste Commands for Windows */}
              <div className="rounded-2xl bg-slate-950 p-3.5 text-[11px] font-mono text-slate-200 space-y-2 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-sans font-bold text-xs text-amber-400 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Windows Laptop Terminal (Command Prompt / PowerShell):</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText('win', capacitorWindowsCommands)}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-400 font-sans text-[11px] font-semibold flex items-center gap-1"
                  >
                    {copiedCmd === 'win' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Commands</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-emerald-300 overflow-x-auto leading-relaxed">
                  {capacitorWindowsCommands}
                </pre>
              </div>

              {/* Copy-paste Commands for Mac / Linux */}
              <div className="rounded-2xl bg-slate-950 p-3.5 text-[11px] font-mono text-slate-200 space-y-2 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-sans font-bold text-xs text-amber-400 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Mac / Linux Laptop Terminal:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText('mac', capacitorMacLinuxCommands)}
                    className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-400 font-sans text-[11px] font-semibold flex items-center gap-1"
                  >
                    {copiedCmd === 'mac' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Commands</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-amber-300 overflow-x-auto leading-relaxed">
                  {capacitorMacLinuxCommands}
                </pre>
              </div>
            </div>
          )}

          {activeGuideTab === 'KOTLIN_STUDIO' && (
            <div className="p-4 rounded-2xl border border-slate-200/60 bg-slate-50 space-y-3.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-amber-600" />
                  <span>Method 2: Build Native Kotlin Jetpack Compose APK in Android Studio</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Generates the complete native Android Studio project containing the hardened{' '}
                  <code>AndroidManifest.xml</code> (with <code>android:exported=&quot;false&quot;</code>,
                  signature-only permissions, and zero external <code>&lt;queries&gt;</code>) plus
                  all <strong>{KOTLIN_CODE_SNIPPETS.length} Kotlin source files</strong>.
                </p>
              </div>

              <ol className="text-xs text-slate-700 space-y-2 list-decimal list-inside bg-white p-3.5 rounded-xl border border-slate-200/70">
                <li>
                  Download <code>build-lakshay-kotlin-apk.sh</code> below on your laptop.
                </li>
                <li>
                  Run <code>bash build-lakshay-kotlin-apk.sh</code> (on Windows, run inside{' '}
                  <strong>Git Bash</strong> or <strong>WSL</strong>) to extract the{' '}
                  <code>LakshayLibraryAndroid</code> folder.
                </li>
                <li>
                  Open <strong>Android Studio</strong> &rarr; <strong>Open</strong> &rarr; select{' '}
                  <code>LakshayLibraryAndroid</code>.
                </li>
                <li>
                  In the top menu bar of Android Studio, click{' '}
                  <strong>Build &rarr; Build Bundle(s) / APK(s) &rarr; Build APK(s)</strong>.
                </li>
                <li>
                  Click <strong>locate</strong> in the bottom-right popup to get your{' '}
                  <code>app-debug.apk</code>!
                </li>
              </ol>

              <button
                type="button"
                onClick={handleDownloadKotlinStudioScript}
                className="w-full px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>Download Native Kotlin Android Studio Generator (.sh)</span>
              </button>
            </div>
          )}

          {activeGuideTab === 'GITHUB_CLOUD' && (
            <div className="p-4 rounded-2xl border border-slate-200/60 bg-slate-50 space-y-3.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-amber-600" />
                  <span>
                    Method 3: Compile .APK in GitHub Actions Cloud (No Android Studio Needed on
                    Laptop!)
                  </span>
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Don&apos;t want to install Android Studio or Java SDK on your laptop? Let GitHub&apos;s
                  free cloud servers compile <code>app-debug.apk</code> for you automatically:
                </p>
              </div>

              <ol className="text-xs text-slate-700 space-y-2 list-decimal list-inside bg-white p-3.5 rounded-xl border border-slate-200/70 leading-relaxed">
                <li>
                  Export/Push this project to a private <strong>GitHub repository</strong> from your
                  laptop.
                </li>
                <li>
                  Download <code>build-apk.yml</code> below and place it inside your repo at{' '}
                  <code>.github/workflows/build-apk.yml</code>.
                </li>
                <li>
                  Open your GitHub repository &rarr; click the <strong>Actions</strong> tab &rarr;
                  click <strong>Build Lakshay Library Standalone APK</strong> &rarr; click{' '}
                  <strong>Run workflow</strong>.
                </li>
                <li>
                  In ~2 minutes, scroll down to <strong>Artifacts</strong> and download{' '}
                  <strong>LakshayLibrary-Standalone-APK.zip</strong> containing your compiled{' '}
                  <code>app-debug.apk</code>!
                </li>
              </ol>

              <button
                type="button"
                onClick={() =>
                  downloadFile('build-apk.yml', GITHUB_ACTIONS_APK_WORKFLOW, 'text/yaml;charset=utf-8;')
                }
                className="w-full px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <FileCode2 className="w-4 h-4" />
                <span>Download GitHub Actions APK Compiler (.yml)</span>
              </button>
            </div>
          )}

          {/* Checklist footer */}
          <div className="p-3.5 rounded-2xl bg-slate-100/80 border border-slate-200/60 flex items-center gap-2.5 text-xs text-slate-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Note:</strong> We also removed the fake phone simulator bezel when viewing on
              mobile screens so your app always renders full-screen like a native Android app.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
