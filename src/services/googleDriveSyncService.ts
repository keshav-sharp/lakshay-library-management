import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User,
  Auth,
  UserCredential,
} from 'firebase/auth';
import firebaseConfig from '../config/firebaseConfig';
import {
  getStoredStudents,
  getStoredPayments,
  getStoredDailyAttendance,
  importSyncedFirestoreSnapshot,
} from './storageService';
import { getStoredShifts, saveStoredShifts } from './shiftService';
import { getStoredSeats, saveStoredSeats } from './seatService';
import { getStoredUpiConfig, saveUpiConfig } from './upiConfigService';

// Use only the non-sensitive `drive.file` scope (never `drive.readonly`, which is a Restricted scope
// that triggers Google's Error 403: access_denied verification block).
export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// Hierarchical Master Folder & Subfolder Architecture on Google Drive
export const MASTER_DRIVE_ROOT_FOLDER_NAME = 'Lakshay_Library_Master';
export const MASTER_SYNC_SUBFOLDER_NAME = 'Master_Sync_Backups';
export const AUTOMATED_LOGS_SUBFOLDER_NAME = 'Automated_Logs';
export const MASTER_DRIVE_BACKUP_FILENAME = 'Lakshay_Library_Master_Sync.json';
export const MASTER_DRIVE_SYNC_PATH = `${MASTER_DRIVE_ROOT_FOLDER_NAME}/${MASTER_SYNC_SUBFOLDER_NAME}/${MASTER_DRIVE_BACKUP_FILENAME}`;
export const MASTER_DRIVE_LOGS_PATH = `${MASTER_DRIVE_ROOT_FOLDER_NAME}/${AUTOMATED_LOGS_SUBFOLDER_NAME}`;

// Persistent Local Storage Keys for Sign-In Profile Metadata & Sync Configuration
export const GOOGLE_AUTH_SESSION_STORAGE_KEY = 'lakshay_library_google_profile_meta_v2';
export const GDRIVE_SYNC_CONFIG_KEY = 'lakshay_library_gdrive_sync_config_v1';
export const PENDING_DRIVE_REDIRECT_FLAG_KEY = 'lakshay_library_pending_drive_redirect';

export type DeviceSyncRole = 'PRIMARY' | 'SECONDARY';

export interface StoredGoogleAuthSession {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  savedAtISO: string;
  signInFlow: 'POPUP' | 'REDIRECT' | 'RESTORED';
  localStorageKey: string;
  driveMasterSyncPath: string;
  driveAutomatedLogsPath: string;
}

export interface GoogleDriveSyncConfig {
  deviceId: string;
  deviceName: string;
  deviceRole: DeviceSyncRole;
  autoDailySyncEnabled: boolean;
  lastSyncedDateKey: string | null;
  lastSyncedAtISO: string | null;
  lastDriveFileId: string | null;
  lastPrimaryWriterName: string | null;
  lastSyncedStudentCount: number | null;
  masterRootFolderId?: string | null;
  masterSyncSubfolderId?: string | null;
  sharedFolderInput?: string | null;
  sharedWithEmails?: string[];
  masterSyncKey?: string | null;
  masterSyncChannelTopic?: string | null;
}

export interface DriveBackupFileMetadata {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
  folderPath?: string;
}

export interface MasterSyncPayload {
  schemaVersion: string;
  application: string;
  syncedAt: string;
  syncDateKey: string;
  primaryDeviceId: string;
  primaryDeviceName: string;
  syncChannelTopic?: string;
  masterSyncKey?: string;
  folderPath: string;
  data: {
    students: ReturnType<typeof getStoredStudents>;
    payments: ReturnType<typeof getStoredPayments>;
    dailyAttendance: ReturnType<typeof getStoredDailyAttendance>;
    shifts: ReturnType<typeof getStoredShifts>;
    seats: ReturnType<typeof getStoredSeats>;
    upiConfig?: ReturnType<typeof getStoredUpiConfig>;
  };
}

// Lazily initialize Firebase Auth with durable browserLocalPersistence
let cachedAuthInstance: Auth | null = null;

const getFirebaseAuth = (): Auth | null => {
  if (cachedAuthInstance) return cachedAuthInstance;
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    return null;
  }
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch(() => {
      // Ignore if persistence is already configured
    });
    cachedAuthInstance = auth;
    return cachedAuthInstance;
  } catch {
    return null;
  }
};

// Creates a fresh GoogleAuthProvider instance on each sign-in attempt.
// When `includeDriveScope` is false (e.g. Secondary phone signing in with a different unverified Gmail),
// only standard `email` and `profile` scopes are requested so Google never blocks with Error 403.
const createGoogleAuthProvider = (includeDriveScope = true): GoogleAuthProvider => {
  const provider = new GoogleAuthProvider();
  if (includeDriveScope) {
    SCOPES.forEach((scope) => provider.addScope(scope));
  } else {
    provider.addScope('email');
    provider.addScope('profile');
  }
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  return provider;
};

// Detect if running inside an Android APK WebView or Capacitor container
export const isNativeAndroidWebView = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isAndroidWv = /Android/i.test(ua) && /; wv\)/i.test(ua);
  const hasCapacitor = Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  );
  const hasNativeBridge = Boolean(
    (window as unknown as { LakshayNativeBridge?: unknown }).LakshayNativeBridge
  );
  return isAndroidWv || hasCapacitor || hasNativeBridge;
};

/**
 * Reads the persisted non-sensitive Google profile metadata from localStorage.
 * OAuth access tokens are never stored in clear text in localStorage.
 */
