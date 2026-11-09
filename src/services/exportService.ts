import { Student, PaymentRecord } from '../types/student';
import { getDaysDifference, formatDueDateDisplay } from './storageService';

export interface DailyBackupRecord {
  id: string;
  fileName: string;
  devicePath: string;
  createdAt: string;
  dateKey: string; // YYYY-MM-DD
  reason: 'SCHEDULED_DAILY' | 'MANUAL_WORKER_RUN';
  studentCount: number;
  paymentRecordCount: number;
  sizeBytes: number;
  jsonPayload: string;
}

export interface WorkManagerBackupConfig {
  autoDailyBackupEnabled: boolean;
  intervalHours: number;
  requireDeviceIdle: boolean;
  lastScheduledDateKey: string | null;
  twiceDailyRemindersEnabled: boolean;
}

const BACKUP_HISTORY_STORAGE_KEY = 'lakshay_library_daily_json_backups_v1';
const BACKUP_CONFIG_STORAGE_KEY = 'lakshay_library_workmanager_backup_config_v1';

export const getWorkManagerBackupConfig = (): WorkManagerBackupConfig => {
  try {
    const raw = localStorage.getItem(BACKUP_CONFIG_STORAGE_KEY);
    if (!raw) {
      return {
        autoDailyBackupEnabled: true,
        intervalHours: 12,
        requireDeviceIdle: false,
        lastScheduledDateKey: null,
        twiceDailyRemindersEnabled: true,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      twiceDailyRemindersEnabled: parsed.twiceDailyRemindersEnabled ?? true,
    };
  } catch {
    return {
      autoDailyBackupEnabled: true,
      intervalHours: 12,
      requireDeviceIdle: false,
      lastScheduledDateKey: null,
      twiceDailyRemindersEnabled: true,
    };
  }
};

export const saveWorkManagerBackupConfig = (config: WorkManagerBackupConfig): void => {
  try {
    localStorage.setItem(BACKUP_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors
  }
};

export const getStoredDailyBackups = (): DailyBackupRecord[] => {
  try {
    const raw = localStorage.getItem(BACKUP_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Serializes the current Firestore `students` collection and `PaymentHistory` sub-collections
 * into a formatted JSON string ready for local device storage.
 */
export const buildFirestoreJsonSnapshot = (
  students: Student[],
  allPayments: Record<string, PaymentRecord[]> = {}
): { jsonString: string; paymentCount: number } => {
  let paymentCount = 0;

  const enrichedStudents = students.map((student) => {
    const paymentHistory = allPayments[student.id] || [];
    paymentCount += paymentHistory.length;
    const diffDays = getDaysDifference(student.nextFeeDueDate);

    return {
      ...student,
      computedFeeStatus:
        diffDays < 0 ? 'OVERDUE' : diffDays <= 3 ? 'DUE_SOON' : 'UPCOMING_PAID',
      daysUntilOrPastDue: diffDays,
      PaymentHistory: paymentHistory,
    };
  });

  const payload = {
    schemaVersion: '1.0',
    application: 'Lakshay Library Management App (LibTrack)',
    workerClass: 'com.example.librarymanagement.worker.DailyDatabaseBackupWorker',
    exportedAt: new Date().toISOString(),
    summary: {
      totalStudents: students.length,
      totalPaymentRecords: paymentCount,
      totalMonthlyRevenueINR: students.reduce((acc, s) => acc + s.monthlyFee, 0),
    },
    firestoreCollections: {
      students: enrichedStudents,
    },
  };

  return {
    jsonString: JSON.stringify(payload, null, 2),
    paymentCount,
  };
};

/**
 * Triggers a browser download of a JSON backup file to the user's local device storage.
 */
export const downloadJsonFileToDevice = (jsonString: string, fileName: string): void => {
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Executes the WorkManager DailyDatabaseBackupWorker task:
 * 1. Serializes the Firestore student database + PaymentHistory sub-collections to JSON.
 * 2. Persists the snapshot into local device storage (`localStorage` backup vault).
 * 3. Optionally downloads the `.json` file directly to the user's device filesystem.
 */
export const runDailyJsonBackupTask = (
  students: Student[],
  allPayments: Record<string, PaymentRecord[]> = {},
  options: {
    triggerDownload?: boolean;
    reason?: 'SCHEDULED_DAILY' | 'MANUAL_WORKER_RUN';
  } = {}
): DailyBackupRecord => {
  const now = new Date();
  const dateKey = now.toISOString().split('T')[0];
  const timeSuffix = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  const fileName =
    options.reason === 'MANUAL_WORKER_RUN'
      ? `Lakshay_Library_Firestore_Backup_${dateKey}_${timeSuffix}.json`
      : `Lakshay_Library_Firestore_Backup_${dateKey}.json`;

  const devicePath = `/storage/emulated/0/Android/data/com.example.librarymanagement/files/backups/${fileName}`;

  const { jsonString, paymentCount } = buildFirestoreJsonSnapshot(students, allPayments);
  const sizeBytes = new Blob([jsonString]).size;

  const newRecord: DailyBackupRecord = {
    id: `backup-${now.getTime()}`,
    fileName,
    devicePath,
    createdAt: now.toISOString(),
    dateKey,
    reason: options.reason || 'MANUAL_WORKER_RUN',
    studentCount: students.length,
    paymentRecordCount: paymentCount,
    sizeBytes,
    jsonPayload: jsonString,
  };

  const existing = getStoredDailyBackups().filter(
    (b) => !(options.reason === 'SCHEDULED_DAILY' && b.dateKey === dateKey)
  );
  const updated = [newRecord, ...existing].slice(0, 7);

  try {
    localStorage.setItem(BACKUP_HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // If quota is tight, store only the latest 2 snapshots
    try {
      localStorage.setItem(
        BACKUP_HISTORY_STORAGE_KEY,
        JSON.stringify(updated.slice(0, 2))
      );
    } catch {
      // Ignore
    }
  }

  const currentConfig = getWorkManagerBackupConfig();
  saveWorkManagerBackupConfig({
    ...currentConfig,
    lastScheduledDateKey: dateKey,
  });

  if (options.triggerDownload) {
    downloadJsonFileToDevice(jsonString, fileName);
  }

  return newRecord;
};

/**
 * Checks whether today's recurring 24-hour WorkManager JSON backup has run yet.
 * If enabled and due, executes the backup automatically to local device storage.
 */
export const checkAndRunDueDailyBackup = (
  students: Student[],
  allPayments: Record<string, PaymentRecord[]> = {}
): DailyBackupRecord | null => {
  if (!students || students.length === 0) return null;
  const config = getWorkManagerBackupConfig();
  if (!config.autoDailyBackupEnabled) return null;

  const todayKey = new Date().toISOString().split('T')[0];
  const existingBackups = getStoredDailyBackups();
  const hasBackupForToday = existingBackups.some((b) => b.dateKey === todayKey);

  if (!hasBackupForToday || config.lastScheduledDateKey !== todayKey) {
    return runDailyJsonBackupTask(students, allPayments, {
      triggerDownload: false,
      reason: 'SCHEDULED_DAILY',
    });
  }

  return null;
};

export const exportStudentsToCSV = (
  students: Student[],
  filterName: string = 'All_Students'
) => {
  if (!students || students.length === 0) {
    return;
  }

  const headers = [
    'Student ID',
    'Full Name',
    'Phone Number',
    'Seat Number',
    'Shift Timings',
    'Monthly Fee (INR)',
    'Next Fee Due Date',
    'Fee Status',
    'Days Due/Overdue',
    'Admission Date',
    'Last Check-in',
    'Notes / Remarks',
  ];

  const escapeCSV = (str: string | number | undefined | null) => {
    if (str === undefined || str === null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = students.map((s) => {
    const diff = getDaysDifference(s.nextFeeDueDate);
    let status = 'Upcoming (Paid)';
    let daysText = `Due in ${diff} days`;

    if (diff < 0) {
      status = 'OVERDUE';
      daysText = `${Math.abs(diff)} days overdue`;
    } else if (diff <= 3) {
      status = 'DUE SOON';
      daysText = diff === 0 ? 'Due Today' : `Due in ${diff} days`;
    }

    const lastCheckInFormatted = s.lastCheckIn
      ? new Date(s.lastCheckIn).toLocaleString('en-IN')
      : 'No check-in yet';

    return [
      escapeCSV(s.id),
      escapeCSV(s.name),
      escapeCSV(s.phoneNumber),
      escapeCSV(s.seatNumber),
      escapeCSV(s.shiftTimings),
      escapeCSV(s.monthlyFee),
      escapeCSV(formatDueDateDisplay(s.nextFeeDueDate)),
      escapeCSV(status),
      escapeCSV(daysText),
      escapeCSV(s.admissionDate || 'N/A'),
      escapeCSV(lastCheckInFormatted),
      escapeCSV(s.notes || ''),
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');

  // Use UTF-8 BOM so Excel opens Hindi/special characters correctly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  const nowStr = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `Lakshay_Library_${filterName}_${nowStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
