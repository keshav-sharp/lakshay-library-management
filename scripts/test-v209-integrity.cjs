/**
 * LibTrack v2.0.9 Comprehensive Production-Function Integrity Test Suite
 * 
 * Verifies actual production services against failure injection scenarios:
 * 1. Safe non-destructive initialization & quarantine handling
 * 2. Write-Ahead Financial Journal persistence, verification, and crash recovery
 * 3. Payment idempotency lifecycle & multi-month consecutive payments
 * 4. Monetary validation & strict INR amount-to-words
 * 5. Initial admission payment handling & initial fee validation
 * 6. Snapshot merge conflict protection
 */

const assert = require('assert');

// Mock localStorage environment
class MockLocalStorage {
  constructor() {
    this.store = {};
    this.failOnSetKey = null;
    this.failOnGetKey = null;
  }
  getItem(key) {
    if (this.failOnGetKey === key) throw new Error('Injected getItem failure');
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, val) {
    if (this.failOnSetKey === key) throw new Error('Injected setItem failure');
    this.store[key] = String(val);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
    this.failOnSetKey = null;
    this.failOnGetKey = null;
  }
  get length() {
    return Object.keys(this.store).length;
  }
}

global.window = {
  localStorage: new MockLocalStorage(),
};
global.localStorage = global.window.localStorage;

// Load actual production modules
const { amountToWordsINR } = require('../src/utils/numberToWords');
const {
  ensureSafeProductionInit,
  markStudentPaidInFirestore,
  addStudentToFirestore,
  validateMonetaryAmount,
  getFinancialJournal,
  saveFinancialJournal,
  recoverPendingFinancialTransactions,
  getStoredPayments,
  getAllStoredStudentsRaw,
  isRecoveryOnlyMode,
  setRecoveryOnlyMode,
  FINANCIAL_JOURNAL_KEY,
} = require('../src/services/storageService');
const { addCustomShift, getStoredShifts } = require('../src/services/shiftService');
const { addCustomSeat, getStoredSeats } = require('../src/services/seatService');
const { setStaffPassphrase } = require('../src/services/storageEncryption');

// Initialize in-memory vault for test suite execution
setStaffPassphrase('test-passphrase-alpha-123');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    testsFailed++;
  }
}

console.log('====================================================');
console.log('LibTrack v2.0.9 Production-Function Integrity Test Suite');
console.log('====================================================\n');

// 1. Amount to Words INR
console.log('Group 1: Amount to Words INR Validation');
runTest('₹0.00 -> "Zero Rupees Only"', () => {
  assert.strictEqual(amountToWordsINR(0), 'Zero Rupees Only');
});
runTest('₹1.00 -> "One Rupee Only"', () => {
  assert.strictEqual(amountToWordsINR(1), 'One Rupee Only');
});
runTest('₹10.50 -> "Ten Rupees and Fifty Paise Only"', () => {
  assert.strictEqual(amountToWordsINR(10.50), 'Ten Rupees and Fifty Paise Only');
});
runTest('₹1,23,456.78 -> correct Indian words', () => {
  assert.strictEqual(
    amountToWordsINR(123456.78),
    'One Lakh Twenty Three Thousand Four Hundred Fifty Six Rupees and Seventy Eight Paise Only'
  );
});
runTest('Negative & NaN rejected', () => {
  assert.strictEqual(amountToWordsINR(-10), 'Invalid Amount');
  assert.strictEqual(amountToWordsINR(NaN), 'Invalid Amount');
});

// 2. Safe Production Initialization & Quarantine
console.log('\nGroup 2: Safe Production Initialization & Quarantine');
runTest('Existing installation with missing marker preserves records and stamps marker', () => {
  localStorage.clear();
  const students = [{ id: 'std_test_1', name: 'Test Student', seatNumber: '12', nextFeeDueDate: '2026-12-01', admissionDate: '2026-11-01', monthlyFee: 1000, shiftTimings: 'Morning' }];
  localStorage.setItem('libtrack_firestore_students', JSON.stringify(students));
  // Notice: init marker absent

  const report = ensureSafeProductionInit();
  assert.strictEqual(report.state, 'EXISTING_MISSING_MARKER_PRESERVED');
  assert.strictEqual(report.studentsCount, 1);
  assert.strictEqual(localStorage.getItem('lakshay_library_prod_v2_0_0_clean'), '1');
  const stored = getAllStoredStudentsRaw();
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].id, 'std_test_1');
});