export const getStoredGoogleAuthSession = (): StoredGoogleAuthSession | null => {
  try {
    const raw = localStorage.getItem(GOOGLE_AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGoogleAuthSession;
    if (parsed && parsed.uid) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Persists non-sensitive Google user profile & Drive folder metadata to localStorage.
 * Sensitive OAuth access tokens are kept strictly in runtime memory (`cachedAccessToken`).
 */
export const saveStoredGoogleAuthSession = (
  user: Pick<User, 'uid' | 'email' | 'displayName' | 'photoURL'>,
  signInFlow: StoredGoogleAuthSession['signInFlow'] = 'POPUP'
): StoredGoogleAuthSession => {
  const profileMeta: StoredGoogleAuthSession = {
    uid: user.uid,
    email: user.email || null,
    displayName: user.displayName || null,
    photoURL: user.photoURL || null,
    savedAtISO: new Date().toISOString(),
    signInFlow,
    localStorageKey: GOOGLE_AUTH_SESSION_STORAGE_KEY,
    driveMasterSyncPath: MASTER_DRIVE_SYNC_PATH,
    driveAutomatedLogsPath: MASTER_DRIVE_LOGS_PATH,
  };
  try {
    localStorage.setItem(GOOGLE_AUTH_SESSION_STORAGE_KEY, JSON.stringify(profileMeta));
  } catch {
    // Ignore storage quota errors
  }
  return profileMeta;
};

/**
 * Clears the persisted Google profile metadata and in-memory access token.
 */
export const clearStoredGoogleAuthSession = (): void => {
  cachedAccessToken = null;
  try {
    localStorage.removeItem(GOOGLE_AUTH_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(PENDING_DRIVE_REDIRECT_FLAG_KEY);
  } catch {
    // Ignore storage errors
  }
};

// Keep OAuth access token strictly in memory (never written to localStorage in clear text)
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let redirectResultPromise: Promise<{ user: User; token: string } | null> | null = null;

const extractAccessTokenFromCredentialResult = (result: UserCredential | null): string | null => {
  if (!result) return null;
  const credential = GoogleAuthProvider.credentialFromResult(result);
  return credential?.accessToken ?? null;
};

export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  const auth = getFirebaseAuth();

  if (!auth) {
    if (onAuthFailure) {
      onAuthFailure();
    }
    return () => {};
  }

  if (!redirectResultPromise) {
    redirectResultPromise = getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
          const token = extractAccessTokenFromCredentialResult(result);
          saveStoredGoogleAuthSession(result.user, 'REDIRECT');
          if (token) {
            cachedAccessToken = token;
            return { user: result.user, token };
          }
        }
        return null;
      })
      .catch(() => null);
  }

  redirectResultPromise.then((redirectData) => {
    if (redirectData && redirectData.token) {
      cachedAccessToken = redirectData.token;
      if (onAuthSuccess) onAuthSuccess(redirectData.user, redirectData.token);
    }
  });

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (redirectResultPromise) {
      await redirectResultPromise;
    }

    if (user) {
      saveStoredGoogleAuthSession(user, 'RESTORED');
      if (cachedAccessToken && onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn && onAuthFailure) {
        onAuthFailure();
      }
    } else if (!isSigningIn) {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleDriveSignIn = async (options?: {
  identityOnly?: boolean;
}): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error('Firebase Auth is not configured in this build environment.');
  }

  const includeDriveScope = !options?.identityOnly;
  const freshProvider = createGoogleAuthProvider(includeDriveScope);

  try {
    isSigningIn = true;
    // Clear any stale redirect state before starting a fresh sign-in
    redirectResultPromise = null;

    if (isNativeAndroidWebView()) {
      try {
        sessionStorage.setItem(PENDING_DRIVE_REDIRECT_FLAG_KEY, '1');
        localStorage.setItem(PENDING_DRIVE_REDIRECT_FLAG_KEY, '1');
      } catch {
        // Ignore storage errors
      }
      await signInWithRedirect(auth, freshProvider);
      return null;
    }

    const result = await signInWithPopup(auth, freshProvider);
    const token =
      extractAccessTokenFromCredentialResult(result) ||
      (options?.identityOnly ? 'IDENTITY_SESSION_ACTIVE' : null);
    if (!token) {
      throw new Error('Failed to obtain Google Drive access token.');
    }
    cachedAccessToken = token;
    saveStoredGoogleAuthSession(result.user, 'POPUP');
    return { user: result.user, accessToken: token };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment' ||
      code === 'auth/cancelled-popup-request'
    ) {
      try {
        sessionStorage.setItem(PENDING_DRIVE_REDIRECT_FLAG_KEY, '1');
        localStorage.setItem(PENDING_DRIVE_REDIRECT_FLAG_KEY, '1');
      } catch {
        // Ignore storage errors
      }
      await signInWithRedirect(auth, createGoogleAuthProvider(includeDriveScope));
      return null;
    }
    throw err;
  } finally {
    isSigningIn = false;
  }
};

export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const getCurrentDriveUser = (): User | null => {
  const auth = getFirebaseAuth();
  if (auth?.currentUser) return auth.currentUser;
  const saved = getStoredGoogleAuthSession();
  if (saved) {
    return {
      uid: saved.uid,
      email: saved.email,
      displayName: saved.displayName,
      photoURL: saved.photoURL,
    } as User;
  }
  return null;
};

export const googleDriveLogout = async (): Promise<void> => {
  const auth = getFirebaseAuth();
  if (auth) {
    try {
      await auth.signOut();
    } catch {
      // Ignore signOut errors
    }
  }
  clearStoredGoogleAuthSession();
};

export const getGoogleDriveSyncConfig = (): GoogleDriveSyncConfig => {
  try {
    const raw = localStorage.getItem(GDRIVE_SYNC_CONFIG_KEY);
    if (!raw) {
      const defaultConfig: GoogleDriveSyncConfig = {
        deviceId: `dev_${Math.random().toString(36).substring(2, 9)}`,
        deviceName: 'Primary Library Phone',
        deviceRole: 'PRIMARY',
        autoDailySyncEnabled: true,
        lastSyncedDateKey: null,
        lastSyncedAtISO: null,
        lastDriveFileId: null,
        lastPrimaryWriterName: null,
        lastSyncedStudentCount: null,
        masterRootFolderId: null,
        masterSyncSubfolderId: null,
      };
      localStorage.setItem(GDRIVE_SYNC_CONFIG_KEY, JSON.stringify(defaultConfig));
      return defaultConfig;
    }
    return JSON.parse(raw);
  } catch {
    return {
      deviceId: 'dev_default',
      deviceName: 'Primary Library Phone',
      deviceRole: 'PRIMARY',
      autoDailySyncEnabled: true,
      lastSyncedDateKey: null,
      lastSyncedAtISO: null,
      lastDriveFileId: null,
      lastPrimaryWriterName: null,
      lastSyncedStudentCount: null,
      masterRootFolderId: null,
      masterSyncSubfolderId: null,
    };
  }
};

