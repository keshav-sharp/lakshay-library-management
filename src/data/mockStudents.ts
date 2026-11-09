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

// Example student IDs that were previously used as demo seed data (auto-purged from storage)
export const LEGACY_EXAMPLE_STUDENT_IDS = new Set([
  'std_001',
  'std_002',
  'std_003',
  'std_004',
  'std_005',
  'std_006',
  'std_007',
  'std_008',
]);

// Clean production defaults: 0 example students
export const INITIAL_STUDENTS: Student[] = [];

export const INITIAL_PAYMENT_HISTORY: Record<string, PaymentRecord[]> = {};

export const generateInitialDailyAttendance = (): DailyAttendanceRecord[] => [];

export const INITIAL_DAILY_ATTENDANCE: DailyAttendanceRecord[] = [];

// Realistic Previous / Demo Library Dataset for "Restore Previous Data" action under the 3-bar menu
export const SAMPLE_STUDENTS_DATA: Student[] = [
  {
    id: 'std_prev_101',
    name: 'Aryan Sharma',
    phoneNumber: '+91 98765 43210',
    seatNumber: 'A-01',
    shiftTimings: '08:00 AM - 02:00 PM',
    monthlyFee: 1200,
    admissionDate: offsetDateString(-90),
    nextFeeDueDate: offsetDateString(-6), // Overdue by 6 days
    notes: 'Preparing for UPSC Civil Services. Reserved front corner desk.',
  },
  {
    id: 'std_prev_102',
    name: 'Priya Patel',
    phoneNumber: '+91 98234 56789',
    seatNumber: 'A-04',
    shiftTimings: '02:00 PM - 08:00 PM',
    monthlyFee: 1200,
    admissionDate: offsetDateString(-60),
    nextFeeDueDate: offsetDateString(1), // Due in 1 day
    notes: 'Preparing for CA Final exams.',
  },
  {
    id: 'std_prev_103',
    name: 'Mohammed Faisal',
    phoneNumber: '+91 94432 98765',
    seatNumber: 'C-09',
    shiftTimings: '08:00 AM - 08:00 PM',
    monthlyFee: 1800,
    admissionDate: offsetDateString(-120),
    nextFeeDueDate: offsetDateString(-9), // Overdue by 9 days
    notes: 'Full day pass holder, quiet aisle preferred.',
  },
  {
    id: 'std_prev_104',
    name: 'Ananya Verma',
    phoneNumber: '+91 91234 87654',
    seatNumber: 'B-02',
    shiftTimings: '08:00 AM - 02:00 PM',
    monthlyFee: 1200,
    admissionDate: offsetDateString(-45),
    nextFeeDueDate: offsetDateString(2), // Due in 2 days
    notes: 'GATE exam preparation.',
  },
  {
    id: 'std_prev_105',
    name: 'Rohan Gupta',
    phoneNumber: '+91 97654 32109',
    seatNumber: 'B-06',
    shiftTimings: '02:00 PM - 08:00 PM',
    monthlyFee: 1200,
    admissionDate: offsetDateString(-30),
    nextFeeDueDate: offsetDateString(14), // Upcoming in 14 days
    notes: 'State PSC aspirant.',
  },
  {
    id: 'std_prev_106',
    name: 'Sneha Kulkarni',
    phoneNumber: '+91 96543 21098',
    seatNumber: 'C-03',
    shiftTimings: '08:00 AM - 08:00 PM',
    monthlyFee: 1800,
    admissionDate: offsetDateString(-80),
    nextFeeDueDate: offsetDateString(-2), // Overdue by 2 days
    notes: 'NEET PG preparation.',
  },
  {
    id: 'std_prev_107',
    name: 'Vikram Singh',
    phoneNumber: '+91 95432 10987',
    seatNumber: 'D-01',
    shiftTimings: '08:00 PM - 02:00 AM',
    monthlyFee: 1000,
    admissionDate: offsetDateString(-40),
    nextFeeDueDate: offsetDateString(20), // Upcoming in 20 days
    notes: 'Night shift self-study.',
  },
  {
    id: 'std_prev_108',
    name: 'Neha Sharma',
    phoneNumber: '+91 94321 09876',
    seatNumber: 'D-05',
    shiftTimings: '08:00 AM - 02:00 PM',
    monthlyFee: 1200,
    admissionDate: offsetDateString(-25),
    nextFeeDueDate: offsetDateString(18), // Upcoming in 18 days
    notes: 'SSC CGL preparation.',
  },
];

export const SAMPLE_PAYMENT_HISTORY_DATA: Record<string, PaymentRecord[]> = {
  std_prev_101: [
    {
      id: 'pay_p101_1',
      studentId: 'std_prev_101',
      amountPaid: 1200,
      paymentDate: offsetDateString(-36),
      receiptNumber: 'RCP-2026-101',
      paymentMode: 'UPI',
      note: 'Initial enrollment payment via GPay',
    },
  ],
  std_prev_102: [
    {
      id: 'pay_p102_1',
      studentId: 'std_prev_102',
      amountPaid: 1200,
      paymentDate: offsetDateString(-29),
      receiptNumber: 'RCP-2026-102',
      paymentMode: 'UPI',
      note: 'Fee payment via PhonePe',
    },
  ],
  std_prev_103: [
    {
      id: 'pay_p103_1',
      studentId: 'std_prev_103',
      amountPaid: 1800,
      paymentDate: offsetDateString(-39),
      receiptNumber: 'RCP-2026-103',
      paymentMode: 'Cash',
      note: 'Collected cash at front reception',
    },
  ],
  std_prev_104: [
    {
      id: 'pay_p104_1',
      studentId: 'std_prev_104',
      amountPaid: 1200,
      paymentDate: offsetDateString(-28),
      receiptNumber: 'RCP-2026-104',
      paymentMode: 'UPI',
      note: 'Paytm UPI transfer',
    },
  ],
  std_prev_105: [
    {
      id: 'pay_p105_1',
      studentId: 'std_prev_105',
      amountPaid: 1200,
      paymentDate: offsetDateString(-16),
      receiptNumber: 'RCP-2026-105',
      paymentMode: 'UPI',
      note: 'Monthly fee renewed',
    },
  ],
  std_prev_106: [
    {
      id: 'pay_p106_1',
      studentId: 'std_prev_106',
      amountPaid: 1800,
      paymentDate: offsetDateString(-32),
      receiptNumber: 'RCP-2026-106',
      paymentMode: 'Card',
      note: 'POS swipe at desk',
    },
  ],
  std_prev_107: [
    {
      id: 'pay_p107_1',
      studentId: 'std_prev_107',
      amountPaid: 1000,
      paymentDate: offsetDateString(-10),
      receiptNumber: 'RCP-2026-107',
      paymentMode: 'UPI',
      note: 'Night owl shift fee paid',
    },
  ],
  std_prev_108: [
    {
      id: 'pay_p108_1',
      studentId: 'std_prev_108',
      amountPaid: 1200,
      paymentDate: offsetDateString(-12),
      receiptNumber: 'RCP-2026-108',
      paymentMode: 'Cash',
      note: 'Cash received at desk',
    },
  ],
};
