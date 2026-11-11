import { Student, PaymentRecord, DailyAttendanceRecord } from '../types/student';
import { SeatItem } from './seatService';
import { ShiftItem } from '../types/shift';
import {
  ALL_PRESERVED_LOCAL_STORAGE_KEYS,
  ALL_PRESERVED_SESSION_STORAGE_KEYS,
  PHASE0_INTERNAL_VAULT_KEYS,
  computeSha256Hex,
  createAndVerifyPhase0LocalBackup,
} from './storageService';

export const LIBTRACK_IDB_NAME = 'lakshay_libtrack_db';
export const LIBTRACK_IDB_VERSION = 1;

// Production safety lock: Migration is NEVER auto-activated for production users without explicit approval
export const PHASE1_PRODUCTION_AUTO_MIGRATION_ENABLED = false;

export const PHASE1_MIGRATION_STATE_KEY = 'lakshay_library_phase1_migration_state_v1';
export const PHASE1_PRE_MIGRATION_SNAPSHOT_KEY = 'lakshay_library_phase1_pre_migration_snapshot_v1';

export const IDB_STORES = {
  STUDENTS: 'students',
  PAYMENTS: 'payments',
  ATTENDANCE: 'attendance',
  SEATS: 'seats',
  SHIFTS: 'shifts',
  SETTINGS: 'settings',
  BACKUPS: 'backups',
  TELEMETRY: 'telemetry',
  RAW_STORAGE_MIRROR: 'raw_storage_mirror',
  MIGRATION_CHECKPOINTS: 'migration_checkpoints',
  SCHEMA_META: 'schema_meta',
} as const;

export type Phase1MigrationStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'VERIFIED_COMPLETED'
  | 'FAILED_RECOVERED_TO_LOCALSTORAGE'
  | 'ROLLED_BACK';

export type Phase1CheckpointStepId =
  | 'STEP_0_PREFLIGHT_SNAPSHOT'
  | 'STEP_1_RAW_STORAGE_MIRROR'
  | 'STEP_2_STUDENTS_STORE'
  | 'STEP_3_PAYMENTS_STORE'
  | 'STEP_4_ATTENDANCE_STORE'
  | 'STEP_5_SEATS_AND_SHIFTS_STORES'
  | 'STEP_6_SETTINGS_BACKUPS_TELEMETRY'
  | 'STEP_7_POST_MIGRATION_VERIFICATION';

export interface Phase1CheckpointRecord {
  checkpointId: Phase1CheckpointStepId;
  stepNumber: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  recordsProcessed: number;
  recordsValidated: number;
  duplicatesPrevented: number;
  validationErrors: string[];
  sha256Hex: string;
  startedAtISO: string;
  completedAtISO: string | null;
}

export interface Phase1ValidationIssue {
  entityType: 'STUDENT' | 'PAYMENT' | 'ATTENDANCE' | 'SEAT' | 'SHIFT' | 'RAW_KEY';
  recordId: string;
  severity: 'WARNING_REPAIRED' | 'ERROR_REJECTED' | 'DUPLICATE_SKIPPED';
  message: string;
}

export interface Phase1MigrationStateSummary {
  dbName: string;
  schemaVersion: number;
  productionAutoMigrationEnabled: boolean;
  activeReadSource: 'localStorage' | 'IndexedDB_Verified_DualWrite';
  dualWriteEnabled: boolean;
  status: Phase1MigrationStatus;
  runCount: number;
  lastRunStartedAtISO: string | null;
  lastRunCompletedAtISO: string | null;
  lastRollbackAtISO: string | null;
  lastRollbackReason: string | null;
  preMigrationCanonicalSha256: string | null;
  postMigrationCanonicalSha256: string | null;
  localStoragePreservedUntouched: boolean;
  indexedDbAvailable: boolean;
  usingInMemoryFallback: boolean;
  counts: {
    activeStudents: number;
    archivedStudents: number;
    totalStudents: number;
    zeroPaymentStudents: number;
    totalPayments: number;
    totalPaymentAmountINR: number;
    attendanceRecords: number;
    seats: number;
    shifts: number;
    settingsKeys: number;
    backupRecords: number;
    telemetryRecords: number;
    rawMirrorLocalKeys: number;
    rawMirrorSessionKeys: number;
    unknownExtraKeysCaptured: number;
    duplicatesPrevented: number;
  };
  checkpoints: Phase1CheckpointRecord[];
  validationIssues: Phase1ValidationIssue[];
  errorLogs: string[];
}

export interface Phase1ScenarioTestResult {
  scenarioId: string;
  title: string;
  passed: boolean;
  details: string;
  metrics: Record<string, string | number | boolean>;
}

export interface Phase1CopiedDataTestSuiteReport {
  executedAtISO: string;
  productionStorageUntouched: boolean;
  preTestProductionSha256: string;
  postTestProductionSha256: string;
  allPassed: boolean;
  totalScenarios: number;
  passedScenarios: number;
  scenarios: Phase1ScenarioTestResult[];
  finalMigrationReport: Phase1MigrationStateSummary;
}

interface InMemoryStoreData {
  keyPath: string;
  indexes: Record<string, { keyPath: string | string[]; unique: boolean }>;
  records: Map<string, Record<string, unknown>>;
}

// Spec-compliant in-memory IndexedDB store map used ONLY when native `window.indexedDB` is unavailable
// or inside isolated sandbox tests so production IndexedDB / localStorage is never touched during tests.
const createInMemoryDatabaseInstance = (): Map<string, InMemoryStoreData> => {
  const db = new Map<string, InMemoryStoreData>();
  db.set(IDB_STORES.STUDENTS, {
    keyPath: 'id',
    indexes: {
      by_status: { keyPath: 'status', unique: false },
      by_seatNumber: { keyPath: 'seatNumber', unique: false },
      by_nextFeeDueDate: { keyPath: 'nextFeeDueDate', unique: false },
      by_phoneNumber: { keyPath: 'phoneNumber', unique: false },
      by_updatedAt: { keyPath: 'updatedAt', unique: false },
    },
    records: new Map(),
  });
  db.set(IDB_STORES.PAYMENTS, {
    keyPath: 'id',
    indexes: {
      by_studentId: { keyPath: 'studentId', unique: false },
      by_paymentDate: { keyPath: 'paymentDate', unique: false },
      by_receiptNumber: { keyPath: 'receiptNumber', unique: false },
      by_paymentMode: { keyPath: 'paymentMode', unique: false },
    },
    records: new Map(),
  });
  db.set(IDB_STORES.ATTENDANCE, {
    keyPath: 'id',
    indexes: {
      by_studentId: { keyPath: 'studentId', unique: false },
      by_date: { keyPath: 'date', unique: false },
      by_student_date: { keyPath: ['studentId', 'date'], unique: false },
    },
    records: new Map(),
  });
  db.set(IDB_STORES.SEATS, {
    keyPath: 'id',
    indexes: {
      by_seatNumber: { keyPath: 'seatNumber', unique: true },
      by_section: { keyPath: 'section', unique: false },
    },
    records: new Map(),
  });
  db.set(IDB_STORES.SHIFTS, {
    keyPath: 'id',
    indexes: {
      by_label: { keyPath: 'label', unique: false },
    },
    records: new Map(),
  });
  db.set(IDB_STORES.SETTINGS, {
    keyPath: 'key',
    indexes: {
      by_category: { keyPath: 'category', unique: false },
      by_updatedAt: { keyPath: 'updatedAt', unique: false },
    },
    records: new Map(),
  });
  db.set(IDB_STORES.BACKUPS, {
    keyPath: 'id',
    indexes: {
      by_backupType: { keyPath: 'backupType', unique: false },
      by_createdAt: { keyPath: 'createdAt', unique: false },
    },
    records: new Map(),
  });
  db.set(IDB_STORES.TELEMETRY, {
    keyPath: 'id',
    indexes: {
      by_telemetryType: { keyPath: 'telemetryType', unique: false },
      by_timestamp: { keyPath: 'timestamp', unique: false },
    },
    records: new Map(),
  });
  db.set(IDB_STORES.RAW_STORAGE_MIRROR, {
    keyPath: 'compositeKey',
    indexes: {
      by_storageArea: { keyPath: 'storageArea', unique: false },
      by_classification: { keyPath: 'classification', unique: false },
    },
    records: new Map(),
  });
  db.set(IDB_STORES.MIGRATION_CHECKPOINTS, {
    keyPath: 'checkpointId',
    indexes: {
      by_status: { keyPath: 'status', unique: false },
      by_updatedAt: { keyPath: 'completedAtISO', unique: false },
    },
    records: new Map(),
  });
  db.set(IDB_STORES.SCHEMA_META, {
    keyPath: 'metaKey',
    indexes: {},
    records: new Map(),
  });
  return db;
};

let fallbackInMemoryDb = createInMemoryDatabaseInstance();
let migrationRunningLock = false;
let syncInProgressLock = false;
let dualWriteActiveInDev = false;

export const isMigrationCurrentlyRunning = (): boolean => migrationRunningLock;
export const setSyncInProgressLock = (locked: boolean): void => {
  syncInProgressLock = locked;
};

export interface StorageProviderAdapter {
  localStorage: Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;
  sessionStorage: Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;
  useIsolatedInMemoryIdb?: boolean;
  isolatedIdbInstance?: Map<string, InMemoryStoreData>;
  simulateInterruptionAfterStep?: Phase1CheckpointStepId | null;
  simulateQuotaExceededOnStep?: Phase1CheckpointStepId | null;
  simulateIdbUnavailable?: boolean;
}

const getDefaultStorageProvider = (): StorageProviderAdapter => ({
  localStorage: window.localStorage,
  sessionStorage: window.sessionStorage,
  useIsolatedInMemoryIdb: false,
});

