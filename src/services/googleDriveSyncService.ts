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
  getAllStoredStudentsRaw,
  getStoredPayments,
  getStoredDailyAttendance,
  importSyncedFirestoreSnapshot,
  createAndVerifyPhase0LocalBackup,
  isRecoveryOnlyMode,
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
 * Includes both active and archived students plus all preserved historical payments.
 */
export const buildCurrentMasterSyncPayload = (): MasterSyncPayload => {
  const config = getGoogleDriveSyncConfig();
  const now = new Date();
  const dateKey = now.toISOString().split('T')[0];

  return {
    schemaVersion: '2.0',
    application: 'Lakshay Library',
    syncedAt: now.toISOString(),
    syncDateKey: dateKey,
    primaryDeviceId: config.deviceId,
    primaryDeviceName: config.deviceName,
    folderPath: `${MASTER_DRIVE_ROOT_FOLDER_NAME}/${MASTER_SYNC_SUBFOLDER_NAME}`,
    data: {
      students: getAllStoredStudentsRaw(),
      payments: getStoredPayments(),
      dailyAttendance: getStoredDailyAttendance(),
      shifts: getStoredShifts(),
      seats: getStoredSeats(),
      upiConfig: getStoredUpiConfig(),
    },
  };
};

/**
 * PHASE 0 SECURITY CONTAINMENT:
 * Triggers a debounced auto-sync strictly to authenticated Google Drive when new data is entered
 * on the Primary device. Public `ntfy.sh` relay broadcasting is permanently disabled.
 */
let autoSyncTimeout: ReturnType<typeof setTimeout> | null = null;
let isAutoSyncing = false;

