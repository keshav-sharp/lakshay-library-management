export interface PaymentRecord {
  id: string;
  studentId: string;
  paymentDate: string; // ISO string
  amountPaid: number;
  amountPaise?: number; // Integer paise for financial calculation & validation
  paymentMode: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer';
  receiptNumber: string;
  note?: string;
  studentName?: string;
  studentPhone?: string;
  seatNumber?: string;
  shiftTimings?: string; // Immutable snapshot of student shift at payment time
  idempotencyKey?: string; // Client submission idempotency key to prevent double charging
  transactionId?: string;
  feePeriod?: string;
  discount?: number;
  previousBalance?: number;
  remainingBalance?: number;
}


export interface DailyAttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  seatNumber: string;
  shiftTimings: string;
  date: string;        // YYYY-MM-DD
  checkInTime: string; // ISO string
  verificationMethod: 'QR_SCAN' | 'MANUAL_DESK';
}

export interface Student {
  id: string;
  name: string;
  phoneNumber: string;
  seatNumber: string;
  shiftTimings: string; // e.g. "08:00 AM - 02:00 PM"
  monthlyFee: number;
  nextFeeDueDate: string; // YYYY-MM-DD
  admissionDate: string;  // YYYY-MM-DD
  notes?: string;
  lastCheckIn?: string;   // ISO timestamp of latest library check-in
  photoUrl?: string;      // Student camera photo data URL
  status?: 'active' | 'archived';
  archivedAt?: string;
  archivedSeatNumber?: string;
  updatedAt?: string;
}

export type TabScreen = 'ALL' | 'DUE_SOON' | 'OVERDUE' | 'ANALYTICS';

export interface ShiftOption {
  label: string;
  timings: string;
  badgeColor: string;
}

export const STANDARD_SHIFTS: ShiftOption[] = [
  { label: 'Morning Shift', timings: '08:00 AM - 02:00 PM', badgeColor: 'bg-amber-100 text-amber-800 border-amber-300' },
  { label: 'Evening Shift', timings: '02:00 PM - 08:00 PM', badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { label: 'Full Day Shift', timings: '08:00 AM - 08:00 PM', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { label: 'Night Owl Shift', timings: '08:00 PM - 02:00 AM', badgeColor: 'bg-purple-100 text-purple-800 border-purple-300' },
];