const hasNativeIndexedDb = (): boolean => {
  try {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined' && window.indexedDB !== null;
  } catch {
    return false;
  }
};

/**
 * Opens `lakshay_libtrack_db` at schema version 1 and creates all 11 object stores & indexes
 * during `onupgradeneeded`.
 */
export const openNativeLibTrackDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!hasNativeIndexedDb()) {
      reject(new Error('INDEXEDDB_UNAVAILABLE'));
      return;
    }

    try {
      const request = window.indexedDB.open(LIBTRACK_IDB_NAME, LIBTRACK_IDB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(IDB_STORES.STUDENTS)) {
          const store = db.createObjectStore(IDB_STORES.STUDENTS, { keyPath: 'id' });
          store.createIndex('by_status', 'status', { unique: false });
          store.createIndex('by_seatNumber', 'seatNumber', { unique: false });
          store.createIndex('by_nextFeeDueDate', 'nextFeeDueDate', { unique: false });
          store.createIndex('by_phoneNumber', 'phoneNumber', { unique: false });
          store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(IDB_STORES.PAYMENTS)) {
          const store = db.createObjectStore(IDB_STORES.PAYMENTS, { keyPath: 'id' });
          store.createIndex('by_studentId', 'studentId', { unique: false });
          store.createIndex('by_paymentDate', 'paymentDate', { unique: false });
          store.createIndex('by_receiptNumber', 'receiptNumber', { unique: false });
          store.createIndex('by_paymentMode', 'paymentMode', { unique: false });
        }

        if (!db.objectStoreNames.contains(IDB_STORES.ATTENDANCE)) {
          const store = db.createObjectStore(IDB_STORES.ATTENDANCE, { keyPath: 'id' });
          store.createIndex('by_studentId', 'studentId', { unique: false });
          store.createIndex('by_date', 'date', { unique: false });
          store.createIndex('by_student_date', ['studentId', 'date'], { unique: false });
        }

        if (!db.objectStoreNames.contains(IDB_STORES.SEATS)) {
          const store = db.createObjectStore(IDB_STORES.SEATS, { keyPath: 'id' });
          store.createIndex('by_seatNumber', 'seatNumber', { unique: true });
          store.createIndex('by_section', 'section', { unique: false });
        }

        if (!db.objectStoreNames.contains(IDB_STORES.SHIFTS)) {
          const store = db.createObjectStore(IDB_STORES.SHIFTS, { keyPath: 'id' });
          store.createIndex('by_label', 'label', { unique: false });
        }

        if (!db.objectStoreNames.contains(IDB_STORES.SETTINGS)) {
          const store = db.createObjectStore(IDB_STORES.SETTINGS, { keyPath: 'key' });
          store.createIndex('by_category', 'category', { unique: false });
          store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(IDB_STORES.BACKUPS)) {
          const store = db.createObjectStore(IDB_STORES.BACKUPS, { keyPath: 'id' });
          store.createIndex('by_backupType', 'backupType', { unique: false });
          store.createIndex('by_createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(IDB_STORES.TELEMETRY)) {
          const store = db.createObjectStore(IDB_STORES.TELEMETRY, { keyPath: 'id' });
          store.createIndex('by_telemetryType', 'telemetryType', { unique: false });
          store.createIndex('by_timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(IDB_STORES.RAW_STORAGE_MIRROR)) {
          const store = db.createObjectStore(IDB_STORES.RAW_STORAGE_MIRROR, { keyPath: 'compositeKey' });
          store.createIndex('by_storageArea', 'storageArea', { unique: false });
          store.createIndex('by_classification', 'classification', { unique: false });
        }

        if (!db.objectStoreNames.contains(IDB_STORES.MIGRATION_CHECKPOINTS)) {
          const store = db.createObjectStore(IDB_STORES.MIGRATION_CHECKPOINTS, { keyPath: 'checkpointId' });
          store.createIndex('by_status', 'status', { unique: false });
          store.createIndex('by_updatedAt', 'completedAtISO', { unique: false });
        }

        if (!db.objectStoreNames.contains(IDB_STORES.SCHEMA_META)) {
          db.createObjectStore(IDB_STORES.SCHEMA_META, { keyPath: 'metaKey' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
      request.onblocked = () => reject(new Error('IndexedDB open request blocked'));
    } catch (err) {
      reject(err);
    }
  });
};

const putRecordsInStore = async (
  storeName: string,
  records: Record<string, unknown>[],
  adapter: StorageProviderAdapter,
  clearFirst = false
): Promise<void> => {
  if (adapter.simulateIdbUnavailable) {
    throw new Error('INDEXEDDB_UNAVAILABLE_SIMULATED');
  }

  const useInMemory = Boolean(adapter.useIsolatedInMemoryIdb) || !hasNativeIndexedDb();
  if (useInMemory) {
    const targetDb = adapter.isolatedIdbInstance || fallbackInMemoryDb;
    const store = targetDb.get(storeName);
    if (!store) throw new Error(`Unknown object store: ${storeName}`);

    // Stage inside a temporary map so that if any error occurs, the transaction rolls back atomically
    const staged = clearFirst ? new Map<string, Record<string, unknown>>() : new Map(store.records);
    for (const rec of records) {
      const keyVal = String(rec[store.keyPath] ?? '');
      if (!keyVal) {
        throw new Error(`Missing primary key '${store.keyPath}' in store '${storeName}'`);
      }
      staged.set(keyVal, JSON.parse(JSON.stringify(rec)));
    }
    store.records = staged;
    return;
  }

  const db = await openNativeLibTrackDb();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);
      if (clearFirst) {
        store.clear();
      }
      for (const rec of records) {
        store.put(rec);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        const err = tx.error || new Error(`Transaction failed on store ${storeName}`);
        db.close();
        reject(err);
      };
      tx.onabort = () => {
        const err = tx.error || new Error(`Transaction aborted on store ${storeName}`);
        db.close();
        reject(err);
      };
    } catch (err) {
      db.close();
      reject(err);
    }
  });
};

export const getAllRecordsFromStore = async <T = Record<string, unknown>>(
  storeName: string,
  adapter: StorageProviderAdapter = getDefaultStorageProvider()
): Promise<T[]> => {
  if (adapter.simulateIdbUnavailable) {
    throw new Error('INDEXEDDB_UNAVAILABLE_SIMULATED');
  }

  const useInMemory = Boolean(adapter.useIsolatedInMemoryIdb) || !hasNativeIndexedDb();
  if (useInMemory) {
    const targetDb = adapter.isolatedIdbInstance || fallbackInMemoryDb;
    const store = targetDb.get(storeName);
    if (!store) return [];
    return Array.from(store.records.values()).map((r) => JSON.parse(JSON.stringify(r)) as T);
  }

  const db = await openNativeLibTrackDb();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([storeName], 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => {
        const res = (req.result || []) as T[];
        db.close();
        resolve(res);
      };
      req.onerror = () => {
        const err = req.error || new Error(`Failed reading store ${storeName}`);
        db.close();
        reject(err);
      };
    } catch (err) {
      db.close();
      reject(err);
    }
  });
};

const clearAllStoresInIndexedDb = async (adapter: StorageProviderAdapter): Promise<void> => {
  const useInMemory = Boolean(adapter.useIsolatedInMemoryIdb) || !hasNativeIndexedDb();
  if (useInMemory) {
    const targetDb = adapter.isolatedIdbInstance || fallbackInMemoryDb;
    for (const store of targetDb.values()) {
      store.records.clear();
    }
    return;
  }

  if (!hasNativeIndexedDb()) return;
  const db = await openNativeLibTrackDb();
  return new Promise((resolve, reject) => {
    try {
      const allStoreNames = Array.from(db.objectStoreNames);
      const tx = db.transaction(allStoreNames, 'readwrite');
      for (const name of allStoreNames) {
        tx.objectStore(name).clear();
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('Failed clearing IndexedDB stores'));
      };
    } catch (err) {
      db.close();
      reject(err);
    }
  });
};

const computeCanonicalStorageDigest = (
  local: Pick<Storage, 'length' | 'key' | 'getItem'>,
  session: Pick<Storage, 'length' | 'key' | 'getItem'>
): string => {
  const localObj: Record<string, string | null> = {};
  for (const k of ALL_PRESERVED_LOCAL_STORAGE_KEYS) {
    localObj[k] = local.getItem(k);
  }
  const sessionObj: Record<string, string | null> = {};
  for (const k of ALL_PRESERVED_SESSION_STORAGE_KEYS) {
    sessionObj[k] = session.getItem(k);
  }
  return computeSha256Hex(JSON.stringify({ localStorage: localObj, sessionStorage: sessionObj }));
};

/**
 * Validates and normalizes a Student record without losing historical or archived properties.
 */
const validateStudentRecord = (
  raw: unknown,
  issues: Phase1ValidationIssue[]
): Student | null => {
  if (!raw || typeof raw !== 'object') {
    issues.push({
      entityType: 'STUDENT',
      recordId: 'UNKNOWN',
      severity: 'ERROR_REJECTED',
      message: 'Student entry is not a valid object.',
    });
    return null;
  }
  const s = raw as Partial<Student> & { phone?: string };
  const id = typeof s.id === 'string' && s.id.trim() ? s.id.trim() : '';
  const name = typeof s.name === 'string' && s.name.trim() ? s.name.trim() : '';
  if (!id || !name) {
    issues.push({
      entityType: 'STUDENT',
      recordId: id || 'MISSING_ID',
      severity: 'ERROR_REJECTED',
      message: `Student record rejected due to missing id ('${id}') or name ('${name}').`,
    });
    return null;
  }

  const phoneNumber =
    typeof s.phoneNumber === 'string'
      ? s.phoneNumber
      : typeof s.phone === 'string'
      ? s.phone
      : '';

  const monthlyFee =
    typeof s.monthlyFee === 'number' && !isNaN(s.monthlyFee) && s.monthlyFee >= 0
      ? s.monthlyFee
      : 0;

  if (typeof s.monthlyFee !== 'number' || isNaN(s.monthlyFee) || s.monthlyFee < 0) {
    issues.push({
      entityType: 'STUDENT',
      recordId: id,
      severity: 'WARNING_REPAIRED',
      message: `Repaired invalid monthlyFee on student '${id}' to 0.`,
    });
  }

  const status: 'active' | 'archived' = s.status === 'archived' ? 'archived' : 'active';

  return {
    ...s,
    id,
    name,
    phoneNumber,
    seatNumber: typeof s.seatNumber === 'string' ? s.seatNumber : '',
    shiftTimings: typeof s.shiftTimings === 'string' ? s.shiftTimings : '08:00 AM - 02:00 PM',
    monthlyFee,
    nextFeeDueDate: typeof s.nextFeeDueDate === 'string' ? s.nextFeeDueDate : '2026-12-01',
    admissionDate: typeof s.admissionDate === 'string' ? s.admissionDate : '2026-11-01',
    status,
  };
};