export const triggerLiveAutoSync = (delayMs: number = 800) => {
  if (isRecoveryOnlyMode()) return;
  const config = getGoogleDriveSyncConfig();
  const token = getDriveAccessToken();
  if (!token || !config.autoDailySyncEnabled || config.deviceRole !== 'PRIMARY') {
    return;
  }

  if (autoSyncTimeout) {
    clearTimeout(autoSyncTimeout);
  }

  autoSyncTimeout = setTimeout(async () => {
    if (isAutoSyncing) return;
    try {
      isAutoSyncing = true;
      const activeToken = getDriveAccessToken();
      if (activeToken && config.autoDailySyncEnabled && config.deviceRole === 'PRIMARY') {
        await pushPrimarySnapshotToGoogleDrive(activeToken, config.lastDriveFileId).catch(() => {});
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
 * inside the string so it can be transferred manually with zero external relay servers.
 */
export const generateOfflineSyncPackageKey = (): string => {
  createAndVerifyPhase0LocalBackup(false);
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
 * Detects if a user pasted a legacy `LK-XXXXXXXXXXXX` Sync Key so the app can display
 * a clear Phase 0 Security Containment notice instead of contacting `ntfy.sh`.
 */
export const extractRelayFileIdFromSyncKey = (input?: string | null): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.includes('LKSYNC1:')) return null;

  const lkMatch = trimmed.match(/LK-([a-zA-Z0-9]{10,16})/);
  if (lkMatch?.[1]) {
    return lkMatch[1];
  }

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
 * PHASE 0 SECURITY CONTAINMENT:
 * Public `ntfy.sh` relay publishing has been permanently disabled to stop broadcasting
 * student PII and payment records over unauthenticated public topics.
 * Calling this function now verifies local backup protection and throws an explicit
 * containment error so callers fall back to authenticated Google Drive or offline `LKSYNC1:...`.
 */
export const publishMasterSnapshotToSyncKeyRelay = async (): Promise<{
  syncKey: string;
  fileId: string;
  syncedAt: string;
  studentCount: number;
}> => {
  createAndVerifyPhase0LocalBackup(false);
  throw new Error(
    'PHASE0_RELAY_DISABLED: Sync Key Only (LK-...) via public ntfy.sh relay has been disabled to protect student and payment data privacy. Use authenticated Google Drive Sync or Offline Sync Package (LKSYNC1:...).'
  );
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
  if (isRecoveryOnlyMode()) throw new Error('Snapshot restore is blocked while recovery-only mode is active.');
  if (!payload?.data?.students || !Array.isArray(payload.data.students)) {
    throw new Error('Invalid master sync snapshot format.');
  }

  // Ensure local backup is verified before applying remote snapshot
  createAndVerifyPhase0LocalBackup(false);

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
  const activeCount = getStoredStudents().length;

  saveGoogleDriveSyncConfig({
    ...config,
    lastSyncedDateKey: dateKey,
    lastSyncedAtISO: now.toISOString(),
    lastDriveFileId: sourceFileOrKeyId,
    lastPrimaryWriterName: payload.primaryDeviceName || 'Primary Phone',
    lastSyncedStudentCount: activeCount,
  });

  return {
    fileId: sourceFileOrKeyId,
    primaryDeviceName: payload.primaryDeviceName || 'Primary Phone',
    syncedAt: payload.syncedAt || now.toISOString(),
    studentCount: activeCount,
  };
};

/**
 * PHASE 0 SECURITY CONTAINMENT:
 * Public `ntfy.sh` relay polling is permanently disabled.
 * Immediately returns `{ synced: false }` with zero network requests.
 */
export const checkAndApplyLiveRelaySync = async (): Promise<{
  synced: boolean;
  studentCount?: number;
  primaryDeviceName?: string;
  syncedAt?: string;
}> => {
  return { synced: false };
};

/**
 * PHASE 0 SECURITY CONTAINMENT:
 * Public `type: 'anyone'` permission creation is permanently disabled.
 * Kept as a strict no-op so no caller can ever make a Google Drive file or folder world-readable.
 */
export const enableAnyoneReaderPermission = async (
  _accessToken: string,
  _fileOrFolderId: string
): Promise<void> => {
  return;
};

export const PHASE0_DRIVE_PERMISSION_AUDIT_KEY = 'lakshay_library_phase0_drive_permission_audit_v1';
export const PHASE0_DRIVE_SAFETY_BACKUP_FILENAME = 'Lakshay_Library_Phase0_PreContainment_Backup.json';

export interface DriveEffectivePermissionItem {
  id: string;
  type: string;
  role: string;
  emailAddress?: string;
  domain?: string;
  displayName?: string;
  inherited: boolean;
  inheritedFrom?: string;
}

export interface DriveFlaggedPermissionItem {
  resourceId: string;
  resourceName: string;
  permissionId: string;
  type: string;
  role: string;
  emailAddress?: string;
  domain?: string;
  displayName?: string;
  inherited: boolean;
  inheritedFrom?: string;
  impactDescription: string;
  requiresExplicitApproval: true;
}

export interface DriveResourcePermissionAudit {
  id: string;
  name: string;
  resourceType: 'ROOT_FOLDER' | 'SUBFOLDER' | 'FILE';
  revokedPermissionIds: string[];
  inheritedPublicFromIds: string[];
  effectivePermissions: DriveEffectivePermissionItem[];
  hasPublicAnyoneAccess: boolean;
  sharedFlag: boolean;
}

export interface DriveUnverifiedResourceItem {
  idOrName: string;
  resourceType: 'ROOT_FOLDER' | 'SUBFOLDER' | 'FILE' | 'CONFIGURED_ID';
  httpStatus?: number;
  reason: string;
}

export interface DrivePermissionVerificationReport {
  verifiedAtISO: string;
  mode: 'AUDIT_ONLY' | 'AUTHORIZED_REVOKE_PUBLIC';
  oauthScope: string;
  paginationVerified: boolean;
  overallStatus:
    | 'VERIFIED_PRIVATE'
    | 'PUBLIC_ACCESS_REMAINING'
    | 'UNVERIFIED_INACCESSIBLE_RESOURCES'
    | 'ERROR';
  localBackupVerified: boolean;
  driveBackupVerified: boolean;
  driveSafetyBackupFileId: string | null;
  driveSafetyBackupPreservedExisting: boolean;
  totalResourcesDiscovered: number;
  totalResourcesInspected: number;
  totalPublicPermissionsDetected: number;
  totalPublicPermissionsRevoked: number;
  unverifiedResources: DriveUnverifiedResourceItem[];
  flaggedDomainOrStaffPermissions: DriveFlaggedPermissionItem[];
  resources: DriveResourcePermissionAudit[];
  errorMessage?: string;
}

export const getStoredDrivePermissionAuditReport = (): DrivePermissionVerificationReport | null => {
  try {
    const raw = localStorage.getItem(PHASE0_DRIVE_PERMISSION_AUDIT_KEY);
    return raw ? (JSON.parse(raw) as DrivePermissionVerificationReport) : null;
  } catch {
    return null;
  }
};

interface RawDrivePermission {
  id: string;
  type: string;
  role: string;
  emailAddress?: string;
  domain?: string;
  displayName?: string;
  deleted?: boolean;
  permissionDetails?: Array<{
    permissionType?: string;
    role?: string;
    inherited?: boolean;
    inheritedFrom?: string;
  }>;
}

/**
 * Helper: Enumerates all matching files/folders across all pages using `nextPageToken`.
 */
const listDriveFilesPaginated = async (
  accessToken: string,
  rawQuery: string
): Promise<{
  ok: boolean;
  httpStatus: number;
  files: Array<{ id: string; name: string; mimeType: string }>;
  pagesFetched: number;
}> => {
  const allFiles: Array<{ id: string; name: string; mimeType: string }> = [];
  let pageToken: string | undefined = undefined;
  let pagesFetched = 0;

  do {
    const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      rawQuery
    )}&spaces=drive&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=nextPageToken,files(id,name,mimeType)&pageSize=100${tokenParam}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    pagesFetched++;

    if (!res.ok) {
      return { ok: false, httpStatus: res.status, files: allFiles, pagesFetched };
    }

    const data = (await res.json()) as {
      nextPageToken?: string;
      files?: Array<{ id: string; name: string; mimeType: string }>;
    };
    if (Array.isArray(data.files)) {
      allFiles.push(...data.files);
    }
    pageToken = data.nextPageToken || undefined;
  } while (pageToken && pagesFetched < 50);

  return { ok: true, httpStatus: 200, files: allFiles, pagesFetched };
};

/**
 * PHASE 0 MANDATORY CONDITION 1 & 5 + FINAL VERIFICATION SECTION 2:
 * 1. Verifies local backup and creates/verifies a pre-containment safety backup of existing Google Drive data.
 *    If `Lakshay_Library_Phase0_PreContainment_Backup.json` already exists on Drive, it is PRESERVED untouched
 *    (never overwritten or deleted).
 * 2. Recursively discovers and paginates (`nextPageToken`) the entire Google Drive folder and file hierarchy
 *    top-down (`Lakshay_Library_Master` -> `Master_Sync_Backups`, `Automated_Logs`, and any nested subfolders/files).
 * 3. Supports two explicit modes via `options?.revokePublicAnyone`:
 *    - `AUDIT_ONLY` (`revokePublicAnyone: false`, default): Inspects direct and inherited permissions without
 *      modifying or deleting any Drive permissions.
 *    - `AUTHORIZED_REVOKE_PUBLIC` (`revokePublicAnyone: true`): Removes `type: 'anyone'` public permissions
 *      at their actual source (`inheritedFrom` for inherited permissions, or `resource.id` for direct grants).
 * 4. Preserves `type: 'domain'`, `user`, and `group` permissions untouched and reports them in
 *    `flaggedDomainOrStaffPermissions`.
 * 5. Tracks any inaccessible or uninspectable resources in `unverifiedResources` and NEVER claims
 *    `VERIFIED_PRIVATE` if any relevant resource remains inaccessible or uninspected.
 */
export const revokeAndVerifyDrivePublicAccess = async (
  accessToken: string,
  options?: { revokePublicAnyone?: boolean }
): Promise<DrivePermissionVerificationReport> => {
  const nowISO = new Date().toISOString();
  const revokePublicAnyone = Boolean(options?.revokePublicAnyone);
  const mode: DrivePermissionVerificationReport['mode'] = revokePublicAnyone
    ? 'AUTHORIZED_REVOKE_PUBLIC'
    : 'AUDIT_ONLY';
  const localBackupReport = createAndVerifyPhase0LocalBackup(false);
  const unverifiedResources: DriveUnverifiedResourceItem[] = [];

  if (!accessToken || accessToken === 'IDENTITY_SESSION_ACTIVE') {
    throw new Error('AUTH_REQUIRED');
  }

  let rootFolderId = '';
  let syncSubfolderId = '';
  let driveBackupVerified = false;
  let driveSafetyBackupFileId: string | null = null;
  let driveSafetyBackupPreservedExisting = false;
  let paginationVerified = true;

  const resourcesToInspect: Array<{
    id: string;
    name: string;
    resourceType: 'ROOT_FOLDER' | 'SUBFOLDER' | 'FILE';
  }> = [];

  if (revokePublicAnyone) {
    // AUTHORIZED_REVOKE_PUBLIC mode: Ensure pre-containment safety backup exists before revoking public access
    const hierarchy = await ensureMasterSyncFolderHierarchy(accessToken);
    rootFolderId = hierarchy.rootFolderId;
    syncSubfolderId = hierarchy.syncSubfolderId;

    resourcesToInspect.push(
      {
        id: rootFolderId,
        name: MASTER_DRIVE_ROOT_FOLDER_NAME,
        resourceType: 'ROOT_FOLDER',
      },
      {
        id: syncSubfolderId,
        name: `${MASTER_DRIVE_ROOT_FOLDER_NAME}/${MASTER_SYNC_SUBFOLDER_NAME}`,
        resourceType: 'SUBFOLDER',
      }
    );

    try {
      const safetyList = await listDriveFilesPaginated(
        accessToken,
        `name = '${PHASE0_DRIVE_SAFETY_BACKUP_FILENAME}' and '${syncSubfolderId}' in parents and trashed = false`
      );
      const existingSafetyId = safetyList.files[0]?.id || null;

      if (existingSafetyId) {
        driveSafetyBackupFileId = existingSafetyId;
        driveSafetyBackupPreservedExisting = true;
        driveBackupVerified = true;
      } else {
        const existingMasterMeta = await findMasterSyncFileOnDrive(accessToken, null);
        let backupContentToPreserve: MasterSyncPayload | null = null;

        if (existingMasterMeta?.id) {
          const dlRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${existingMasterMeta.id}?alt=media&supportsAllDrives=true`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          if (dlRes.ok) {
            const parsedRemote = (await dlRes.json()) as MasterSyncPayload;
            if (parsedRemote && Array.isArray(parsedRemote?.data?.students)) {
              backupContentToPreserve = parsedRemote;
              driveBackupVerified = true;
            }
          }
        }

        if (!backupContentToPreserve) {
          backupContentToPreserve = buildCurrentMasterSyncPayload();
          driveBackupVerified = true;
        }

        const safetyMeta = {
          name: PHASE0_DRIVE_SAFETY_BACKUP_FILENAME,
          mimeType: 'application/json',
          parents: [syncSubfolderId],
          description: `Phase 0 Pre-Containment Verified Safety Backup (${nowISO})`,
        };

        const boundary = '-------lakshay_phase0_safety_backup_boundary';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;
        const multipartBody =
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(safetyMeta) +
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(backupContentToPreserve, null, 2) +
          closeDelimiter;

        const safetyUploadRes = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartBody,
          }
        );

        if (safetyUploadRes.ok) {
          const safetyData = await safetyUploadRes.json();
          driveSafetyBackupFileId = safetyData.id || null;
        }
      }
    } catch {
      // Continue with permission audit even if safety backup check encountered a non-fatal error
    }
  } else {
    // AUDIT_ONLY (Default Read-Only Mode): Zero folder creation, zero file uploads, zero permission mutations.
    try {
      const rootSearch = await listDriveFilesPaginated(
        accessToken,
        `name = '${MASTER_DRIVE_ROOT_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
      );
      if (!rootSearch.ok) {
        paginationVerified = false;
        unverifiedResources.push({
          idOrName: MASTER_DRIVE_ROOT_FOLDER_NAME,
          resourceType: 'ROOT_FOLDER',
          httpStatus: rootSearch.httpStatus,
          reason: `Read-only lookup for root folder '${MASTER_DRIVE_ROOT_FOLDER_NAME}' failed with HTTP ${rootSearch.httpStatus}.`,
        });
      } else if (rootSearch.files.length === 0) {
        unverifiedResources.push({
          idOrName: MASTER_DRIVE_ROOT_FOLDER_NAME,
          resourceType: 'ROOT_FOLDER',
          reason: `Intended root folder '${MASTER_DRIVE_ROOT_FOLDER_NAME}' was not found or is inaccessible under the current OAuth token (${SCOPES[0]}).`,
        });
      } else {
        rootFolderId = rootSearch.files[0].id;
        for (const f of rootSearch.files) {
          resourcesToInspect.push({
            id: f.id,
            name: f.name,
            resourceType: 'ROOT_FOLDER',
          });
        }
      }

      if (rootFolderId) {
        const subSearch = await listDriveFilesPaginated(
          accessToken,
          `name = '${MASTER_SYNC_SUBFOLDER_NAME}' and '${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
        );
        if (!subSearch.ok) {
          paginationVerified = false;
          unverifiedResources.push({
            idOrName: `${MASTER_DRIVE_ROOT_FOLDER_NAME}/${MASTER_SYNC_SUBFOLDER_NAME}`,
            resourceType: 'SUBFOLDER',
            httpStatus: subSearch.httpStatus,
            reason: `Read-only lookup for subfolder '${MASTER_SYNC_SUBFOLDER_NAME}' failed with HTTP ${subSearch.httpStatus}.`,
          });
        } else if (subSearch.files.length === 0) {
          unverifiedResources.push({
            idOrName: `${MASTER_DRIVE_ROOT_FOLDER_NAME}/${MASTER_SYNC_SUBFOLDER_NAME}`,
            resourceType: 'SUBFOLDER',
            reason: `Intended subfolder '${MASTER_SYNC_SUBFOLDER_NAME}' was not found or is inaccessible inside '${MASTER_DRIVE_ROOT_FOLDER_NAME}'.`,
          });
        } else {
          syncSubfolderId = subSearch.files[0].id;
        }
      } else {
        unverifiedResources.push({
          idOrName: `${MASTER_DRIVE_ROOT_FOLDER_NAME}/${MASTER_SYNC_SUBFOLDER_NAME}`,
          resourceType: 'SUBFOLDER',
          reason: `Cannot inspect '${MASTER_SYNC_SUBFOLDER_NAME}' because parent folder '${MASTER_DRIVE_ROOT_FOLDER_NAME}' is unverified/inaccessible.`,
        });
      }

      if (syncSubfolderId) {
        const safetyList = await listDriveFilesPaginated(
          accessToken,
          `name = '${PHASE0_DRIVE_SAFETY_BACKUP_FILENAME}' and '${syncSubfolderId}' in parents and trashed = false`
        );
        if (safetyList.ok && safetyList.files[0]?.id) {
          driveSafetyBackupFileId = safetyList.files[0].id;
          driveSafetyBackupPreservedExisting = true;
          driveBackupVerified = true;
        }
      }
    } catch (err: unknown) {
      paginationVerified = false;
      unverifiedResources.push({
        idOrName: MASTER_DRIVE_ROOT_FOLDER_NAME,
        resourceType: 'ROOT_FOLDER',
        reason: err instanceof Error ? err.message : 'Read-only hierarchy lookup failed.',
      });
    }
  }

  // Also discover any other `Lakshay_Library_Master` folders visible under `drive.file`
  try {
    const allRootMatches = await listDriveFilesPaginated(
      accessToken,
      `name = '${MASTER_DRIVE_ROOT_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    );
    for (const f of allRootMatches.files) {
      if (!resourcesToInspect.some((r) => r.id === f.id)) {
        resourcesToInspect.push({
          id: f.id,
          name: f.name,
          resourceType: 'ROOT_FOLDER',
        });
      }
    }
  } catch {
    // Ignore
  }

  const seenIds = new Set<string>(resourcesToInspect.map((r) => r.id));
  const folderQueue: Array<{ id: string; name: string }> = resourcesToInspect
    .filter((r) => r.resourceType !== 'FILE')
    .map((r) => ({ id: r.id, name: r.name }));

  // Breadth-first recursive traversal with `nextPageToken` pagination
  while (folderQueue.length > 0) {
    const currentFolder = folderQueue.shift()!;
    try {
      const pagedChildren = await listDriveFilesPaginated(
        accessToken,
        `'${currentFolder.id}' in parents and trashed = false`
      );
      if (!pagedChildren.ok) {
        paginationVerified = false;
        unverifiedResources.push({
          idOrName: `${currentFolder.name} (${currentFolder.id})`,
          resourceType: 'SUBFOLDER',
          httpStatus: pagedChildren.httpStatus,
          reason: `Child enumeration failed with HTTP ${pagedChildren.httpStatus} under drive.file scope.`,
        });
        continue;
      }

      for (const item of pagedChildren.files) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
          const fullName = `${currentFolder.name}/${item.name}`;
          resourcesToInspect.push({
            id: item.id,
            name: fullName,
            resourceType: isFolder ? 'SUBFOLDER' : 'FILE',
          });
          if (isFolder) {
            folderQueue.push({ id: item.id, name: fullName });
          }
        }
      }
    } catch (err: unknown) {
      paginationVerified = false;
      unverifiedResources.push({
        idOrName: `${currentFolder.name} (${currentFolder.id})`,
        resourceType: 'SUBFOLDER',
        reason: err instanceof Error ? err.message : 'Failed to enumerate folder children.',
      });
    }
  }

  // Also include `lastDriveFileId` and `sharedFolderInput` if configured outside the discovered hierarchy
  const syncConfig = getGoogleDriveSyncConfig();
  if (
    syncConfig.lastDriveFileId &&
    /^[a-zA-Z0-9_-]{20,}$/.test(syncConfig.lastDriveFileId) &&
    !seenIds.has(syncConfig.lastDriveFileId)
  ) {
    seenIds.add(syncConfig.lastDriveFileId);
    resourcesToInspect.push({
      id: syncConfig.lastDriveFileId,
      name: `${MASTER_DRIVE_BACKUP_FILENAME} (lastDriveFileId)`,
      resourceType: 'FILE',
    });
  }

  const configuredSharedDriveId = extractDriveIdFromInput(syncConfig.sharedFolderInput);
  if (configuredSharedDriveId && !seenIds.has(configuredSharedDriveId)) {
    seenIds.add(configuredSharedDriveId);
    resourcesToInspect.push({
      id: configuredSharedDriveId,
      name: `Configured Shared Resource (${configuredSharedDriveId})`,
      resourceType: 'SUBFOLDER',
    });
  }

  // Verify that the intended master sync file `Lakshay_Library_Master_Sync.json` is present in the discovered hierarchy
  const hasMasterSyncFileInHierarchy = resourcesToInspect.some(
    (r) => r.resourceType === 'FILE' && r.name.includes(MASTER_DRIVE_BACKUP_FILENAME)
  );
  if (!hasMasterSyncFileInHierarchy) {
    unverifiedResources.push({
      idOrName: `${MASTER_DRIVE_ROOT_FOLDER_NAME}/${MASTER_SYNC_SUBFOLDER_NAME}/${MASTER_DRIVE_BACKUP_FILENAME}`,
      resourceType: 'FILE',
      reason: `Intended master sync file '${MASTER_DRIVE_BACKUP_FILENAME}' was not found or is inaccessible under the current OAuth token (${SCOPES[0]}).`,
    });
  } else {
    driveBackupVerified = true;
  }

  // Step 3: Inspect (and if `revokePublicAnyone === true`, revoke) Public (`type: 'anyone'`) Permissions.
  // - Inherited `anyone` permissions are removed ONLY at their source (`inheritedFrom`), deduplicated across ancestors.
  // - Direct `anyone` permissions are removed on the resource itself.
  // - `domain`, `user`, and `group` permissions (non-owner) are NOT revoked automatically; they are flagged for explicit user approval.
  let totalPublicPermissionsDetected = 0;
  let totalPublicPermissionsRevoked = 0;
  const revokedByResourceId = new Map<string, string[]>();
  const inheritedSourcesByResourceId = new Map<string, string[]>();
  const revokedSourceTargetKeys = new Set<string>();
  const flaggedDomainOrStaffPermissions: DriveFlaggedPermissionItem[] = [];

  for (const resource of resourcesToInspect) {
    const revokedIds: string[] = [];
    const inheritedFromIds: string[] = [];

    try {
      const permListUrl = `https://www.googleapis.com/drive/v3/files/${resource.id}/permissions?supportsAllDrives=true&fields=permissions(id,type,role,emailAddress,domain,displayName,deleted,permissionDetails(permissionType,role,inherited,inheritedFrom))`;
      const permListRes = await fetch(permListUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!permListRes.ok) {
        unverifiedResources.push({
          idOrName: `${resource.name} (${resource.id})`,
          resourceType: resource.resourceType,
          httpStatus: permListRes.status,
          reason: `permissions.list returned HTTP ${permListRes.status} (resource may have been created outside this OAuth client's drive.file scope or owned by another account).`,
        });
        continue;
      }

      const permListData = (await permListRes.json()) as { permissions?: RawDrivePermission[] };
      const permissions = permListData.permissions || [];

      for (const perm of permissions) {
        if (perm.deleted) continue;

        const isPublicAnyone =
          perm.type === 'anyone' ||
          perm.id === 'anyoneWithLink' ||
          perm.id === 'anyone';

        const details = perm.permissionDetails || [];
        const inheritedDetails = details.filter((d) => d.inherited && d.inheritedFrom);
        const hasDirectGrant =
          details.length === 0 || details.some((d) => !d.inherited);

        if (isPublicAnyone) {
          totalPublicPermissionsDetected++;

          for (const detail of inheritedDetails) {
            if (detail.inheritedFrom) {
              inheritedFromIds.push(detail.inheritedFrom);
            }
          }

          if (revokePublicAnyone) {
            // 1. If inherited from an ancestor folder, remove ONLY at the ancestor source (`inheritedFrom`)
            for (const detail of inheritedDetails) {
              if (detail.inheritedFrom) {
                const sourceKey = `${detail.inheritedFrom}::${perm.id}`;
                if (!revokedSourceTargetKeys.has(sourceKey)) {
                  revokedSourceTargetKeys.add(sourceKey);
                  try {
                    const ancestorDelRes = await fetch(
                      `https://www.googleapis.com/drive/v3/files/${detail.inheritedFrom}/permissions/${perm.id}?supportsAllDrives=true`,
                      {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${accessToken}` },
                      }
                    );
                    if (ancestorDelRes.ok || ancestorDelRes.status === 204) {
                      revokedIds.push(`${perm.id}@source:${detail.inheritedFrom}`);
                      totalPublicPermissionsRevoked++;
                    } else {
                      unverifiedResources.push({
                        idOrName: `Inherited Source Folder (${detail.inheritedFrom})`,
                        resourceType: 'ROOT_FOLDER',
                        httpStatus: ancestorDelRes.status,
                        reason: `Could not revoke inherited public permission '${perm.id}' at source folder '${detail.inheritedFrom}' (HTTP ${ancestorDelRes.status}).`,
                      });
                    }
                  } catch {
                    unverifiedResources.push({
                      idOrName: `Inherited Source Folder (${detail.inheritedFrom})`,
                      resourceType: 'ROOT_FOLDER',
                      reason: `Network/API error revoking inherited public permission at source '${detail.inheritedFrom}'.`,
                    });
                  }
                } else {
                  revokedIds.push(`${perm.id}@source:${detail.inheritedFrom}`);
                }
              }
            }

            // 2. Only issue DELETE on `resource.id` if the permission is directly attached to this resource (not purely inherited)
            if (hasDirectGrant) {
              const directKey = `${resource.id}::${perm.id}`;
              if (!revokedSourceTargetKeys.has(directKey)) {
                revokedSourceTargetKeys.add(directKey);
                try {
                  const delRes = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${resource.id}/permissions/${perm.id}?supportsAllDrives=true`,
                    {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${accessToken}` },
                    }
                  );
                  if (delRes.ok || delRes.status === 204) {
                    revokedIds.push(perm.id);
                    totalPublicPermissionsRevoked++;
                  } else {
                    unverifiedResources.push({
                      idOrName: `${resource.name} (${resource.id})`,
                      resourceType: resource.resourceType,
                      httpStatus: delRes.status,
                      reason: `Could not delete direct public permission '${perm.id}' on '${resource.name}' (HTTP ${delRes.status}).`,
                    });
                  }
                } catch {
                  unverifiedResources.push({
                    idOrName: `${resource.name} (${resource.id})`,
                    resourceType: resource.resourceType,
                    reason: `Network/API error deleting direct public permission on '${resource.name}'.`,
                  });
                }
              }
            }
          }
        } else if (perm.role !== 'owner') {
          // Do NOT revoke domain-wide or legitimate staff (`user` / `group`) permissions without explicit approval
          const inheritedDetail = inheritedDetails[0];
          const impactDescription =
            perm.type === 'domain'
              ? `Domain-wide ${perm.role} access for '${perm.domain || perm.displayName || 'organization'}'. Revoking this will block users in that Google Workspace domain unless explicitly shared.`
              : `Named ${perm.type} (${perm.emailAddress || perm.displayName || perm.id}) has '${perm.role}' access. Revoking this will disconnect this staff/secondary device from shared-folder Drive sync.`;

          flaggedDomainOrStaffPermissions.push({
            resourceId: resource.id,
            resourceName: resource.name,
            permissionId: perm.id,
            type: perm.type,
            role: perm.role,
            emailAddress: perm.emailAddress,
            domain: perm.domain,
            displayName: perm.displayName,
            inherited: Boolean(inheritedDetail?.inherited),
            inheritedFrom: inheritedDetail?.inheritedFrom,
            impactDescription,
            requiresExplicitApproval: true,
          });
        }
      }
    } catch (err: unknown) {
      unverifiedResources.push({
        idOrName: `${resource.name} (${resource.id})`,
        resourceType: resource.resourceType,
        reason: err instanceof Error ? err.message : 'Permission inspection failed.',
      });
    }

    revokedByResourceId.set(resource.id, revokedIds);
    inheritedSourcesByResourceId.set(resource.id, inheritedFromIds);
  }

  // Step 4: Re-Query Every Resource to Verify Effective Access Permissions
  const auditedResources: DriveResourcePermissionAudit[] = [];
  let anyPublicRemaining = false;

  for (const resource of resourcesToInspect) {
    try {
      const verifyUrl = `https://www.googleapis.com/drive/v3/files/${resource.id}?supportsAllDrives=true&fields=id,name,shared,permissions(id,type,role,emailAddress,domain,displayName,deleted,permissionDetails(permissionType,role,inherited,inheritedFrom))`;
      const verifyRes = await fetch(verifyUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!verifyRes.ok) {
        if (!unverifiedResources.some((u) => u.idOrName.includes(resource.id))) {
          unverifiedResources.push({
            idOrName: `${resource.name} (${resource.id})`,
            resourceType: resource.resourceType,
            httpStatus: verifyRes.status,
            reason: `Verification files.get returned HTTP ${verifyRes.status}.`,
          });
        }
        continue;
      }

      const verifyData = (await verifyRes.json()) as {
        id: string;
        name: string;
        shared?: boolean;
        permissions?: RawDrivePermission[];
      };

      if (!Array.isArray(verifyData.permissions)) {
        unverifiedResources.push({
          idOrName: `${resource.name} (${resource.id})`,
          resourceType: resource.resourceType,
          reason:
            'Google Drive API response omitted the `permissions` list (insufficient permission to inspect ACLs on this item).',
        });
        continue;
      }

      const effectivePermissions: DriveEffectivePermissionItem[] = verifyData.permissions
        .filter((p) => !p.deleted)
        .map((p) => {
          const inheritedDetail = (p.permissionDetails || []).find((d) => d.inherited);
          return {
            id: p.id,
            type: p.type,
            role: p.role,
            emailAddress: p.emailAddress,
            domain: p.domain,
            displayName: p.displayName,
            inherited: Boolean(inheritedDetail?.inherited),
            inheritedFrom: inheritedDetail?.inheritedFrom,
          };
        });

      const hasPublicAnyoneAccess = effectivePermissions.some(
        (p) =>
          p.type === 'anyone' ||
          p.id === 'anyoneWithLink' ||
          p.id === 'anyone'
      );

      if (hasPublicAnyoneAccess) {
        anyPublicRemaining = true;
      }

      auditedResources.push({
        id: resource.id,
        name: resource.name,
        resourceType: resource.resourceType,
        revokedPermissionIds: revokedByResourceId.get(resource.id) || [],
        inheritedPublicFromIds: inheritedSourcesByResourceId.get(resource.id) || [],
        effectivePermissions,
        hasPublicAnyoneAccess,
        sharedFlag: Boolean(verifyData.shared),
      });
    } catch (err: unknown) {
      if (!unverifiedResources.some((u) => u.idOrName.includes(resource.id))) {
        unverifiedResources.push({
          idOrName: `${resource.name} (${resource.id})`,
          resourceType: resource.resourceType,
          reason: err instanceof Error ? err.message : 'Verification request failed.',
        });
      }
    }
  }

  // Never claim VERIFIED_PRIVATE if the intended folder hierarchy (`Lakshay_Library_Master`, `Master_Sync_Backups`, `Lakshay_Library_Master_Sync.json`)
  // was not fully inspected or if any resource remains inaccessible/uninspected or has public access remaining
  const inspectedRootFolder = auditedResources.some((r) => r.resourceType === 'ROOT_FOLDER');
  const inspectedSyncSubfolder = auditedResources.some(
    (r) => r.resourceType === 'SUBFOLDER' && r.name.includes(MASTER_SYNC_SUBFOLDER_NAME)
  );
  const inspectedMasterSyncFile = auditedResources.some(
    (r) => r.resourceType === 'FILE' && r.name.includes(MASTER_DRIVE_BACKUP_FILENAME)
  );
  const intendedHierarchyFullyInspected =
    inspectedRootFolder && inspectedSyncSubfolder && inspectedMasterSyncFile;

  const hasUnverifiedResources =
    !intendedHierarchyFullyInspected ||
    unverifiedResources.length > 0 ||
    auditedResources.length === 0 ||
    auditedResources.length < resourcesToInspect.length;

  const overallStatus: DrivePermissionVerificationReport['overallStatus'] = anyPublicRemaining
    ? 'PUBLIC_ACCESS_REMAINING'
    : hasUnverifiedResources
    ? 'UNVERIFIED_INACCESSIBLE_RESOURCES'
    : 'VERIFIED_PRIVATE';

  const report: DrivePermissionVerificationReport = {
    verifiedAtISO: nowISO,
    mode,
    oauthScope: SCOPES[0],
    paginationVerified,
    overallStatus,
    localBackupVerified: localBackupReport.verified,
    driveBackupVerified,
    driveSafetyBackupFileId,
    driveSafetyBackupPreservedExisting,
    totalResourcesDiscovered: resourcesToInspect.length,
    totalResourcesInspected: auditedResources.length,
    totalPublicPermissionsDetected,
    totalPublicPermissionsRevoked,
    unverifiedResources,
    flaggedDomainOrStaffPermissions,
    resources: auditedResources,
  };

  try {
    localStorage.setItem(PHASE0_DRIVE_PERMISSION_AUDIT_KEY, JSON.stringify(report));
  } catch {
    // Ignore storage error
  }

  return report;
};

/**
 * PRIMARY DEVICE HELPER: Grants read-only permission on the `Lakshay_Library_Master`
 * root folder, `Master_Sync_Backups` subfolder, and `Lakshay_Library_Master_Sync.json` file
 * to a specific named Google account email ONLY (`type: 'user'`).
 * Never grants `type: 'anyone'` public permissions.
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
  if (config.lastDriveFileId && /^[a-zA-Z0-9_-]{20,}$/.test(config.lastDriveFileId)) {
    idsToShare.push(config.lastDriveFileId);
  }

  for (const id of idsToShare) {
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
 * 2. Authenticated Google Drive API v3 (OAuth Bearer token required; zero public `ntfy.sh` or API-key-only calls)
 */
export const findMasterSyncFileOnDrive = async (
  accessToken?: string | null,
  overrideSyncKeyInput?: string | null
): Promise<DriveBackupFileMetadata | null> => {
  const config = getGoogleDriveSyncConfig();
  const rawInput =
    overrideSyncKeyInput !== undefined ? overrideSyncKeyInput : config.sharedFolderInput;

  // 1. Check if the user pasted a self-contained Offline Sync Code (`LKSYNC1:...`)
  const decodedOffline = decodeOfflineSyncPackageKey(rawInput);
  if (decodedOffline) {
    return {
      id: 'LKSYNC1-OFFLINE',
      name: MASTER_DRIVE_BACKUP_FILENAME,
      modifiedTime: decodedOffline.syncedAt || new Date().toISOString(),
      folderPath: `Offline Sync Package from ${decodedOffline.primaryDeviceName || 'Primary Phone'} (${decodedOffline.data.students.length} students)`,
    };
  }

  const hasRealOAuthToken = Boolean(accessToken && accessToken !== 'IDENTITY_SESSION_ACTIVE');
  if (!hasRealOAuthToken) {
    return null;
  }

  const customSharedId = extractDriveIdFromInput(rawInput);
  const authHeaders: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };

  // 2. If the user provided a specific Google Drive File ID or Folder ID:
  if (customSharedId) {
    try {
      const directFileUrl = `https://www.googleapis.com/drive/v3/files/${customSharedId}?supportsAllDrives=true&fields=id,name,mimeType,modifiedTime,size,trashed`;
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
            folderPath: `Authenticated Drive File (${MASTER_DRIVE_ROOT_FOLDER_NAME}/${MASTER_SYNC_SUBFOLDER_NAME})`,
          };
        }
      }
    } catch {
      // Fall through to folder search
    }

    try {
      const insideSharedFolderQuery = encodeURIComponent(
        `name = '${MASTER_DRIVE_BACKUP_FILENAME}' and '${customSharedId}' in parents and trashed = false`
      );
      const sharedFolderUrl = `https://www.googleapis.com/drive/v3/files?q=${insideSharedFolderQuery}&spaces=drive&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=1`;
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

  // 3. Search across accessible Drive files with authenticated OAuth token
  const globalFileQuery = encodeURIComponent(
    `name = '${MASTER_DRIVE_BACKUP_FILENAME}' and trashed = false`
  );
  const globalSearchUrl = `https://www.googleapis.com/drive/v3/files?q=${globalFileQuery}&spaces=drive&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,name,modifiedTime,size,owners)&orderBy=modifiedTime desc&pageSize=5`;

  const globalResponse = await fetch(globalSearchUrl, {
    headers: authHeaders,
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
 * `Lakshay_Library_Master/Master_Sync_Backups/` on Google Drive with private permissions.
 * Note: Live permission audits and public permission revocation are executed ONLY when explicitly
 * initiated by the signed-in user.
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
  if (isRecoveryOnlyMode()) throw new Error('Google Drive upload is blocked while recovery-only mode is active.');
  createAndVerifyPhase0LocalBackup(false);
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
  const activeStudentCount = payload.data.students.filter((s) => s.status !== 'archived').length;
  const folderPath = payload.folderPath;

  let targetFileId = existingFileId;
  if (!targetFileId) {
    const found = await findMasterSyncFileOnDrive(accessToken, null);
    if (found && !found.id.startsWith('LK-') && found.id !== 'LKSYNC1-OFFLINE') {
      targetFileId = found.id;
    }
  }

  // Detect a remote snapshot newer than this device's last acknowledged sync.
  // Google Drive v3 does not provide an atomic compare-and-swap for this JSON
  // update flow, so this is a stale-write safety check, not a distributed lock.
  if (targetFileId && config.lastSyncedAtISO) {
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${targetFileId}?supportsAllDrives=true&fields=id,modifiedTime`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!metaRes.ok) throw new Error(`Unable to verify remote snapshot revision (${metaRes.status}); upload cancelled to avoid overwriting unknown data.`);
    const remoteMeta = await metaRes.json() as { modifiedTime?: string };
    const remoteRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${targetFileId}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!remoteRes.ok) throw new Error(`Unable to read current remote snapshot (${remoteRes.status}); upload cancelled.`);
    const remotePayload = await remoteRes.json() as MasterSyncPayload;
    const lastAcknowledged = Date.parse(config.lastSyncedAtISO);
    const remoteSyncedAt = Date.parse(remotePayload?.syncedAt || remoteMeta.modifiedTime || '');
    if (Number.isFinite(lastAcknowledged) && Number.isFinite(remoteSyncedAt) && remoteSyncedAt > lastAcknowledged) {
      throw new Error('SYNC_CONFLICT: Google Drive contains a newer snapshot than this device last acknowledged. Pull and review the latest snapshot before uploading; no remote data was overwritten.');
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

  const latestConfig = getGoogleDriveSyncConfig();
  saveGoogleDriveSyncConfig({
    ...latestConfig,
    lastSyncedDateKey: dateKey,
    lastSyncedAtISO: nowISO,
    lastDriveFileId: savedFileId,
    lastPrimaryWriterName: latestConfig.deviceName,
    lastSyncedStudentCount: activeStudentCount,
  });

  return {
    fileId: savedFileId,
    syncedAt: nowISO,
    studentCount: activeStudentCount,
    folderPath,
  };
};

/**
 * SECONDARY (OR RESTORE) MODE: Downloads `Lakshay_Library_Master_Sync.json` and applies the snapshot locally.
 * Supports:
 * 1. Self-contained Offline Sync Package (`LKSYNC1:...` — 100% local decode, zero external servers)
 * 2. Authenticated Google Drive API v3 (OAuth Bearer token required)
 * Note: `LK-XXXXXXXXXXXX` Sync Key Only via public `ntfy.sh` relay is blocked with a clear security notice.
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
  createAndVerifyPhase0LocalBackup(false);
  const config = getGoogleDriveSyncConfig();
  const rawInput = (
    overrideSyncKeyInput !== undefined ? overrideSyncKeyInput : config.sharedFolderInput
  )?.trim();

  // 1. Check if the user pasted a self-contained Offline Sync Code (`LKSYNC1:...`)
  if (rawInput && rawInput.includes('LKSYNC1:')) {
    const decoded = decodeOfflineSyncPackageKey(rawInput);
    if (!decoded) {
      throw new Error(
        'The pasted Offline Sync Package (LKSYNC1:...) appears incomplete. Please tap "Copy Offline Sync Package" on the Primary Phone and paste again.'
      );
    }
    return applyMasterSyncPayloadLocally(decoded, 'LKSYNC1-OFFLINE');
  }

  // 2. If the user pasted a legacy `LK-XXXXXXXXXXXX` Sync Key, explicitly inform them that Sync Key Only relay is disabled
  const relayFileId = extractRelayFileIdFromSyncKey(rawInput);
  if (relayFileId) {
    throw new Error(
      'Sync Key Only (LK-...) synchronization via public ntfy.sh relay has been disabled in Phase 0 Security Containment to protect student and payment data privacy. Please sign in with the Library Google Drive account or use "Copy Offline Sync Package (LKSYNC1:...)" instead.'
    );
  }

  const hasRealOAuthToken = Boolean(accessToken && accessToken !== 'IDENTITY_SESSION_ACTIVE');
  if (!hasRealOAuthToken) {
    throw new Error(
      'Google Drive authentication is required. Please sign in with the Library Google Account (or paste an Offline Sync Package starting with LKSYNC1:...).'
    );
  }

  // 3. Resolve via authenticated Google Drive search
  const fileMeta = await findMasterSyncFileOnDrive(accessToken, rawInput);
  if (!fileMeta) {
    throw new Error(
      `No '${MASTER_DRIVE_BACKUP_FILENAME}' found in this Google Drive account. Ensure all library devices are signed into the same dedicated Library Google Account or use an Offline Sync Package (LKSYNC1:...).`
    );
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileMeta.id}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      clearStoredGoogleAuthSession();
      throw new Error('AUTH_REQUIRED');
    }
    throw new Error(
      `Failed to download '${MASTER_DRIVE_BACKUP_FILENAME}' from Google Drive (HTTP ${res.status}). Ensure you are signed into the authorized Library Google Account.`
    );
  }

  const payload = (await res.json()) as MasterSyncPayload;
  return applyMasterSyncPayloadLocally(payload, fileMeta.id);
};