export const saveGoogleDriveSyncConfig = (config: GoogleDriveSyncConfig): void => {
  try {
    localStorage.setItem(GDRIVE_SYNC_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
};

/**
 * Helper: Ensures a specific folder exists in Google Drive (optionally inside a parent folder).
 */
export const ensureDriveFolderExists = async (
  accessToken: string,
  folderName: string,
  parentFolderId?: string | null,
  cachedFolderId?: string | null,
  description?: string
): Promise<string> => {
  if (cachedFolderId) {
    try {
      const checkRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${cachedFolderId}?fields=id,name,trashed`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (!checkData.trashed) {
          return cachedFolderId;
        }
      }
    } catch {
      // Fall through to search
    }
  }

  const parentClause = parentFolderId ? ` and '${parentFolderId}' in parents` : '';
  const query = encodeURIComponent(
    `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder'${parentClause} and trashed = false`
  );
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name)&pageSize=1`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    if (searchRes.status === 401 || searchRes.status === 403) {
      clearStoredGoogleAuthSession();
      throw new Error('AUTH_REQUIRED');
    }
    throw new Error(`Google Drive folder lookup failed (${searchRes.status})`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id as string;
  }

  const createPayload: Record<string, unknown> = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    description: description || `Lakshay Library folder: ${folderName}`,
  };
  if (parentFolderId) {
    createPayload.parents = [parentFolderId];
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    if (createRes.status === 401 || createRes.status === 403) {
      clearStoredGoogleAuthSession();
      throw new Error('AUTH_REQUIRED');
    }
    throw new Error(`Failed to create folder '${folderName}' on Google Drive (${createRes.status})`);
  }

  const createdData = await createRes.json();
  return createdData.id as string;
};

/**
 * Ensures the root Master Folder (`Lakshay_Library_Master`) and the `Master_Sync_Backups` subfolder exist.
 */
export const ensureMasterSyncFolderHierarchy = async (
  accessToken: string
): Promise<{ rootFolderId: string; syncSubfolderId: string }> => {
  const config = getGoogleDriveSyncConfig();

  const rootFolderId = await ensureDriveFolderExists(
    accessToken,
    MASTER_DRIVE_ROOT_FOLDER_NAME,
    null,
    config.masterRootFolderId,
    'Lakshay Library Master Cloud Directory (Contains Master Sync Backups and Automated Logs)'
  );

  const syncSubfolderId = await ensureDriveFolderExists(
    accessToken,
    MASTER_SYNC_SUBFOLDER_NAME,
    rootFolderId,
    config.masterSyncSubfolderId,
    'Lakshay Library Master Database Sync Subfolder'
  );

  if (
    config.masterRootFolderId !== rootFolderId ||
    config.masterSyncSubfolderId !== syncSubfolderId
  ) {
    saveGoogleDriveSyncConfig({
      ...config,
      masterRootFolderId: rootFolderId,
      masterSyncSubfolderId: syncSubfolderId,
    });
  }

  return { rootFolderId, syncSubfolderId };
};

/**
 * Reliable cross-platform clipboard copy helper that works inside Android APK WebView
 * as well as mobile/desktop browsers.
 */
export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (!text) return false;
  let copied = false;

  // 1. Synchronous DOM textarea copy (always permitted inside Android WebView user gesture)
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    copied = document.execCommand('copy');
    document.body.removeChild(textarea);
  } catch {
    // Fall through to navigator.clipboard
  }

  // 2. Modern Async Clipboard API
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch {
    // Ignore if synchronous copy already succeeded
  }

  return copied;
};

/**
 * Builds the live MasterSyncPayload from the device's current local storage.
 */
export const buildCurrentMasterSyncPayload = (): MasterSyncPayload => {
  const config = getGoogleDriveSyncConfig();
  const now = new Date();
  const dateKey = now.toISOString().split('T')[0];
  const cleanDeviceId = (config.deviceId || 'default').replace(/[^a-zA-Z0-9]/g, '');
  const syncChannelTopic = config.masterSyncChannelTopic || `lakshay_ch_${cleanDeviceId}`;

  return {
    schemaVersion: '2.0',
    application: 'Lakshay Library',
    syncedAt: now.toISOString(),
    syncDateKey: dateKey,
    primaryDeviceId: config.deviceId,
    primaryDeviceName: config.deviceName,
    syncChannelTopic,
    masterSyncKey: config.masterSyncKey || undefined,
    folderPath: `${MASTER_DRIVE_ROOT_FOLDER_NAME}/${MASTER_SYNC_SUBFOLDER_NAME}`,
    data: {
      students: getStoredStudents(),
      payments: getStoredPayments(),
      dailyAttendance: getStoredDailyAttendance(),
      shifts: getStoredShifts(),
      seats: getStoredSeats(),
      upiConfig: getStoredUpiConfig(),
    },
  };
};

/**
 * Triggers an immediate debounced auto-sync to Cloud Relay & Google Drive when new data is entered
 * on ANY active device (Primary, Secondary, or third consecutive device).
 * Runs seamlessly in the background without blocking the UI.
 */
let autoSyncTimeout: ReturnType<typeof setTimeout> | null = null;
let isAutoSyncing = false;

export const triggerLiveAutoSync = (delayMs: number = 800) => {
  const config = getGoogleDriveSyncConfig();
  const cleanDeviceId = (config.deviceId || 'default').replace(/[^a-zA-Z0-9]/g, '');
  const topic =
    config.masterSyncChannelTopic ||
    (config.deviceRole === 'PRIMARY' ? `lakshay_ch_${cleanDeviceId}` : null);
  if (!topic) return;

  if (autoSyncTimeout) {
    clearTimeout(autoSyncTimeout);
  }

  autoSyncTimeout = setTimeout(async () => {
    if (isAutoSyncing) return;
    try {
      isAutoSyncing = true;
      // 1. Immediately publish to the instant Cloud Relay on the shared channel
      await publishMasterSnapshotToSyncKeyRelay();

      // 2. If Google Drive access token is available in memory on this device, also push snapshot to Google Drive
      const token = getDriveAccessToken();
      if (token && config.autoDailySyncEnabled) {
        await pushPrimarySnapshotToGoogleDrive(token, config.lastDriveFileId).catch(() => {});
      }
    } catch {
      // Non-fatal background sync
    } finally {
      isAutoSyncing = false;
    }
  }, delayMs);
};

export const triggerLivePrimaryAutoSync = triggerLiveAutoSync;

/**
 * Generates a 100% self-contained, offline-capable Sync Code (`LKSYNC1:...`)
 * that embeds all student, seat, shift, payment, and attendance records directly
 * inside the string so it can be pasted on a Secondary Phone with zero server dependencies.
 */
export const generateOfflineSyncPackageKey = (): string => {
  const payload = buildCurrentMasterSyncPayload();
  // Strip bulky base64 camera images only in the compact clipboard string to keep it WhatsApp-friendly
  const compactPayload: MasterSyncPayload = {
    ...payload,
    data: {
      ...payload.data,
      students: payload.data.students.map((st) => ({
        ...st,
        photoUrl:
          st.photoUrl && st.photoUrl.startsWith('data:image') && st.photoUrl.length > 2048
            ? undefined
            : st.photoUrl,
      })),
    },
  };
  const jsonStr = JSON.stringify(compactPayload);
  const utf8Bytes = new TextEncoder().encode(jsonStr);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  const base64Url = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `LKSYNC1:${base64Url}`;
};

/**
 * Decodes a self-contained `LKSYNC1:...` sync key string back into a MasterSyncPayload.
 */
export const decodeOfflineSyncPackageKey = (input?: string | null): MasterSyncPayload | null => {
  if (!input) return null;
  const idx = input.indexOf('LKSYNC1:');
  if (idx === -1) return null;
  const rawToken = input
    .slice(idx + 'LKSYNC1:'.length)
    .trim()
    .split(/\s+/)[0];
  if (!rawToken) return null;

  try {
    let base64 = rawToken.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(jsonStr) as MasterSyncPayload;
    if (parsed && parsed.data && Array.isArray(parsed.data.students)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Extracts a 12-character Cloud Relay File ID from a `LK-XXXXXXXXXXXX` Sync Key
 * (or `https://ntfy.sh/file/XXXXXXXXXXXX.json` URL or bare 12-char relay ID).
 */
export const extractRelayFileIdFromSyncKey = (input?: string | null): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.includes('LKSYNC1:')) return null;

  // Match explicit `LK-<id>` anywhere in the pasted text (e.g. if copied with surrounding WhatsApp text)
  const lkMatch = trimmed.match(/LK-([a-zA-Z0-9]{10,16})/);
  if (lkMatch?.[1]) {
    return lkMatch[1];
  }

  // Match full relay URL `https://ntfy.sh/file/<id>.json`
  const urlMatch = trimmed.match(/ntfy\.sh\/file\/([a-zA-Z0-9]{10,16})(?:\.json)?/);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }

  // Match bare 12-char alphanumeric relay ID (note: Google Drive IDs are 28-44 chars)
  if (/^[a-zA-Z0-9]{11,14}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
};

/**
 * Extracts a clean Google Drive Folder/File ID from either a full Google Drive URL or a 20+ char Drive ID string.
 */
export const extractDriveIdFromInput = (input?: string | null): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.includes('LKSYNC1:') || extractRelayFileIdFromSyncKey(trimmed)) {
    return null;
  }
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) return folderMatch[1];
  const fileMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch?.[1]) return fileMatch[1];
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch?.[1]) return idParamMatch[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
};

