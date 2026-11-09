// Firebase Client Configuration
// Safe loader: loads from environment variables or optional local configuration

interface FirebaseAppConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
}

let localFileConfig: Partial<FirebaseAppConfig> = {};

try {
  // Vite eager glob imports root config if present locally without throwing if missing
  const globbed = import.meta.glob('/firebase-applet-config.json', { eager: true });
  const entry = globbed['/firebase-applet-config.json'] as { default?: FirebaseAppConfig } | undefined;
  if (entry) {
    localFileConfig = entry.default || (entry as unknown as FirebaseAppConfig) || {};
  }
} catch {
  // Ignored when running in production or repository clone without local file
}

export const firebaseConfig: FirebaseAppConfig = {
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    localFileConfig.projectId ||
    '',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    localFileConfig.appId ||
    '',
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    localFileConfig.apiKey ||
    '',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    localFileConfig.authDomain ||
    '',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    localFileConfig.storageBucket ||
    '',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    localFileConfig.messagingSenderId ||
    '',
  oAuthClientId:
    localFileConfig.oAuthClientId ||
    '',
};

export default firebaseConfig;
