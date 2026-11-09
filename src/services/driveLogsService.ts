import {
  MASTER_DRIVE_ROOT_FOLDER_NAME,
  AUTOMATED_LOGS_SUBFOLDER_NAME,
  ensureDriveFolderExists,
  getGoogleDriveSyncConfig,
  saveGoogleDriveSyncConfig,
} from './googleDriveSyncService';

export const LOGS_FOLDER_NAME = `${MASTER_DRIVE_ROOT_FOLDER_NAME}/${AUTOMATED_LOGS_SUBFOLDER_NAME}`;
export const CRASH_LOGS_FILENAME = 'crash_and_error_logs.json';
export const ACTIVE_CLIENTS_FILENAME = 'active_clients_status.json';

export interface DriveLogFolderInfo {
  rootFolderId?: string;
  folderId: string;
  folderName: string;
  lastSyncedAtISO: string | null;
  crashLogsFileId: string | null;
  activeClientsFileId: string | null;
}

const LOGS_FOLDER_STORAGE_KEY = 'lakshay_library_drive_logs_folder_meta_v2';

export const getStoredDriveLogsFolderMeta = (): DriveLogFolderInfo | null => {
  try {
    const raw = localStorage.getItem(LOGS_FOLDER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveStoredDriveLogsFolderMeta = (meta: DriveLogFolderInfo) => {
  try {
    localStorage.setItem(LOGS_FOLDER_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // Ignore storage errors
  }
};

/**
 * Finds or creates `Lakshay_Library_Master/Automated_Logs` folder hierarchy in Google Drive.
 */
export const ensureLogsFolderOnDrive = async (accessToken: string): Promise<string> => {
  const meta = getStoredDriveLogsFolderMeta();
  const syncConfig = getGoogleDriveSyncConfig();

  // 1. Ensure Root Master Folder (`Lakshay_Library_Master`) exists
  const rootFolderId = await ensureDriveFolderExists(
    accessToken,
    MASTER_DRIVE_ROOT_FOLDER_NAME,
    null,
    meta?.rootFolderId || syncConfig.masterRootFolderId,
    'Lakshay Library Master Cloud Directory (Contains Master Sync Backups and Automated Logs)'
  );

  if (syncConfig.masterRootFolderId !== rootFolderId) {
    saveGoogleDriveSyncConfig({
      ...syncConfig,
      masterRootFolderId: rootFolderId,
    });
  }

  // 2. Ensure `Automated_Logs` Subfolder exists inside `Lakshay_Library_Master`
  const logsSubfolderId = await ensureDriveFolderExists(
    accessToken,
    AUTOMATED_LOGS_SUBFOLDER_NAME,
    rootFolderId,
    meta?.folderId,
    'Lakshay Library Automated Crash Logs & Active Client Heartbeats Subfolder'
  );

  saveStoredDriveLogsFolderMeta({
    rootFolderId,
    folderId: logsSubfolderId,
    folderName: LOGS_FOLDER_NAME,
    lastSyncedAtISO: meta?.lastSyncedAtISO || new Date().toISOString(),
    crashLogsFileId: meta?.crashLogsFileId || null,
    activeClientsFileId: meta?.activeClientsFileId || null,
  });

  return logsSubfolderId;
};

/**
 * Searches for a specific file inside the `Lakshay_Library_Master/Automated_Logs` subfolder.
 */
export const findFileInLogsFolder = async (
  accessToken: string,
  folderId: string,
  filename: string
): Promise<string | null> => {
  const query = encodeURIComponent(
    `name = '${filename}' and '${folderId}' in parents and trashed = false`
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime)&pageSize=1`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
};

/**
 * Uploads or updates a JSON file inside `Lakshay_Library_Master/Automated_Logs`.
 */
export const uploadJsonToLogsFolder = async (
  accessToken: string,
  filename: string,
  jsonData: unknown,
  description: string
): Promise<string> => {
  const folderId = await ensureLogsFolderOnDrive(accessToken);
  const existingFileId = await findFileInLogsFolder(accessToken, folderId, filename);

  const metadata = existingFileId
    ? {
        name: filename,
        mimeType: 'application/json',
        description,
      }
    : {
        name: filename,
        mimeType: 'application/json',
        parents: [folderId],
        description,
      };

  const boundary = '-------lakshay_logs_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(jsonData, null, 2) +
    closeDelimiter;

  const uploadUrl = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const method = existingFileId ? 'PATCH' : 'POST';

  const res = await fetch(uploadUrl, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!res.ok) {
    throw new Error(`Failed to upload ${filename} to Google Drive (${res.status})`);
  }

  const result = await res.json();
  const fileId = result.id || existingFileId || '';

  const meta = getStoredDriveLogsFolderMeta();
  if (meta) {
    saveStoredDriveLogsFolderMeta({
      ...meta,
      lastSyncedAtISO: new Date().toISOString(),
      crashLogsFileId: filename === CRASH_LOGS_FILENAME ? fileId : meta.crashLogsFileId,
      activeClientsFileId: filename === ACTIVE_CLIENTS_FILENAME ? fileId : meta.activeClientsFileId,
    });
  }

  return fileId;
};

/**
 * Downloads a file from `Lakshay_Library_Master/Automated_Logs`.
 */
export const downloadJsonFromLogsFolder = async <T>(
  accessToken: string,
  filename: string
): Promise<T | null> => {
  try {
    const folderId = await ensureLogsFolderOnDrive(accessToken);
    const fileId = await findFileInLogsFolder(accessToken, folderId, filename);
    if (!fileId) return null;

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
};