/**
 * Publishes the Primary Phone's current database snapshot to the CORS-enabled Cloud Sync Relay
 * (`ntfy.sh`) and returns a short 15-character Master Sync Key (`LK-XXXXXXXXXXXX`).
 * Works WITH or WITHOUT Google Drive Sign-In and completely bypasses Google OAuth Error 403!
 */
export const publishMasterSnapshotToSyncKeyRelay = async (): Promise<{
  syncKey: string;
  fileId: string;
  syncedAt: string;
  studentCount: number;
}> => {
  const config = getGoogleDriveSyncConfig();
  const payload = buildCurrentMasterSyncPayload();
  const topic =
    payload.syncChannelTopic ||
    `lakshay_ch_${(config.deviceId || 'primary').replace(/[^a-zA-Z0-9]/g, '')}`;

  const putRes = await fetch(`https://ntfy.sh/${topic}`, {
    method: 'PUT',
    headers: {
      Filename: MASTER_DRIVE_BACKUP_FILENAME,
    },
    body: JSON.stringify(payload),
  });

  if (!putRes.ok) {
    throw new Error(`Cloud Sync Key relay returned HTTP ${putRes.status}`);
  }

  const putMeta = (await putRes.json()) as { id?: string; attachment?: { url?: string } };
  const relayFileId = putMeta.id;
  if (!relayFileId) {
    throw new Error('Failed to generate Sync Key ID from Cloud Relay.');
  }

  const syncKey = `LK-${relayFileId}`;
  const nowISO = payload.syncedAt;
  const dateKey = payload.syncDateKey;

  // If this Primary phone previously had a Google Drive File ID, also publish a bridge pointer
  // so any Secondary phone that pasted the older Drive File ID automatically resolves the new Sync Key!
  if (config.lastDriveFileId && /^[a-zA-Z0-9_-]{20,}$/.test(config.lastDriveFileId)) {
    const bridgeTopic = `lakshay_gdrive_${config.lastDriveFileId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}`;
    fetch(`https://ntfy.sh/${bridgeTopic}`, {
      method: 'PUT',
      headers: { Filename: MASTER_DRIVE_BACKUP_FILENAME },
      body: JSON.stringify({ ...payload, masterSyncKey: syncKey }),
    }).catch(() => {
      // Non-fatal background bridge
    });
  }

  const latestConfig = getGoogleDriveSyncConfig();
  saveGoogleDriveSyncConfig({
    ...latestConfig,
    masterSyncKey: syncKey,
    masterSyncChannelTopic: topic,
    lastSyncedDateKey: latestConfig.lastSyncedDateKey || dateKey,
    lastSyncedAtISO: latestConfig.lastSyncedAtISO || nowISO,
    lastPrimaryWriterName: latestConfig.deviceName,
    lastSyncedStudentCount: payload.data.students.length,
  });

  return {
    syncKey,
    fileId: relayFileId,
    syncedAt: nowISO,
    studentCount: payload.data.students.length,
  };
};

/**
 * Applies a downloaded or decoded MasterSyncPayload to local storage and updates sync config.
 */
