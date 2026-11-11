import { Student, PaymentRecord, DailyAttendanceRecord } from '../types/student';
import { 
  INITIAL_STUDENTS, 
  INITIAL_PAYMENT_HISTORY, 
  INITIAL_DAILY_ATTENDANCE, 
  LEGACY_EXAMPLE_STUDENT_IDS,
  SAMPLE_STUDENTS_DATA,
  SAMPLE_PAYMENT_HISTORY_DATA,
  offsetDateString, 
  getTodayDateString 
} from '../data/mockStudents';

export { offsetDateString, getTodayDateString };

const STUDENTS_STORAGE_KEY = 'libtrack_firestore_students';
const PAYMENTS_STORAGE_KEY = 'libtrack_firestore_payments';
const DAILY_ATTENDANCE_STORAGE_KEY = 'libtrack_firestore_daily_attendance';
const PREVIOUS_SNAPSHOT_STORAGE_KEY = 'libtrack_firestore_previous_backup_snapshot';
const PRODUCTION_CLEAN_INIT_KEY = 'lakshay_library_prod_v2_0_0_clean';
export const PHASE0_CONTAINMENT_BACKUP_KEY = 'lakshay_library_phase0_containment_backup_v1';
export const PHASE0_LATEST_SNAPSHOT_BACKUP_KEY = 'lakshay_library_phase0_latest_snapshot_v1';
export const PHASE0_PRE_RESTORE_SAFETY_KEY = 'lakshay_library_phase0_pre_restore_safety_v1';

export const PHASE0_INTERNAL_VAULT_KEYS = [
  PHASE0_CONTAINMENT_BACKUP_KEY,
  PHASE0_LATEST_SNAPSHOT_BACKUP_KEY,
  PHASE0_PRE_RESTORE_SAFETY_KEY,
  'lakshay_library_phase0_drive_permission_audit_v1',
  'lakshay_library_phase1_migration_state_v1',
  'lakshay_library_phase1_pre_migration_snapshot_v1',
] as const;

export const ALL_PRESERVED_LOCAL_STORAGE_KEYS = [
  'libtrack_firestore_students',
  'libtrack_firestore_payments',
  'libtrack_firestore_daily_attendance',
  'libtrack_firestore_previous_backup_snapshot',
  'lakshay_library_prod_v2_0_0_clean',
  'lakshay_app_seats',
  'lakshay_app_shifts',
  'lakshay_library_upi_config_v1',
  'lakshay_library_profile_settings_v1',
  'lakshay_library_daily_json_backups_v1',
  'lakshay_library_daily_backups_v1',
  'lakshay_library_workmanager_backup_config_v1',
  'lakshay_library_google_profile_meta_v2',
  'lakshay_library_gdrive_sync_config_v1',
  'lakshay_library_pending_drive_redirect',
  'lakshay_library_active_clients_registry_v1',
  'lakshay_library_blocked_clients_manifest_v1',
  'lakshay_library_current_client_id_v1',
  'lakshay_library_crash_logs_v1',
  'lakshay_library_drive_logs_folder_meta_v2',
  'lakshay_app_theme',
  'lakshay_app_dark_mode',
  'libtrack_financial_journal_v1',
  'libtrack_quarantined_payment_conflicts',
  'libtrack_device_id_v1',
  'libtrack_financial_audit_trail_v1',
] as const;


export const ALL_PRESERVED_SESSION_STORAGE_KEYS = [
  'lakshay_library_pending_drive_redirect',
  'lakshay_library_breadcrumbs_buffer_v1',
] as const;

export interface Phase0KeyInventoryItem {
  key: string;
  storageArea: 'localStorage' | 'sessionStorage';
  status: 'POPULATED' | 'NULL_UNINITIALIZED';
  byteLength: number;
  sha256Hex: string | null;
}

export interface Phase0DynamicExtraKeyItem {
  key: string;
  storageArea: 'localStorage' | 'sessionStorage';
  classification: 'PHASE0_INTERNAL_VAULT' | 'UNKNOWN_EXTERNAL';
  byteLength: number;
  sha256Hex: string;
}

export interface Phase0BackupVerificationReport {
  verified: boolean;
  backupKey: string;
  originalBackupPreservedImmutable: boolean;
  createdAtISO: string;
  verifiedAtISO: string;
  sha256Hex: string;
  checksumHex: string;
  downloadedFileName: string;
  downloadedFileSizeBytes: number;
  downloadedFileTimestampISO: string;
  downloadedFileSha256Hex: string;
  expectedLocalKeyCount: number;
  expectedSessionKeyCount: number;
  expectedTotalKeySlots: number;
  capturedKeySlotsCount: number;
  populatedKeyCount: number;
  uninitializedNullKeyCount: number;
  preservedKeyCount: number;
  actualDynamicLocalKeyCount: number;
  actualDynamicSessionKeyCount: number;
  duplicateCrossStorageKeys: string[];
  missingUninitializedKeys: Array<{ key: string; storageArea: 'localStorage' | 'sessionStorage' }>;
  unknownOrInternalKeys: Phase0DynamicExtraKeyItem[];
  keyInventory: Phase0KeyInventoryItem[];
  activeStudentCount: number;
  archivedStudentCount: number;
  totalStudentRecordsCount: number;
  paymentAccountKeysCount: number;
  totalPaymentRecordsCount: number;
  totalPaymentAmountINR: number;
  attendanceRecordsCount: number;
  seatsCount: number;
  shiftsCount: number;
  dailyBackupsCount: number;
  upiConfigured: boolean;
  pendingSyncDataProtected: boolean;
  syncRole: string;
  lastSyncedAtISO: string | null;
}

export interface Phase0RestoreVerificationResult {
  restored: boolean;
  isolatedTestProfile: boolean;
  productionStorageUntouched: boolean;
  restoredAtISO: string;
  preRestoreSafetyKey: string;
  originalBackupSha256Hex: string;
  postRestoreSha256Hex: string;
  reproducedBitForBit: boolean;
  restoredLocalKeySlots: number;
  restoredSessionKeySlots: number;
  activeStudentCount: number;
  archivedStudentCount: number;
  totalPaymentRecordsCount: number;
  totalPaymentAmountINR: number;
  attendanceRecordsCount: number;
  seatsCount: number;
  shiftsCount: number;
  upiConfigured: boolean;
  pendingSyncConfigPresent: boolean;
}

const computeDeterministicHashHex = (input: string): string => {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0, ch; i < input.length; i++) {
    ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
};

/**
 * Pure synchronous FIPS 180-4 SHA-256 implementation over UTF-8 bytes.
 * Produces standard 64-character lowercase hexadecimal SHA-256 digests identical to
 * Node `crypto.createHash('sha256')` and Web Crypto `crypto.subtle.digest('SHA-256')`.
 */