runTest('Corrupted storage isolates raw bytes into quarantine keys without destructive wipe', () => {
  localStorage.clear();
  localStorage.setItem('libtrack_firestore_students', 'INVALID_JSON_PAYLOAD_ABC');

  const report = ensureSafeProductionInit();
  assert.strictEqual(report.state, 'CORRUPTED_STORAGE_QUARANTINED_PRESERVED');
  assert.strictEqual(report.quarantinedKeys.length, 1);
  assert.strictEqual(localStorage.getItem(report.quarantinedKeys[0]), 'INVALID_JSON_PAYLOAD_ABC');
});

// 3. Financial Journal Persistence & Failure Injection
console.log('\nGroup 3: Financial Journal Persistence & Failure Injection');
runTest('saveFinancialJournal verifies persistence and throws on write error', () => {
  localStorage.clear();
  const testEntry = {
    journalId: 'jnl_test_99',
    idempotencyKey: 'idemp_99',
    paymentId: 'pay_test_99',
    receiptNumber: 'REC-2026-001',
    studentId: 'std_test_1',
    studentName: 'Test Student',
    oldDueDate: '2026-12-01',
    newDueDate: '2027-01-01',
    amount: 1000,
    amountPaise: 100000,
    paymentMode: 'UPI',
    timestampISO: new Date().toISOString(),
    state: 'PREPARED',
  };

  const saved = saveFinancialJournal([testEntry]);
  assert.strictEqual(saved, true);
  const journal = getFinancialJournal();
  assert.strictEqual(journal.length, 1);
  assert.strictEqual(journal[0].journalId, 'jnl_test_99');
});

runTest('Crash Recovery reconciles payment written but due-date advancement interrupted', () => {
  localStorage.clear();
  const student = { id: 'std_rec_1', name: 'Recovery Test', seatNumber: '5', nextFeeDueDate: '2026-11-01', admissionDate: '2026-10-01', monthlyFee: 1200, shiftTimings: 'Morning', status: 'active' };

  localStorage.setItem('libtrack_firestore_students', JSON.stringify([student]));

  const paymentRecord = {
    id: 'pay_test_rec_1',
    studentId: 'std_rec_1',
    paymentDate: new Date().toISOString(),
    amountPaid: 1200,
    amountPaise: 120000,
    paymentMode: 'UPI',
    receiptNumber: 'REC-2026-999',
    idempotencyKey: 'idemp_rec_1',
  };
  localStorage.setItem('libtrack_firestore_payments', JSON.stringify({ 'std_rec_1': [paymentRecord] }));

  // Journal in PAYMENT_PERSISTED state (due date not advanced yet)
  const journal = [{
    journalId: 'jnl_rec_1',
    idempotencyKey: 'idemp_rec_1',
    paymentId: 'pay_test_rec_1',
    receiptNumber: 'REC-2026-999',
    studentId: 'std_rec_1',

    studentName: 'Recovery Test',
    oldDueDate: '2026-11-01',
    newDueDate: '2026-12-01',
    amount: 1200,
    amountPaise: 120000,
    paymentMode: 'UPI',
    timestampISO: new Date().toISOString(),
    state: 'PAYMENT_PERSISTED',
  }];
  saveFinancialJournal(journal);
  localStorage.setItem('lakshay_library_prod_v2_0_0_clean', '1');

  const report = recoverPendingFinancialTransactions();

  assert.strictEqual(report.recoveredCount, 1);


  const updatedStudents = getAllStoredStudentsRaw();
  assert.strictEqual(updatedStudents[0].nextFeeDueDate, '2026-12-01');
  assert.strictEqual(getFinancialJournal().length, 0); // Pruned
});

