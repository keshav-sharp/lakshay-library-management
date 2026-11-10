import { Student, PaymentRecord, DailyAttendanceRecord } from '../types/student';

// Reference date helper
export const getTodayDateString = (): string => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

export const offsetDateString = (daysOffset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
};

// Legacy/sample student IDs that are automatically purged in production
export const LEGACY_EXAMPLE_STUDENT_IDS = new Set([
  'std_001',
  'std_002',
  'std_003',
  'std_004',
  'std_005',
  'std_006',
  'std_007',
  'std_008',
  'std_prev_101',
  'std_prev_102',
  'std_prev_103',
  'std_prev_104',
  'std_prev_105',
  'std_prev_106',
  'std_prev_107',
  'std_prev_108',
]);

// Clean production defaults: 0 students, 0 payments, 0 attendance logs
export const INITIAL_STUDENTS: Student[] = [];

export const INITIAL_PAYMENT_HISTORY: Record<string, PaymentRecord[]> = {};

export const generateInitialDailyAttendance = (): DailyAttendanceRecord[] => [];

export const INITIAL_DAILY_ATTENDANCE: DailyAttendanceRecord[] = [];

export const SAMPLE_STUDENTS_DATA: Student[] = [];

export const SAMPLE_PAYMENT_HISTORY_DATA: Record<string, PaymentRecord[]> = {};