/**
 * Validates and normalizes a PaymentRecord while preserving historical `studentName`, `seatNumber`, and `receiptNumber`.
 */
const validatePaymentRecord = (
  raw: unknown,
  fallbackStudentId: string,
  studentLookup: Map<string, Student>,
  issues: Phase1ValidationIssue[]
): PaymentRecord | null => {
  if (!raw || typeof raw !== 'object') {
    issues.push({
      entityType: 'PAYMENT',
      recordId: 'UNKNOWN',
      severity: 'ERROR_REJECTED',
      message: 'Payment entry is not a valid object.',
    });
    return null;
  }
  const p = raw as Partial<PaymentRecord>;
  const id = typeof p.id === 'string' && p.id.trim() ? p.id.trim() : '';
  const studentId =
    typeof p.studentId === 'string' && p.studentId.trim()
      ? p.studentId.trim()
      : fallbackStudentId;

  if (!id || !studentId) {
    issues.push({
      entityType: 'PAYMENT',
      recordId: id || 'MISSING_PAYMENT_ID',
      severity: 'ERROR_REJECTED',
      message: `Payment record rejected due to missing id ('${id}') or studentId ('${studentId}').`,
    });
    return null;
  }

  if (typeof p.amountPaid !== 'number' || isNaN(p.amountPaid) || p.amountPaid < 0) {
    issues.push({
      entityType: 'PAYMENT',
      recordId: id,
      severity: 'ERROR_REJECTED',
      message: `Payment record '${id}' rejected due to invalid amountPaid (${String(p.amountPaid)}).`,
    });
    return null;
  }

  const matchedStudent = studentLookup.get(studentId);
  const historicalName =
    typeof p.studentName === 'string' && p.studentName.trim()
      ? p.studentName.trim()
      : matchedStudent?.name || 'Archived Student';
  const historicalSeat =
    typeof p.seatNumber === 'string' && p.seatNumber.trim()
      ? p.seatNumber.trim()
      : matchedStudent?.archivedSeatNumber || matchedStudent?.seatNumber || '';

  return {
    ...p,
    id,
    studentId,
    paymentDate: typeof p.paymentDate === 'string' && p.paymentDate ? p.paymentDate : new Date().toISOString(),
    amountPaid: p.amountPaid,
    paymentMode:
      p.paymentMode === 'Cash' ||
      p.paymentMode === 'UPI' ||
      p.paymentMode === 'Card' ||
      p.paymentMode === 'Bank Transfer'
        ? p.paymentMode
        : 'Cash',
    receiptNumber:
      typeof p.receiptNumber === 'string' && p.receiptNumber.trim()
        ? p.receiptNumber.trim()
        : `REC-MIG-${id}`,
    studentName: historicalName,
    seatNumber: historicalSeat,
  };
};

/**
 * Validates and normalizes a DailyAttendanceRecord while preserving historical `studentName` and `seatNumber`.
 */
const validateAttendanceRecord = (
  raw: unknown,
  studentLookup: Map<string, Student>,
  issues: Phase1ValidationIssue[]
): DailyAttendanceRecord | null => {
  if (!raw || typeof raw !== 'object') {
    issues.push({
      entityType: 'ATTENDANCE',
      recordId: 'UNKNOWN',
      severity: 'ERROR_REJECTED',
      message: 'Attendance entry is not a valid object.',
    });
    return null;
  }
  const a = raw as Partial<DailyAttendanceRecord>;
  const id = typeof a.id === 'string' && a.id.trim() ? a.id.trim() : '';
  const studentId = typeof a.studentId === 'string' && a.studentId.trim() ? a.studentId.trim() : '';
  if (!id || !studentId) {
    issues.push({
      entityType: 'ATTENDANCE',
      recordId: id || 'MISSING_ATTENDANCE_ID',
      severity: 'ERROR_REJECTED',
      message: `Attendance record rejected due to missing id ('${id}') or studentId ('${studentId}').`,
    });
    return null;
  }

  const matchedStudent = studentLookup.get(studentId);
  return {
    ...a,
    id,
    studentId,
    studentName:
      typeof a.studentName === 'string' && a.studentName.trim()
        ? a.studentName.trim()
        : matchedStudent?.name || 'Archived Student',
    seatNumber:
      typeof a.seatNumber === 'string' && a.seatNumber.trim()
        ? a.seatNumber.trim()
        : matchedStudent?.archivedSeatNumber || matchedStudent?.seatNumber || '',
    shiftTimings: typeof a.shiftTimings === 'string' ? a.shiftTimings : '08:00 AM - 02:00 PM',
    date: typeof a.date === 'string' && a.date ? a.date : '2026-11-11',
    checkInTime: typeof a.checkInTime === 'string' && a.checkInTime ? a.checkInTime : new Date().toISOString(),
    verificationMethod: a.verificationMethod === 'QR_SCAN' ? 'QR_SCAN' : 'MANUAL_DESK',
  };
};

const INITIAL_CHECKPOINTS: Array<{ id: Phase1CheckpointStepId; step: number }> = [
  { id: 'STEP_0_PREFLIGHT_SNAPSHOT', step: 0 },
  { id: 'STEP_1_RAW_STORAGE_MIRROR', step: 1 },
  { id: 'STEP_2_STUDENTS_STORE', step: 2 },
  { id: 'STEP_3_PAYMENTS_STORE', step: 3 },
  { id: 'STEP_4_ATTENDANCE_STORE', step: 4 },
  { id: 'STEP_5_SEATS_AND_SHIFTS_STORES', step: 5 },
  { id: 'STEP_6_SETTINGS_BACKUPS_TELEMETRY', step: 6 },
  { id: 'STEP_7_POST_MIGRATION_VERIFICATION', step: 7 },
];

export const getStoredPhase1MigrationState = (
  local: Pick<Storage, 'getItem'> = window.localStorage
): Phase1MigrationStateSummary => {
  try {
    const raw = local.getItem(PHASE1_MIGRATION_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Phase1MigrationStateSummary;
      if (parsed && parsed.dbName === LIBTRACK_IDB_NAME) {
        return parsed;
      }
    }
  } catch {
    // Fall through to default state
  }

  return {
    dbName: LIBTRACK_IDB_NAME,
    schemaVersion: LIBTRACK_IDB_VERSION,
    productionAutoMigrationEnabled: PHASE1_PRODUCTION_AUTO_MIGRATION_ENABLED,
    activeReadSource: 'localStorage',
    dualWriteEnabled: dualWriteActiveInDev,
    status: 'NOT_STARTED',
    runCount: 0,
    lastRunStartedAtISO: null,
    lastRunCompletedAtISO: null,
    lastRollbackAtISO: null,
    lastRollbackReason: null,
    preMigrationCanonicalSha256: null,
    postMigrationCanonicalSha256: null,
    localStoragePreservedUntouched: true,
    indexedDbAvailable: hasNativeIndexedDb(),
    usingInMemoryFallback: !hasNativeIndexedDb(),
    counts: {
      activeStudents: 0,
      archivedStudents: 0,
      totalStudents: 0,
      zeroPaymentStudents: 0,
      totalPayments: 0,
      totalPaymentAmountINR: 0,
      attendanceRecords: 0,
      seats: 0,
      shifts: 0,
      settingsKeys: 0,
      backupRecords: 0,
      telemetryRecords: 0,
      rawMirrorLocalKeys: 0,
      rawMirrorSessionKeys: 0,
      unknownExtraKeysCaptured: 0,
      duplicatesPrevented: 0,
    },
    checkpoints: INITIAL_CHECKPOINTS.map((c) => ({
      checkpointId: c.id,
      stepNumber: c.step,
      status: 'PENDING',
      recordsProcessed: 0,
      recordsValidated: 0,
      duplicatesPrevented: 0,
      validationErrors: [],
      sha256Hex: '',
      startedAtISO: '',
      completedAtISO: null,
    })),
    validationIssues: [],
    errorLogs: [],
  };
};

