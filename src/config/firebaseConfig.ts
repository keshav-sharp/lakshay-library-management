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
    import.meta.env?.VITE_FIREBASE_PROJECT_ID ||
    localFileConfig.projectId ||
    'gen-lang-client-0586032146',
  appId:
    import.meta.env?.VITE_FIREBASE_APP_ID ||
    localFileConfig.appId ||
    '1:511395414632:web:dc773d7f0025851ef7b1dd',
  apiKey:
    import.meta.env?.VITE_FIREBASE_API_KEY ||
    localFileConfig.apiKey ||
    '',
  authDomain:
    import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN ||
    localFileConfig.authDomain ||
    'gen-lang-client-0586032146.firebaseapp.com',
  storageBucket:
    import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET ||
    localFileConfig.storageBucket ||
    'gen-lang-client-0586032146.firebasestorage.app',
  messagingSenderId:
    import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    localFileConfig.messagingSenderId ||
    '511395414632',
  oAuthClientId:
    localFileConfig.oAuthClientId ||
    '511395414632-rkn4o6a7ne4iarcc9og8t1sebeoi4e1b.apps.googleusercontent.com',
};

export default firebaseConfig;
