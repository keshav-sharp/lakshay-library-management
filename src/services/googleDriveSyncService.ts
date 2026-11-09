import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
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

export const MASTER_DRIVE_BACKUP_FILENAME = 'Lakshay_Library_Master_Sync.json';

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
}

export interface DriveBackupFileMetadata {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

export interface MasterSyncPayload {
  schemaVersion: string;
  application: string;
  syncedAt: string;
  syncDateKey: string;
  primaryDeviceId: string;
  primaryDeviceName: string;
  data: {
    students: ReturnType<typeof getStoredStudents>;
    payments: ReturnType<typeof getStoredPayments>;
    dailyAttendance: ReturnType<typeof getStoredDailyAttendance>;
    shifts: ReturnType<typeof getStoredShifts>;
    seats: ReturnType<typeof getStoredSeats>;
  };
}

const GDRIVE_SYNC_CONFIG_KEY = 'lakshay_library_gdrive_sync_config_v1';

// Initialize Firebase App safely (reuse if already initialized)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// In-memory access token cache (NEVER persisted in localStorage or sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
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
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Drive access token.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
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
 * Searches Google Drive for the canonical `Lakshay_Library_Master_Sync.json` file.
 */
export const findMasterSyncFileOnDrive = async (
  accessToken: string
): Promise<DriveBackupFileMetadata | null> => {
  const query = encodeURIComponent(
    `name = '${MASTER_DRIVE_BACKUP_FILENAME}' and trashed = false`
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=1`;

  const response = await fetch(url, {
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
    return data.files[0] as DriveBackupFileMetadata;
  }
  return null;
};

/**
 * PRIMARY DEVICE ONLY: Uploads or updates `Lakshay_Library_Master_Sync.json` in Google Drive.
 * Secondary devices are blocked from writing to prevent multi-device conflict.
 */
export const pushPrimarySnapshotToGoogleDrive = async (
  accessToken: string,
  existingFileId?: string | null
): Promise<{
  fileId: string;
  syncedAt: string;
  studentCount: number;
}> => {
  const config = getGoogleDriveSyncConfig();
  if (config.deviceRole !== 'PRIMARY') {
    throw new Error(
      'Conflict Guard: Only a device set to PRIMARY mode can upload master data to Google Drive.'
    );
  }

  const now = new Date();
  const dateKey = now.toISOString().split('T')[0];
  const students = getStoredStudents();
  const payments = getStoredPayments();
  const dailyAttendance = getStoredDailyAttendance();
  const shifts = getStoredShifts();
  const seats = getStoredSeats();

  const payload: MasterSyncPayload = {
    schemaVersion: '1.0',
    application: 'Lakshay Library Management App (LibTrack)',
    syncedAt: now.toISOString(),
    syncDateKey: dateKey,
    primaryDeviceId: config.deviceId,
    primaryDeviceName: config.deviceName,
    data: {
      students,
      payments,
      dailyAttendance,
      shifts,
      seats,
    },
  };

  // Check if file already exists if existingFileId wasn't passed
  let targetFileId = existingFileId;
  if (!targetFileId) {
    const found = await findMasterSyncFileOnDrive(accessToken);
    if (found) {
      targetFileId = found.id;
    }
  }

  const metadata = {
    name: MASTER_DRIVE_BACKUP_FILENAME,
    mimeType: 'application/json',
    description: `Lakshay Library Master Daily Sync from Primary Device (${config.deviceName}) on ${dateKey}`,
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

  saveGoogleDriveSyncConfig({
    ...config,
    lastSyncedDateKey: dateKey,
    lastSyncedAtISO: now.toISOString(),
    lastDriveFileId: savedFileId,
    lastPrimaryWriterName: config.deviceName,
    lastSyncedStudentCount: students.length,
  });

  return {
    fileId: savedFileId,
    syncedAt: now.toISOString(),
    studentCount: students.length,
  };
};

/**
 * SECONDARY (OR RESTORE) MODE: Downloads `Lakshay_Library_Master_Sync.json` from Google Drive
 * and applies the Primary device's student database, payments, attendance, shifts, and seats locally.
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
      `No '${MASTER_DRIVE_BACKUP_FILENAME}' file found in Google Drive. Push a snapshot from your Primary phone first.`
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

  // Hydrate local database from Primary snapshot
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
