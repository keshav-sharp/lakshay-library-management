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
  folderPath: string;
  data: {
    students: ReturnType<typeof getStoredStudents>;
    payments: ReturnType<typeof getStoredPayments>;
    dailyAttendance: ReturnType<typeof getStoredDailyAttendance>;
    shifts: ReturnType<typeof getStoredShifts>;
    seats: ReturnType<typeof getStoredSeats>;
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
 * Extracts a clean Google Drive Folder/File ID from either a full Google Drive URL or a raw ID string.
 */
export const extractDriveIdFromInput = (input?: string | null): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) return folderMatch[1];
  const fileMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch?.[1]) return fileMatch[1];
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch?.[1]) return idParamMatch[1];
  if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) return trimmed;
  return null;
};

/**
 * Enables link-based read permission (`type: 'anyone', role: 'reader'`) on a Drive file or folder
 * created by the Primary Phone so a Secondary Phone can pull it using just the Sync Key (`fileId`)
 * without hitting Google's Error 403 verification block on secondary Gmail accounts.
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
 * Searches Google Drive for `Lakshay_Library_Master_Sync.json`.
 * Supports both authenticated Drive API lookup AND direct Sync Key / Shared Link lookup
 * (using `?key=${firebaseConfig.apiKey}`) so Secondary phones on any Gmail account can pull!
 */
export const findMasterSyncFileOnDrive = async (
  accessToken?: string | null
): Promise<DriveBackupFileMetadata | null> => {
  const config = getGoogleDriveSyncConfig();
  const customSharedId = extractDriveIdFromInput(config.sharedFolderInput);
  const hasRealOAuthToken = Boolean(accessToken && accessToken !== 'IDENTITY_SESSION_ACTIVE');
  const apiKeyParam = firebaseConfig.apiKey ? `&key=${encodeURIComponent(firebaseConfig.apiKey)}` : '';

  // 1. If the Secondary user pasted a Sync Key (File ID / Folder ID) or Google Drive Share Link:
  if (customSharedId) {
    const authHeaders: Record<string, string> = hasRealOAuthToken
      ? { Authorization: `Bearer ${accessToken}` }
      : {};

    // 1a. Check if customSharedId is directly the `Lakshay_Library_Master_Sync.json` file ID
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

    // 1b. Otherwise treat customSharedId as a Shared Folder ID and look for `Lakshay_Library_Master_Sync.json` inside it
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

  // 2. Search across all accessible Drive files with OAuth token
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

  // 3. If this device is PRIMARY, ensure the Master folder hierarchy exists in its own Drive
  if (config.deviceRole === 'PRIMARY' && accessToken) {
    await ensureMasterSyncFolderHierarchy(accessToken);
  }

  return null;
};

/**
 * PRIMARY DEVICE ONLY: Uploads or updates `Lakshay_Library_Master_Sync.json` inside
 * `Lakshay_Library_Master/Master_Sync_Backups/` on Google Drive.
 */
export const pushPrimarySnapshotToGoogleDrive = async (
  accessToken: string,
  existingFileId?: string | null
): Promise<{
  fileId: string;
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

  const now = new Date();
  const dateKey = now.toISOString().split('T')[0];
  const students = getStoredStudents();
  const payments = getStoredPayments();
  const dailyAttendance = getStoredDailyAttendance();
  const shifts = getStoredShifts();
  const seats = getStoredSeats();

  const folderPath = `${MASTER_DRIVE_ROOT_FOLDER_NAME}/${MASTER_SYNC_SUBFOLDER_NAME}`;

  const payload: MasterSyncPayload = {
    schemaVersion: '2.0',
    application: 'Lakshay Library',
    syncedAt: now.toISOString(),
    syncDateKey: dateKey,
    primaryDeviceId: config.deviceId,
    primaryDeviceName: config.deviceName,
    folderPath,
    data: {
      students,
      payments,
      dailyAttendance,
      shifts,
      seats,
    },
  };

  let targetFileId = existingFileId;
  if (!targetFileId) {
    const found = await findMasterSyncFileOnDrive(accessToken);
    if (found) {
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

  // Automatically enable reader permission on the uploaded file & subfolder so Secondary phones
  // can pull using the Sync Key (`savedFileId`) even from another Gmail account without OAuth 403 blocks.
  if (savedFileId) {
    await enableAnyoneReaderPermission(accessToken, savedFileId);
  }
  await enableAnyoneReaderPermission(accessToken, syncSubfolderId);

  const latestConfig = getGoogleDriveSyncConfig();
  saveGoogleDriveSyncConfig({
    ...latestConfig,
    lastSyncedDateKey: dateKey,
    lastSyncedAtISO: now.toISOString(),
    lastDriveFileId: savedFileId,
    lastPrimaryWriterName: latestConfig.deviceName,
    lastSyncedStudentCount: students.length,
  });

  return {
    fileId: savedFileId,
    syncedAt: now.toISOString(),
    studentCount: students.length,
    folderPath,
  };
};

/**
 * SECONDARY (OR RESTORE) MODE: Downloads `Lakshay_Library_Master_Sync.json` from
 * `Lakshay_Library_Master/Master_Sync_Backups/` on Google Drive and applies the snapshot locally.
 * Works both with a full Google Drive OAuth token OR using a pasted Primary Sync Key / Share Link!
 */
export const pullMasterSnapshotFromGoogleDrive = async (
  accessToken?: string | null
): Promise<{
  fileId: string;
  primaryDeviceName: string;
  syncedAt: string;
  studentCount: number;
}> => {
  const fileMeta = await findMasterSyncFileOnDrive(accessToken);
  if (!fileMeta) {
    throw new Error(
      `No '${MASTER_DRIVE_BACKUP_FILENAME}' found. If using a different Gmail on this Secondary phone, paste the Primary Phone's Sync Key (or Shared Link) in Section 1 first.`
    );
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

  // Fallback to API key download if Bearer token belongs to a different account without Drive scope
  if (!res.ok && hasRealOAuthToken && apiKeyParam) {
    res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileMeta.id}?alt=media&supportsAllDrives=true${apiKeyParam}`
    );
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        'Google Drive denied download (403). On the Primary Phone, tap "Push Primary Snapshot to Drive" once so the Sync Key is active, then try again.'
      );
    }
    throw new Error(`Failed to download snapshot from Google Drive (${res.status})`);
  }

  const payload = (await res.json()) as MasterSyncPayload;
  if (!payload?.data?.students || !Array.isArray(payload.data.students)) {
    throw new Error('Invalid master sync file format in Google Drive.');
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

  const now = new Date();
  const dateKey = now.toISOString().split('T')[0];
  const config = getGoogleDriveSyncConfig();

  saveGoogleDriveSyncConfig({
    ...config,
    lastSyncedDateKey: dateKey,
    lastSyncedAtISO: now.toISOString(),
    lastDriveFileId: fileMeta.id,
    lastPrimaryWriterName: payload.primaryDeviceName || 'Primary Phone',
    lastSyncedStudentCount: payload.data.students.length,
  });

  return {
    fileId: fileMeta.id,
    primaryDeviceName: payload.primaryDeviceName || 'Primary Phone',
    syncedAt: payload.syncedAt || fileMeta.modifiedTime,
    studentCount: payload.data.students.length,
  };
};
