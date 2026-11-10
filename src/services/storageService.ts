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

const ensureProductionCleanInit = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (localStorage.getItem(PRODUCTION_CLEAN_INIT_KEY) !== '1') {
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify([]));
      localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify({}));
      localStorage.setItem(DAILY_ATTENDANCE_STORAGE_KEY, JSON.stringify([]));
      localStorage.removeItem(PREVIOUS_SNAPSHOT_STORAGE_KEY);
      localStorage.removeItem('lakshay_library_crash_logs_v1');
      localStorage.removeItem('lakshay_library_daily_backups_v1');
      localStorage.setItem(PRODUCTION_CLEAN_INIT_KEY, '1');
    }
  } catch {
    // Ignore storage access errors
  }
};

ensureProductionCleanInit();

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

  // Automatically trigger real-time auto-sync when new data is entered locally
  if (!isImportingRemoteSnapshot) {
    try {
      import('./googleDriveSyncService').then((m) => {
        m.triggerLivePrimaryAutoSync();
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

export const getStoredStudents = (): Student[] => {
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
    // Automatically strip out any legacy example students (std_001 .. std_008)
    const cleaned = parsed.filter((s: Student) => s && !LEGACY_EXAMPLE_STUDENT_IDS.has(s.id));
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return INITIAL_STUDENTS;
  }
};

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
    const currentStudents = getStoredStudents();
    const validStudentIds = new Set(currentStudents.map((s) => s.id));
    let modified = false;
    const cleaned: Record<string, PaymentRecord[]> = {};
    for (const [studentId, records] of Object.entries(parsed)) {
      if (LEGACY_EXAMPLE_STUDENT_IDS.has(studentId) || !validStudentIds.has(studentId)) {
        modified = true;
      } else {
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
  const students = getStoredStudents();
  const newStudent: Student = {
    ...data,
    id: `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  };

  const updated = [newStudent, ...students];
  localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(updated));

  if (initialPayment) {
    const allPayments = getStoredPayments();
    const newRecord: PaymentRecord = {
      id: `pay_${Date.now()}_init`,
      studentId: newStudent.id,
      paymentDate: new Date(initialPayment.paymentDate).toISOString(),
      amountPaid: initialPayment.amountPaid,
      paymentMode: initialPayment.paymentMode || 'UPI',
      receiptNumber: `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      note: initialPayment.note || `Initial admission fee recorded on ${initialPayment.paymentDate}`,
    };
    allPayments[newStudent.id] = [newRecord];
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(allPayments));
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

// Mark Paid: Atomic transaction in Firestore
// 1. Adds record to PaymentHistory sub-collection
// 2. Advances nextFeeDueDate by exactly 1 month
export const markStudentPaidInFirestore = (
  studentId: string,
  amount: number,
  paymentMode: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' = 'UPI',
  note?: string
): { updatedStudent: Student; newRecord: PaymentRecord } => {
  const students = getStoredStudents();
  const index = students.findIndex((s) => s.id === studentId);
  if (index === -1) {
    throw new Error('Student not found');
  }

  const currentStudent = students[index];
  const oldDueDate = currentStudent.nextFeeDueDate;
  const newDueDate = advanceDateByOneMonth(oldDueDate);

  const updatedStudent: Student = {
    ...currentStudent,
    nextFeeDueDate: newDueDate,
  };

  students[index] = updatedStudent;
  localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(students));

  // Add record into PaymentHistory sub-collection
  const allPayments = getStoredPayments();
  const studentPayments = allPayments[studentId] || [];

  const newRecord: PaymentRecord = {
    id: `pay_${Date.now()}`,
    studentId,
    paymentDate: new Date().toISOString(),
    amountPaid: amount,
    paymentMode,
    receiptNumber: `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    note: note || `Monthly fee renewal (${paymentMode})`,
  };

  allPayments[studentId] = [newRecord, ...studentPayments];
  localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(allPayments));

  notifyListeners();
  return { updatedStudent, newRecord };
};

// Quick digital check-in scanner action: updates 'lastCheckIn' timestamp in Firestore
// AND writes a daily log to the 'DailyAttendance' collection
export const updateStudentCheckIn = (
  studentId: string,
  timestamp?: string,
  verificationMethod: 'QR_SCAN' | 'MANUAL_DESK' = 'QR_SCAN'
): Student => {
  const students = getStoredStudents();
  const index = students.findIndex((s) => s.id === studentId);
  if (index === -1) {
    throw new Error('Student not found in library registry');
  }

  const checkInDateObj = timestamp ? new Date(timestamp) : new Date();
  const checkInTime = checkInDateObj.toISOString();
  const dateStr = `${checkInDateObj.getFullYear()}-${String(checkInDateObj.getMonth() + 1).padStart(2, '0')}-${String(checkInDateObj.getDate()).padStart(2, '0')}`;

  const updatedStudent: Student = {
    ...students[index],
    lastCheckIn: checkInTime,
  };

  students[index] = updatedStudent;
  localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(students));

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
  const students = getStoredStudents();
  const studentIndex = students.findIndex((s) => s.id === studentId);
  if (studentIndex === -1) {
    throw new Error('Student not found');
  }
  const student = students[studentIndex];

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
      students[studentIndex] = { ...student, lastCheckIn: checkInTime };
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(students));
    }

    notifyListeners();
    return { added: true, record: newRecord };
  }
};

export const deleteStudentFromFirestore = (studentId: string) => {
  const students = getStoredStudents().filter((s) => s.id !== studentId);
  localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(students));

  const allPayments = getStoredPayments();
  delete allPayments[studentId];
  localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(allPayments));

  const filteredAttendance = getStoredDailyAttendance().filter((rec) => rec.studentId !== studentId);
  localStorage.setItem(DAILY_ATTENDANCE_STORAGE_KEY, JSON.stringify(filteredAttendance));

  notifyListeners();
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
  try {
    localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(INITIAL_STUDENTS));
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(INITIAL_PAYMENT_HISTORY));
    localStorage.setItem(DAILY_ATTENDANCE_STORAGE_KEY, JSON.stringify(INITIAL_DAILY_ATTENDANCE));
    localStorage.removeItem(PREVIOUS_SNAPSHOT_STORAGE_KEY);
    localStorage.removeItem('lakshay_library_crash_logs_v1');
    localStorage.removeItem('lakshay_library_daily_backups_v1');
  } catch {
    // Ignore storage errors
  }
  notifyListeners();
};

export const restorePreviousOrSampleData = (): { count: number; source: 'backup' | 'sample' } => {
  resetFirestoreToDefaults();
  return { count: 0, source: 'sample' };
};

export const importSyncedFirestoreSnapshot = (
  students: Student[],
  payments: Record<string, PaymentRecord[]>,
  dailyAttendance?: DailyAttendanceRecord[]
) => {
  isImportingRemoteSnapshot = true;
  try {
    if (Array.isArray(students)) {
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(students));
    }
    if (payments && typeof payments === 'object') {
      localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(payments));
    }
    if (Array.isArray(dailyAttendance)) {
      localStorage.setItem(DAILY_ATTENDANCE_STORAGE_KEY, JSON.stringify(dailyAttendance));
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