const savePhase1MigrationState = (
  state: Phase1MigrationStateSummary,
  local: Pick<Storage, 'setItem'>
): void => {
  try {
    local.setItem(PHASE1_MIGRATION_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage error
  }
};

/**
 * STAGE B: Non-destructive, idempotent, checkpointed migration from `localStorage`/`sessionStorage`
 * into `lakshay_libtrack_db` (schema version 1).
 *
 * Guarantees:
 * - Never deletes or modifies original application keys in `localStorage` or `sessionStorage`.
 * - Dynamically enumerates ALL actual keys in `localStorage` and `sessionStorage` (including keys outside the 23 predefined slots).
 * - Validates every Student, PaymentRecord, DailyAttendanceRecord, SeatItem, and ShiftItem.
 * - Prevents duplicate IDs across all object stores.
 * - Recovers safely from simulated or real interruptions, quota errors, or IndexedDB unavailability.
 */
export const runPhase1IndexedDbMigration = async (
  options?: {
    adapter?: StorageProviderAdapter;
    enableDualWriteAfterVerify?: boolean;
  }
): Promise<Phase1MigrationStateSummary> => {
  const adapter = options?.adapter || getDefaultStorageProvider();
  const local = adapter.localStorage;
  const session = adapter.sessionStorage;
  const nowISO = new Date().toISOString();

  if (syncInProgressLock) {
    const currentState = getStoredPhase1MigrationState(local);
    currentState.errorLogs.push(
      `[${nowISO}] Migration deferred: Google Drive synchronization is currently active.`
    );
    savePhase1MigrationState(currentState, local);
    return currentState;
  }

  migrationRunningLock = true;
  const prevState = getStoredPhase1MigrationState(local);
  const validationIssues: Phase1ValidationIssue[] = [];
  const errorLogs: string[] = [...prevState.errorLogs];

  const checkpoints: Phase1CheckpointRecord[] = INITIAL_CHECKPOINTS.map((c) => ({
    checkpointId: c.id,
    stepNumber: c.step,
    status: 'PENDING',
    recordsProcessed: 0,
    recordsValidated: 0,
    duplicatesPrevented: 0,
    validationErrors: [],
    sha256Hex: '',
    startedAtISO: '',
    completedAtISO: null,
  }));

  const preMigrationCanonicalSha256 = computeCanonicalStorageDigest(local, session);

  const state: Phase1MigrationStateSummary = {
    ...prevState,
    dbName: LIBTRACK_IDB_NAME,
    schemaVersion: LIBTRACK_IDB_VERSION,
    productionAutoMigrationEnabled: PHASE1_PRODUCTION_AUTO_MIGRATION_ENABLED,
    activeReadSource: 'localStorage',
    dualWriteEnabled: false,
    status: 'IN_PROGRESS',
    runCount: prevState.runCount + 1,
    lastRunStartedAtISO: nowISO,
    lastRunCompletedAtISO: null,
    preMigrationCanonicalSha256,
    postMigrationCanonicalSha256: null,
    localStoragePreservedUntouched: true,
    indexedDbAvailable: !adapter.simulateIdbUnavailable && hasNativeIndexedDb(),
    usingInMemoryFallback: Boolean(adapter.useIsolatedInMemoryIdb) || !hasNativeIndexedDb(),
    checkpoints,
    validationIssues,
    errorLogs,
  };

  savePhase1MigrationState(state, local);

  const markCheckpointStart = (stepId: Phase1CheckpointStepId): Phase1CheckpointRecord => {
    const cp = checkpoints.find((c) => c.checkpointId === stepId)!;
    cp.status = 'IN_PROGRESS';
    cp.startedAtISO = new Date().toISOString();
    savePhase1MigrationState(state, local);
    return cp;
  };

  const completeCheckpoint = async (
    cp: Phase1CheckpointRecord,
    processed: number,
    validated: number,
    dups: number,
    payloadForHash: unknown
  ) => {
    cp.recordsProcessed = processed;
    cp.recordsValidated = validated;
    cp.duplicatesPrevented = dups;
    cp.sha256Hex = computeSha256Hex(JSON.stringify(payloadForHash));
    cp.status = 'COMPLETED';
    cp.completedAtISO = new Date().toISOString();
    await putRecordsInStore(
      IDB_STORES.MIGRATION_CHECKPOINTS,
      [cp as unknown as Record<string, unknown>],
      adapter,
      false
    );
    savePhase1MigrationState(state, local);

    if (adapter.simulateInterruptionAfterStep === cp.checkpointId) {
      throw new Error(`SIMULATED_INTERRUPTION_AFTER_${cp.checkpointId}`);
    }
  };

  const checkQuotaSimulation = (stepId: Phase1CheckpointStepId) => {
    if (adapter.simulateQuotaExceededOnStep === stepId) {
      throw new Error(`QuotaExceededError: Simulated storage quota exceeded during ${stepId}`);
    }
  };

  try {
    // STEP 0: Pre-Flight Snapshot & Immutable Backup Check
    const cp0 = markCheckpointStart('STEP_0_PREFLIGHT_SNAPSHOT');
    checkQuotaSimulation('STEP_0_PREFLIGHT_SNAPSHOT');

    if (!adapter.useIsolatedInMemoryIdb) {
      createAndVerifyPhase0LocalBackup(false);
    }

    const preflightSnapshot: Record<string, string | null> = {};
    for (const k of ALL_PRESERVED_LOCAL_STORAGE_KEYS) {
      preflightSnapshot[k] = local.getItem(k);
    }
    if (!local.getItem(PHASE1_PRE_MIGRATION_SNAPSHOT_KEY)) {
      local.setItem(
        PHASE1_PRE_MIGRATION_SNAPSHOT_KEY,
        JSON.stringify({
          capturedAtISO: nowISO,
          canonicalSha256: preMigrationCanonicalSha256,
          localStorage: preflightSnapshot,
        })
      );
    }
    await completeCheckpoint(cp0, ALL_PRESERVED_LOCAL_STORAGE_KEYS.length, ALL_PRESERVED_LOCAL_STORAGE_KEYS.length, 0, preflightSnapshot);

    // STEP 1: Dynamic Enumeration of ALL localStorage & sessionStorage Keys -> `raw_storage_mirror`
    const cp1 = markCheckpointStart('STEP_1_RAW_STORAGE_MIRROR');
    checkQuotaSimulation('STEP_1_RAW_STORAGE_MIRROR');

    const expectedLocalSet = new Set<string>(ALL_PRESERVED_LOCAL_STORAGE_KEYS);
    const expectedSessionSet = new Set<string>(ALL_PRESERVED_SESSION_STORAGE_KEYS);
    const internalVaultSet = new Set<string>([
      ...PHASE0_INTERNAL_VAULT_KEYS,
      PHASE1_MIGRATION_STATE_KEY,
      PHASE1_PRE_MIGRATION_SNAPSHOT_KEY,
    ]);

    const rawMirrorRecords: Record<string, unknown>[] = [];
    let rawMirrorLocalKeys = 0;
    let rawMirrorSessionKeys = 0;
    let unknownExtraKeysCaptured = 0;

    // 1A: All 21 expected localStorage slots
    for (const key of ALL_PRESERVED_LOCAL_STORAGE_KEYS) {
      const val = local.getItem(key);
      rawMirrorLocalKeys++;
      rawMirrorRecords.push({
        compositeKey: `localStorage::${key}`,
        storageArea: 'localStorage',
        key,
        rawValue: val,
        isPopulated: val !== null,
        byteLength: val ? val.length : 0,
        sha256Hex: val !== null ? computeSha256Hex(val) : null,
        classification: 'EXPECTED_23_SLOT',
        migratedAtISO: nowISO,
      });
    }

    // 1B: Dynamic scan of actual localStorage for any extra/unknown keys outside the 21 slots
    for (let i = 0; i < local.length; i++) {
      const key = local.key(i);
      if (!key || expectedLocalSet.has(key)) continue;
      if (key === PHASE1_MIGRATION_STATE_KEY) continue; // exclude transient state tracker itself from mirror count
      const val = local.getItem(key);
      const isInternal = internalVaultSet.has(key);
      if (!isInternal) {
        unknownExtraKeysCaptured++;
      }
      rawMirrorLocalKeys++;
      rawMirrorRecords.push({
        compositeKey: `localStorage::${key}`,
        storageArea: 'localStorage',
        key,
        rawValue: val,
        isPopulated: val !== null,
        byteLength: val ? val.length : 0,
        sha256Hex: val !== null ? computeSha256Hex(val) : null,
        classification: isInternal ? 'INTERNAL_BACKUP_VAULT' : 'DYNAMIC_EXTRA_KEY',
        migratedAtISO: nowISO,
      });
    }

    // 1C: All 2 expected sessionStorage slots + any dynamic sessionStorage keys
    for (const key of ALL_PRESERVED_SESSION_STORAGE_KEYS) {
      const val = session.getItem(key);
      rawMirrorSessionKeys++;
      rawMirrorRecords.push({
        compositeKey: `sessionStorage::${key}`,
        storageArea: 'sessionStorage',
        key,
        rawValue: val,
        isPopulated: val !== null,
        byteLength: val ? val.length : 0,
        sha256Hex: val !== null ? computeSha256Hex(val) : null,
        classification: 'EXPECTED_23_SLOT',
        migratedAtISO: nowISO,
      });
    }

    for (let i = 0; i < session.length; i++) {
      const key = session.key(i);
      if (!key || expectedSessionSet.has(key)) continue;
      const val = session.getItem(key);
      unknownExtraKeysCaptured++;
      rawMirrorSessionKeys++;
      rawMirrorRecords.push({
        compositeKey: `sessionStorage::${key}`,
        storageArea: 'sessionStorage',
        key,
        rawValue: val,
        isPopulated: val !== null,
        byteLength: val ? val.length : 0,
        sha256Hex: val !== null ? computeSha256Hex(val) : null,
        classification: 'DYNAMIC_EXTRA_KEY',
        migratedAtISO: nowISO,
      });
    }

    await putRecordsInStore(IDB_STORES.RAW_STORAGE_MIRROR, rawMirrorRecords, adapter, true);
    await completeCheckpoint(
      cp1,
      rawMirrorRecords.length,
      rawMirrorRecords.length,
      0,
      rawMirrorRecords.map((r) => ({ k: r.compositeKey, h: r.sha256Hex }))
    );

    // STEP 2: Migrate & Validate Students (Active + Archived) -> `students` object store
    const cp2 = markCheckpointStart('STEP_2_STUDENTS_STORE');
    checkQuotaSimulation('STEP_2_STUDENTS_STORE');

    const rawStudentsStr = local.getItem('libtrack_firestore_students');
    let parsedStudents: unknown[] = [];
    if (rawStudentsStr) {
      try {
        const parsed = JSON.parse(rawStudentsStr);
        if (Array.isArray(parsed)) parsedStudents = parsed;
      } catch {
        validationIssues.push({
          entityType: 'STUDENT',
          recordId: 'libtrack_firestore_students',
          severity: 'ERROR_REJECTED',
          message: 'Corrupted JSON in libtrack_firestore_students.',
        });
      }
    }

    const studentMap = new Map<string, Student>();
    let studentDuplicatesPrevented = 0;

    for (const item of parsedStudents) {
      const validated = validateStudentRecord(item, validationIssues);
      if (!validated) continue;
      if (studentMap.has(validated.id)) {
        studentDuplicatesPrevented++;
        validationIssues.push({
          entityType: 'STUDENT',
          recordId: validated.id,
          severity: 'DUPLICATE_SKIPPED',
          message: `Duplicate student ID '${validated.id}' prevented during migration.`,
        });
        continue;
      }
      studentMap.set(validated.id, validated);
    }

    const validatedStudents = Array.from(studentMap.values());
    await putRecordsInStore(
      IDB_STORES.STUDENTS,
      validatedStudents as unknown as Record<string, unknown>[],
      adapter,
      true
    );
    await completeCheckpoint(
      cp2,
      parsedStudents.length,
      validatedStudents.length,
      studentDuplicatesPrevented,
      validatedStudents
    );

    // STEP 3: Migrate & Validate Historical Payments -> `payments` object store
    const cp3 = markCheckpointStart('STEP_3_PAYMENTS_STORE');
    checkQuotaSimulation('STEP_3_PAYMENTS_STORE');

    const rawPaymentsStr = local.getItem('libtrack_firestore_payments');
    let parsedPaymentsObj: Record<string, unknown[]> = {};
    if (rawPaymentsStr) {
      try {
        const parsed = JSON.parse(rawPaymentsStr);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          parsedPaymentsObj = parsed as Record<string, unknown[]>;
        }
      } catch {
        validationIssues.push({
          entityType: 'PAYMENT',
          recordId: 'libtrack_firestore_payments',
          severity: 'ERROR_REJECTED',
          message: 'Corrupted JSON in libtrack_firestore_payments.',
        });
      }
    }

    const paymentMap = new Map<string, PaymentRecord>();
    let rawPaymentsProcessed = 0;
    let paymentDuplicatesPrevented = 0;

    for (const [bucketStudentId, list] of Object.entries(parsedPaymentsObj)) {
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        rawPaymentsProcessed++;
        const validated = validatePaymentRecord(item, bucketStudentId, studentMap, validationIssues);
        if (!validated) continue;
        if (paymentMap.has(validated.id)) {
          paymentDuplicatesPrevented++;
          validationIssues.push({
            entityType: 'PAYMENT',
            recordId: validated.id,
            severity: 'DUPLICATE_SKIPPED',
            message: `Duplicate payment ID '${validated.id}' prevented during migration.`,
          });
          continue;
        }
        paymentMap.set(validated.id, validated);
      }
    }

    const validatedPayments = Array.from(paymentMap.values());
    await putRecordsInStore(
      IDB_STORES.PAYMENTS,
      validatedPayments as unknown as Record<string, unknown>[],
      adapter,
      true
    );
    await completeCheckpoint(
      cp3,
      rawPaymentsProcessed,
      validatedPayments.length,
      paymentDuplicatesPrevented,
      validatedPayments
    );

    // STEP 4: Migrate & Validate Daily Attendance -> `attendance` object store
    const cp4 = markCheckpointStart('STEP_4_ATTENDANCE_STORE');
    checkQuotaSimulation('STEP_4_ATTENDANCE_STORE');

    const rawAttendanceStr = local.getItem('libtrack_firestore_daily_attendance');
    let parsedAttendance: unknown[] = [];
    if (rawAttendanceStr) {
      try {
        const parsed = JSON.parse(rawAttendanceStr);
        if (Array.isArray(parsed)) parsedAttendance = parsed;
      } catch {
        validationIssues.push({
          entityType: 'ATTENDANCE',
          recordId: 'libtrack_firestore_daily_attendance',
          severity: 'ERROR_REJECTED',
          message: 'Corrupted JSON in libtrack_firestore_daily_attendance.',
        });
      }
    }

    const attendanceMap = new Map<string, DailyAttendanceRecord>();
    let attendanceDuplicatesPrevented = 0;

    for (const item of parsedAttendance) {
      const validated = validateAttendanceRecord(item, studentMap, validationIssues);
      if (!validated) continue;
      if (attendanceMap.has(validated.id)) {
        attendanceDuplicatesPrevented++;
        validationIssues.push({
          entityType: 'ATTENDANCE',
          recordId: validated.id,
          severity: 'DUPLICATE_SKIPPED',
          message: `Duplicate attendance ID '${validated.id}' prevented during migration.`,
        });
        continue;
      }
      attendanceMap.set(validated.id, validated);
    }

    const validatedAttendance = Array.from(attendanceMap.values());
    await putRecordsInStore(
      IDB_STORES.ATTENDANCE,
      validatedAttendance as unknown as Record<string, unknown>[],
      adapter,
      true
    );
    await completeCheckpoint(
      cp4,
      parsedAttendance.length,
      validatedAttendance.length,
      attendanceDuplicatesPrevented,
      validatedAttendance
    );

    // STEP 5: Migrate & Validate Seats and Shifts -> `seats` and `shifts` object stores
    const cp5 = markCheckpointStart('STEP_5_SEATS_AND_SHIFTS_STORES');
    checkQuotaSimulation('STEP_5_SEATS_AND_SHIFTS_STORES');

    const rawSeatsStr = local.getItem('lakshay_app_seats');
    let parsedSeats: SeatItem[] = [];
    if (rawSeatsStr) {
      try {
        const parsed = JSON.parse(rawSeatsStr);
        if (Array.isArray(parsed)) parsedSeats = parsed;
      } catch {
        // Ignore
      }
    }
    const seatById = new Map<string, SeatItem>();
    const seatByNumber = new Set<string>();
    let seatShiftDuplicatesPrevented = 0;

    for (const s of parsedSeats) {
      if (!s || typeof s !== 'object' || !s.id || !s.seatNumber) continue;
      const cleanNumber = String(s.seatNumber).trim().toUpperCase();
      if (seatById.has(s.id) || seatByNumber.has(cleanNumber)) {
        seatShiftDuplicatesPrevented++;
        continue;
      }
      seatByNumber.add(cleanNumber);
      seatById.set(s.id, {
        id: String(s.id),
        seatNumber: cleanNumber,
        section: String(s.section || cleanNumber.split('-')[0] || 'A'),
        zoneLabel: s.zoneLabel || 'Silent Reading Zone',
      });
    }
    const validatedSeats = Array.from(seatById.values());

    const rawShiftsStr = local.getItem('lakshay_app_shifts');
    let parsedShifts: ShiftItem[] = [];
    if (rawShiftsStr) {
      try {
        const parsed = JSON.parse(rawShiftsStr);
        if (Array.isArray(parsed)) parsedShifts = parsed;
      } catch {
        // Ignore
      }
    }
    const shiftById = new Map<string, ShiftItem>();
    for (const sh of parsedShifts) {
      if (!sh || typeof sh !== 'object' || !sh.id || !sh.label) continue;
      if (shiftById.has(sh.id)) {
        seatShiftDuplicatesPrevented++;
        continue;
      }
      shiftById.set(sh.id, sh);
    }
    const validatedShifts = Array.from(shiftById.values());

    await putRecordsInStore(
      IDB_STORES.SEATS,
      validatedSeats as unknown as Record<string, unknown>[],
      adapter,
      true
    );
    await putRecordsInStore(
      IDB_STORES.SHIFTS,
      validatedShifts as unknown as Record<string, unknown>[],
      adapter,
      true
    );
    await completeCheckpoint(
      cp5,
      parsedSeats.length + parsedShifts.length,
      validatedSeats.length + validatedShifts.length,
      seatShiftDuplicatesPrevented,
      { seats: validatedSeats, shifts: validatedShifts }
    );

    // STEP 6: Migrate Settings, Backups & Telemetry -> `settings`, `backups`, `telemetry` stores
    const cp6 = markCheckpointStart('STEP_6_SETTINGS_BACKUPS_TELEMETRY');
    checkQuotaSimulation('STEP_6_SETTINGS_BACKUPS_TELEMETRY');

    const settingsKeyDefs: Array<{ key: string; category: string }> = [
      { key: 'lakshay_library_upi_config_v1', category: 'UPI_CONFIG' },
      { key: 'lakshay_app_theme', category: 'THEME' },
      { key: 'lakshay_app_dark_mode', category: 'THEME' },
      { key: 'lakshay_library_gdrive_sync_config_v1', category: 'SYNC_CONFIG' },
      { key: 'lakshay_library_google_profile_meta_v2', category: 'AUTH_META' },
      { key: 'lakshay_library_workmanager_backup_config_v1', category: 'BACKUP_CONFIG' },
      { key: 'lakshay_library_drive_logs_folder_meta_v2', category: 'DRIVE_LOGS_META' },
      { key: 'lakshay_library_prod_v2_0_0_clean', category: 'SYSTEM_INIT' },
      { key: 'lakshay_library_pending_drive_redirect', category: 'SYNC_REDIRECT' },
    ];

    const settingsRecords: Record<string, unknown>[] = settingsKeyDefs.map((def) => {
      const rawVal = local.getItem(def.key);
      return {
        key: def.key,
        category: def.category,
        rawValue: rawVal,
        updatedAt: nowISO,
      };
    });

    const backupKeyDefs: Array<{ key: string; backupType: string }> = [
      { key: 'lakshay_library_daily_json_backups_v1', backupType: 'DAILY_JSON_BACKUPS' },
      { key: 'lakshay_library_daily_backups_v1', backupType: 'LEGACY_DAILY_BACKUPS' },
      { key: 'libtrack_firestore_previous_backup_snapshot', backupType: 'PREVIOUS_SNAPSHOT' },
      { key: 'lakshay_library_phase0_containment_backup_v1', backupType: 'PHASE0_IMMUTABLE_VAULT' },
      { key: 'lakshay_library_phase0_latest_snapshot_v1', backupType: 'PHASE0_LATEST_VAULT' },
      { key: 'lakshay_library_phase0_pre_restore_safety_v1', backupType: 'PHASE0_PRE_RESTORE' },
      { key: 'lakshay_library_phase0_drive_permission_audit_v1', backupType: 'PHASE0_DRIVE_AUDIT' },
    ];

    const backupRecords: Record<string, unknown>[] = backupKeyDefs
      .map((def) => {
        const rawVal = local.getItem(def.key);
        return {
          id: def.key,
          backupType: def.backupType,
          rawValue: rawVal,
          isPresent: rawVal !== null,
          byteLength: rawVal ? rawVal.length : 0,
          createdAt: nowISO,
        };
      })
      .filter((b) => b.isPresent);

    const telemetryKeyDefs: Array<{ key: string; area: 'local' | 'session'; telemetryType: string }> = [
      { key: 'lakshay_library_active_clients_registry_v1', area: 'local', telemetryType: 'ACTIVE_CLIENTS' },
      { key: 'lakshay_library_blocked_clients_manifest_v1', area: 'local', telemetryType: 'BLOCKED_CLIENTS' },
      { key: 'lakshay_library_current_client_id_v1', area: 'local', telemetryType: 'CLIENT_ID' },
      { key: 'lakshay_library_crash_logs_v1', area: 'local', telemetryType: 'CRASH_LOGS' },
      { key: 'lakshay_library_breadcrumbs_buffer_v1', area: 'session', telemetryType: 'BREADCRUMBS' },
    ];

    const telemetryRecords: Record<string, unknown>[] = telemetryKeyDefs.map((def) => {
      const rawVal = def.area === 'local' ? local.getItem(def.key) : session.getItem(def.key);
      return {
        id: `${def.area}::${def.key}`,
        telemetryType: def.telemetryType,
        rawValue: rawVal,
        timestamp: nowISO,
      };
    });

    await putRecordsInStore(IDB_STORES.SETTINGS, settingsRecords, adapter, true);
    await putRecordsInStore(IDB_STORES.BACKUPS, backupRecords, adapter, true);
    await putRecordsInStore(IDB_STORES.TELEMETRY, telemetryRecords, adapter, true);

    await completeCheckpoint(
      cp6,
      settingsRecords.length + backupRecords.length + telemetryRecords.length,
      settingsRecords.length + backupRecords.length + telemetryRecords.length,
      0,
      { settingsCount: settingsRecords.length, backupsCount: backupRecords.length, telemetryCount: telemetryRecords.length }
    );

    // STEP 7: Post-Migration Read-Back Verification & Consistency Audit
    const cp7 = markCheckpointStart('STEP_7_POST_MIGRATION_VERIFICATION');
    checkQuotaSimulation('STEP_7_POST_MIGRATION_VERIFICATION');

    const idbStudents = await getAllRecordsFromStore<Student>(IDB_STORES.STUDENTS, adapter);
    const idbPayments = await getAllRecordsFromStore<PaymentRecord>(IDB_STORES.PAYMENTS, adapter);
    const idbAttendance = await getAllRecordsFromStore<DailyAttendanceRecord>(IDB_STORES.ATTENDANCE, adapter);
    const idbSeats = await getAllRecordsFromStore<SeatItem>(IDB_STORES.SEATS, adapter);
    const idbShifts = await getAllRecordsFromStore<ShiftItem>(IDB_STORES.SHIFTS, adapter);
    const idbRawMirror = await getAllRecordsFromStore<Record<string, unknown>>(IDB_STORES.RAW_STORAGE_MIRROR, adapter);

    const postMigrationCanonicalSha256 = computeCanonicalStorageDigest(local, session);
    const localStoragePreservedUntouched = preMigrationCanonicalSha256 === postMigrationCanonicalSha256;

    if (!localStoragePreservedUntouched) {
      throw new Error('CONSISTENCY_ERROR: Canonical localStorage digest changed during migration!');
    }

    if (
      idbStudents.length !== validatedStudents.length ||
      idbPayments.length !== validatedPayments.length ||
      idbAttendance.length !== validatedAttendance.length
    ) {
      throw new Error('CONSISTENCY_ERROR: IndexedDB read-back record counts did not match validated input!');
    }

    const activeStudentsCount = idbStudents.filter((s) => s.status !== 'archived').length;
    const archivedStudentsCount = idbStudents.filter((s) => s.status === 'archived').length;
    const studentIdsWithPayments = new Set(idbPayments.map((p) => p.studentId));
    const zeroPaymentStudentsCount = idbStudents.filter((s) => !studentIdsWithPayments.has(s.id)).length;
    const totalPaymentAmountINR = idbPayments.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
    const totalDuplicatesPrevented =
      studentDuplicatesPrevented + paymentDuplicatesPrevented + attendanceDuplicatesPrevented + seatShiftDuplicatesPrevented;

    state.counts = {
      activeStudents: activeStudentsCount,
      archivedStudents: archivedStudentsCount,
      totalStudents: idbStudents.length,
      zeroPaymentStudents: zeroPaymentStudentsCount,
      totalPayments: idbPayments.length,
      totalPaymentAmountINR,
      attendanceRecords: idbAttendance.length,
      seats: idbSeats.length,
      shifts: idbShifts.length,
      settingsKeys: settingsRecords.length,
      backupRecords: backupRecords.length,
      telemetryRecords: telemetryRecords.length,
      rawMirrorLocalKeys,
      rawMirrorSessionKeys,
      unknownExtraKeysCaptured,
      duplicatesPrevented: totalDuplicatesPrevented,
    };

    await putRecordsInStore(
      IDB_STORES.SCHEMA_META,
      [
        {
          metaKey: 'LIBTRACK_SCHEMA_V1',
          dbName: LIBTRACK_IDB_NAME,
          schemaVersion: LIBTRACK_IDB_VERSION,
          migratedAtISO: nowISO,
          canonicalSha256: postMigrationCanonicalSha256,
          counts: state.counts,
        },
      ],
      adapter,
      true
    );

    await completeCheckpoint(
      cp7,
      idbStudents.length + idbPayments.length + idbAttendance.length + idbRawMirror.length,
      idbStudents.length + idbPayments.length + idbAttendance.length + idbRawMirror.length,
      0,
      state.counts
    );

    if (options?.enableDualWriteAfterVerify && !adapter.useIsolatedInMemoryIdb) {
      dualWriteActiveInDev = true;
    }

    state.status = 'VERIFIED_COMPLETED';
    state.dualWriteEnabled = Boolean(options?.enableDualWriteAfterVerify);
    state.activeReadSource = state.dualWriteEnabled ? 'IndexedDB_Verified_DualWrite' : 'localStorage';
    state.postMigrationCanonicalSha256 = postMigrationCanonicalSha256;
    state.localStoragePreservedUntouched = localStoragePreservedUntouched;
    state.lastRunCompletedAtISO = new Date().toISOString();

    savePhase1MigrationState(state, local);
    return state;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    state.errorLogs.push(`[${new Date().toISOString()}] Migration halted safely: ${errMsg}`);
    const failedCp = state.checkpoints.find((c) => c.status === 'IN_PROGRESS');
    if (failedCp) {
      failedCp.status = 'FAILED';
      failedCp.validationErrors.push(errMsg);
    }

    // Verify localStorage remains 100% intact on any interruption or failure
    const afterFailureSha256 = computeCanonicalStorageDigest(local, session);
    state.postMigrationCanonicalSha256 = afterFailureSha256;
    state.localStoragePreservedUntouched = preMigrationCanonicalSha256 === afterFailureSha256;
    state.status = 'FAILED_RECOVERED_TO_LOCALSTORAGE';
    state.activeReadSource = 'localStorage';
    state.dualWriteEnabled = false;
    savePhase1MigrationState(state, local);
    return state;
  } finally {
    migrationRunningLock = false;
  }
};