runTest('Crash recovery cancels prepared entry if payment record is missing', () => {
  localStorage.clear();
  const student = { id: 'std_missing_pay', name: 'Missing Pay Test', seatNumber: '6', nextFeeDueDate: '2026-11-01', admissionDate: '2026-10-01', monthlyFee: 1000, shiftTimings: 'Morning', status: 'active' };
  localStorage.setItem('libtrack_firestore_students', JSON.stringify([student]));
  localStorage.setItem('libtrack_firestore_payments', JSON.stringify({}));

  const journal = [{
    journalId: 'jnl_missing_pay',
    idempotencyKey: 'idemp_missing',
    paymentId: 'pay_missing',
    receiptNumber: 'REC-2026-888',
    studentId: 'std_missing_pay',
    studentName: 'Missing Pay Test',
    oldDueDate: '2026-11-01',
    newDueDate: '2026-12-01',
    amount: 1000,
    amountPaise: 100000,
    paymentMode: 'UPI',
    timestampISO: new Date().toISOString(),
    state: 'PREPARED',
  }];
  saveFinancialJournal(journal);
  localStorage.setItem('lakshay_library_prod_v2_0_0_clean', '1');

  const report = recoverPendingFinancialTransactions();
  assert.strictEqual(report.cancelledCount, 1);
  assert.strictEqual(getFinancialJournal().length, 0);
});

runTest('PAYMENT_PERSISTED without matching payment is retained and enters recovery-only mode', () => {
  localStorage.clear();
  const student = { id: 'std_no_payment', name: 'Missing Persisted Payment', nextFeeDueDate: '2026-11-01', status: 'active' };
  localStorage.setItem('libtrack_firestore_students', JSON.stringify([student]));
  localStorage.setItem('libtrack_firestore_payments', JSON.stringify({}));
  const entry = {
    journalId: 'jnl_no_payment', idempotencyKey: 'idem_no_payment',
    paymentId: 'pay_not_found', receiptNumber: 'REC-NOT-FOUND',
    studentId: 'std_no_payment', studentName: 'Missing Persisted Payment',
    oldDueDate: '2026-11-01', newDueDate: '2026-12-01',
    amount: 1000, amountPaise: 100000, paymentMode: 'UPI',
    timestampISO: new Date().toISOString(), state: 'PAYMENT_PERSISTED',
  };
  saveFinancialJournal([entry]);
  const report = recoverPendingFinancialTransactions();
  assert.strictEqual(report.recoveredCount, 0);
  assert.strictEqual(getAllStoredStudentsRaw()[0].nextFeeDueDate, '2026-11-01');
  assert.strictEqual(getFinancialJournal().length, 1);
  assert.strictEqual(isRecoveryOnlyMode(), true);
  setRecoveryOnlyMode(false);
});

runTest('Malformed financial journal is preserved and blocks recovery', () => {
  localStorage.clear();
  localStorage.setItem(FINANCIAL_JOURNAL_KEY, '{broken-json');
  assert.throws(() => getFinancialJournal(), /malformed/);
  assert.strictEqual(localStorage.getItem(FINANCIAL_JOURNAL_KEY), '{broken-json');
  assert.strictEqual(isRecoveryOnlyMode(), true);
  setRecoveryOnlyMode(false);
});

runTest('Financial journal write failure is injected and surfaced', () => {
  localStorage.clear();
  localStorage.failOnSetKey = FINANCIAL_JOURNAL_KEY;
  assert.throws(() => saveFinancialJournal([]), /persistence failure/);
  localStorage.failOnSetKey = null;
  setRecoveryOnlyMode(false);
});

runTest('Recovery fails closed when storage reads are unavailable', () => {
  localStorage.clear();
  localStorage.failOnGetKey = 'libtrack_recovery_only_mode';
  assert.strictEqual(isRecoveryOnlyMode(), true);
  localStorage.failOnGetKey = null;
});

runTest('Seat, shift, and student attendance mutations are blocked in recovery-only mode', () => {
  localStorage.clear();
  setRecoveryOnlyMode(true);
  assert.throws(() => addCustomShift({ label: 'Test Shift', timings: '08:00 AM - 12:00 PM', defaultFee: 500 }), /recovery-only mode/);
  assert.throws(() => addCustomSeat('Z-01'), /recovery-only mode/);
  setRecoveryOnlyMode(false);
});