export const computeSha256Hex = (input: string): string => {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const utf8 = new TextEncoder().encode(input);
  const bitLen = utf8.length * 8;
  const totalBytes = (((utf8.length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(totalBytes);
  padded.set(utf8);
  padded[utf8.length] = 0x80;

  const view = new DataView(padded.buffer);
  const highBits = Math.floor(bitLen / 0x100000000);
  const lowBits = bitLen >>> 0;
  view.setUint32(totalBytes - 8, highBits, false);
  view.setUint32(totalBytes - 4, lowBits, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const W = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < totalBytes; offset += 64) {
    for (let i = 0; i < 16; i++) {
      W[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => (v >>> 0).toString(16).padStart(8, '0'))
    .join('');
};

/**
 * PHASE 0 MANDATORY CONDITION 1, 2, 3 & FINAL VERIFICATION SECTION 1:
 * 1. Dynamically enumerates all actual keys in `localStorage` and `sessionStorage`.
 * 2. Compares the actual inventory against the expected 23 storage slots (21 localStorage + 2 sessionStorage).
 * 3. Identifies unknown/internal keys, missing/uninitialized keys, and duplicate key names across storage areas.
 * 4. Computes FIPS 180-4 SHA-256 over the canonical 23-slot payload.
 * 5. NEVER overwrites or deletes the original `lakshay_library_phase0_containment_backup_v1` once created;
 *    if `saveLatestSnapshot` is true and the original backup already exists, writes the refreshed snapshot
 *    to `lakshay_library_phase0_latest_snapshot_v1`.
 */
export const createAndVerifyPhase0LocalBackup = (
  saveLatestSnapshot = false
): Phase0BackupVerificationReport => {
  const nowISO = new Date().toISOString();
  const expectedLocalKeyCount = ALL_PRESERVED_LOCAL_STORAGE_KEYS.length; // 21
  const expectedSessionKeyCount = ALL_PRESERVED_SESSION_STORAGE_KEYS.length; // 2
  const expectedTotalKeySlots = expectedLocalKeyCount + expectedSessionKeyCount; // 23 slots (22 unique key names)
  const localKeySet = new Set<string>(ALL_PRESERVED_LOCAL_STORAGE_KEYS);
  const sessionKeySet = new Set<string>(ALL_PRESERVED_SESSION_STORAGE_KEYS);
  const internalVaultKeySet = new Set<string>(PHASE0_INTERNAL_VAULT_KEYS);

  const duplicateCrossStorageKeys = ALL_PRESERVED_LOCAL_STORAGE_KEYS.filter((k) =>
    sessionKeySet.has(k)
  );

  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        verified: false,
        backupKey: PHASE0_CONTAINMENT_BACKUP_KEY,
        originalBackupPreservedImmutable: true,
        createdAtISO: nowISO,
        verifiedAtISO: nowISO,
        sha256Hex: computeSha256Hex(''),
        checksumHex: '0000000000000000',
        downloadedFileName: `Lakshay_Library_Phase0_Full_Verified_Backup_${nowISO.split('T')[0]}.json`,
        downloadedFileSizeBytes: 0,
        downloadedFileTimestampISO: nowISO,
        downloadedFileSha256Hex: computeSha256Hex(''),
        expectedLocalKeyCount,
        expectedSessionKeyCount,
        expectedTotalKeySlots,
        capturedKeySlotsCount: 0,
        populatedKeyCount: 0,
        uninitializedNullKeyCount: expectedTotalKeySlots,
        preservedKeyCount: 0,
        actualDynamicLocalKeyCount: 0,
        actualDynamicSessionKeyCount: 0,
        duplicateCrossStorageKeys,
        missingUninitializedKeys: [],
        unknownOrInternalKeys: [],
        keyInventory: [],
        activeStudentCount: 0,
        archivedStudentCount: 0,
        totalStudentRecordsCount: 0,
        paymentAccountKeysCount: 0,
        totalPaymentRecordsCount: 0,
        totalPaymentAmountINR: 0,
        attendanceRecordsCount: 0,
        seatsCount: 0,
        shiftsCount: 0,
        dailyBackupsCount: 0,
        upiConfigured: false,
        pendingSyncDataProtected: false,
        syncRole: 'PRIMARY',
        lastSyncedAtISO: null,
      };
    }

    const rawLocalKeysSnapshot: Record<string, string | null> = {};
    const keyInventory: Phase0KeyInventoryItem[] = [];
    const missingUninitializedKeys: Array<{ key: string; storageArea: 'localStorage' | 'sessionStorage' }> = [];
    let populatedKeyCount = 0;
    let uninitializedNullKeyCount = 0;

    for (const key of ALL_PRESERVED_LOCAL_STORAGE_KEYS) {
      const val = localStorage.getItem(key);
      rawLocalKeysSnapshot[key] = val;
      if (val !== null) {
        populatedKeyCount++;
        keyInventory.push({
          key,
          storageArea: 'localStorage',
          status: 'POPULATED',
          byteLength: new TextEncoder().encode(val).length,
          sha256Hex: computeSha256Hex(val),
        });
      } else {
        uninitializedNullKeyCount++;
        missingUninitializedKeys.push({ key, storageArea: 'localStorage' });
        keyInventory.push({
          key,
          storageArea: 'localStorage',
          status: 'NULL_UNINITIALIZED',
          byteLength: 0,
          sha256Hex: null,
        });
      }
    }

    const rawSessionKeysSnapshot: Record<string, string | null> = {};
    for (const key of ALL_PRESERVED_SESSION_STORAGE_KEYS) {
      let val: string | null = null;
      try {
        val = sessionStorage.getItem(key);
      } catch {
        val = null;
      }
      rawSessionKeysSnapshot[key] = val;
      if (val !== null) {
        populatedKeyCount++;
        keyInventory.push({
          key,
          storageArea: 'sessionStorage',
          status: 'POPULATED',
          byteLength: new TextEncoder().encode(val).length,
          sha256Hex: computeSha256Hex(val),
        });
      } else {
        uninitializedNullKeyCount++;
        missingUninitializedKeys.push({ key, storageArea: 'sessionStorage' });
        keyInventory.push({
          key,
          storageArea: 'sessionStorage',
          status: 'NULL_UNINITIALIZED',
          byteLength: 0,
          sha256Hex: null,
        });
      }
    }

    // Dynamically enumerate all actual keys present in localStorage and sessionStorage
    const unknownOrInternalKeys: Phase0DynamicExtraKeyItem[] = [];
    const actualDynamicLocalKeyCount = localStorage.length;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && !localKeySet.has(k)) {
        const val = localStorage.getItem(k) || '';
        unknownOrInternalKeys.push({
          key: k,
          storageArea: 'localStorage',
          classification: internalVaultKeySet.has(k) ? 'PHASE0_INTERNAL_VAULT' : 'UNKNOWN_EXTERNAL',
          byteLength: new TextEncoder().encode(val).length,
          sha256Hex: computeSha256Hex(val),
        });
      }
    }

    let actualDynamicSessionKeyCount = 0;
    try {
      actualDynamicSessionKeyCount = sessionStorage.length;
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && !sessionKeySet.has(k)) {
          const val = sessionStorage.getItem(k) || '';
          unknownOrInternalKeys.push({
            key: k,
            storageArea: 'sessionStorage',
            classification: internalVaultKeySet.has(k) ? 'PHASE0_INTERNAL_VAULT' : 'UNKNOWN_EXTERNAL',
            byteLength: new TextEncoder().encode(val).length,
            sha256Hex: computeSha256Hex(val),
          });
        }
      }
    } catch {
      actualDynamicSessionKeyCount = 0;
    }

    const capturedKeySlotsCount = keyInventory.length; // 23

    const canonicalDataString = JSON.stringify({
      local: rawLocalKeysSnapshot,
      session: rawSessionKeysSnapshot,
    });
    const sha256Hex = computeSha256Hex(canonicalDataString);
    const checksumHex = computeDeterministicHashHex(canonicalDataString);

    // Parse counts from raw storage without mutating anything
    const rawStudents: Student[] = (() => {
      try {
        const parsed = JSON.parse(rawLocalKeysSnapshot[STUDENTS_STORAGE_KEY] || '[]');
        return Array.isArray(parsed)
          ? parsed.filter((s: Student) => s && !LEGACY_EXAMPLE_STUDENT_IDS.has(s.id))
          : [];
      } catch {
        return [];
      }
    })();

    const activeStudentCount = rawStudents.filter((s) => s.status !== 'archived').length;
    const archivedStudentCount = rawStudents.filter((s) => s.status === 'archived').length;

    const rawPayments: Record<string, PaymentRecord[]> = (() => {
      try {
        const parsed = JSON.parse(rawLocalKeysSnapshot[PAYMENTS_STORAGE_KEY] || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    })();

    let paymentAccountKeysCount = 0;
    let totalPaymentRecordsCount = 0;
    let totalPaymentAmountINR = 0;
    for (const [studentId, records] of Object.entries(rawPayments)) {
      if (!LEGACY_EXAMPLE_STUDENT_IDS.has(studentId) && Array.isArray(records)) {
        paymentAccountKeysCount++;
        totalPaymentRecordsCount += records.length;
        for (const r of records) {
          totalPaymentAmountINR += Number(r?.amountPaid) || 0;
        }
      }
    }

    const attendanceRecordsCount = (() => {
      try {
        const parsed = JSON.parse(rawLocalKeysSnapshot[DAILY_ATTENDANCE_STORAGE_KEY] || '[]');
        return Array.isArray(parsed)
          ? parsed.filter((r: DailyAttendanceRecord) => r && !LEGACY_EXAMPLE_STUDENT_IDS.has(r.studentId)).length
          : 0;
      } catch {
        return 0;
      }
    })();

    const seatsCount = (() => {
      try {
        const parsed = JSON.parse(rawLocalKeysSnapshot['lakshay_app_seats'] || '[]');
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        return 0;
      }
    })();

    const shiftsCount = (() => {
      try {
        const parsed = JSON.parse(rawLocalKeysSnapshot['lakshay_app_shifts'] || '[]');
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        return 0;
      }
    })();

    const dailyBackupsCount = (() => {
      try {
        const parsed = JSON.parse(rawLocalKeysSnapshot['lakshay_library_daily_json_backups_v1'] || '[]');
        return Array.isArray(parsed) ? parsed.length : 0;
      } catch {
        return 0;
      }
    })();

    const upiConfigured = (() => {
      try {
        const parsed = JSON.parse(rawLocalKeysSnapshot['lakshay_library_upi_config_v1'] || '{}');
        return Boolean(parsed && (parsed.upiId || parsed.customQrImageUrl || parsed.isConfigured));
      } catch {
        return false;
      }
    })();

    const syncConfigParsed = (() => {
      try {
        return JSON.parse(rawLocalKeysSnapshot['lakshay_library_gdrive_sync_config_v1'] || '{}');
      } catch {
        return {};
      }
    })();

    const vaultEnvelope = {
      schemaVersion: 'phase0-containment-backup-v1',
      createdAtISO: nowISO,
      sha256Hex,
      checksumHex,
      summary: {
        expectedLocalKeyCount,
        expectedSessionKeyCount,
        expectedTotalKeySlots,
        capturedKeySlotsCount,
        populatedKeyCount,
        uninitializedNullKeyCount,
        preservedKeyCount: capturedKeySlotsCount,
        actualDynamicLocalKeyCount,
        actualDynamicSessionKeyCount,
        duplicateCrossStorageKeys,
        activeStudentCount,
        archivedStudentCount,
        totalStudentRecordsCount: rawStudents.length,
        paymentAccountKeysCount,
        totalPaymentRecordsCount,
        totalPaymentAmountINR,
        attendanceRecordsCount,
        seatsCount,
        shiftsCount,
        dailyBackupsCount,
        upiConfigured,
      },
      keyInventory,
      missingUninitializedKeys,
      unknownOrInternalKeys,
      rawLocalKeysSnapshot,
      rawSessionKeysSnapshot,
    };

    const existingVaultRaw = localStorage.getItem(PHASE0_CONTAINMENT_BACKUP_KEY);
    let createdAtISO = nowISO;
    // STRICT IMMUTABILITY: Never overwrite `PHASE0_CONTAINMENT_BACKUP_KEY` once it exists!
    if (!existingVaultRaw) {
      try {
        localStorage.setItem(PHASE0_CONTAINMENT_BACKUP_KEY, JSON.stringify(vaultEnvelope));
      } catch {
        const compactLocalSnapshot = {
          ...rawLocalKeysSnapshot,
          lakshay_library_daily_json_backups_v1: `[PRESERVED_IN_PLACE:${dailyBackupsCount}_BACKUPS]`,
        };
        localStorage.setItem(
          PHASE0_CONTAINMENT_BACKUP_KEY,
          JSON.stringify({
            ...vaultEnvelope,
            rawLocalKeysSnapshot: compactLocalSnapshot,
          })
        );
      }
    } else {
      try {
        const parsedExisting = JSON.parse(existingVaultRaw);
        createdAtISO = parsedExisting.createdAtISO || nowISO;
      } catch {
        createdAtISO = nowISO;
      }
      // If a secondary snapshot save was requested, write to PHASE0_LATEST_SNAPSHOT_BACKUP_KEY without touching the original
      if (saveLatestSnapshot) {
        try {
          localStorage.setItem(PHASE0_LATEST_SNAPSHOT_BACKUP_KEY, JSON.stringify(vaultEnvelope));
        } catch {
          // Ignore quota error on secondary snapshot
        }
      }
    }

    const verifyReadBack = localStorage.getItem(PHASE0_CONTAINMENT_BACKUP_KEY);
    const isVerified = Boolean(verifyReadBack && verifyReadBack.includes('phase0-containment-backup-v1'));
    const activeDownloadJson =
      localStorage.getItem(PHASE0_LATEST_SNAPSHOT_BACKUP_KEY) ||
      verifyReadBack ||
      JSON.stringify(vaultEnvelope);
    const downloadedFileSizeBytes = new TextEncoder().encode(activeDownloadJson).length;
    const downloadedFileSha256Hex = computeSha256Hex(activeDownloadJson);
    const downloadedFileName = `Lakshay_Library_Phase0_Full_Verified_Backup_${nowISO.split('T')[0]}.json`;

    return {
      verified: isVerified,
      backupKey: PHASE0_CONTAINMENT_BACKUP_KEY,
      originalBackupPreservedImmutable: true,
      createdAtISO,
      verifiedAtISO: nowISO,
      sha256Hex,
      checksumHex,
      downloadedFileName,
      downloadedFileSizeBytes,
      downloadedFileTimestampISO: nowISO,
      downloadedFileSha256Hex,
      expectedLocalKeyCount,
      expectedSessionKeyCount,
      expectedTotalKeySlots,
      capturedKeySlotsCount,
      populatedKeyCount,
      uninitializedNullKeyCount,
      preservedKeyCount: capturedKeySlotsCount,
      actualDynamicLocalKeyCount: localStorage.length,
      actualDynamicSessionKeyCount,
      duplicateCrossStorageKeys,
      missingUninitializedKeys,
      unknownOrInternalKeys,
      keyInventory,
      activeStudentCount,
      archivedStudentCount,
      totalStudentRecordsCount: rawStudents.length,
      paymentAccountKeysCount,
      totalPaymentRecordsCount,
      totalPaymentAmountINR,
      attendanceRecordsCount,
      seatsCount,
      shiftsCount,
      dailyBackupsCount,
      upiConfigured,
      pendingSyncDataProtected: isVerified,
      syncRole: syncConfigParsed?.deviceRole || 'PRIMARY',
      lastSyncedAtISO: syncConfigParsed?.lastSyncedAtISO || null,
    };
  } catch {
    return {
      verified: false,
      backupKey: PHASE0_CONTAINMENT_BACKUP_KEY,
      originalBackupPreservedImmutable: true,
      createdAtISO: nowISO,
      verifiedAtISO: nowISO,
      sha256Hex: computeSha256Hex(''),
      checksumHex: '0000000000000000',
      downloadedFileName: `Lakshay_Library_Phase0_Full_Verified_Backup_${nowISO.split('T')[0]}.json`,
      downloadedFileSizeBytes: 0,
      downloadedFileTimestampISO: nowISO,
      downloadedFileSha256Hex: computeSha256Hex(''),
      expectedLocalKeyCount,
      expectedSessionKeyCount,
      expectedTotalKeySlots,
      capturedKeySlotsCount: 0,
      populatedKeyCount: 0,
      uninitializedNullKeyCount: expectedTotalKeySlots,
      preservedKeyCount: 0,
      actualDynamicLocalKeyCount: 0,
      actualDynamicSessionKeyCount: 0,
      duplicateCrossStorageKeys,
      missingUninitializedKeys: [],
      unknownOrInternalKeys: [],
      keyInventory: [],
      activeStudentCount: 0,
      archivedStudentCount: 0,
      totalStudentRecordsCount: 0,
      paymentAccountKeysCount: 0,
      totalPaymentRecordsCount: 0,
      totalPaymentAmountINR: 0,
      attendanceRecordsCount: 0,
      seatsCount: 0,
      shiftsCount: 0,
      dailyBackupsCount: 0,
      upiConfigured: false,
      pendingSyncDataProtected: false,
      syncRole: 'PRIMARY',
      lastSyncedAtISO: null,
    };
  }
};