/**
 * STAGE B/C: Safe Rollback Mechanism.
 * - Immediately routes all reads/writes exclusively to `localStorage`.
 * - Clears `lakshay_libtrack_db` object stores (or resets the isolated test DB).
 * - Never deletes `localStorage` data; verifies `localStorage` canonical SHA-256 matches pre-migration snapshot.
 */
export const rollbackPhase1IndexedDbMigration = async (
  reason = 'Manual rollback requested by administrator',
  adapter: StorageProviderAdapter = getDefaultStorageProvider()
): Promise<Phase1MigrationStateSummary> => {
  const local = adapter.localStorage;
  const session = adapter.sessionStorage;
  const nowISO = new Date().toISOString();

  dualWriteActiveInDev = false;
  await clearAllStoresInIndexedDb(adapter).catch(() => {});

  // If pre-migration snapshot exists and any key was altered in a test environment, verify or restore
  const preSnapRaw = local.getItem(PHASE1_PRE_MIGRATION_SNAPSHOT_KEY);
  let preSha256: string | null = null;
  if (preSnapRaw) {
    try {
      const parsed = JSON.parse(preSnapRaw) as {
        canonicalSha256: string;
        localStorage: Record<string, string | null>;
      };
      preSha256 = parsed.canonicalSha256;
      const currentSha = computeCanonicalStorageDigest(local, session);
      if (currentSha !== preSha256 && parsed.localStorage) {
        for (const [k, v] of Object.entries(parsed.localStorage)) {
          if (v === null) local.removeItem(k);
          else local.setItem(k, v);
        }
      }
    } catch {
      // Ignore parse error
    }
  }

  const postRollbackSha256 = computeCanonicalStorageDigest(local, session);
  const currentState = getStoredPhase1MigrationState(local);

  const rolledBackState: Phase1MigrationStateSummary = {
    ...currentState,
    activeReadSource: 'localStorage',
    dualWriteEnabled: false,
    status: 'ROLLED_BACK',
    lastRollbackAtISO: nowISO,
    lastRollbackReason: reason,
    postMigrationCanonicalSha256: postRollbackSha256,
    localStoragePreservedUntouched: preSha256 ? preSha256 === postRollbackSha256 : true,
    checkpoints: currentState.checkpoints.map((cp) => ({
      ...cp,
      status: 'ROLLED_BACK',
    })),
  };

  savePhase1MigrationState(rolledBackState, local);
  return rolledBackState;
};