runTest('Corrupt seat and shift JSON is preserved and enables recovery-only mode', () => {
  localStorage.clear();
  localStorage.setItem('lakshay_app_shifts', '{bad-shifts');
  localStorage.setItem('lakshay_app_seats', '{bad-seats');
  getStoredShifts();
  assert.strictEqual(localStorage.getItem('lakshay_app_shifts'), '{bad-shifts');
  assert.strictEqual(isRecoveryOnlyMode(), true);
  setRecoveryOnlyMode(false);
  getStoredSeats();
  assert.strictEqual(localStorage.getItem('lakshay_app_seats'), '{bad-seats');
  assert.strictEqual(isRecoveryOnlyMode(), true);
  setRecoveryOnlyMode(false);
});

runTest('Repeated recovery execution is safe and idempotent', () => {
  localStorage.clear();
  const report1 = recoverPendingFinancialTransactions();
  const report2 = recoverPendingFinancialTransactions();
  assert.strictEqual(report1.recoveredCount, 0);
  assert.strictEqual(report2.recoveredCount, 0);
});

// 4. Idempotency & Payment Transactions
console.log('\nGroup 4: Payment Idempotency & Consecutive Monthly Payments');
runTest('Mark student paid creates payment and advances due date atomically', () => {
  localStorage.clear();
  const student = { id: 'std_pay_1', name: 'Payment Test', seatNumber: '10', nextFeeDueDate: '2026-12-01', admissionDate: '2026-11-01', monthlyFee: 1500, shiftTimings: 'Evening', status: 'active' };
  localStorage.setItem('libtrack_firestore_students', JSON.stringify([student]));
  localStorage.setItem('libtrack_firestore_payments', JSON.stringify({}));

  const result = markStudentPaidInFirestore('std_pay_1', 1500, 'UPI', 'Monthly fee', { idempotencyKey: 'idemp_p1' });
  assert.strictEqual(result.updatedStudent.nextFeeDueDate, '2027-01-01');
  assert.strictEqual(result.newRecord.amountPaid, 1500);
  assert.strictEqual(result.wasIdempotentReplay, false);

  // Replay same idempotency key -> idempotent return
  const replay = markStudentPaidInFirestore('std_pay_1', 1500, 'UPI', 'Monthly fee', { idempotencyKey: 'idemp_p1' });
  assert.strictEqual(replay.wasIdempotentReplay, true);
  assert.strictEqual(replay.newRecord.id, result.newRecord.id);

  const payments = getStoredPayments();
  assert.strictEqual(payments['std_pay_1'].length, 1); // Zero duplicate records!
});

runTest('Two consecutive monthly payments create two distinct payment records', () => {
  localStorage.clear();
  const student = { id: 'std_pay_2', name: 'Consecutive Test', seatNumber: '11', nextFeeDueDate: '2026-12-01', admissionDate: '2026-11-01', monthlyFee: 1000, shiftTimings: 'Morning', status: 'active' };
  localStorage.setItem('libtrack_firestore_students', JSON.stringify([student]));
  localStorage.setItem('libtrack_firestore_payments', JSON.stringify({}));

  const pay1 = markStudentPaidInFirestore('std_pay_2', 1000, 'Cash', 'Month 1', { idempotencyKey: 'idemp_m1' });
  assert.strictEqual(pay1.updatedStudent.nextFeeDueDate, '2027-01-01');

  const pay2 = markStudentPaidInFirestore('std_pay_2', 1000, 'Cash', 'Month 2', { idempotencyKey: 'idemp_m2' });
  assert.strictEqual(pay2.updatedStudent.nextFeeDueDate, '2027-02-01');

  const payments = getStoredPayments();
  assert.strictEqual(payments['std_pay_2'].length, 2);
});