export const applyMasterSyncPayloadLocally = (
  payload: MasterSyncPayload,
  sourceFileOrKeyId: string
): {
  fileId: string;
  primaryDeviceName: string;
  syncedAt: string;
  studentCount: number;
} => {
  if (!payload?.data?.students || !Array.isArray(payload.data.students)) {
    throw new Error('Invalid master sync snapshot format.');
  }

  importSyncedFirestoreSnapshot(
    payload.data.students,
    payload.data.payments || {},
    payload.data.dailyAttendance || []
  );

  if (Array.isArray(payload.data.shifts) && payload.data.shifts.length > 0) {
    saveStoredShifts(payload.data.shifts);
  }
  if (Array.isArray(payload.data.seats) && payload.data.seats.length > 0) {
    saveStoredSeats(payload.data.seats);
  }
  if (
    payload.data.upiConfig &&
    (payload.data.upiConfig.upiId ||
      payload.data.upiConfig.customQrImageUrl ||
      payload.data.upiConfig.isConfigured)
  ) {
    saveUpiConfig(payload.data.upiConfig);
  }

  const now = new Date();
  const dateKey = now.toISOString().split('T')[0];
  const config = getGoogleDriveSyncConfig();

  saveGoogleDriveSyncConfig({
    ...config,
    lastSyncedDateKey: dateKey,
    lastSyncedAtISO: now.toISOString(),
    lastDriveFileId: sourceFileOrKeyId,
    lastPrimaryWriterName: payload.primaryDeviceName || 'Primary Phone',
    lastSyncedStudentCount: payload.data.students.length,
    masterSyncChannelTopic: payload.syncChannelTopic || config.masterSyncChannelTopic || null,
  });

  return {
    fileId: sourceFileOrKeyId,
    primaryDeviceName: payload.primaryDeviceName || 'Primary Phone',
    syncedAt: payload.syncedAt || now.toISOString(),
    studentCount: payload.data.students.length,
  };
};

/**
 * Checks the live Cloud Relay channel for any newer snapshot published by any peer device
 * (Primary, Secondary, or third consecutive device).
 * If found and authored by another device with a newer timestamp, it downloads and applies it locally right away.
 * Returns { synced: true, ... } if new peer data was applied, or { synced: false } if already up-to-date.
 */
let isCheckingLiveRelay = false;
export const checkAndApplyLiveRelaySync = async (): Promise<{
  synced: boolean;
  studentCount?: number;
  primaryDeviceName?: string;
  syncedAt?: string;
}> => {
  const config = getGoogleDriveSyncConfig();
  const cleanDeviceId = (config.deviceId || 'default').replace(/[^a-zA-Z0-9]/g, '');
  const topic =
    config.masterSyncChannelTopic ||
    (config.deviceRole === 'PRIMARY' ? `lakshay_ch_${cleanDeviceId}` : null);

  if (!topic) {
    return { synced: false };
  }
  if (isCheckingLiveRelay) return { synced: false };

  try {
    isCheckingLiveRelay = true;
    const pollRes = await fetch(
      `https://ntfy.sh/${topic}/json?poll=1&since=1h`
    );
    if (!pollRes.ok) return { synced: false };
    const text = (await pollRes.text()).trim();
    if (!text) return { synced: false };

    const lines = text
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as { id?: string; attachment?: { url?: string }; time?: number };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as { id?: string; attachment?: { url?: string }; time?: number }[];

    const newestMsg = [...lines].reverse().find((m) => m.id && m.attachment?.url);
    if (!newestMsg?.id) return { synced: false };

    const candidateFileId = `LK-${newestMsg.id}`;
    if (config.lastDriveFileId === candidateFileId) {
      // Already at this exact snapshot
      return { synced: false };
    }

    const newerFileRes = await fetch(`https://ntfy.sh/file/${newestMsg.id}.json`);
    if (!newerFileRes.ok) return { synced: false };

    const newerPayload = (await newerFileRes.json()) as MasterSyncPayload;
    if (!newerPayload?.data?.students) return { synced: false };

    // Ignore snapshots authored by this device itself to prevent self-echoes
    if (newerPayload.primaryDeviceId === config.deviceId) {
      return { synced: false };
    }

    // If payload has a syncedAt, compare with local lastSyncedAtISO
    if (config.lastSyncedAtISO && newerPayload.syncedAt) {
      const lastTime = new Date(config.lastSyncedAtISO).getTime();
      const payloadTime = new Date(newerPayload.syncedAt).getTime();
      if (payloadTime <= lastTime) {
        return { synced: false };
      }
    }

    const result = applyMasterSyncPayloadLocally(newerPayload, candidateFileId);
    return {
      synced: true,
      studentCount: result.studentCount,
      primaryDeviceName: result.primaryDeviceName,
      syncedAt: result.syncedAt,
    };
  } catch {
    return { synced: false };
  } finally {
    isCheckingLiveRelay = false;
  }
};

/**
 * Enables link-based read permission (`type: 'anyone', role: 'reader'`) on a Drive file or folder.
 */
export const enableAnyoneReaderPermission = async (
  accessToken: string,
  fileOrFolderId: string
): Promise<void> => {
  try {
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileOrFolderId}/permissions?supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      }
    );
  } catch {
    // Non-fatal if permission already exists
  }
};

/**
 * PRIMARY DEVICE HELPER: Grants read-only permission on the `Lakshay_Library_Master`
 * root folder, `Master_Sync_Backups` subfolder, and `Lakshay_Library_Master_Sync.json` file
 * to another Google account email AND enables Sync Key reader access.
 */
export const shareMasterFolderWithEmail = async (
  accessToken: string,
  targetEmail: string
): Promise<{ rootFolderId: string; syncSubfolderId: string; sharedEmail: string }> => {
  const cleanEmail = targetEmail.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid Google email address (e.g. colleague@gmail.com).');
  }

  const { rootFolderId, syncSubfolderId } = await ensureMasterSyncFolderHierarchy(accessToken);
  const config = getGoogleDriveSyncConfig();
  const idsToShare = [rootFolderId, syncSubfolderId];
  if (config.lastDriveFileId) {
    idsToShare.push(config.lastDriveFileId);
  }

  for (const id of idsToShare) {
    await enableAnyoneReaderPermission(accessToken, id);
    const permRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}/permissions?sendNotificationEmail=false&supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'user',
          emailAddress: cleanEmail,
        }),
      }
    );

    if (!permRes.ok) {
      if (permRes.status === 401 || permRes.status === 403) {
        clearStoredGoogleAuthSession();
        throw new Error('AUTH_REQUIRED');
      }
      const errText = await permRes.text().catch(() => '');
      throw new Error(
        `Failed to share folder with ${cleanEmail} (${permRes.status}). ${errText.slice(0, 120)}`
      );
    }
  }

  const existingEmails = config.sharedWithEmails || [];
  if (!existingEmails.includes(cleanEmail)) {
    saveGoogleDriveSyncConfig({
      ...config,
      sharedWithEmails: [...existingEmails, cleanEmail],
    });
  }

  return { rootFolderId, syncSubfolderId, sharedEmail: cleanEmail };
};

