import { getGoogleDriveSyncConfig } from './googleDriveSyncService';

export const LOGS_FOLDER_NAME = 'Lakshay_Library_Logs';
export const CRASH_LOGS_FILENAME = 'crash_and_error_logs.json';
export const ACTIVE_CLIENTS_FILENAME = 'active_clients_status.json';

export interface DriveLogFolderInfo {
  folderId: string;
  folderName: string;
  lastSyncedAtISO: string | null;
  crashLogsFileId: string | null;
  activeClientsFileId: string | null;
}

const LOGS_FOLDER_STORAGE_KEY = 'lakshay_library_drive_logs_folder_meta_v1';

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
 * Finds or creates the `Lakshay_Library_Logs` folder in Google Drive.
 */
export const ensureLogsFolderOnDrive = async (accessToken: string): Promise<string> => {
  const meta = getStoredDriveLogsFolderMeta();
  if (meta?.folderId) {
    // Verify it still exists and is not trashed
    try {
      const checkRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${meta.folderId}?fields=id,name,trashed`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (!checkData.trashed) {
          return meta.folderId;
        }
      }
    } catch {
      // Continue to search
    }
  }

  // Search for folder by name
  const query = encodeURIComponent(
    `name = '${LOGS_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name)&pageSize=1`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      const existingFolderId = searchData.files[0].id;
      saveStoredDriveLogsFolderMeta({
        folderId: existingFolderId,
        folderName: LOGS_FOLDER_NAME,
        lastSyncedAtISO: meta?.lastSyncedAtISO || null,
        crashLogsFileId: meta?.crashLogsFileId || null,
        activeClientsFileId: meta?.activeClientsFileId || null,
      });
      return existingFolderId;
    }
  }

  // Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: LOGS_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Lakshay Library automated crash logs and active client heartbeats',
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Failed to create ${LOGS_FOLDER_NAME} folder in Google Drive (${createRes.status})`);
  }

  const createdData = await createRes.json();
  const folderId = createdData.id;

  saveStoredDriveLogsFolderMeta({
    folderId,
    folderName: LOGS_FOLDER_NAME,
    lastSyncedAtISO: new Date().toISOString(),
    crashLogsFileId: null,
    activeClientsFileId: null,
  });

  return folderId;
};

/**
 * Searches for a specific file inside the `Lakshay_Library_Logs` folder.
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
 * Uploads or updates a JSON file inside the `Lakshay_Library_Logs` folder.
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
 * Downloads a file from the `Lakshay_Library_Logs` folder.
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