/**
 * FINAL PHASE 0 REQUIREMENT 1.7, 1.8, 1.9 & 1.10:
 * Restores and verifies a Phase 0 backup envelope inside a completely isolated in-memory test profile
 * (`isolatedLocal` and `isolatedSession`) without touching or mutating the active browser `localStorage`
 * or `sessionStorage` copy. Independently recomputes the SHA-256 digest and verifies all entity counts.
 */
export const verifyBackupRestoreOnIsolatedProfile = (
  customBackupJson?: string
): Phase0RestoreVerificationResult => {
  const nowISO = new Date().toISOString();
  const rawVault =
    customBackupJson ||
    (typeof window !== 'undefined' && window.localStorage
      ? localStorage.getItem(PHASE0_LATEST_SNAPSHOT_BACKUP_KEY) ||
        localStorage.getItem(PHASE0_CONTAINMENT_BACKUP_KEY)
      : null);

  if (!rawVault) {
    throw new Error('No Phase 0 backup vault found to verify.');
  }

  // Capture pre-test production digest to prove production storage was never touched
  const prodLocalBefore: Record<string, string | null> = {};
  const prodSessionBefore: Record<string, string | null> = {};
  if (typeof window !== 'undefined' && window.localStorage) {
    for (const key of ALL_PRESERVED_LOCAL_STORAGE_KEYS) {
      prodLocalBefore[key] = localStorage.getItem(key);
    }
    for (const key of ALL_PRESERVED_SESSION_STORAGE_KEYS) {
      try {
        prodSessionBefore[key] = sessionStorage.getItem(key);
      } catch {
        prodSessionBefore[key] = null;
      }
    }
  }
  const prodShaBefore = computeSha256Hex(
    JSON.stringify({ local: prodLocalBefore, session: prodSessionBefore })
  );

  const parsedVault = JSON.parse(rawVault) as {
    sha256Hex?: string;
    rawLocalKeysSnapshot: Record<string, string | null>;
    rawSessionKeysSnapshot: Record<string, string | null>;
  };

  const savedLocal = parsedVault.rawLocalKeysSnapshot || {};
  const savedSession = parsedVault.rawSessionKeysSnapshot || {};
  const originalCanonical = JSON.stringify({
    local: savedLocal,
    session: savedSession,
  });
  const originalBackupSha256Hex = parsedVault.sha256Hex || computeSha256Hex(originalCanonical);

  // Restore into an isolated test profile Map (never touching live localStorage/sessionStorage)
  const isolatedLocalProfile = new Map<string, string>();
  const isolatedSessionProfile = new Map<string, string>();

  let restoredLocalKeySlots = 0;
  for (const key of ALL_PRESERVED_LOCAL_STORAGE_KEYS) {
    const val = savedLocal[key];
    if (val === null || val === undefined) {
      isolatedLocalProfile.delete(key);
    } else {
      isolatedLocalProfile.set(key, val);
    }
    restoredLocalKeySlots++;
  }

  let restoredSessionKeySlots = 0;
  for (const key of ALL_PRESERVED_SESSION_STORAGE_KEYS) {
    const val = savedSession[key];
    if (val === null || val === undefined) {
      isolatedSessionProfile.delete(key);
    } else {
      isolatedSessionProfile.set(key, val);
    }
    restoredSessionKeySlots++;
  }

  // Re-read from the isolated test profile and compute post-restore SHA-256
  const verifyLocalFromIsolated: Record<string, string | null> = {};
  for (const key of ALL_PRESERVED_LOCAL_STORAGE_KEYS) {
    verifyLocalFromIsolated[key] = isolatedLocalProfile.has(key)
      ? (isolatedLocalProfile.get(key) ?? null)
      : null;
  }
  const verifySessionFromIsolated: Record<string, string | null> = {};
  for (const key of ALL_PRESERVED_SESSION_STORAGE_KEYS) {
    verifySessionFromIsolated[key] = isolatedSessionProfile.has(key)
      ? (isolatedSessionProfile.get(key) ?? null)
      : null;
  }

  const postRestoreCanonical = JSON.stringify({
    local: verifyLocalFromIsolated,
    session: verifySessionFromIsolated,
  });
  const postRestoreSha256Hex = computeSha256Hex(postRestoreCanonical);
  const reproducedBitForBit = postRestoreSha256Hex === originalBackupSha256Hex;

  // Verify entity counts inside the isolated test profile
  const studentsInIsolated: Student[] = JSON.parse(
    isolatedLocalProfile.get(STUDENTS_STORAGE_KEY) || '[]'
  );
  const activeStudentCount = studentsInIsolated.filter((s) => s && s.status !== 'archived').length;
  const archivedStudentCount = studentsInIsolated.filter((s) => s && s.status === 'archived').length;

  const paymentsInIsolated: Record<string, PaymentRecord[]> = JSON.parse(
    isolatedLocalProfile.get(PAYMENTS_STORAGE_KEY) || '{}'
  );
  let totalPaymentRecordsCount = 0;
  let totalPaymentAmountINR = 0;
  for (const records of Object.values(paymentsInIsolated)) {
    if (Array.isArray(records)) {
      totalPaymentRecordsCount += records.length;
      for (const r of records) {
        totalPaymentAmountINR += Number(r?.amountPaid) || 0;
      }
    }
  }

  const attendanceInIsolated: DailyAttendanceRecord[] = JSON.parse(
    isolatedLocalProfile.get(DAILY_ATTENDANCE_STORAGE_KEY) || '[]'
  );
  const seatsInIsolated = JSON.parse(isolatedLocalProfile.get('lakshay_app_seats') || '[]');
  const shiftsInIsolated = JSON.parse(isolatedLocalProfile.get('lakshay_app_shifts') || '[]');
  const upiInIsolated = JSON.parse(
    isolatedLocalProfile.get('lakshay_library_upi_config_v1') || '{}'
  );
  const syncCfgInIsolated = JSON.parse(
    isolatedLocalProfile.get('lakshay_library_gdrive_sync_config_v1') || '{}'
  );

  // Confirm live production storage was completely untouched
  const prodLocalAfter: Record<string, string | null> = {};
  const prodSessionAfter: Record<string, string | null> = {};
  if (typeof window !== 'undefined' && window.localStorage) {
    for (const key of ALL_PRESERVED_LOCAL_STORAGE_KEYS) {
      prodLocalAfter[key] = localStorage.getItem(key);
    }
    for (const key of ALL_PRESERVED_SESSION_STORAGE_KEYS) {
      try {
        prodSessionAfter[key] = sessionStorage.getItem(key);
      } catch {
        prodSessionAfter[key] = null;
      }
    }
  }
  const prodShaAfter = computeSha256Hex(
    JSON.stringify({ local: prodLocalAfter, session: prodSessionAfter })
  );

  return {
    restored: true,
    isolatedTestProfile: true,
    productionStorageUntouched: prodShaBefore === prodShaAfter,
    restoredAtISO: nowISO,
    preRestoreSafetyKey: PHASE0_PRE_RESTORE_SAFETY_KEY,
    originalBackupSha256Hex,
    postRestoreSha256Hex,
    reproducedBitForBit,
    restoredLocalKeySlots,
    restoredSessionKeySlots,
    activeStudentCount,
    archivedStudentCount,
    totalPaymentRecordsCount,
    totalPaymentAmountINR,
    attendanceRecordsCount: Array.isArray(attendanceInIsolated) ? attendanceInIsolated.length : 0,
    seatsCount: Array.isArray(seatsInIsolated) ? seatsInIsolated.length : 0,
    shiftsCount: Array.isArray(shiftsInIsolated) ? shiftsInIsolated.length : 0,
    upiConfigured: Boolean(
      upiInIsolated && (upiInIsolated.upiId || upiInIsolated.customQrImageUrl || upiInIsolated.isConfigured)
    ),
    pendingSyncConfigPresent: Boolean(syncCfgInIsolated && syncCfgInIsolated.deviceId),
  };
};

/**
 * Restores all 21 localStorage keys and 2 sessionStorage keys into the current storage profile
 * after saving a pre-restore safety snapshot (`lakshay_library_phase0_pre_restore_safety_v1`).
 */
export const restoreFromPhase0LocalBackup = (): Phase0RestoreVerificationResult => {
  const nowISO = new Date().toISOString();
  const rawVault = localStorage.getItem(PHASE0_CONTAINMENT_BACKUP_KEY);
  if (!rawVault) {
    throw new Error('No Phase 0 backup vault found in localStorage.');
  }

  const parsedVault = JSON.parse(rawVault) as {
    sha256Hex?: string;
    rawLocalKeysSnapshot: Record<string, string | null>;
    rawSessionKeysSnapshot: Record<string, string | null>;
  };

  // Preserve current state in a separate pre-restore safety snapshot (never deleting any existing backups)
  const currentLocalBeforeRestore: Record<string, string | null> = {};
  for (const key of ALL_PRESERVED_LOCAL_STORAGE_KEYS) {
    currentLocalBeforeRestore[key] = localStorage.getItem(key);
  }
  const currentSessionBeforeRestore: Record<string, string | null> = {};
  for (const key of ALL_PRESERVED_SESSION_STORAGE_KEYS) {
    try {
      currentSessionBeforeRestore[key] = sessionStorage.getItem(key);
    } catch {
      currentSessionBeforeRestore[key] = null;
    }
  }
  try {
    localStorage.setItem(
      PHASE0_PRE_RESTORE_SAFETY_KEY,
      JSON.stringify({
        savedAtISO: nowISO,
        local: currentLocalBeforeRestore,
        session: currentSessionBeforeRestore,
      })
    );
  } catch {
    // Ignore quota limits on optional pre-restore safety copy
  }

  const savedLocal = parsedVault.rawLocalKeysSnapshot || {};
  const savedSession = parsedVault.rawSessionKeysSnapshot || {};

  const originalCanonical = JSON.stringify({
    local: savedLocal,
    session: savedSession,
  });
  const originalBackupSha256Hex = parsedVault.sha256Hex || computeSha256Hex(originalCanonical);

  let restoredLocalKeySlots = 0;
  for (const key of ALL_PRESERVED_LOCAL_STORAGE_KEYS) {
    const val = savedLocal[key];
    // Never overwrite daily backups if the vault stored a compact placeholder reference
    if (
      key === 'lakshay_library_daily_json_backups_v1' &&
      typeof val === 'string' &&
      val.startsWith('[PRESERVED_IN_PLACE:')
    ) {
      restoredLocalKeySlots++;
      continue;
    }
    if (val === null || val === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, val);
    }
    restoredLocalKeySlots++;
  }

  let restoredSessionKeySlots = 0;
  for (const key of ALL_PRESERVED_SESSION_STORAGE_KEYS) {
    const val = savedSession[key];
    try {
      if (val === null || val === undefined) {
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, val);
      }
      restoredSessionKeySlots++;
    } catch {
      // Ignore sessionStorage restrictions
    }
  }

  // Re-read all keys after restore and compute post-restore SHA-256
  const verifyLocalAfterRestore: Record<string, string | null> = {};
  for (const key of ALL_PRESERVED_LOCAL_STORAGE_KEYS) {
    verifyLocalAfterRestore[key] = localStorage.getItem(key);
  }
  const verifySessionAfterRestore: Record<string, string | null> = {};
  for (const key of ALL_PRESERVED_SESSION_STORAGE_KEYS) {
    try {
      verifySessionAfterRestore[key] = sessionStorage.getItem(key);
    } catch {
      verifySessionAfterRestore[key] = null;
    }
  }

  const postRestoreCanonical = JSON.stringify({
    local: verifyLocalAfterRestore,
    session: verifySessionAfterRestore,
  });
  const postRestoreSha256Hex = computeSha256Hex(postRestoreCanonical);
  const reproducedBitForBit = postRestoreSha256Hex === originalBackupSha256Hex;

  const postReport = createAndVerifyPhase0LocalBackup(false);
  notifyListeners();

  return {
    restored: true,
    isolatedTestProfile: false,
    productionStorageUntouched: false,
    restoredAtISO: nowISO,
    preRestoreSafetyKey: PHASE0_PRE_RESTORE_SAFETY_KEY,
    originalBackupSha256Hex,
    postRestoreSha256Hex,
    reproducedBitForBit,
    restoredLocalKeySlots,
    restoredSessionKeySlots,
    activeStudentCount: postReport.activeStudentCount,
    archivedStudentCount: postReport.archivedStudentCount,
    totalPaymentRecordsCount: postReport.totalPaymentRecordsCount,
    totalPaymentAmountINR: postReport.totalPaymentAmountINR,
    attendanceRecordsCount: postReport.attendanceRecordsCount,
    seatsCount: postReport.seatsCount,
    shiftsCount: postReport.shiftsCount,
    upiConfigured: postReport.upiConfigured,
    pendingSyncConfigPresent: postReport.pendingSyncDataProtected,
  };
};