/**
 * Searches for `Lakshay_Library_Master_Sync.json` via:
 * 1. Pasted Offline Sync Code (`LKSYNC1:...`)
 * 2. Pasted Master Sync Key (`LK-XXXXXXXXXXXX` via Cloud Relay)
 * 3. Google Drive API v3 (for Same-Gmail or Shared Folder Link with Drive OAuth)
 */
export const findMasterSyncFileOnDrive = async (
  accessToken?: string | null,
  overrideSyncKeyInput?: string | null
): Promise<DriveBackupFileMetadata | null> => {
  const config = getGoogleDriveSyncConfig();
  const rawInput =
    overrideSyncKeyInput !== undefined ? overrideSyncKeyInput : config.sharedFolderInput;

  // 1a. Check if the user pasted a self-contained Offline Sync Code (`LKSYNC1:...`)
  const decodedOffline = decodeOfflineSyncPackageKey(rawInput);
  if (decodedOffline) {
    return {
      id: 'LKSYNC1-OFFLINE',
      name: MASTER_DRIVE_BACKUP_FILENAME,
      modifiedTime: decodedOffline.syncedAt || new Date().toISOString(),
      folderPath: `Offline Sync Key from ${decodedOffline.primaryDeviceName || 'Primary Phone'} (${decodedOffline.data.students.length} students)`,
    };
  }

  // 1b. Check if the user pasted a `LK-XXXXXXXXXXXX` Cloud Relay Sync Key
  const relayFileId = extractRelayFileIdFromSyncKey(rawInput);
  if (relayFileId) {
    try {
      const relayRes = await fetch(`https://ntfy.sh/file/${relayFileId}.json`);
      if (relayRes.ok) {
        const relayPayload = (await relayRes.json()) as MasterSyncPayload;
        if (relayPayload?.data?.students) {
          return {
            id: `LK-${relayFileId}`,
            name: MASTER_DRIVE_BACKUP_FILENAME,
            modifiedTime: relayPayload.syncedAt || new Date().toISOString(),
            folderPath: `Master Sync Key LK-${relayFileId} (${relayPayload.data.students.length} students from ${relayPayload.primaryDeviceName || 'Primary Phone'})`,
          };
        }
      }
    } catch {
      // Fall through
    }
  }

  const customSharedId = extractDriveIdFromInput(rawInput);
  const hasRealOAuthToken = Boolean(accessToken && accessToken !== 'IDENTITY_SESSION_ACTIVE');
  const apiKeyParam = firebaseConfig.apiKey ? `&key=${encodeURIComponent(firebaseConfig.apiKey)}` : '';

  // 2. If the Secondary user pasted a Google Drive File ID or Share Link:
  if (customSharedId) {
    // 2a. Check if Primary Phone bridged this Google Drive File ID to the Cloud Sync Relay
    try {
      const bridgeTopic = `lakshay_gdrive_${customSharedId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}`;
      const bridgePoll = await fetch(`https://ntfy.sh/${bridgeTopic}/json?poll=1&since=all`);
      if (bridgePoll.ok) {
        const lines = (await bridgePoll.text())
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((l) => JSON.parse(l) as { id?: string; attachment?: { url?: string } });
        const latestBridge = [...lines].reverse().find((m) => m.attachment?.url || m.id);
        if (latestBridge?.id) {
          return {
            id: `LK-${latestBridge.id}`,
            name: MASTER_DRIVE_BACKUP_FILENAME,
            modifiedTime: new Date().toISOString(),
            folderPath: `Bridged Sync Key (${MASTER_DRIVE_ROOT_FOLDER_NAME}/${MASTER_SYNC_SUBFOLDER_NAME})`,
          };
        }
      }
    } catch {
      // Fall through to Google Drive lookup
    }

    const authHeaders: Record<string, string> = hasRealOAuthToken
      ? { Authorization: `Bearer ${accessToken}` }
      : {};

    // 2b. Check if customSharedId is directly accessible via Google Drive API
    try {
      const directFileUrl = `https://www.googleapis.com/drive/v3/files/${customSharedId}?supportsAllDrives=true&fields=id,name,mimeType,modifiedTime,size,trashed${
        hasRealOAuthToken ? '' : apiKeyParam
      }`;
      const directRes = await fetch(directFileUrl, { headers: authHeaders });
      if (directRes.ok) {
        const directMeta = await directRes.json();
        if (
          !directMeta.trashed &&
          directMeta.mimeType !== 'application/vnd.google-apps.folder'
        ) {
          return {
            id: directMeta.id,
            name: directMeta.name || MASTER_DRIVE_BACKUP_FILENAME,
            modifiedTime: directMeta.modifiedTime || new Date().toISOString(),
            size: directMeta.size,
            folderPath: `Sync Key Linked (${MASTER_DRIVE_ROOT_FOLDER_NAME}/${MASTER_SYNC_SUBFOLDER_NAME})`,
          };
        }
      }
    } catch {
      // Fall through to folder search
    }

    // 2c. Otherwise treat customSharedId as a Shared Folder ID and look for `Lakshay_Library_Master_Sync.json` inside it
    try {
      const insideSharedFolderQuery = encodeURIComponent(
        `name = '${MASTER_DRIVE_BACKUP_FILENAME}' and '${customSharedId}' in parents and trashed = false`
      );
      const sharedFolderUrl = `https://www.googleapis.com/drive/v3/files?q=${insideSharedFolderQuery}&spaces=drive&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=1${
        hasRealOAuthToken ? '' : apiKeyParam
      }`;
      const sharedRes = await fetch(sharedFolderUrl, { headers: authHeaders });
      if (sharedRes.ok) {
        const sharedData = await sharedRes.json();
        if (sharedData.files && sharedData.files.length > 0) {
          return {
            ...(sharedData.files[0] as DriveBackupFileMetadata),
            folderPath: `Shared Folder (${MASTER_DRIVE_ROOT_FOLDER_NAME}/${MASTER_SYNC_SUBFOLDER_NAME})`,
          };
        }
      }
    } catch {
      // Fall through
    }
  }

  if (!hasRealOAuthToken) {
    return null;
  }

  // 3. Search across all accessible Drive files with OAuth token
  const globalFileQuery = encodeURIComponent(
    `name = '${MASTER_DRIVE_BACKUP_FILENAME}' and trashed = false`
  );
  const globalSearchUrl = `https://www.googleapis.com/drive/v3/files?q=${globalFileQuery}&spaces=drive&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,name,modifiedTime,size,owners)&orderBy=modifiedTime desc&pageSize=5`;

  const globalResponse = await fetch(globalSearchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!globalResponse.ok) {
    if (globalResponse.status === 401 || globalResponse.status === 403) {
      clearStoredGoogleAuthSession();
      throw new Error('AUTH_REQUIRED');
    }
    throw new Error(`Google Drive search failed (${globalResponse.status})`);
  }

  const globalData = await globalResponse.json();
  if (globalData.files && globalData.files.length > 0) {
    const latestFile = globalData.files[0] as DriveBackupFileMetadata & {
      owners?: Array<{ emailAddress?: string; me?: boolean }>;
    };
    const ownerEmail = latestFile.owners?.[0]?.emailAddress;
    const isSharedFromOtherAccount = latestFile.owners?.[0] && !latestFile.owners[0].me;
    return {
      id: latestFile.id,
      name: latestFile.name,
      modifiedTime: latestFile.modifiedTime,
      size: latestFile.size,
      folderPath: isSharedFromOtherAccount
        ? `Shared by ${ownerEmail || 'Primary Account'} (${MASTER_DRIVE_ROOT_FOLDER_NAME}/${MASTER_SYNC_SUBFOLDER_NAME})`
        : `${MASTER_DRIVE_ROOT_FOLDER_NAME}/${MASTER_SYNC_SUBFOLDER_NAME}`,
    };
  }

  // 4. If this device is PRIMARY, ensure the Master folder hierarchy exists in its own Drive
  if (config.deviceRole === 'PRIMARY' && accessToken) {
    await ensureMasterSyncFolderHierarchy(accessToken);
  }

  return null;
};