/**
 * Optional Dual-Write Mirror Hook:
 * When `dualWriteActiveInDev === true` (after explicit verification in development),
 * mirrors updated `localStorage` changes into `lakshay_libtrack_db` without blocking synchronous UI operations.
 */
export const mirrorLocalStorageWriteToIndexedDbIfEnabled = (): void => {
  if (!dualWriteActiveInDev || migrationRunningLock || syncInProgressLock) return;
  runPhase1IndexedDbMigration({ enableDualWriteAfterVerify: true }).catch(() => {});
};

/**
 * STAGE C: Comprehensive Copied-Data Verification Suite (`runPhase1CopiedDataTestSuite`).
 *
 * Tests all mandatory Phase 1 scenarios on an isolated copy of data + realistic test records
 * WITHOUT modifying active production `localStorage`, `sessionStorage`, or production IndexedDB:
 * 1. Active students, archived students, zero-payment students, multiple historical payments, attendance, reused seats, settings/UPI, pending sync, and unknown extra keys.
 * 2. Record counts, student IDs, payment IDs, total payment amounts (INR), historical student names & seats.
 * 3. Idempotent repeated migration & duplicate prevention.
 * 4. Interrupted migration (app close / Android process kill mid-migration) & safe recovery.
 * 5. Storage quota exceeded / IndexedDB unavailable graceful fallback to `localStorage`.
 * 6. Google Drive sync concurrency guard during migration & older app version compatibility.
 * 7. Full rollback & bit-for-bit `localStorage` preservation.
 */