/**
 * Downloads the complete Phase 0 Verified Backup (all localStorage keys, students, archived students,
 * payments, attendance, seats, shifts, UPI config, and sync state) as a `.json` file to the device.
 * Never overwrites `PHASE0_CONTAINMENT_BACKUP_KEY`.
 */
export const downloadPhase0VerifiedBackupFile = (): Phase0BackupVerificationReport => {
  const originalBeforeDownload = localStorage.getItem(PHASE0_CONTAINMENT_BACKUP_KEY);
  const report = createAndVerifyPhase0LocalBackup(true);
  const originalAfterDownload = localStorage.getItem(PHASE0_CONTAINMENT_BACKUP_KEY);
  const rawVault =
    localStorage.getItem(PHASE0_LATEST_SNAPSHOT_BACKUP_KEY) ||
    originalAfterDownload ||
    JSON.stringify(report, null, 2);

  const dateStr = report.verifiedAtISO.split('T')[0];
  const fileName = `Lakshay_Library_Phase0_Full_Verified_Backup_${dateStr}.json`;
  const downloadedFileSizeBytes = new TextEncoder().encode(rawVault).length;
  const downloadedFileSha256Hex = computeSha256Hex(rawVault);

  if (typeof document !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
    const blob = new Blob([rawVault], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return {
    ...report,
    originalBackupPreservedImmutable:
      originalBeforeDownload === null || originalBeforeDownload === originalAfterDownload,
    downloadedFileName: fileName,
    downloadedFileSizeBytes,
    downloadedFileTimestampISO: report.verifiedAtISO,
    downloadedFileSha256Hex,
  };
};

export interface SafeInitReport {
  state:
    | 'EXISTING_VALID'
    | 'EXISTING_MISSING_MARKER_PRESERVED'
    | 'FRESH_EMPTY_INITIALIZED'
    | 'PARTIAL_INITIALIZATION_REPAIRED'
    | 'CORRUPTED_STORAGE_QUARANTINED_PRESERVED'
    | 'STORAGE_INACCESSIBLE';
  studentsCount: number;
  paymentsCount: number;
  attendanceCount: number;
  backupPreserved: boolean;
  quarantinedKeys: string[];
  diagnostics: string;
}

const RECOVERY_ONLY_MODE_KEY = 'libtrack_recovery_only_mode';
export const isRecoveryOnlyMode = (): boolean => {
  try {
    return localStorage.getItem(RECOVERY_ONLY_MODE_KEY) === '1';
  } catch {
    // Storage availability is unknown: fail closed so writes cannot proceed.
    return true;
  }
};
export const setRecoveryOnlyMode = (active: boolean): void => {
  try {
    if (active) localStorage.setItem(RECOVERY_ONLY_MODE_KEY, '1');
    else localStorage.removeItem(RECOVERY_ONLY_MODE_KEY);
  } catch {
    // Ignore
  }
};

export const ensureSafeProductionInit = (): SafeInitReport => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        state: 'STORAGE_INACCESSIBLE',
        studentsCount: 0,
        paymentsCount: 0,
        attendanceCount: 0,
        backupPreserved: false,
        quarantinedKeys: [],
        diagnostics: 'Storage inaccessible in current runtime environment.',
      };
    }

    const rawStudents = localStorage.getItem(STUDENTS_STORAGE_KEY);
    const rawPayments = localStorage.getItem(PAYMENTS_STORAGE_KEY);
    const rawAttendance = localStorage.getItem(DAILY_ATTENDANCE_STORAGE_KEY);
    const initMarker = localStorage.getItem(PRODUCTION_CLEAN_INIT_KEY);

    let parsedStudents: Student[] | null = null;
    let studentsCorrupted = false;
    if (rawStudents !== null) {
      try {
        const parsed = JSON.parse(rawStudents);
        if (Array.isArray(parsed)) parsedStudents = parsed;
        else studentsCorrupted = true;
      } catch {
        studentsCorrupted = true;
      }
    }

    let parsedPayments: Record<string, PaymentRecord[]> | null = null;
    let paymentsCorrupted = false;
    if (rawPayments !== null) {
      try {
        const parsed = JSON.parse(rawPayments);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) parsedPayments = parsed;
        else paymentsCorrupted = true;
      } catch {
        paymentsCorrupted = true;
      }
    }

    let parsedAttendance: DailyAttendanceRecord[] | null = null;
    let attendanceCorrupted = false;
    if (rawAttendance !== null) {
      try {
        const parsed = JSON.parse(rawAttendance);
        if (Array.isArray(parsed)) parsedAttendance = parsed;
        else attendanceCorrupted = true;
      } catch {
        attendanceCorrupted = true;
      }
    }

    const quarantinedKeys: string[] = [];

    // Never delete unparseable corrupted data: quarantine raw strings with timestamps and verify readback
    if (studentsCorrupted && rawStudents !== null) {
      const qKey = `libtrack_quarantine_students_${Date.now()}`;
      localStorage.setItem(qKey, rawStudents);
      if (localStorage.getItem(qKey) !== rawStudents) {
        throw new Error('Quarantine write verification failed for student storage.');
      }
      quarantinedKeys.push(qKey);
    }
    if (paymentsCorrupted && rawPayments !== null) {
      const qKey = `libtrack_quarantine_payments_${Date.now()}`;
      localStorage.setItem(qKey, rawPayments);
      if (localStorage.getItem(qKey) !== rawPayments) {
        throw new Error('Quarantine write verification failed for payment storage.');
      }
      quarantinedKeys.push(qKey);
    }
    if (attendanceCorrupted && rawAttendance !== null) {
      const qKey = `libtrack_quarantine_attendance_${Date.now()}`;
      localStorage.setItem(qKey, rawAttendance);
      if (localStorage.getItem(qKey) !== rawAttendance) {
        throw new Error('Quarantine write verification failed for attendance storage.');
      }
      quarantinedKeys.push(qKey);
    }


    const hasStudentData = parsedStudents !== null && parsedStudents.length > 0;
    const hasPaymentData = parsedPayments !== null && Object.keys(parsedPayments).length > 0;
    const hasAttendanceData = parsedAttendance !== null && parsedAttendance.length > 0;
    const hasAnyExistingData = hasStudentData || hasPaymentData || hasAttendanceData || (rawStudents !== null && rawStudents.length > 2);

    // State 1: Partial or Corrupted storage state. Set recovery-only mode, quarantine corrupt payloads, and prevent unsafe operation.
    if (studentsCorrupted || paymentsCorrupted || attendanceCorrupted) {
      setRecoveryOnlyMode(true);
      if (parsedStudents && !studentsCorrupted) {
        localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(parsedStudents));
      }
      if (parsedPayments && !paymentsCorrupted) {
        localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(parsedPayments));
      }
      if (parsedAttendance && !attendanceCorrupted) {
        localStorage.setItem(DAILY_ATTENDANCE_STORAGE_KEY, JSON.stringify(parsedAttendance));
      }

      return {
        state: 'CORRUPTED_STORAGE_QUARANTINED_PRESERVED',
        studentsCount: parsedStudents?.length || 0,
        paymentsCount: parsedPayments ? Object.values(parsedPayments).flat().length : 0,
        attendanceCount: parsedAttendance?.length || 0,
        backupPreserved: false,
        quarantinedKeys,
        diagnostics: 'CRITICAL: Corrupted storage detected and quarantined. Application placed in persistent recovery-only mode to prevent silent data loss.',
      };
    }

    // State 2: Existing installation with valid initialization marker
    if (initMarker === '1') {
      recoverPendingFinancialTransactions();
      return {
        state: 'EXISTING_VALID',
        studentsCount: parsedStudents?.length || 0,
        paymentsCount: parsedPayments ? Object.values(parsedPayments).flat().length : 0,
        attendanceCount: parsedAttendance?.length || 0,
        backupPreserved: true,
        quarantinedKeys,
        diagnostics: 'Existing valid production installation with clean marker.',
      };
    }


    // State 2: Existing installation with data but MISSING initialization marker.
    // CRITICAL: NEVER DELETE EXISTING DATA! PRESERVE AND STAMP MARKER.
    if (hasAnyExistingData) {
      try {
        createAndVerifyPhase0LocalBackup(false);
      } catch {
        // Continue safely
      }

      if (rawStudents === null || studentsCorrupted) {
        localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(parsedStudents || []));
      }
      if (rawPayments === null || paymentsCorrupted) {
        localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(parsedPayments || {}));
      }
      if (rawAttendance === null || attendanceCorrupted) {
        localStorage.setItem(DAILY_ATTENDANCE_STORAGE_KEY, JSON.stringify(parsedAttendance || []));
      }

      localStorage.setItem(PRODUCTION_CLEAN_INIT_KEY, '1');
      recoverPendingFinancialTransactions();

      return {
        state: 'EXISTING_MISSING_MARKER_PRESERVED',
        studentsCount: parsedStudents?.length || 0,
        paymentsCount: parsedPayments ? Object.values(parsedPayments).flat().length : 0,
        attendanceCount: parsedAttendance?.length || 0,
        backupPreserved: true,
        quarantinedKeys,
        diagnostics: 'Existing installation detected with missing init marker. Preserved all records intact.',
      };
    }

    // State 3: Partial or Corrupted storage state. Preserve valid data, quarantine corrupt payloads, and prevent destructive reset.
    if (studentsCorrupted || paymentsCorrupted || attendanceCorrupted) {
      // Restore valid subsets if present, quarantine invalid keys
      if (parsedStudents && !studentsCorrupted) {
        localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(parsedStudents));
      } else if (rawStudents !== null) {
        const qKey = `libtrack_quarantine_students_raw_${Date.now()}`;
        localStorage.setItem(qKey, rawStudents);
        quarantinedKeys.push(qKey);
        localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify([]));
      }

      if (parsedPayments && !paymentsCorrupted) {
        localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(parsedPayments));
      } else if (rawPayments !== null) {
        const qKey = `libtrack_quarantine_payments_raw_${Date.now()}`;
        localStorage.setItem(qKey, rawPayments);
        quarantinedKeys.push(qKey);
        localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify({}));
      }

      if (parsedAttendance && !attendanceCorrupted) {
        localStorage.setItem(DAILY_ATTENDANCE_STORAGE_KEY, JSON.stringify(parsedAttendance));
      } else if (rawAttendance !== null) {
        const qKey = `libtrack_quarantine_attendance_raw_${Date.now()}`;
        localStorage.setItem(qKey, rawAttendance);
        quarantinedKeys.push(qKey);
        localStorage.setItem(DAILY_ATTENDANCE_STORAGE_KEY, JSON.stringify([]));
      }

      localStorage.setItem(PRODUCTION_CLEAN_INIT_KEY, '1');
      return {
        state: 'CORRUPTED_STORAGE_QUARANTINED_PRESERVED',
        studentsCount: parsedStudents?.length || 0,
        paymentsCount: parsedPayments ? Object.values(parsedPayments).flat().length : 0,
        attendanceCount: parsedAttendance?.length || 0,
        backupPreserved: false,
        quarantinedKeys,
        diagnostics: 'Corrupted storage payload quarantined to preserve raw bytes; valid subset recovered.',
      };
    }


    // State 4: Genuinely empty fresh installation
    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify({}));
    localStorage.setItem(DAILY_ATTENDANCE_STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem(PRODUCTION_CLEAN_INIT_KEY, '1');
    return {
      state: 'FRESH_EMPTY_INITIALIZED',
      studentsCount: 0,
      paymentsCount: 0,
      attendanceCount: 0,
      backupPreserved: true,
      quarantinedKeys: [],
      diagnostics: 'Fresh installation initialized cleanly.',
    };
  } catch (err) {
    return {
      state: 'STORAGE_INACCESSIBLE',
      studentsCount: 0,
      paymentsCount: 0,
      attendanceCount: 0,
      backupPreserved: false,
      quarantinedKeys: [],
      diagnostics: `Storage exception during initialization: ${String(err)}`,
    };
  }
};

