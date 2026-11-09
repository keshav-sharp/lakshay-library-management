import { getDriveAccessToken } from './googleDriveSyncService';
import { uploadJsonToLogsFolder, CRASH_LOGS_FILENAME } from './driveLogsService';

export interface BreadcrumbItem {
  timestamp: string;
  category: 'NAVIGATION' | 'ACTION' | 'DATA_SYNC' | 'NETWORK' | 'SYSTEM';
  message: string;
}

export interface CrashLogEntry {
  id: string;
  timestamp: string;
  type: 'REACT_CRASH' | 'UNHANDLED_ERROR' | 'PROMISE_REJECTION' | 'MANUAL_REPORT' | 'TEST_SIMULATION';
  severity: 'CRITICAL' | 'ERROR' | 'WARNING';
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  platform: string;
  breadcrumbs: BreadcrumbItem[];
  syncedToDrive: boolean;
}

const CRASH_LOGS_STORAGE_KEY = 'lakshay_library_crash_logs_v1';
const BREADCRUMBS_BUFFER_KEY = 'lakshay_library_breadcrumbs_buffer_v1';
const MAX_LOGS = 50;
const MAX_BREADCRUMBS = 25;

type CrashLogListener = (logs: CrashLogEntry[]) => void;
const listeners: Set<CrashLogListener> = new Set();

const notifyListeners = (logs: CrashLogEntry[]) => {
  listeners.forEach((listener) => {
    try {
      listener(logs);
    } catch {
      // Ignore listener error
    }
  });
};

export const subscribeToCrashLogs = (callback: CrashLogListener): (() => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

/**
 * Gets buffered breadcrumbs for crash diagnostics.
 */
export const getBreadcrumbs = (): BreadcrumbItem[] => {
  try {
    const raw = sessionStorage.getItem(BREADCRUMBS_BUFFER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Adds an in-app breadcrumb so we know what the user was doing before a crash happened.
 */
export const addBreadcrumb = (category: BreadcrumbItem['category'], message: string) => {
  try {
    const current = getBreadcrumbs();
    const updated = [
      ...current,
      {
        timestamp: new Date().toISOString(),
        category,
        message,
      },
    ].slice(-MAX_BREADCRUMBS);
    sessionStorage.setItem(BREADCRUMBS_BUFFER_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage issues
  }
};

/**
 * Retrieves all stored crash & error logs from local storage.
 */
export const getCrashLogs = (): CrashLogEntry[] => {
  try {
    const raw = localStorage.getItem(CRASH_LOGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Clears stored crash logs.
 */
export const clearCrashLogs = () => {
  try {
    localStorage.removeItem(CRASH_LOGS_STORAGE_KEY);
    notifyListeners([]);
  } catch {
    // Ignore
  }
};

/**
 * Logs a crash, error, or unhandled rejection, saves to localStorage, and auto-pushes to Google Drive if authorized.
 */
export const logCrash = (
  error: Error | string,
  options: {
    type?: CrashLogEntry['type'];
    severity?: CrashLogEntry['severity'];
    componentStack?: string;
    extraMessage?: string;
  } = {}
): CrashLogEntry => {
  const isErrorObj = error instanceof Error;
  const message = isErrorObj ? error.message : String(error);
  const stack = isErrorObj ? error.stack : undefined;

  const entry: CrashLogEntry = {
    id: `crash_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    type: options.type || (options.componentStack ? 'REACT_CRASH' : 'UNHANDLED_ERROR'),
    severity: options.severity || (options.componentStack ? 'CRITICAL' : 'ERROR'),
    message: options.extraMessage ? `${options.extraMessage}: ${message}` : message,
    stack,
    componentStack: options.componentStack,
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown',
    breadcrumbs: getBreadcrumbs(),
    syncedToDrive: false,
  };

  const existing = getCrashLogs();
  const updated = [entry, ...existing].slice(0, MAX_LOGS);

  try {
    localStorage.setItem(CRASH_LOGS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }

  notifyListeners(updated);

  // Auto-push to Google Drive `Lakshay_Library_Logs` folder if access token is available
  const token = getDriveAccessToken();
  if (token) {
    syncCrashLogsToGoogleDrive(token).catch(() => {
      // Silent failure for background sync
    });
  }

  return entry;
};

/**
 * Pushes the current crash and error logs to Google Drive into `Lakshay_Library_Logs/crash_and_error_logs.json`.
 */
export const syncCrashLogsToGoogleDrive = async (
  token?: string | null
): Promise<{ fileId: string; count: number; syncedAt: string }> => {
  const accessToken = token || getDriveAccessToken();
  if (!accessToken) {
    throw new Error('Google Drive is not connected. Sign in via Drive Sync first.');
  }

  const logs = getCrashLogs();
  const payload = {
    schemaVersion: '1.0',
    application: 'Lakshay Library Management App (LibTrack)',
    syncedAt: new Date().toISOString(),
    totalErrorsLogged: logs.length,
    recentCrashes: logs,
  };

  const fileId = await uploadJsonToLogsFolder(
    accessToken,
    CRASH_LOGS_FILENAME,
    payload,
    `Lakshay Library Crash and Error Logs (${logs.length} entries)`
  );

  // Mark existing logs as synced
  const updated = logs.map((log) => ({ ...log, syncedToDrive: true }));
  try {
    localStorage.setItem(CRASH_LOGS_STORAGE_KEY, JSON.stringify(updated));
    notifyListeners(updated);
  } catch {
    // Ignore
  }

  return {
    fileId,
    count: logs.length,
    syncedAt: payload.syncedAt,
  };
};

/**
 * Exports crash logs as a downloadable JSON file.
 */
export const exportCrashLogsAsJson = () => {
  const logs = getCrashLogs();
  const payload = {
    application: 'Lakshay Library Management App',
    exportedAt: new Date().toISOString(),
    count: logs.length,
    logs,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `lakshay_crash_logs_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Installs global error listeners for `window.onerror` and `unhandledrejection`.
 */
export const initGlobalErrorLogging = (): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  const handleGlobalError = (event: ErrorEvent) => {
    // Filter out transient browser extension or resize observer errors
    if (
      event.message?.includes('ResizeObserver') ||
      event.message?.includes('Script error') ||
      event.filename?.includes('extension')
    ) {
      return;
    }

    logCrash(event.error || event.message, {
      type: 'UNHANDLED_ERROR',
      severity: 'ERROR',
      extraMessage: `Global Error at ${event.filename || 'unknown'}:${event.lineno || 0}:${event.colno || 0}`,
    });
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);

    // Filter out intentional user cancellations or AbortError
    if (msg?.includes('AbortError') || msg?.includes('cancelled')) {
      return;
    }

    logCrash(reason instanceof Error ? reason : new Error(msg), {
      type: 'PROMISE_REJECTION',
      severity: 'ERROR',
      extraMessage: 'Unhandled Promise Rejection',
    });
  };

  window.addEventListener('error', handleGlobalError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);

  // Initial breadcrumb
  addBreadcrumb('SYSTEM', 'Application session started');

  return () => {
    window.removeEventListener('error', handleGlobalError);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  };
};