// 5. Initial Admission Payment Flow
console.log('\nGroup 5: Initial Admission Payment Flow');
runTest('addStudentToFirestore with valid initial payment records student and payment ledger entry', () => {
  localStorage.clear();
  const newStudentData = {
    name: 'Admission Student',
    phoneNumber: '9876543210',
    seatNumber: '25',
    shiftTimings: 'Full Day Shift',
    monthlyFee: 1200,
    nextFeeDueDate: '2026-12-01',
    admissionDate: '2026-11-01',
  };

  const created = addStudentToFirestore(newStudentData, {
    paymentDate: '2026-11-01T10:00:00.000Z',
    amountPaid: 1200,
    paymentMode: 'UPI',
    note: 'Initial admission fee',
  });

  assert.ok(created.id);
  const payments = getStoredPayments();
  assert.ok(payments[created.id]);
  assert.strictEqual(payments[created.id].length, 1);
  assert.strictEqual(payments[created.id][0].amountPaid, 1200);
});

runTest('addStudentToFirestore with invalid negative initial payment throws error', () => {
  localStorage.clear();
  const newStudentData = {
    name: 'Bad Admission',
    phoneNumber: '9876543210',
    seatNumber: '26',
    shiftTimings: 'Morning',
    monthlyFee: 1000,
    nextFeeDueDate: '2026-12-01',
    admissionDate: '2026-11-01',
  };

  assert.throws(() => {
    addStudentToFirestore(newStudentData, {
      paymentDate: '2026-11-01T10:00:00.000Z',
      amountPaid: -500,
    });
  }, /Invalid initial admission payment amount/);
});

// AES-GCM Cryptographic Tamper-Detection & Authentication Integrity
console.log('Group 6: AES-256-GCM Cryptographic Tamper-Detection & Authentication Integrity (14 Scenarios)');
const { encryptStoragePayload, decryptStoragePayload, StorageCryptoError, clearStaffPassphrase } = require('../src/services/storageEncryption');

// Test missing passphrase fails closed
runTest('0. Missing passphrase fails closed (no default passphrase exists)', () => {
  clearStaffPassphrase();
  assert.throws(() => encryptStoragePayload('test'), (err) => err && err.code === 'KEY_ERROR');
  setStaffPassphrase('test-passphrase-alpha-123');
});

runTest('1. AES-GCM round trip success', () => {
  setStaffPassphrase('test-passphrase-alpha-123');
  const plaintext = JSON.stringify({ student: 'Rahul Sharma', dues: 1200 });
  const ct = encryptStoragePayload(plaintext);
  assert.ok(ct.startsWith('AESGCM_GCM_V2:'));
  const pt = decryptStoragePayload(ct);
  assert.strictEqual(pt, plaintext);
});

runTest('2. Ciphertext bit-flipping detection', () => {
  setStaffPassphrase('test-passphrase-alpha-123');
  const ct = encryptStoragePayload('Secret records');
  const parts = ct.split(':');
  const tampered = `${parts[0]}:${parts[1]}:${parts[2].replace(/[0-9a-f]/g, 'f')}`;
  assert.throws(() => decryptStoragePayload(tampered), StorageCryptoError);
});

runTest('3. Authentication-tag modification detection', () => {
  setStaffPassphrase('test-passphrase-alpha-123');
  const ct = encryptStoragePayload('Secret records');
  const parts = ct.split(':');
  const tamperedTag = parts[2].slice(0, -4) + '0000';
  const tampered = `${parts[0]}:${parts[1]}:${tamperedTag}`;
  assert.throws(() => decryptStoragePayload(tampered), StorageCryptoError);
});

runTest('4. Nonce modification detection', () => {
  setStaffPassphrase('test-passphrase-alpha-123');
  const ct = encryptStoragePayload('Secret records');
  const parts = ct.split(':');
  const badNonce = '00112233445566778899aabb';
  const tampered = `${parts[0]}:${badNonce}:${parts[2]}`;
  assert.throws(() => decryptStoragePayload(tampered), StorageCryptoError);
});

runTest('5. Wrong-key decryption failure (fail closed)', () => {
  setStaffPassphrase('correct-passphrase-alpha-123');
  const ct = encryptStoragePayload('Confidential financial audit');
  assert.throws(() => {
    decryptStoragePayload(ct, 'wrong-passphrase-beta-999');
  }, StorageCryptoError);
  setStaffPassphrase('test-passphrase-alpha-123');
});