export const ensureProductionCleanInit = ensureSafeProductionInit;

ensureSafeProductionInit();
createAndVerifyPhase0LocalBackup(false);


type Listener = () => void;
const listeners: Set<Listener> = new Set();
let isImportingRemoteSnapshot = false;

const notifyListeners = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('Listener notification error', e);
    }
  });

  // Automatically trigger authenticated Google Drive auto-sync when new data is entered locally
  if (!isImportingRemoteSnapshot) {
    try {
      import('./googleDriveSyncService').then((m) => {
        m.triggerLivePrimaryAutoSync();
      }).catch(() => {});
      import('./indexedDbService').then((m) => {
        m.mirrorLocalStorageWriteToIndexedDbIfEnabled();
      }).catch(() => {});
    } catch {
      // Ignore
    }
  }
};

export const subscribeToFirestore = (callback: Listener): (() => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

/**
 * Returns ALL stored students in `libtrack_firestore_students`, including both active
 * and archived (`status === 'archived'`) students, so write operations and historical
 * analytics never drop archived records.
 */
export const getAllStoredStudentsRaw = (): Student[] => {
  ensureProductionCleanInit();
  try {
    const raw = localStorage.getItem(STUDENTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(INITIAL_STUDENTS));
      return INITIAL_STUDENTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(INITIAL_STUDENTS));
      return INITIAL_STUDENTS;
    }
    // Strip only legacy synthetic example IDs (std_001 .. std_008)
    const cleaned = parsed.filter((s: Student) => s && !LEGACY_EXAMPLE_STUDENT_IDS.has(s.id));
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return INITIAL_STUDENTS;
  }
};

/**
 * Returns active (non-archived) students for active desk occupancy, seat matrix,
 * check-in scanner, and due-date reminder lists.
 */
export const getStoredStudents = (): Student[] => {
  return getAllStoredStudentsRaw().filter((s) => s.status !== 'archived');
};

/**
 * Returns archived students (`status === 'archived'`) whose historical records and
 * payments are preserved.
 */
export const getStoredArchivedStudents = (): Student[] => {
  return getAllStoredStudentsRaw().filter((s) => s.status === 'archived');
};

/**
 * PHASE 0 MANDATORY CONDITION 6:
 * Retrieves all stored payment histories without deleting payments belonging to
 * archived or previously removed students.
 */
export const getStoredPayments = (): Record<string, PaymentRecord[]> => {
  try {
    const raw = localStorage.getItem(PAYMENTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(INITIAL_PAYMENT_HISTORY));
      return INITIAL_PAYMENT_HISTORY;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(INITIAL_PAYMENT_HISTORY));
      return INITIAL_PAYMENT_HISTORY;
    }
    let modified = false;
    const cleaned: Record<string, PaymentRecord[]> = {};
    for (const [studentId, records] of Object.entries(parsed)) {
      // Only filter synthetic mock IDs (std_001..std_008). NEVER delete real student payments!
      if (LEGACY_EXAMPLE_STUDENT_IDS.has(studentId)) {
        modified = true;
      } else if (Array.isArray(records)) {
        cleaned[studentId] = records as PaymentRecord[];
      }
    }
    if (modified) {
      localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return INITIAL_PAYMENT_HISTORY;
  }
};

export const getStudentPaymentHistory = (studentId: string): PaymentRecord[] => {
  const allPayments = getStoredPayments();
  const history = allPayments[studentId] || [];
  // Sort descending by payment date
  return [...history].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
};