/**
 * PRIMARY DEVICE ONLY: Uploads or updates `Lakshay_Library_Master_Sync.json` inside
 * `Lakshay_Library_Master/Master_Sync_Backups/` on Google Drive AND publishes a fresh
 * `LK-XXXXXXXXXXXX` Master Sync Key to the Cloud Relay for Secondary Phones.
 */
export const pushPrimarySnapshotToGoogleDrive = async (
  accessToken: string,
  existingFileId?: string | null
): Promise<{
  fileId: string;
  syncKey?: string;
  syncedAt: string;
  studentCount: number;
  folderPath: string;
}> => {
  const config = getGoogleDriveSyncConfig();
  if (config.deviceRole !== 'PRIMARY') {
    throw new Error(
      'Conflict Guard: Only a device set to PRIMARY mode can upload master data to Google Drive.'
    );
  }

  const { syncSubfolderId } = await ensureMasterSyncFolderHierarchy(accessToken);

  const payload = buildCurrentMasterSyncPayload();
  const nowISO = payload.syncedAt;
  const dateKey = payload.syncDateKey;
  const students = payload.data.students;
  const folderPath = payload.folderPath;

  let targetFileId = existingFileId;
  if (!targetFileId) {
    const found = await findMasterSyncFileOnDrive(accessToken, null);
    if (found && !found.id.startsWith('LK-') && found.id !== 'LKSYNC1-OFFLINE') {
      targetFileId = found.id;
    }
  }

  const metadata = targetFileId
    ? {
        name: MASTER_DRIVE_BACKUP_FILENAME,
        mimeType: 'application/json',
        description: `Lakshay Library Master Daily Sync in ${folderPath} from Primary Device (${config.deviceName}) on ${dateKey}`,
      }
    : {
        name: MASTER_DRIVE_BACKUP_FILENAME,
        mimeType: 'application/json',
        parents: [syncSubfolderId],
        description: `Lakshay Library Master Daily Sync in ${folderPath} from Primary Device (${config.deviceName}) on ${dateKey}`,
      };

  const boundary = '-------lakshay_library_drive_sync_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(payload, null, 2) +
    closeDelimiter;

  const uploadUrl = targetFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${targetFileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const method = targetFileId ? 'PATCH' : 'POST';

  const res = await fetch(uploadUrl, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      clearStoredGoogleAuthSession();
      throw new Error('AUTH_REQUIRED');
    }
    throw new Error(`Failed to upload snapshot to Google Drive (${res.status})`);
  }

  const resultData = await res.json();
  const savedFileId = resultData.id || targetFileId || '';

  if (savedFileId) {
    await enableAnyoneReaderPermission(accessToken, savedFileId);
  }
  await enableAnyoneReaderPermission(accessToken, syncSubfolderId);

  // Also publish to the Cloud Sync Key Relay (`LK-XXXXXXXXXXXX`) so Secondary phones on any Gmail can pull!
  let generatedSyncKey: string | undefined;
  try {
    const relayRes = await publishMasterSnapshotToSyncKeyRelay();
    generatedSyncKey = relayRes.syncKey;
  } catch {
    // Non-fatal if relay is temporarily unreachable
  }

  const latestConfig = getGoogleDriveSyncConfig();
  saveGoogleDriveSyncConfig({
    ...latestConfig,
    lastSyncedDateKey: dateKey,
    lastSyncedAtISO: nowISO,
    lastDriveFileId: savedFileId,
    masterSyncKey: generatedSyncKey || latestConfig.masterSyncKey || null,
    lastPrimaryWriterName: latestConfig.deviceName,
    lastSyncedStudentCount: students.length,
  });

  return {
    fileId: savedFileId,
    syncKey: generatedSyncKey,
    syncedAt: nowISO,
    studentCount: students.length,
    folderPath,
  };
};

/**
 * SECONDARY (OR RESTORE) MODE: Downloads `Lakshay_Library_Master_Sync.json` and applies the snapshot locally.
 * Seamlessly supports:
 * 1. Method 1 Master Sync Key (`LK-XXXXXXXXXXXX` via CORS-enabled Cloud Relay — works on ANY Gmail or without sign-in!)
 * 2. Method 1 Offline Sync Package (`LKSYNC1:...` — 100% offline instant decode!)
 * 3. Google Drive API v3 (when signed into the same Gmail account or authorized Shared Folder)
 */
