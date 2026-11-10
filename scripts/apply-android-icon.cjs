const fs = require('fs');
const path = require('path');

const iconSource = path.join(__dirname, '../public/app-icon.png');
const resDir = path.join(__dirname, '../android/app/src/main/res');

if (!fs.existsSync(iconSource)) {
  console.error('Source icon not found at', iconSource);
  process.exit(1);
}

if (!fs.existsSync(resDir)) {
  console.log('Android res dir not found yet:', resDir);
  process.exit(0);
}

const iconBuffer = fs.readFileSync(iconSource);

// 1. Walk and replace all ic_launcher*.png and splash.png files in android/app/src/main/res
const walkSync = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkSync(filePath));
    } else {
      if ((file.includes('ic_launcher') || file === 'splash.png') && file.endsWith('.png')) {
        results.push(filePath);
      }
    }
  });
  return results;
};

const targetPngs = walkSync(resDir);
console.log(`Found ${targetPngs.length} Android icon/splash PNG files to replace.`);
targetPngs.forEach((file) => {
  fs.writeFileSync(file, iconBuffer);
  console.log(`Replaced PNG: ${file}`);
});

// 2. Remove adaptive-icon XML overrides (mipmap-anydpi-v26 & vector drawables)
const pathsToRemove = [
  path.join(resDir, 'mipmap-anydpi-v26/ic_launcher.xml'),
  path.join(resDir, 'mipmap-anydpi-v26/ic_launcher_round.xml'),
  path.join(resDir, 'mipmap-anydpi-v26'),
  path.join(resDir, 'drawable-v24/ic_launcher_foreground.xml'),
  path.join(resDir, 'drawable/ic_launcher_background.xml'),
];

pathsToRemove.forEach((p) => {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
    console.log(`Removed default vector/adaptive override: ${p}`);
  }
});

// 3. Update ic_launcher_background.xml color to deep teal (#0B192C)
const bgXmlPath = path.join(resDir, 'values/ic_launcher_background.xml');
if (fs.existsSync(bgXmlPath)) {
  const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0B192C</color>
</resources>
`;
  fs.writeFileSync(bgXmlPath, xmlContent);
  console.log('Updated ic_launcher_background.xml to deep teal (#0B192C)');
}

// 4. Sync versionName and versionCode in android/app/build.gradle from package.json
const buildGradlePath = path.join(__dirname, '../android/app/build.gradle');
const pkgJsonPath = path.join(__dirname, '../package.json');
if (fs.existsSync(buildGradlePath) && fs.existsSync(pkgJsonPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const versionName = pkg.version || '2.0.1';
    const parts = versionName.split('.').map((n) => parseInt(n, 10) || 0);
    const versionCode = (parts[0] || 2) * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);
    let gradleContent = fs.readFileSync(buildGradlePath, 'utf8');
    gradleContent = gradleContent.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
    gradleContent = gradleContent.replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);
    fs.writeFileSync(buildGradlePath, gradleContent);
    console.log(`Updated android/app/build.gradle to versionName "${versionName}" (versionCode ${versionCode})`);
  } catch (err) {
    console.warn('Could not update build.gradle version:', err.message);
  }
}

// 5. Patch MainActivity.java to enable 3rd-party OAuth cookies, clean Chrome User-Agent,
// and intercept Android System Back Gesture to trigger ExitAppModal in React!
const javaRoot = path.join(__dirname, '../android/app/src/main/java');
if (fs.existsSync(javaRoot)) {
  const findMainActivity = (dir) => {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        const found = findMainActivity(fullPath);
        if (found) return found;
      } else if (entry === 'MainActivity.java') {
        return fullPath;
      }
    }
    return null;
  };

  const mainActivityPath = findMainActivity(javaRoot);
  if (mainActivityPath) {
    const existingSource = fs.readFileSync(mainActivityPath, 'utf8');
    const pkgMatch = existingSource.match(/package\s+([a-zA-Z0-9_.]+);/);
    const pkgName = pkgMatch ? pkgMatch[1] : 'com.lakshaylibrary.app';

    const enhancedMainActivity = `package ${pkgName};

import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                // Enable first-party and third-party cookies for Firebase & Google OAuth redirects
                CookieManager cookieManager = CookieManager.getInstance();
                cookieManager.setAcceptCookie(true);
                cookieManager.setAcceptThirdPartyCookies(webView, true);

                WebSettings settings = webView.getSettings();
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setJavaScriptCanOpenWindowsAutomatically(true);
                settings.setSupportMultipleWindows(false);

                // Remove "; wv" marker so Google Sign-In never blocks or rejects the WebView
                String ua = settings.getUserAgentString();
                if (ua != null) {
                    settings.setUserAgentString(ua.replace("; wv", ""));
                }

                // Expose Native Bridge so React ExitAppModal can close the Android app after animation
                webView.addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public void closeApp() {
                        runOnUiThread(() -> {
                            finishAndRemoveTask();
                        });
                    }
                }, "LakshayNativeBridge");
            }
        } catch (Exception ignored) {
        }

        // Intercept Android system Back gesture / Back button to prompt Exit Confirmation in React
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                try {
                    WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                    if (webView != null) {
                        webView.evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('lakshay-native-back'));",
                            null
                        );
                        return;
                    }
                } catch (Exception ignored) {
                }
                finish();
            }
        });
    }
}
`;
    fs.writeFileSync(mainActivityPath, enhancedMainActivity, 'utf8');
    console.log(`Patched ${mainActivityPath} with OAuth CookieManager, User-Agent fix, and Back Gesture handler!`);
  }
}