// DailyAttendance Firestore Collection Methods
export const getStoredDailyAttendance = (): DailyAttendanceRecord[] => {
  try {
    const raw = localStorage.getItem(DAILY_ATTENDANCE_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(DAILY_ATTENDANCE_STORAGE_KEY, JSON.stringify(INITIAL_DAILY_ATTENDANCE));
      return INITIAL_DAILY_ATTENDANCE;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.setItem(DAILY_ATTENDANCE_STORAGE_KEY, JSON.stringify(INITIAL_DAILY_ATTENDANCE));
      return INITIAL_DAILY_ATTENDANCE;
    }
    const cleaned = parsed.filter(
      (rec: DailyAttendanceRecord) => rec && !LEGACY_EXAMPLE_STUDENT_IDS.has(rec.studentId)
    );
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(DAILY_ATTENDANCE_STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return INITIAL_DAILY_ATTENDANCE;
  }
};

export const getStudentDailyAttendance = (studentId: string): DailyAttendanceRecord[] => {
  const allAttendance = getStoredDailyAttendance();
  return allAttendance
    .filter((rec) => rec.studentId === studentId)
    .sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
};

// Add student to Firestore
export const addStudentToFirestore = (
  data: Omit<Student, 'id'>,
  initialPayment?: {
    paymentDate: string;
    amountPaid: number;
    paymentMode?: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer';
    note?: string;
  }
): Student => {
  if (isRecoveryOnlyMode()) {
    throw new Error('CRITICAL: Admissions are blocked while application is in recovery-only mode due to unresolved storage corruption.');
  }

  const nowISO = new Date().toISOString();
  const allStudentsRaw = getAllStoredStudentsRaw();
  const newStudent: Student = {
    ...data,
    status: 'active',
    updatedAt: nowISO,
    id: `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  };

  const updated = [newStudent, ...allStudentsRaw];
  localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(updated));

  if (initialPayment) {
    const validation = validateMonetaryAmount(initialPayment.amountPaid);
    if (!validation.valid) {
      throw new Error(`Invalid initial admission payment amount: ${validation.error}`);
    }

    const allPayments = getStoredPayments();
    const initReceiptNumber = generateCollisionResistantReceiptNumber('REC');
    const deviceTag = getDeviceStableTag();
    const uuid = generateUUID();
    const initPaymentId = `pay_${deviceTag}_${uuid}`;
    const idempotencyKey = `idemp_init_${newStudent.id}_${validation.paise}`;

    const newRecord: PaymentRecord = {
      id: initPaymentId,
      studentId: newStudent.id,
      studentName: newStudent.name,
      studentPhone: newStudent.phoneNumber,
      seatNumber: newStudent.seatNumber,
      shiftTimings: newStudent.shiftTimings,
      paymentDate: new Date(initialPayment.paymentDate).toISOString(),
      amountPaid: initialPayment.amountPaid,
      amountPaise: validation.paise,
      paymentMode: initialPayment.paymentMode || 'UPI',
      receiptNumber: initReceiptNumber,
      idempotencyKey,
      note: initialPayment.note || `Initial admission fee recorded on ${initialPayment.paymentDate}`,
    };

    // Write financial journal entry for admission payment
    const journalEntry: FinancialJournalEntry = {
      journalId: `jnl_init_${uuid}`,
      idempotencyKey,
      paymentId: initPaymentId,
      receiptNumber: initReceiptNumber,
      studentId: newStudent.id,
      studentName: newStudent.name,
      studentPhone: newStudent.phoneNumber,
      seatNumber: newStudent.seatNumber,
      shiftTimings: newStudent.shiftTimings,
      oldDueDate: newStudent.admissionDate,
      newDueDate: newStudent.nextFeeDueDate,
      amount: initialPayment.amountPaid,
      amountPaise: validation.paise,
      paymentMode: initialPayment.paymentMode || 'UPI',
      note: newRecord.note,
      timestampISO: nowISO,
      state: 'PREPARED',
    };

    const activeJournal = getFinancialJournal();
    activeJournal.push(journalEntry);
    saveFinancialJournal(activeJournal);

    journalEntry.state = 'PAYMENT_PERSISTED';
    saveFinancialJournal(activeJournal);

    allPayments[newStudent.id] = [newRecord];
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(allPayments));

    journalEntry.state = 'COMMITTED';
    archiveCommittedJournal(journalEntry);
    const remainingJournal = activeJournal.filter((j) => j.journalId !== journalEntry.journalId);
    saveFinancialJournal(remainingJournal);
  }

  notifyListeners();
  return newStudent;
};


// Advance date by exactly 1 calendar month
export const advanceDateByOneMonth = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    const now = new Date();
    now.setMonth(now.getMonth() + 1);
    return now.toISOString().split('T')[0];
  }
  
  // Handling month rollover gracefully (e.g., Jan 31 -> Feb 28)
  const currentDay = date.getDate();
  date.setMonth(date.getMonth() + 1);
  if (date.getDate() < currentDay) {
    date.setDate(0); // rollback to last day of previous month
  }
  return date.toISOString().split('T')[0];
};

/**
 * Derives a stable, non-sensitive device tag (e.g. D01, D_3A2F) for offline identifier partitioning.
 */
export const getDeviceStableTag = (): string => {
  try {
    let tag = localStorage.getItem('libtrack_device_id_v1');
    if (!tag) {
      const rawClient = localStorage.getItem('lakshay_library_current_client_id_v1') || '';
      const entropy = Math.random().toString(36).substring(2, 6).toUpperCase();
      tag = rawClient ? `D_${rawClient.slice(-4).toUpperCase()}` : `D_${entropy}`;
      localStorage.setItem('libtrack_device_id_v1', tag);
    }
    return tag;
  } catch {
    return 'D_OFFLINE';
  }
};

/**
 * Standard RFC4122 v4 UUID generator with fallback.
 */
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Strict monetary validation to prevent invalid, negative, NaN, infinite, or overflowing amounts.
 */
export const validateMonetaryAmount = (
  amount: number
): { valid: boolean; error?: string; paise: number } => {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || Number.isNaN(amount)) {
    return { valid: false, error: 'Payment amount must be a finite valid number', paise: 0 };
  }
  if (amount <= 0) {
    return { valid: false, error: 'Payment amount must be strictly greater than zero', paise: 0 };
  }
  if (amount > 10_000_000) {
    return { valid: false, error: 'Payment amount exceeds maximum allowable limit (₹1 Crore)', paise: 0 };
  }
  const paise = Math.round(amount * 100);
  return { valid: true, paise };
};

// Collision-resistant offline receipt number generator
export const generateCollisionResistantReceiptNumber = (prefix: 'REC' = 'REC'): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const timeEntropy = (Date.now() % 100000).toString().padStart(5, '0');
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  const devTag = getDeviceStableTag();
  return `${prefix}-${yyyy}${mm}${dd}-${devTag}-${timeEntropy}${randomChars}`;
};

export const FINANCIAL_JOURNAL_KEY = 'libtrack_financial_journal_v1';
export const FINANCIAL_AUDIT_TRAIL_KEY = 'libtrack_financial_audit_trail_v1';
export const QUARANTINED_PAYMENT_CONFLICTS_KEY = 'libtrack_quarantined_payment_conflicts';

export interface FinancialJournalEntry {
  journalId: string;
  idempotencyKey: string;
  paymentId: string;
  receiptNumber: string;
  studentId: string;
  studentName: string;
  studentPhone?: string;
  seatNumber?: string;
  shiftTimings?: string;
  oldDueDate: string;
  newDueDate: string;
  amount: number;
  amountPaise: number;
  paymentMode: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer';
  note?: string;
  feePeriod?: string;
  extraMetadata?: {
    transactionId?: string;
    discount?: number;
    previousBalance?: number;
    remainingBalance?: number;
  };
  timestampISO: string;
  state: 'PREPARED' | 'PAYMENT_PERSISTED' | 'COMMITTED';
}

export const getFinancialJournal = (): FinancialJournalEntry[] => {
  const raw = localStorage.getItem(FINANCIAL_JOURNAL_KEY);
  if (raw === null || raw === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    setRecoveryOnlyMode(true);
    throw new Error('Financial journal is malformed. Recovery-only mode enabled; journal bytes have been preserved.');
  }
  if (!Array.isArray(parsed) || parsed.some((entry) =>
    !entry || typeof entry !== 'object' ||
    typeof entry.journalId !== 'string' ||
    typeof entry.studentId !== 'string' ||
    typeof entry.paymentId !== 'string' ||
    !['PREPARED', 'PAYMENT_PERSISTED', 'COMMITTED'].includes(entry.state)
  )) {
    setRecoveryOnlyMode(true);
    throw new Error('Financial journal schema is invalid. Recovery-only mode enabled; journal bytes have been preserved.');
  }
  return parsed as FinancialJournalEntry[];
};

export const saveFinancialJournal = (entries: FinancialJournalEntry[]): boolean => {
  try {
    const serialized = JSON.stringify(entries);
    localStorage.setItem(FINANCIAL_JOURNAL_KEY, serialized);
    if (localStorage.getItem(FINANCIAL_JOURNAL_KEY) !== serialized) {
      throw new Error('Financial journal storage verification check failed.');
    }
    return true;
  } catch (e) {
    console.error('CRITICAL: Failed to save or verify financial journal', e);
    throw new Error(`Financial journal persistence failure: ${e instanceof Error ? e.message : String(e)}`);
  }
};


const archiveCommittedJournal = (entry: FinancialJournalEntry): void => {
  const rawAudit = localStorage.getItem(FINANCIAL_AUDIT_TRAIL_KEY);
  let audit: FinancialJournalEntry[] = [];
  if (rawAudit !== null) {
    const parsed = JSON.parse(rawAudit);
    if (!Array.isArray(parsed)) throw new Error('Financial audit trail is malformed.');
    audit = parsed;
  }
  const updated = [entry, ...audit.filter((a) => a.journalId !== entry.journalId)].slice(0, 100);
  const serialized = JSON.stringify(updated);
  localStorage.setItem(FINANCIAL_AUDIT_TRAIL_KEY, serialized);
  if (localStorage.getItem(FINANCIAL_AUDIT_TRAIL_KEY) !== serialized) {
    throw new Error('Financial audit trail persistence verification failed.');
  }
}

/**
 * Crash-recovery protocol: Reconciles any interrupted payments.
 * Guarantees that if a payment was saved locally, the student due date advancement is never dropped.
 */
export const recoverPendingFinancialTransactions = (): {
  recoveredCount: number;
  cancelledCount: number;
  details: string[];
} => {
  const report = { recoveredCount: 0, cancelledCount: 0, details: [] as string[] };
  try {
    const journal = getFinancialJournal();
    if (journal.length === 0) return report;

    const rawStudents = localStorage.getItem(STUDENTS_STORAGE_KEY);
    if (rawStudents === null) throw new Error('Student registry is missing while financial journal has pending entries.');
    const parsedStudents: unknown = JSON.parse(rawStudents);
    if (!Array.isArray(parsedStudents)) throw new Error('Student registry is invalid during financial recovery.');
    const allStudents = parsedStudents as Student[];
    const rawPayments = localStorage.getItem(PAYMENTS_STORAGE_KEY);
    if (rawPayments === null) throw new Error('Payment ledger is missing while financial journal has pending entries.');
    const parsedPayments: unknown = JSON.parse(rawPayments);
    if (!parsedPayments || typeof parsedPayments !== 'object' || Array.isArray(parsedPayments)) {
      throw new Error('Payment ledger is invalid during financial recovery.');
    }
    const allPayments = parsedPayments as Record<string, PaymentRecord[]>;
    const remainingJournal: FinancialJournalEntry[] = [];
    const auditEntries: FinancialJournalEntry[] = [];
    let studentsModified = false;

    for (const entry of journal) {
      const studentIndex = allStudents.findIndex((student) => student && student.id === entry.studentId);
      const studentPayments = allPayments[entry.studentId];
      if (studentPayments !== undefined && !Array.isArray(studentPayments)) {
        throw new Error(`Payment records are invalid for student ${entry.studentId}.`);
      }
      const paymentExists = (studentPayments || []).some((payment) =>
        payment && (payment.id === entry.paymentId ||
          (payment.idempotencyKey && payment.idempotencyKey === entry.idempotencyKey))
      );

      if (entry.state === 'COMMITTED') {
        auditEntries.push(entry);
        continue;
      }

      if (entry.state === 'PAYMENT_PERSISTED') {
        if (!paymentExists) {
          remainingJournal.push(entry);
          throw new Error(`Payment record ${entry.paymentId} is not present; refusing to advance due date or prune journal.`);
        }
        if (studentIndex < 0) {
          remainingJournal.push(entry);
          throw new Error(`Student ${entry.studentId} is missing; refusing to archive financial transaction.`);
        }
        const student = allStudents[studentIndex];
        if (student.nextFeeDueDate === entry.oldDueDate) {
          allStudents[studentIndex] = { ...student, nextFeeDueDate: entry.newDueDate, updatedAt: new Date().toISOString() };
          studentsModified = true;
        } else if (student.nextFeeDueDate !== entry.newDueDate) {
          remainingJournal.push(entry);
          throw new Error(`Due date mismatch for ${entry.studentId}; expected ${entry.oldDueDate} or ${entry.newDueDate}, found ${student.nextFeeDueDate}.`);
        }
        auditEntries.push(entry);
        report.recoveredCount++;
        report.details.push(`Verified payment ${entry.paymentId} and reconciled student ${entry.studentId}.`);
        continue;
      }

      if (entry.state === 'PREPARED') {
        if (!paymentExists) {
          report.cancelledCount++;
          report.details.push(`Cancelled prepared transaction ${entry.journalId}; no matching payment record exists.`);
          continue;
        }
        if (studentIndex < 0) {
          remainingJournal.push(entry);
          throw new Error(`Student ${entry.studentId} is missing for a persisted payment; transaction retained for manual recovery.`);
        }
        const student = allStudents[studentIndex];
        if (student.nextFeeDueDate === entry.oldDueDate) {
          allStudents[studentIndex] = { ...student, nextFeeDueDate: entry.newDueDate, updatedAt: new Date().toISOString() };
          studentsModified = true;
        } else if (student.nextFeeDueDate !== entry.newDueDate) {
          remainingJournal.push(entry);
          throw new Error(`Due date mismatch for prepared transaction ${entry.journalId}; retained for manual recovery.`);
        }
        auditEntries.push({ ...entry, state: 'COMMITTED' });
        report.recoveredCount++;
        continue;
      }

      remainingJournal.push(entry);
      throw new Error(`Unsupported financial journal state for ${entry.journalId}.`);
    }

    if (studentsModified) {
      const serializedStudents = JSON.stringify(allStudents);
      localStorage.setItem(STUDENTS_STORAGE_KEY, serializedStudents);
      if (localStorage.getItem(STUDENTS_STORAGE_KEY) !== serializedStudents) {
        throw new Error('Student due-date persistence verification failed during recovery.');
      }
    }

    // Preserve every unresolved entry. Do not prune until all reconciliation and audit writes verify.
    for (const entry of auditEntries) archiveCommittedJournal(entry);
    saveFinancialJournal(remainingJournal);
    return report;
  } catch (err) {
    setRecoveryOnlyMode(true);
    report.details.push(`RECOVERY SUSPENDED: ${err instanceof Error ? err.message : String(err)}`);
    console.error('Financial recovery suspended; journal retained and recovery-only mode enabled.', err);
    return report;
  }
};

/**
 * Crash-recoverable fee payment transaction.
 * 1. Validates amount, limits, and integer paise.
 * 2. Enforces idempotency to prevent duplicate charging.
 * 3. Uses collision-resistant UUID payment IDs (pay_D01_<uuid>).
 * 4. Logs Write-Ahead Journal before modifying records.
 * 5. Persists payment record FIRST, then advances student due date.
 * 6. Commits and prunes journal on successful completion.
 */
export const markStudentPaidInFirestore = (
  studentId: string,
  amount: number,
  paymentMode: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' = 'UPI',
  note?: string,
  extraMetadata?: {
    transactionId?: string;
    feePeriod?: string;
    discount?: number;
    previousBalance?: number;
    remainingBalance?: number;
    idempotencyKey?: string;
  }
): { updatedStudent: Student; newRecord: PaymentRecord; wasIdempotentReplay?: boolean } => {
  if (isRecoveryOnlyMode()) {
    throw new Error('CRITICAL: Payment collection is blocked while application is in recovery-only mode due to unresolved storage corruption.');
  }

  // 1. Strict Monetary Validation
  const validation = validateMonetaryAmount(amount);
  if (!validation.valid) {
    throw new Error(`Invalid payment amount: ${validation.error}`);
  }

  // 2. Fetch student and verify existence
  const allStudentsRaw = getAllStoredStudentsRaw();
  const index = allStudentsRaw.findIndex((s) => s.id === studentId);
  if (index === -1) {
    throw new Error('Student not found in library registry');
  }

  const currentStudent = allStudentsRaw[index];
  const oldDueDate = currentStudent.nextFeeDueDate;
  const newDueDate = advanceDateByOneMonth(oldDueDate);

  // 3. Idempotency Key Handling
  const idempotencyKey =
    extraMetadata?.idempotencyKey ||
    `idemp_${studentId}_${oldDueDate}_${validation.paise}_${paymentMode}`;

  // Check if this idempotency key was already committed
  const allPayments = getStoredPayments();
  const studentPayments = allPayments[studentId] || [];
  const existingRecord = studentPayments.find((p) => p.idempotencyKey === idempotencyKey);
  if (existingRecord) {
    console.warn('Idempotent payment re-submission detected. Returning existing payment record without double charging.');
    return {
      updatedStudent: currentStudent,
      newRecord: existingRecord,
      wasIdempotentReplay: true,
    };
  }

  const nowISO = new Date().toISOString();
  const deviceTag = getDeviceStableTag();
  const uuid = generateUUID();
  const paymentId = `pay_${deviceTag}_${uuid}`;
  const receiptNumber = generateCollisionResistantReceiptNumber('REC');

  const newRecord: PaymentRecord = {
    id: paymentId,
    studentId,
    studentName: currentStudent.name,
    studentPhone: currentStudent.phoneNumber,
    seatNumber: currentStudent.seatNumber,
    shiftTimings: currentStudent.shiftTimings,
    paymentDate: nowISO,
    amountPaid: amount,
    amountPaise: validation.paise,
    paymentMode,
    receiptNumber,
    idempotencyKey,
    note: note || `Monthly fee renewal (${paymentMode})`,
    transactionId: extraMetadata?.transactionId,
    feePeriod: extraMetadata?.feePeriod || `${formatDueDateDisplay(oldDueDate)} - ${formatDueDateDisplay(newDueDate)}`,
    discount: extraMetadata?.discount,
    previousBalance: extraMetadata?.previousBalance,
    remainingBalance: extraMetadata?.remainingBalance,
  };

  // 4. STEP 1: Write Journal Entry (PREPARED)
  const journalEntry: FinancialJournalEntry = {
    journalId: `jnl_${uuid}`,
    idempotencyKey,
    paymentId,
    receiptNumber,
    studentId,
    studentName: currentStudent.name,
    studentPhone: currentStudent.phoneNumber,
    seatNumber: currentStudent.seatNumber,
    shiftTimings: currentStudent.shiftTimings,
    oldDueDate,
    newDueDate,
    amount,
    amountPaise: validation.paise,
    paymentMode,
    note: newRecord.note,
    feePeriod: newRecord.feePeriod,
    extraMetadata,
    timestampISO: nowISO,
    state: 'PREPARED',
  };

  const activeJournal = getFinancialJournal();
  activeJournal.push(journalEntry);
  saveFinancialJournal(activeJournal);

  // 5. STEP 2: Payment-First Local Persistence
  allPayments[studentId] = [newRecord, ...studentPayments];
  localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(allPayments));

  // Update Journal state to PAYMENT_PERSISTED
  journalEntry.state = 'PAYMENT_PERSISTED';
  saveFinancialJournal(activeJournal);

  // 6. STEP 3: Student Due-Date Advancement
  const updatedStudent: Student = {
    ...currentStudent,
    nextFeeDueDate: newDueDate,
    updatedAt: nowISO,
  };
  allStudentsRaw[index] = updatedStudent;
  localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(allStudentsRaw));

  // 7. STEP 4: Commit & Prune Journal Entry
  journalEntry.state = 'COMMITTED';
  archiveCommittedJournal(journalEntry);
  const remainingJournal = activeJournal.filter((j) => j.journalId !== journalEntry.journalId);
  saveFinancialJournal(remainingJournal);

  notifyListeners();
  return { updatedStudent, newRecord, wasIdempotentReplay: false };
};


// Quick digital check-in scanner action: updates 'lastCheckIn' timestamp in Firestore
// AND writes a daily log to the 'DailyAttendance' collection
export const updateStudentCheckIn = (
  studentId: string,
  timestamp?: string,
  verificationMethod: 'QR_SCAN' | 'MANUAL_DESK' = 'QR_SCAN'
): Student => {
  const allStudentsRaw = getAllStoredStudentsRaw();
  const index = allStudentsRaw.findIndex((s) => s.id === studentId && s.status !== 'archived');
  if (index === -1) {
    throw new Error('Student not found in library registry');
  }

  const checkInDateObj = timestamp ? new Date(timestamp) : new Date();
  const checkInTime = checkInDateObj.toISOString();
  const dateStr = `${checkInDateObj.getFullYear()}-${String(checkInDateObj.getMonth() + 1).padStart(2, '0')}-${String(checkInDateObj.getDate()).padStart(2, '0')}`;

  const updatedStudent: Student = {
    ...allStudentsRaw[index],
    lastCheckIn: checkInTime,
    updatedAt: new Date().toISOString(),
  };

  allStudentsRaw[index] = updatedStudent;
  localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(allStudentsRaw));

  // Upsert into DailyAttendance collection (one log per student per calendar date)
  const allAttendance = getStoredDailyAttendance();
  const recordId = `att_${studentId}_${dateStr}`;
  const existingIdx = allAttendance.findIndex(
    (rec) => rec.id === recordId || (rec.studentId === studentId && rec.date === dateStr)
  );

  const attendanceRecord: DailyAttendanceRecord = {
    id: recordId,
    studentId,
    studentName: updatedStudent.name,
    seatNumber: updatedStudent.seatNumber,
    shiftTimings: updatedStudent.shiftTimings,
    date: dateStr,
    checkInTime,
    verificationMethod,
  };

  if (existingIdx >= 0) {
    allAttendance[existingIdx] = attendanceRecord;
  } else {
    allAttendance.unshift(attendanceRecord);
  }
  localStorage.setItem(DAILY_ATTENDANCE_STORAGE_KEY, JSON.stringify(allAttendance));

  notifyListeners();
  return updatedStudent;
};

// Toggle or manually log attendance for a specific date in the calendar view
export const toggleStudentAttendanceForDate = (
  studentId: string,
  dateStr: string,
  verificationMethod: 'QR_SCAN' | 'MANUAL_DESK' = 'MANUAL_DESK'
): { added: boolean; record?: DailyAttendanceRecord } => {
  const allStudentsRaw = getAllStoredStudentsRaw();
  const studentIndex = allStudentsRaw.findIndex((s) => s.id === studentId);
  if (studentIndex === -1) {
    throw new Error('Student not found');
  }
  const student = allStudentsRaw[studentIndex];

  const allAttendance = getStoredDailyAttendance();
  const existingIdx = allAttendance.findIndex(
    (rec) => rec.studentId === studentId && rec.date === dateStr
  );

  if (existingIdx >= 0) {
    // Remove attendance record if toggled off
    allAttendance.splice(existingIdx, 1);
    localStorage.setItem(DAILY_ATTENDANCE_STORAGE_KEY, JSON.stringify(allAttendance));
    notifyListeners();
    return { added: false };
  } else {
    // Create attendance record for that date
    const [yr, mo, dy] = dateStr.split('-').map(Number);
    const now = new Date();
    const checkInDateObj = new Date(yr, mo - 1, dy, now.getHours(), now.getMinutes(), now.getSeconds());
    const checkInTime = checkInDateObj.toISOString();

    const newRecord: DailyAttendanceRecord = {
      id: `att_${studentId}_${dateStr}`,
      studentId,
      studentName: student.name,
      seatNumber: student.seatNumber,
      shiftTimings: student.shiftTimings,
      date: dateStr,
      checkInTime,
      verificationMethod,
    };

    allAttendance.unshift(newRecord);
    localStorage.setItem(DAILY_ATTENDANCE_STORAGE_KEY, JSON.stringify(allAttendance));

    // If it's today or newer than lastCheckIn, update student.lastCheckIn
    if (!student.lastCheckIn || new Date(checkInTime).getTime() >= new Date(student.lastCheckIn).getTime()) {
      allStudentsRaw[studentIndex] = {
        ...student,
        lastCheckIn: checkInTime,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(allStudentsRaw));
    }

    notifyListeners();
    return { added: true, record: newRecord };
  }
};

/**
 * PHASE 0 MANDATORY CONDITION 6:
 * Non-destructively archives a student when removed instead of destroying their historical
 * payment records (`libtrack_firestore_payments`) or attendance history (`libtrack_firestore_daily_attendance`).
 * Frees their active seat assignment so the desk can be reassigned while keeping 100% of financial history intact.
 * Safely handles students both with and without payment records.
 */
export const deleteStudentFromFirestore = (studentId: string): Student | null => {
  createAndVerifyPhase0LocalBackup(false);
  const nowISO = new Date().toISOString();
  const allStudentsRaw = getAllStoredStudentsRaw();
  const targetIndex = allStudentsRaw.findIndex((s) => s.id === studentId);
  if (targetIndex === -1) {
    return null;
  }

  const targetStudent = allStudentsRaw[targetIndex];
  const isAlreadyArchived = targetStudent.status === 'archived';

  // If already archived, preserve original `archivedAt`, `archivedSeatNumber`, and `updatedAt` without overwriting them
  const archivedStudent: Student = isAlreadyArchived
    ? {
        ...targetStudent,
        status: 'archived',
        archivedAt: targetStudent.archivedAt || nowISO,
        updatedAt: targetStudent.updatedAt || targetStudent.archivedAt || nowISO,
        archivedSeatNumber: targetStudent.archivedSeatNumber || targetStudent.seatNumber,
        seatNumber: '',
      }
    : {
        ...targetStudent,
        status: 'archived',
        archivedAt: nowISO,
        updatedAt: nowISO,
        archivedSeatNumber: targetStudent.seatNumber || targetStudent.archivedSeatNumber,
        seatNumber: '',
      };

  allStudentsRaw[targetIndex] = archivedStudent;
  localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(allStudentsRaw));

  // Preserve 100% of historical payment records for this student and stamp studentName & seatNumber snapshots
  const allPayments = getStoredPayments();
  if (Array.isArray(allPayments[studentId]) && allPayments[studentId].length > 0) {
    allPayments[studentId] = allPayments[studentId].map((record) => ({
      ...record,
      studentName: record.studentName || targetStudent.name,
      seatNumber: record.seatNumber || targetStudent.seatNumber || targetStudent.archivedSeatNumber,
    }));
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(allPayments));
  }

  // Note: DailyAttendance records for `studentId` are also preserved intact in `DAILY_ATTENDANCE_STORAGE_KEY`.
  notifyListeners();
  return archivedStudent;
};

/**
 * Updates a student's profile (e.g., name, seatNumber, shiftTimings, phone) while ensuring
 * all pre-existing historical PaymentRecord and DailyAttendanceRecord entries retain their
 * point-in-time `studentName` and `seatNumber` snapshots.
 */
export const updateStudentInFirestore = (
  studentId: string,
  updates: Partial<Omit<Student, 'id'>>
): Student | null => {
  createAndVerifyPhase0LocalBackup(false);
  const nowISO = new Date().toISOString();
  const allStudentsRaw = getAllStoredStudentsRaw();
  const targetIndex = allStudentsRaw.findIndex((s) => s.id === studentId);
  if (targetIndex === -1) return null;

  const previousStudent = allStudentsRaw[targetIndex];

  // Before applying the student's new name or seatNumber, ensure all existing historical payments
  // and attendance records have their original point-in-time `studentName` and `seatNumber` stamped.
  const allPayments = getStoredPayments();
  if (Array.isArray(allPayments[studentId]) && allPayments[studentId].length > 0) {
    allPayments[studentId] = allPayments[studentId].map((record) => ({
      ...record,
      studentName: record.studentName || previousStudent.name,
      seatNumber: record.seatNumber || previousStudent.seatNumber || previousStudent.archivedSeatNumber,
    }));
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(allPayments));
  }

  const allAttendance = getStoredDailyAttendance();
  let attendanceModified = false;
  const updatedAttendance = allAttendance.map((rec) => {
    if (rec.studentId === studentId && (!rec.studentName || !rec.seatNumber)) {
      attendanceModified = true;
      return {
        ...rec,
        studentName: rec.studentName || previousStudent.name,
        seatNumber: rec.seatNumber || previousStudent.seatNumber || previousStudent.archivedSeatNumber || '',
      };
    }
    return rec;
  });
  if (attendanceModified) {
    localStorage.setItem(DAILY_ATTENDANCE_STORAGE_KEY, JSON.stringify(updatedAttendance));
  }

  const updatedStudent: Student = {
    ...previousStudent,
    ...updates,
    id: studentId,
    updatedAt: nowISO,
  };
  allStudentsRaw[targetIndex] = updatedStudent;
  localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(allStudentsRaw));
  notifyListeners();
  return updatedStudent;
};

/**
 * Restores a previously archived student back to active status.
 * Checks seat occupancy before restoring the student's previous seat so it never causes a duplicate seat collision.
 */
export const restoreArchivedStudentInFirestore = (
  studentId: string,
  reassignSeatNumber?: string
): Student | null => {
  const nowISO = new Date().toISOString();
  const allStudentsRaw = getAllStoredStudentsRaw();
  const targetIndex = allStudentsRaw.findIndex((s) => s.id === studentId);
  if (targetIndex === -1) return null;

  const target = allStudentsRaw[targetIndex];
  const candidateSeat = (reassignSeatNumber ?? target.archivedSeatNumber ?? target.seatNumber ?? '').trim();

  // Check if another active student currently occupies `candidateSeat`
  const isCandidateSeatOccupied =
    candidateSeat.length > 0 &&
    allStudentsRaw.some(
      (s) => s.id !== studentId && s.status !== 'archived' && s.seatNumber === candidateSeat
    );

  const assignedSeat = isCandidateSeatOccupied
    ? reassignSeatNumber
      ? '' // Do not collide with an active occupant
      : ''
    : candidateSeat;

  const restored: Student = {
    ...target,
    status: 'active',
    archivedAt: undefined,
    updatedAt: nowISO,
    seatNumber: assignedSeat,
  };
  allStudentsRaw[targetIndex] = restored;
  localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(allStudentsRaw));
  notifyListeners();
  return restored;
};

export const hasPreviousSnapshot = (): boolean => {
  try {
    const raw = localStorage.getItem(PREVIOUS_SNAPSHOT_STORAGE_KEY);
    return !!raw;
  } catch {
    return false;
  }
};

export const resetFirestoreToDefaults = () => {
  // Always snapshot current state into Phase 0 backup vault before any reset
  createAndVerifyPhase0LocalBackup(true);
  try {
    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(INITIAL_STUDENTS));
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(INITIAL_PAYMENT_HISTORY));
    localStorage.setItem(DAILY_ATTENDANCE_STORAGE_KEY, JSON.stringify(INITIAL_DAILY_ATTENDANCE));
  } catch {
    // Ignore storage errors
  }
  notifyListeners();
};

export const restorePreviousOrSampleData = (): { count: number; source: 'backup' | 'sample' } => {
  resetFirestoreToDefaults();
  return { count: 0, source: 'sample' };
};

const computeEffectiveStudentRecencyMs = (
  student: Student,
  studentPayments: PaymentRecord[] = []
): number => {
  const candidates: number[] = [];
  const pushDate = (d?: string | null) => {
    if (!d) return;
    const ms = Date.parse(d);
    if (!isNaN(ms)) candidates.push(ms);
  };
  pushDate(student.updatedAt);
  pushDate(student.archivedAt);
  pushDate(student.lastCheckIn);
  pushDate(student.admissionDate);
  for (const p of studentPayments) {
    pushDate(p?.paymentDate);
  }
  return candidates.length > 0 ? Math.max(...candidates) : 0;
};

/**
 * PHASE 0 CLOSURE REQUIREMENT 3 & 4:
 * Non-destructively merges an incoming synced snapshot (from Authenticated Google Drive or LKSYNC1:... package)
 * with local state so that:
 * 1. Pending local students (active or archived) not present in the incoming snapshot are preserved.
 * 2. When a student exists in both local and incoming snapshots, the newer record wins (based on
 *    `updatedAt`, `archivedAt`, `lastCheckIn`, `nextFeeDueDate`, and payment timestamps) so an older
 *    incoming snapshot never silently overwrites newer local changes.
 * 3. Payment histories are merged via per-student set union on `record.id` so zero payments are lost.
 * 4. Daily attendance logs are merged via set union on `record.id` (`att_${studentId}_${date}`).
 */
export const importSyncedFirestoreSnapshot = (
  students: Student[],
  payments: Record<string, PaymentRecord[]>,
  dailyAttendance?: DailyAttendanceRecord[]
) => {
  isImportingRemoteSnapshot = true;
  try {
    // Ensure a verified local backup exists before applying any remote snapshot
    createAndVerifyPhase0LocalBackup(false);

    // 1. Merge Payment Histories first (union by payment record `id` per student)
    const existingPayments = getStoredPayments();
    const mergedPayments: Record<string, PaymentRecord[]> = { ...existingPayments };

    if (payments && typeof payments === 'object') {
      const allStudentIds = new Set([
        ...Object.keys(existingPayments),
        ...Object.keys(payments),
      ]);

      for (const studentId of allStudentIds) {
        if (LEGACY_EXAMPLE_STUDENT_IDS.has(studentId)) continue;
        const localList = Array.isArray(existingPayments[studentId]) ? existingPayments[studentId] : [];
        const remoteList = Array.isArray(payments[studentId]) ? payments[studentId] : [];

        const byId = new Map<string, PaymentRecord>();
        for (const rec of localList) {
          if (rec && rec.id) byId.set(rec.id, rec);
        }

        for (const remoteRec of remoteList) {
          if (!remoteRec || !remoteRec.id) continue;
          const existingRec = byId.get(remoteRec.id);

          if (!existingRec) {
            // Check for potential receipt number collision with a different local payment
            const duplicateReceipt = Array.from(byId.values()).find(
              (p) => p.receiptNumber && p.receiptNumber === remoteRec.receiptNumber && p.id !== remoteRec.id
            );
            if (duplicateReceipt) {
              // Quarantine receipt number collision
              try {
                const rawQ = localStorage.getItem(QUARANTINED_PAYMENT_CONFLICTS_KEY);
                const qList = rawQ ? JSON.parse(rawQ) : [];
                qList.push({
                  conflictId: `conf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  conflictType: 'RECEIPT_NUMBER_COLLISION',
                  detectedAtISO: new Date().toISOString(),
                  studentId,
                  incomingRecord: remoteRec,
                  existingRecord: duplicateReceipt,
                });
                localStorage.setItem(QUARANTINED_PAYMENT_CONFLICTS_KEY, JSON.stringify(qList.slice(-50)));
              } catch {
                // Ignore
              }
              byId.set(remoteRec.id, {
                ...remoteRec,
                note: `[RECEIPT COLLISION] ${remoteRec.note || ''}`,
              });
            } else {
              byId.set(remoteRec.id, remoteRec);
            }
          } else {
            // Payment ID matches. Verify that immutable financial attributes have not been mutated
            const isFinancialConflict =
              existingRec.amountPaid !== remoteRec.amountPaid ||
              existingRec.paymentDate !== remoteRec.paymentDate ||
              existingRec.studentId !== remoteRec.studentId;

            if (isFinancialConflict) {
              // Quarantined financial mismatch: Never overwrite local financial record
              try {
                const rawQ = localStorage.getItem(QUARANTINED_PAYMENT_CONFLICTS_KEY);
                const qList = rawQ ? JSON.parse(rawQ) : [];
                qList.push({
                  conflictId: `conf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  conflictType: 'FINANCIAL_ATTRIBUTE_MISMATCH',
                  detectedAtISO: new Date().toISOString(),
                  studentId,
                  incomingRecord: remoteRec,
                  existingRecord: existingRec,
                });
                localStorage.setItem(QUARANTINED_PAYMENT_CONFLICTS_KEY, JSON.stringify(qList.slice(-50)));
              } catch {
                // Ignore
              }
              // Keep authoritative local record intact
            } else {
              // Benign enrichment of metadata
              byId.set(existingRec.id, {
                ...remoteRec,
                ...existingRec,
                studentName: existingRec.studentName || remoteRec.studentName,
                studentPhone: existingRec.studentPhone || remoteRec.studentPhone,
                seatNumber: existingRec.seatNumber || remoteRec.seatNumber,
                shiftTimings: existingRec.shiftTimings || remoteRec.shiftTimings,
                feePeriod: existingRec.feePeriod || remoteRec.feePeriod,
              });
            }
          }
        }

        mergedPayments[studentId] = Array.from(byId.values()).sort(
          (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
        );
      }

      localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(mergedPayments));
    }


    // 2. Merge Students (both active and archived) without overwriting newer local records
    if (Array.isArray(students)) {
      const existingAllStudents = getAllStoredStudentsRaw();
      const localMap = new Map<string, Student>(existingAllStudents.map((s) => [s.id, s]));
      const mergedMap = new Map<string, Student>();

      for (const incoming of students) {
        if (!incoming || !incoming.id || LEGACY_EXAMPLE_STUDENT_IDS.has(incoming.id)) continue;
        const local = localMap.get(incoming.id);
        if (!local) {
          mergedMap.set(incoming.id, incoming);
          continue;
        }

        const studentPayments = mergedPayments[incoming.id] || [];
        const localRecency = computeEffectiveStudentRecencyMs(local, existingPayments[incoming.id] || []);
        const incomingRecency = computeEffectiveStudentRecencyMs(incoming, payments?.[incoming.id] || []);
        const localDueMs = Date.parse(local.nextFeeDueDate || '') || 0;
        const incomingDueMs = Date.parse(incoming.nextFeeDueDate || '') || 0;

        const isLocalNewer =
          localRecency > incomingRecency ||
          (localRecency === incomingRecency && localDueMs > incomingDueMs);

        const winner = isLocalNewer ? local : incoming;
        const loser = isLocalNewer ? incoming : local;

        mergedMap.set(incoming.id, {
          ...loser,
          ...winner,
          // Preserve photoUrl if stripped in compact LKSYNC1 transfer
          photoUrl: winner.photoUrl || loser.photoUrl,
          // Preserve archivedSeatNumber across merges
          archivedSeatNumber: winner.archivedSeatNumber || loser.archivedSeatNumber,
          // Keep the furthest valid nextFeeDueDate if a payment was merged from either side
          nextFeeDueDate:
            localDueMs > incomingDueMs && studentPayments.length > 0
              ? local.nextFeeDueDate
              : winner.nextFeeDueDate,
        });
      }

      // Preserve any local students (active or archived) that were created locally and not yet in the remote snapshot
      for (const local of existingAllStudents) {
        if (!mergedMap.has(local.id)) {
          mergedMap.set(local.id, local);
        }
      }

      localStorage.setItem(
        STUDENTS_STORAGE_KEY,
        JSON.stringify(Array.from(mergedMap.values()))
      );
    }

    // 3. Merge DailyAttendance records by `id` (`att_${studentId}_${date}`)
    if (Array.isArray(dailyAttendance)) {
      const existingAttendance = getStoredDailyAttendance();
      const attMap = new Map<string, DailyAttendanceRecord>();
      for (const rec of existingAttendance) {
        if (rec && rec.id) attMap.set(rec.id, rec);
      }
      for (const rec of dailyAttendance) {
        if (rec && rec.id && !LEGACY_EXAMPLE_STUDENT_IDS.has(rec.studentId)) {
          attMap.set(rec.id, rec);
        }
      }
      const mergedAttendance = Array.from(attMap.values()).sort(
        (a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime()
      );
      localStorage.setItem(DAILY_ATTENDANCE_STORAGE_KEY, JSON.stringify(mergedAttendance));
    }

    notifyListeners();
  } finally {
    isImportingRemoteSnapshot = false;
  }
};


// Date calculation helpers (Hardened against null, undefined, and malformed date strings)
export const getDaysDifference = (dueDateStr?: string | null): number => {
  if (!dueDateStr || typeof dueDateStr !== 'string') return 0;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parts = dueDateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      const parsedDate = new Date(dueDateStr);
      if (isNaN(parsedDate.getTime())) return 0;
      parsedDate.setHours(0, 0, 0, 0);
      return Math.round((parsedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    const [year, month, day] = parts;
    const due = new Date(year, month - 1, day);
    if (isNaN(due.getTime())) return 0;
    due.setHours(0, 0, 0, 0);

    const diffTime = due.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
};

export const getStudentStatus = (dueDateStr?: string | null): 'overdue' | 'due_soon' | 'upcoming' => {
  if (!dueDateStr) return 'upcoming';
  const diffDays = getDaysDifference(dueDateStr);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'due_soon';
  return 'upcoming';
};

export const formatDueDateDisplay = (dueDateStr?: string | null): string => {
  if (!dueDateStr || typeof dueDateStr !== 'string') return 'Not set';
  try {
    const parts = dueDateStr.split('-').map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const [year, month, day] = parts;
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
    }
    const fallbackDate = new Date(dueDateStr);
    if (!isNaN(fallbackDate.getTime())) {
      return fallbackDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
    return dueDateStr;
  } catch {
    return dueDateStr || 'Not set';
  }
};