export const pullMasterSnapshotFromGoogleDrive = async (
  accessToken?: string | null,
  overrideSyncKeyInput?: string | null
): Promise<{
  fileId: string;
  primaryDeviceName: string;
  syncedAt: string;
  studentCount: number;
}> => {
  const config = getGoogleDriveSyncConfig();
  const rawInput = (
    overrideSyncKeyInput !== undefined ? overrideSyncKeyInput : config.sharedFolderInput
  )?.trim();

  // 1. Check if the user pasted an Offline Sync Code (`LKSYNC1:...`)
  if (rawInput && rawInput.includes('LKSYNC1:')) {
    const decoded = decodeOfflineSyncPackageKey(rawInput);
    if (!decoded) {
      throw new Error(
        'The pasted Offline Sync Key (LKSYNC1:...) appears incomplete. Please tap "Copy Offline Key" on the Primary Phone and paste again.'
      );
    }
    return applyMasterSyncPayloadLocally(decoded, 'LKSYNC1-OFFLINE');
  }

  // 2. Check if the user pasted a `LK-XXXXXXXXXXXX` Master Sync Key (or 12-char Relay ID)
  const relayFileId = extractRelayFileIdFromSyncKey(rawInput);
  if (relayFileId) {
    let targetRelayId = relayFileId;
    const directRes = await fetch(`https://ntfy.sh/file/${targetRelayId}.json`);
    if (!directRes.ok) {
      throw new Error(
        `Sync Key LK-${targetRelayId} has expired or was not found (${directRes.status}). On your Primary Phone, open Google Drive Sync, tap "Refresh & Copy Sync Key", and paste the new LK-... key here.`
      );
    }

    let payload = (await directRes.json()) as MasterSyncPayload;

    // Check if the Primary Phone has published an even newer snapshot on its channel since this key was copied!
    const channelTopic = payload?.syncChannelTopic || config.masterSyncChannelTopic;
    if (channelTopic) {
      try {
        const pollRes = await fetch(`https://ntfy.sh/${channelTopic}/json?poll=1&since=all`);
        if (pollRes.ok) {
          const lines = (await pollRes.text())
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((l) => JSON.parse(l) as { id?: string; time?: number; attachment?: { url?: string } });
          const newestMsg = [...lines].reverse().find((m) => m.id && m.attachment?.url);
          if (newestMsg?.id && newestMsg.id !== targetRelayId) {
            const newerFileRes = await fetch(`https://ntfy.sh/file/${newestMsg.id}.json`);
            if (newerFileRes.ok) {
              const newerPayload = (await newerFileRes.json()) as MasterSyncPayload;
              if (newerPayload?.data?.students) {
                payload = newerPayload;
                targetRelayId = newestMsg.id;
              }
            }
          }
        }
      } catch {
        // Use the already downloaded payload
      }
    }

    return applyMasterSyncPayloadLocally(payload, `LK-${targetRelayId}`);
  }

  // 3. Check if the Secondary Phone has a saved `masterSyncChannelTopic` from a previous Sync Key pull
  if (!rawInput && config.masterSyncChannelTopic) {
    try {
      const pollRes = await fetch(
        `https://ntfy.sh/${config.masterSyncChannelTopic}/json?poll=1&since=all`
      );
      if (pollRes.ok) {
        const lines = (await pollRes.text())
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((l) => JSON.parse(l) as { id?: string; attachment?: { url?: string } });
        const newestMsg = [...lines].reverse().find((m) => m.id && m.attachment?.url);
        if (newestMsg?.id) {
          const newerFileRes = await fetch(`https://ntfy.sh/file/${newestMsg.id}.json`);
          if (newerFileRes.ok) {
            const newerPayload = (await newerFileRes.json()) as MasterSyncPayload;
            if (newerPayload?.data?.students) {
              return applyMasterSyncPayloadLocally(newerPayload, `LK-${newestMsg.id}`);
            }
          }
        }
      }
    } catch {
      // Fall through to Google Drive lookup
    }
  }

  // 4. Otherwise resolve via `findMasterSyncFileOnDrive` (includes bridged Drive IDs & authenticated Drive search)
  const fileMeta = await findMasterSyncFileOnDrive(accessToken, rawInput);
  if (!fileMeta) {
    if (rawInput && /^[a-zA-Z0-9_-]{20,}$/.test(rawInput)) {
      throw new Error(
        'That looks like a raw Google Drive File ID, which Google blocks across different Gmail accounts. On your Primary Phone, open Google Drive Sync → Method 1, tap "Copy Sync Key" (starts with LK-...), and paste that LK-... key here!'
      );
    }
    throw new Error(
      `No '${MASTER_DRIVE_BACKUP_FILENAME}' found. On your Primary Phone, open Google Drive Sync → Method 1, tap "Copy Sync Key" (starts with LK-...), and paste it here on the Secondary Phone.`
    );
  }

  // If `findMasterSyncFileOnDrive` resolved a bridged `LK-...` key:
  if (fileMeta.id.startsWith('LK-')) {
    const bridgedRelayId = fileMeta.id.replace(/^LK-/, '');
    const bridgedRes = await fetch(`https://ntfy.sh/file/${bridgedRelayId}.json`);
    if (bridgedRes.ok) {
      const bridgedPayload = (await bridgedRes.json()) as MasterSyncPayload;
      return applyMasterSyncPayloadLocally(bridgedPayload, fileMeta.id);
    }
  }

  const hasRealOAuthToken = Boolean(accessToken && accessToken !== 'IDENTITY_SESSION_ACTIVE');
  const apiKeyParam = firebaseConfig.apiKey ? `&key=${encodeURIComponent(firebaseConfig.apiKey)}` : '';

  let res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileMeta.id}?alt=media&supportsAllDrives=true${
      hasRealOAuthToken ? '' : apiKeyParam
    }`,
    {
      headers: hasRealOAuthToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {},
    }
  );

  if (!res.ok && hasRealOAuthToken && apiKeyParam) {
    res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileMeta.id}?alt=media&supportsAllDrives=true${apiKeyParam}`
    );
  }

  if (!res.ok) {
    throw new Error(
      'Google Drive blocked cross-account download. Please copy the "LK-..." Master Sync Key from Method 1 on your Primary Phone and paste it in Section 1 on this Secondary Phone.'
    );
  }

  const payload = (await res.json()) as MasterSyncPayload;
  return applyMasterSyncPayloadLocally(payload, fileMeta.id);
};

