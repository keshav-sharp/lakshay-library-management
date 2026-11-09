import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
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

export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// Hierarchical Master Folder & Subfolder Architecture on Google Drive
export const MASTER_DRIVE_ROOT_FOLDER_NAME = 'Lakshay_Library_Master';
export const MASTER_SYNC_SUBFOLDER_NAME = 'Master_Sync_Backups';
export const AUTOMATED_LOGS_SUBFOLDER_NAME = 'Automated_Logs';
export const MASTER_DRIVE_BACKUP_FILENAME = 'Lakshay_Library_Master_Sync.json';
export const MASTER_DRIVE_SYNC_PATH = `${MASTER_DRIVE_ROOT_FOLDER_NAME}/${MASTER_SYNC_SUBFOLDER_NAME}/${MASTER_DRIVE_BACKUP_FILENAME}`;

export type DeviceSyncRole = 'PRIMARY' | 'SECONDARY';

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

const GDRIVE_SYNC_CONFIG_KEY = 'lakshay_library_gdrive_sync_config_v1';
export const PENDING_DRIVE_AUTH_REDIRECT_KEY = 'lakshay_library_pending_drive_redirect';

// Initialize Firebase App safely (reuse if already initialized)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({ prompt: 'select_account' });

// Detect if running inside an Android APK WebView or Capacitor container
const isNativeAndroidWebView = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isAndroidWv = /Android/i.test(ua) && /; wv\)/i.test(ua);
  const hasCapacitor = Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
  );
  return isAndroidWv || hasCapacitor;
};

// In-memory access token cache (NEVER persisted in localStorage or sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let redirectResultPromise: Promise<User | null> | null = null;

export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!redirectResultPromise) {
    redirectResultPromise = getRedirectResult(auth)
      .then((result) => {
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            cachedAccessToken = credential.accessToken;
          }
          return result.user;
        }
        return null;
      })
      .catch(() => null);
  }

  redirectResultPromise.then((redirectUser) => {
    if (redirectUser && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(redirectUser, cachedAccessToken);
    }
  });

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (redirectResultPromise) {
      await redirectResultPromise;
    }
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleDriveSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    if (isNativeAndroidWebView()) {
      try {
        sessionStorage.setItem(PENDING_DRIVE_AUTH_REDIRECT_KEY, '1');
      } catch {
        // Ignore storage errors
      }
      await signInWithRedirect(auth, provider);
      return null;
    }

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Drive access token.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      try {
        sessionStorage.setItem(PENDING_DRIVE_AUTH_REDIRECT_KEY, '1');
      } catch {
        // Ignore storage errors
      }
      await signInWithRedirect(auth, provider);
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
  return auth.currentUser;
};

export const googleDriveLogout = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
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
  // 1. Verify cachedFolderId if available
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

  // 2. Search for folder by name (and parent if specified)
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
      cachedAccessToken = null;
      throw new Error('AUTH_REQUIRED');
    }
    throw new Error(`Google Drive folder lookup failed (${searchRes.status})`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id as string;
  }

  // 3. Create the folder if it doesn't exist yet
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
      cachedAccessToken = null;
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
 * Searches Google Drive inside `Lakshay_Library_Master/Master_Sync_Backups/` for `Lakshay_Library_Master_Sync.json`.
 */
export const findMasterSyncFileOnDrive = async (
  accessToken: string
): Promise<DriveBackupFileMetadata | null> => {
  const { syncSubfolderId } = await ensureMasterSyncFolderHierarchy(accessToken);

  // 1. Search inside the dedicated `Master_Sync_Backups` subfolder first
  const subfolderQuery = encodeURIComponent(
    `name = '${MASTER_DRIVE_BACKUP_FILENAME}' and '${syncSubfolderId}' in parents and trashed = false`
  );
  const subfolderUrl = `https://www.googleapis.com/drive/v3/files?q=${subfolderQuery}&spaces=drive&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=1`;

  const response = await fetch(subfolderUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      cachedAccessToken = null;
      throw new Error('AUTH_REQUIRED');
    }
    throw new Error(`Google Drive search failed (${response.status})`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return {
      ...(data.files[0] as DriveBackupFileMetadata),
      folderPath: `${MASTER_DRIVE_ROOT_FOLDER_NAME}/${MASTER_SYNC_SUBFOLDER_NAME}`,
    };
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
    schemaVersion: '1.3',
    application: 'Lakshay Library Management App (LibTrack)',
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

  // Check if file already exists inside the `Master_Sync_Backups` subfolder
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
      cachedAccessToken = null;
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
 */
export const pullMasterSnapshotFromGoogleDrive = async (
  accessToken: string
): Promise<{
  fileId: string;
  primaryDeviceName: string;
  syncedAt: string;
  studentCount: number;
}> => {
  const fileMeta = await findMasterSyncFileOnDrive(accessToken);
  if (!fileMeta) {
    throw new Error(
      `No '${MASTER_DRIVE_BACKUP_FILENAME}' found in '${MASTER_DRIVE_ROOT_FOLDER_NAME}/${MASTER_SYNC_SUBFOLDER_NAME}'. Push a snapshot from your Primary phone first.`
    );
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileMeta.id}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      cachedAccessToken = null;
      throw new Error('AUTH_REQUIRED');
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