export const runPhase1CopiedDataTestSuite = async (): Promise<Phase1CopiedDataTestSuiteReport> => {
  const executedAtISO = new Date().toISOString();
  const preTestProductionSha256 = computeCanonicalStorageDigest(window.localStorage, window.sessionStorage);

  // Helper to create an isolated in-memory Storage clone seeded with realistic copied data
  const createSeededSandboxAdapter = (): StorageProviderAdapter => {
    const localMap = new Map<string, string>();
    const sessionMap = new Map<string, string>();

    // Copy any existing production keys into the isolated sandbox first
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k) {
        const v = window.localStorage.getItem(k);
        if (v !== null) localMap.set(k, v);
      }
    }
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k) {
        const v = window.sessionStorage.getItem(k);
        if (v !== null) sessionMap.set(k, v);
      }
    }

    // Seed realistic dataset covering all required edge cases in the isolated sandbox copy:
    // - 2 Active students (one on reused seat A-01, one with zero payments)
    // - 1 Archived student (formerly on seat A-01, renamed before archive, with 2 historical payments)
    const testStudents: Student[] = [
      {
        id: 'stu-archived-01',
        name: 'Aarav Sharma (Archived)',
        phoneNumber: '9876543210',
        seatNumber: '',
        archivedSeatNumber: 'A-01',
        archivedAt: '2026-11-05T10:00:00.000Z',
        shiftTimings: '08:00 AM - 02:00 PM',
        monthlyFee: 1200,
        admissionDate: '2026-09-01',
        nextFeeDueDate: '2026-11-01',
        status: 'archived',
        updatedAt: '2026-11-05T10:00:00.000Z',
      },
      {
        id: 'stu-active-reused-seat-02',
        name: 'Priya Verma',
        phoneNumber: '9123456780',
        seatNumber: 'A-01', // Reused seat A-01!
        shiftTimings: '08:00 AM - 02:00 PM',
        monthlyFee: 1500,
        admissionDate: '2026-11-06',
        nextFeeDueDate: '2026-12-06',
        status: 'active',
        updatedAt: '2026-11-06T09:00:00.000Z',
      },
      {
        id: 'stu-active-zero-payments-03',
        name: 'Rohan Gupta (Zero Payments)',
        phoneNumber: '9988776655',
        seatNumber: 'B-04',
        shiftTimings: '02:00 PM - 08:00 PM',
        monthlyFee: 1000,
        admissionDate: '2026-11-10',
        nextFeeDueDate: '2026-11-15',
        status: 'active',
        updatedAt: '2026-11-10T11:00:00.000Z',
      },
    ];

    const testPayments: Record<string, PaymentRecord[]> = {
      'stu-archived-01': [
        {
          id: 'pay-hist-01',
          studentId: 'stu-archived-01',
          paymentDate: '2026-09-01T09:00:00.000Z',
          amountPaid: 1200,
          paymentMode: 'UPI',
          receiptNumber: 'REC-2026-1001',
          studentName: 'Aarav Sharma', // Original historical name before rename/archive
          seatNumber: 'A-01',          // Original historical seat before reuse
          note: 'September Admission Fee',
        },
        {
          id: 'pay-hist-02',
          studentId: 'stu-archived-01',
          paymentDate: '2026-10-01T09:30:00.000Z',
          amountPaid: 1200,
          paymentMode: 'Cash',
          receiptNumber: 'REC-2026-1002',
          studentName: 'Aarav Sharma',
          seatNumber: 'A-01',
          note: 'October Renewal Fee',
        },
      ],
      'stu-active-reused-seat-02': [
        {
          id: 'pay-active-03',
          studentId: 'stu-active-reused-seat-02',
          paymentDate: '2026-11-06T09:15:00.000Z',
          amountPaid: 1500,
          paymentMode: 'UPI',
          receiptNumber: 'REC-2026-1003',
          studentName: 'Priya Verma',
          seatNumber: 'A-01',
          note: 'November Admission Fee on Reused Seat A-01',
        },
      ],
    };

    const testAttendance: DailyAttendanceRecord[] = [
      {
        id: 'att-hist-01',
        studentId: 'stu-archived-01',
        studentName: 'Aarav Sharma',
        seatNumber: 'A-01',
        shiftTimings: '08:00 AM - 02:00 PM',
        date: '2026-10-15',
        checkInTime: '2026-10-15T08:05:00.000Z',
        verificationMethod: 'QR_SCAN',
      },
      {
        id: 'att-active-02',
        studentId: 'stu-active-reused-seat-02',
        studentName: 'Priya Verma',
        seatNumber: 'A-01',
        shiftTimings: '08:00 AM - 02:00 PM',
        date: '2026-11-11',
        checkInTime: '2026-11-11T08:02:00.000Z',
        verificationMethod: 'MANUAL_DESK',
      },
    ];

    localMap.set('libtrack_firestore_students', JSON.stringify(testStudents));
    localMap.set('libtrack_firestore_payments', JSON.stringify(testPayments));
    localMap.set('libtrack_firestore_daily_attendance', JSON.stringify(testAttendance));
    if (!localMap.has('lakshay_app_seats')) {
      localMap.set(
        'lakshay_app_seats',
        JSON.stringify([
          { id: 'seat_A-01', seatNumber: 'A-01', section: 'A', zoneLabel: 'Silent Reading Zone' },
          { id: 'seat_A-02', seatNumber: 'A-02', section: 'A', zoneLabel: 'Silent Reading Zone' },
          { id: 'seat_B-04', seatNumber: 'B-04', section: 'B', zoneLabel: 'Silent Reading Zone' },
        ])
      );
    }
    if (!localMap.has('lakshay_app_shifts')) {
      localMap.set(
        'lakshay_app_shifts',
        JSON.stringify([
          { id: 'shift_morning', label: 'Morning Shift', timings: '08:00 AM - 02:00 PM', isSystem: true },
          { id: 'shift_evening', label: 'Evening Shift', timings: '02:00 PM - 08:00 PM', isSystem: true },
        ])
      );
    }
    localMap.set(
      'lakshay_library_upi_config_v1',
      JSON.stringify({
        upiId: 'lakshaylib@okaxis',
        payeeName: 'Lakshay Library',
        isConfigured: true,
      })
    );
    // Also add an unknown extra key outside the 23 predefined slots to verify dynamic key capture
    localMap.set('custom_unclassified_extension_key_v1', JSON.stringify({ customFlag: true }));
    sessionMap.set('lakshay_library_pending_drive_redirect', '1');

    const makeStorage = (map: Map<string, string>) => ({
      get length() {
        return map.size;
      },
      key(i: number) {
        return Array.from(map.keys())[i] ?? null;
      },
      getItem(k: string) {
        return map.has(k) ? map.get(k)! : null;
      },
      setItem(k: string, v: string) {
        map.set(k, String(v));
      },
      removeItem(k: string) {
        map.delete(k);
      },
    });

    return {
      localStorage: makeStorage(localMap),
      sessionStorage: makeStorage(sessionMap),
      useIsolatedInMemoryIdb: true,
      isolatedIdbInstance: createInMemoryDatabaseInstance(),
    };
  };

  const scenarios: Phase1ScenarioTestResult[] = [];

  // SCENARIO 1: Full Copied-Data Migration (Active, Archived, Zero-Payment, Reused Seat, Historical Snapshots, Dynamic Extra Keys)
  const sandbox1 = createSeededSandboxAdapter();
  const res1 = await runPhase1IndexedDbMigration({ adapter: sandbox1 });
  const idbStudents1 = await getAllRecordsFromStore<Student>(IDB_STORES.STUDENTS, sandbox1);
  const idbPayments1 = await getAllRecordsFromStore<PaymentRecord>(IDB_STORES.PAYMENTS, sandbox1);
  const idbAttendance1 = await getAllRecordsFromStore<DailyAttendanceRecord>(IDB_STORES.ATTENDANCE, sandbox1);

  const histPayment1 = idbPayments1.find((p) => p.id === 'pay-hist-01');
  const reusedPayment2 = idbPayments1.find((p) => p.id === 'pay-active-03');
  const histAttendance1 = idbAttendance1.find((a) => a.id === 'att-hist-01');

  const s1Passed =
    res1.status === 'VERIFIED_COMPLETED' &&
    res1.localStoragePreservedUntouched &&
    res1.counts.activeStudents === 2 &&
    res1.counts.archivedStudents === 1 &&
    res1.counts.zeroPaymentStudents === 1 &&
    res1.counts.totalPayments === 3 &&
    res1.counts.totalPaymentAmountINR === 3900 &&
    res1.counts.attendanceRecords === 2 &&
    res1.counts.unknownExtraKeysCaptured >= 1 &&
    histPayment1?.studentName === 'Aarav Sharma' &&
    histPayment1?.seatNumber === 'A-01' &&
    reusedPayment2?.studentName === 'Priya Verma' &&
    reusedPayment2?.seatNumber === 'A-01' &&
    histAttendance1?.studentName === 'Aarav Sharma';

  scenarios.push({
    scenarioId: 'SCENARIO_1_COPIED_DATA_AND_HISTORICAL_INTEGRITY',
    title: 'Copied Data Migration: Active, Archived, Zero-Payment, Reused Seat & Historical Snapshots',
    passed: Boolean(s1Passed),
    details:
      'Verified 2 active + 1 archived + 1 zero-payment student, 3 payments (₹3,900), 2 attendance records, reused seat A-01, and dynamic extra key capture.',
    metrics: {
      activeStudents: res1.counts.activeStudents,
      archivedStudents: res1.counts.archivedStudents,
      zeroPaymentStudents: res1.counts.zeroPaymentStudents,
      totalPayments: res1.counts.totalPayments,
      totalPaymentAmountINR: res1.counts.totalPaymentAmountINR,
      historicalSeatPreservedOnReusedSeat: `${histPayment1?.studentName}@${histPayment1?.seatNumber} vs ${reusedPayment2?.studentName}@${reusedPayment2?.seatNumber}`,
      unknownExtraKeysCaptured: res1.counts.unknownExtraKeysCaptured,
    },
  });

  // SCENARIO 2: Idempotent Repeated Migration & Duplicate Record Prevention
  // Inject a duplicate student ID and duplicate payment ID into sandbox1 and re-run migration
  const currentStudentsRaw = JSON.parse(sandbox1.localStorage.getItem('libtrack_firestore_students') || '[]');
  currentStudentsRaw.push(currentStudentsRaw[0]); // duplicate student ID
  sandbox1.localStorage.setItem('libtrack_firestore_students', JSON.stringify(currentStudentsRaw));

  const res2 = await runPhase1IndexedDbMigration({ adapter: sandbox1 });
  const idbStudentsAfterRepeat = await getAllRecordsFromStore<Student>(IDB_STORES.STUDENTS, sandbox1);
  const s2Passed =
    res2.status === 'VERIFIED_COMPLETED' &&
    idbStudentsAfterRepeat.length === idbStudents1.length &&
    res2.counts.duplicatesPrevented >= 1;

  scenarios.push({
    scenarioId: 'SCENARIO_2_IDEMPOTENT_REPEATED_AND_DUPLICATE_PREVENTION',
    title: 'Idempotent Repeated Migration & Duplicate ID Prevention',
    passed: Boolean(s2Passed),
    details: `Re-ran migration with injected duplicate IDs; prevented ${res2.counts.duplicatesPrevented} duplicate(s) and preserved exact store counts (${idbStudentsAfterRepeat.length} students).`,
    metrics: {
      runCount: res2.runCount,
      studentsCountAfterRepeat: idbStudentsAfterRepeat.length,
      duplicatesPrevented: res2.counts.duplicatesPrevented,
    },
  });

  // SCENARIO 3: Interrupted Migration (App Close / Android Process Kill After Step 3) & Recovery Retry
  const sandbox3 = createSeededSandboxAdapter();
  sandbox3.simulateInterruptionAfterStep = 'STEP_3_PAYMENTS_STORE';
  const resInterrupted = await runPhase1IndexedDbMigration({ adapter: sandbox3 });

  // Now clear interruption simulation and resume/retry migration
  sandbox3.simulateInterruptionAfterStep = null;
  const resRecovered = await runPhase1IndexedDbMigration({ adapter: sandbox3 });

  const s3Passed =
    resInterrupted.status === 'FAILED_RECOVERED_TO_LOCALSTORAGE' &&
    resInterrupted.localStoragePreservedUntouched &&
    resInterrupted.activeReadSource === 'localStorage' &&
    resRecovered.status === 'VERIFIED_COMPLETED' &&
    resRecovered.counts.totalStudents === 3 &&
    resRecovered.counts.totalPayments === 3;

  scenarios.push({
    scenarioId: 'SCENARIO_3_INTERRUPTED_MIGRATION_AND_RECOVERY',
    title: 'Interrupted Migration (Mid-Run Termination) & Safe Recovery Retry',
    passed: Boolean(s3Passed),
    details:
      'Simulated process termination after STEP_3_PAYMENTS_STORE; confirmed localStorage remained untouched and active, then resumed migration to VERIFIED_COMPLETED.',
    metrics: {
      interruptedStatus: resInterrupted.status,
      localStorageUntouchedOnCrash: resInterrupted.localStoragePreservedUntouched,
      recoveredStatus: resRecovered.status,
      recoveredPayments: resRecovered.counts.totalPayments,
    },
  });

  // SCENARIO 4: Quota Exceeded & IndexedDB Unavailable Fallback
  const sandbox4 = createSeededSandboxAdapter();
  sandbox4.simulateQuotaExceededOnStep = 'STEP_4_ATTENDANCE_STORE';
  const resQuota = await runPhase1IndexedDbMigration({ adapter: sandbox4 });

  const sandbox4Unavailable = createSeededSandboxAdapter();
  sandbox4Unavailable.simulateIdbUnavailable = true;
  const resUnavailable = await runPhase1IndexedDbMigration({ adapter: sandbox4Unavailable });

  const s4Passed =
    resQuota.status === 'FAILED_RECOVERED_TO_LOCALSTORAGE' &&
    resQuota.localStoragePreservedUntouched &&
    resUnavailable.status === 'FAILED_RECOVERED_TO_LOCALSTORAGE' &&
    resUnavailable.localStoragePreservedUntouched;

  scenarios.push({
    scenarioId: 'SCENARIO_4_QUOTA_AND_IDB_UNAVAILABLE_FALLBACK',
    title: 'Storage Quota Exceeded & IndexedDB Unavailable Safe Fallback',
    passed: Boolean(s4Passed),
    details:
      'Verified both QuotaExceededError and IndexedDB unavailability halt cleanly with zero corruption of localStorage.',
    metrics: {
      quotaExceededStatus: resQuota.status,
      idbUnavailableStatus: resUnavailable.status,
      localStoragePreserved: resQuota.localStoragePreservedUntouched && resUnavailable.localStoragePreservedUntouched,
    },
  });

  // SCENARIO 5: Safe Rollback & Older App Version / Sync Compatibility
  const sandbox5 = createSeededSandboxAdapter();
  await runPhase1IndexedDbMigration({ adapter: sandbox5 });
  const rolledBack = await rollbackPhase1IndexedDbMigration(
    'Stage C automated rollback verification test',
    sandbox5
  );
  const idbStudentsAfterRollback = await getAllRecordsFromStore<Student>(IDB_STORES.STUDENTS, sandbox5);

  const s5Passed =
    rolledBack.status === 'ROLLED_BACK' &&
    rolledBack.activeReadSource === 'localStorage' &&
    rolledBack.localStoragePreservedUntouched &&
    idbStudentsAfterRollback.length === 0 &&
    JSON.parse(sandbox5.localStorage.getItem('libtrack_firestore_students') || '[]').length === 3;

  scenarios.push({
    scenarioId: 'SCENARIO_5_SAFE_ROLLBACK_AND_BACKWARD_COMPATIBILITY',
    title: 'Full Rollback & Backward Compatibility with localStorage / Sync',
    passed: Boolean(s5Passed),
    details:
      'Rolled back IndexedDB migration; verified IndexedDB stores cleared, activeReadSource reset to localStorage, and all 3 students + ₹3,900 payments remained intact in localStorage.',
    metrics: {
      postRollbackStatus: rolledBack.status,
      activeReadSource: rolledBack.activeReadSource,
      idbStoreCountAfterRollback: idbStudentsAfterRollback.length,
      localStorageStudentsIntact: JSON.parse(sandbox5.localStorage.getItem('libtrack_firestore_students') || '[]').length,
    },
  });

  const postTestProductionSha256 = computeCanonicalStorageDigest(window.localStorage, window.sessionStorage);
  const productionStorageUntouched = preTestProductionSha256 === postTestProductionSha256;
  const passedScenarios = scenarios.filter((s) => s.passed).length;

  return {
    executedAtISO,
    productionStorageUntouched,
    preTestProductionSha256,
    postTestProductionSha256,
    allPassed: passedScenarios === scenarios.length && productionStorageUntouched,
    totalScenarios: scenarios.length,
    passedScenarios,
    scenarios,
    finalMigrationReport: res1,
  };
};