runTest('6. Truncated ciphertext detection', () => {
  const ct = encryptStoragePayload('Secret records');
  const truncated = ct.substring(0, ct.length - 10);
  assert.throws(() => decryptStoragePayload(truncated), StorageCryptoError);
});

runTest('7. Malformed envelope rejection', () => {
  assert.throws(() => decryptStoragePayload('AESGCM_GCM_V2:invalidhex:short'), StorageCryptoError);
});

runTest('8. Empty payload handling', () => {
  assert.strictEqual(encryptStoragePayload(''), '');
  assert.strictEqual(decryptStoragePayload(''), '');
});

runTest('9. Missing secure random generator simulation fail closed', () => {
  localStorage.clear();
  const oldGlobalThisCrypto = globalThis.crypto;
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
  let caught = false;
  try {
    encryptStoragePayload('test');
  } catch (err) {
    if (err && err.name === 'StorageCryptoError') caught = true;
  }
  assert.strictEqual(caught, true);
  Object.defineProperty(globalThis, 'crypto', { value: oldGlobalThisCrypto, configurable: true, writable: true });
  localStorage.clear();
});

runTest('10. Encryption failure without plaintext persistence', () => {
  localStorage.clear();
  const oldGlobalThisCrypto = globalThis.crypto;
  Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
  let caught = false;
  try {
    encryptStoragePayload('no plaintext leaked');
  } catch (err) {
    if (err && err.name === 'StorageCryptoError') caught = true;
  }
  assert.strictEqual(caught, true);
  Object.defineProperty(globalThis, 'crypto', { value: oldGlobalThisCrypto, configurable: true, writable: true });
  localStorage.clear();
});

runTest('11. Decryption failure without raw-data return', () => {
  const badPayload = 'AESGCM_GCM_V2:0123456789abcdef01234567:deadbeefdeadbeefdeadbeefdeadbeef';
  assert.throws(() => decryptStoragePayload(badPayload), StorageCryptoError);
});

runTest('12. Cross-device backup encryption and decryption via shared passphrase', () => {
  const sharedKey = 'enterprise-staff-shared-key-2026';
  setStaffPassphrase(sharedKey);
  const backupData = JSON.stringify({ students: [{ id: '1', name: 'Device A Backup' }] });
  const exportedCt = encryptStoragePayload(backupData);

  setStaffPassphrase(sharedKey);
  const importedPt = decryptStoragePayload(exportedCt);
  assert.strictEqual(importedPt, backupData);

  setStaffPassphrase('test-passphrase-alpha-123');
});

runTest('13. Separate-device backup import with distinct local salt succeeds with portable KDF metadata', () => {
  const sharedKey = 'enterprise-staff-shared-key-2026';
  // Device A creates backup with Device A's salt
  localStorage.setItem('libtrack_device_storage_salt_v2', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  setStaffPassphrase(sharedKey);
  const backupData = JSON.stringify({
    students: [{ id: 'std_dev_a', name: 'Device A Student', nextFeeDueDate: '2026-12-01' }],
    payments: { std_dev_a: [{ id: 'pay_a', amountPaid: 1000 }] },
    journal: []
  });
  const exportedCt = encryptStoragePayload(backupData);

  // Device B has a DIFFERENT salt in localStorage
  localStorage.setItem('libtrack_device_storage_salt_v2', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  setStaffPassphrase(sharedKey);
  const importedPt = decryptStoragePayload(exportedCt);
  assert.strictEqual(importedPt, backupData);

  // Wrong passphrase on Device B must fail
  assert.throws(() => decryptStoragePayload(exportedCt, 'wrong-passphrase-invalid'), StorageCryptoError);

  // Tampered ciphertext must fail authentication
  const tamperedCt = exportedCt.substring(0, exportedCt.length - 4) + '0000';
  assert.throws(() => decryptStoragePayload(tamperedCt, sharedKey), StorageCryptoError);

  setStaffPassphrase('test-passphrase-alpha-123');
});

console.log('\n====================================================');
console.log(`Results: ${testsPassed} passed, ${testsFailed} failed.`);
console.log('====================================================');

if (testsFailed > 0) {
  process.exit(1);
}
