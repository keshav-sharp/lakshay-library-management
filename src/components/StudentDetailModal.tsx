import React, { useState, useEffect, useMemo } from 'react';
import { Student, DailyAttendanceRecord } from '../types/student';
import { useTheme } from '../context/ThemeContext';
import { 
  getStudentPaymentHistory, 
  getStudentDailyAttendance,
  toggleStudentAttendanceForDate,
  updateStudentCheckIn,
  subscribeToFirestore,
  formatDueDateDisplay, 
  getDaysDifference 
} from '../services/storageService';
import { 
  X, 
  ArrowLeft, 
  Calendar, 
  Phone, 
  Clock, 
  IndianRupee, 
  Receipt, 
  CheckCircle2, 
  MessageSquare, 
  AlertCircle, 
  AlertTriangle,
  Code2,
  Copy,
  Check,
  CreditCard,
  Building,
  Banknote,
  QrCode,
  Printer,
  CalendarCheck,
  Scan,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { KOTLIN_CODE_SNIPPETS } from '../data/kotlinCodeSnippets';

interface StudentDetailModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onMarkPaidClick: (student: Student) => void;
  onWhatsAppClick: (student: Student) => void;
  onQrCodeClick?: (student: Student) => void;
  onPrintCardClick?: (student: Student) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  student,
  isOpen,
  onClose,
  onMarkPaidClick,
  onWhatsAppClick,
  onQrCodeClick,
  onPrintCardClick,
}) => {
  const { darkModeClass } = useTheme();
  const [activeTab, setActiveTab] = useState<'details' | 'kotlin_code'>('details');
  const [copiedCode, setCopiedCode] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToFirestore(() => {
      setRefreshTick((t) => t + 1);
    });
    return unsub;
  }, []);

  // Reset selected day when student changes
  useEffect(() => {
    if (student) {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      setSelectedDayStr(todayKey);
    }
  }, [student?.id]);

  // Current month calendar computation
  const calendarInfo = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const todayDate = now.getDate();
    const todayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(todayDate).padStart(2, '0')}`;

    const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{
      day: number | null;
      dateStr: string | null;
      isToday: boolean;
      isPast: boolean;
      isFuture: boolean;
    }> = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ day: null, dateStr: null, isToday: false, isPast: false, isFuture: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        day: d,
        dateStr,
        isToday: d === todayDate,
        isPast: d < todayDate,
        isFuture: d > todayDate,
      });
    }

    return {
      year,
      month,
      todayDate,
      todayKey,
      monthName,
      daysInMonth,
      cells,
    };
  }, [refreshTick]);

  if (!isOpen || !student) return null;

  const paymentHistory = getStudentPaymentHistory(student.id);
  const totalAmountPaid = paymentHistory.reduce((sum, p) => sum + p.amountPaid, 0);

  // Fetch student's DailyAttendance records from Firestore
  const allAttendanceLogs = getStudentDailyAttendance(student.id);

  // Filter logs belonging to the current month
  const currentMonthPrefix = `${calendarInfo.year}-${String(calendarInfo.month + 1).padStart(2, '0')}-`;
  const currentMonthLogs = allAttendanceLogs.filter((rec) => rec.date.startsWith(currentMonthPrefix));

  // Map by YYYY-MM-DD for O(1) lookup in the calendar view
  const attendanceByDate = new Map<string, DailyAttendanceRecord>();
  currentMonthLogs.forEach((rec) => {
    attendanceByDate.set(rec.date, rec);
  });

  const daysPresentCount = attendanceByDate.size;
  const elapsedDaysInMonth = Math.max(1, calendarInfo.todayDate);
  const attendancePercentage = Math.min(100, Math.round((daysPresentCount / elapsedDaysInMonth) * 100));
  const isCheckedInToday = attendanceByDate.has(calendarInfo.todayKey);

  const selectedDayRecord = selectedDayStr ? attendanceByDate.get(selectedDayStr) : undefined;

  const diffDays = getDaysDifference(student.nextFeeDueDate);
  const isOverdue = diffDays < 0;
  const isDueSoon = diffDays >= 0 && diffDays <= 3;

  const detailSnippet = KOTLIN_CODE_SNIPPETS.find(
    (s) => s.name === 'StudentDetailScreen.kt'
  );

  const handleCopyCode = () => {
    if (detailSnippet) {
      navigator.clipboard.writeText(detailSnippet.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCheckInToday = () => {
    updateStudentCheckIn(student.id, undefined, 'QR_SCAN');
    setSelectedDayStr(calendarInfo.todayKey);
  };

  const handleToggleDateAttendance = (dateStr: string) => {
    toggleStudentAttendanceForDate(student.id, dateStr, 'MANUAL_DESK');
    setSelectedDayStr(dateStr);
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'UPI':
        return <Building className="w-3.5 h-3.5 text-amber-600" />;
      case 'Cash':
        return <Banknote className="w-3.5 h-3.5 text-emerald-500" />;
      case 'Card':
        return <CreditCard className="w-3.5 h-3.5 text-blue-500" />;
      default:
        return <Receipt className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-slate-950/55 backdrop-blur-xs animate-in fade-in duration-200 ${darkModeClass}`} onClick={onClose}>
      <div 
        className="bg-white w-full max-w-full sm:max-w-xl h-[92vh] sm:h-full rounded-t-3xl sm:rounded-t-none sm:rounded-l-3xl shadow-2xl border-t sm:border-t-0 sm:border-l border-slate-200/60 overflow-hidden flex flex-col min-w-0 animate-in slide-in-from-bottom sm:slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-amber-50/50 min-w-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 -ml-1 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-200/60 transition-colors shrink-0 touch-manipulation"
              title="Back to students list"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0 truncate">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">{student.name}</h2>
                <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                  Seat {student.seatNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{student.phoneNumber}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 shrink-0 touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {activeTab === 'details' ? (
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5 min-w-0 max-w-full">
            {/* Core Info Summary Card */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Shift Timing</span>
                  <div className="flex items-center gap-1 font-semibold text-slate-800">
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">{student.shiftTimings}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Monthly Fee</span>
                  <div className="flex items-center gap-0.5 font-bold text-slate-900 text-sm">
                    <IndianRupee className="w-3.5 h-3.5 text-slate-600" />
                    <span>₹{student.monthlyFee.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Next Due Date</span>
                  <div className="flex items-center gap-1 font-semibold text-slate-900">
                    <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>{formatDueDateDisplay(student.nextFeeDueDate)}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block mb-0.5">Fee Status</span>
                  {isOverdue ? (
                    <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                      {Math.abs(diffDays)}d Overdue
                    </span>
                  ) : isDueSoon ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      Due in {diffDays}d
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      Active (Paid)
                    </span>
                  )}
                </div>
              </div>

              {student.notes && (
                <div className="mt-3 pt-3 border-t border-slate-200/60 text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Student Note: </span>
                  {student.notes}
                </div>
              )}
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center justify-between flex-wrap gap-3 bg-amber-50/60 p-3 rounded-2xl border border-amber-200/70">
              <div className="text-xs text-amber-950">
                <span className="font-bold">Total Paid: </span>
                <span className="font-mono font-bold text-amber-800">₹{totalAmountPaid.toLocaleString('en-IN')}</span>
                <span className="text-slate-400 mx-1.5">&bull;</span>
                <span>{paymentHistory.length} payments</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {onQrCodeClick && (
                  <button
                    type="button"
                    onClick={() => onQrCodeClick(student)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-2xs"
                  >
                    <QrCode className="w-3.5 h-3.5 text-slate-600" />
                    <span>Desk QR Pass</span>
                  </button>
                )}

                {onPrintCardClick && (
                  <button
                    type="button"
                    onClick={() => onPrintCardClick(student)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>Print Badge</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onWhatsAppClick(student)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-xl transition-all shadow-2xs"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => onMarkPaidClick(student)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark Paid (+1 Mo)</span>
                </button>
              </div>
            </div>

            {/* ================================================================= */}
            {/* NEW: 'Daily Attendance' Firestore Collection & Monthly Calendar   */}
            {/* ================================================================= */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Daily Attendance &bull; {calendarInfo.monthName}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Monthly check-in history and attendance calendar
                  </p>
                </div>

                {/* Check-in Today quick button */}
                {!isCheckedInToday ? (
                  <button
                    type="button"
                    onClick={handleCheckInToday}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Log Today&apos;s Check-in</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Checked in Today
                  </span>
                )}
              </div>

              {/* Monthly Attendance Summary KPIs */}
              <div className="grid grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Days Present</span>
                  <span className="text-sm font-bold text-emerald-700">
                    {daysPresentCount} <span className="text-xs font-normal text-slate-500">/ {calendarInfo.daysInMonth} days</span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Monthly Consistency</span>
                  <span className="text-sm font-bold text-slate-900">
                    {attendancePercentage}% <span className="text-[11px] font-normal text-slate-500">(up to today)</span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Latest Check-in</span>
                  <span className="text-xs font-mono font-semibold text-slate-800">
                    {currentMonthLogs[0]
                      ? new Date(currentMonthLogs[0].checkInTime).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'No logs'}
                  </span>
                </div>
              </div>

              {/* 7-Column Calendar Grid for Current Month */}
              <div>
                <div className="grid grid-cols-7 gap-1.5 text-center mb-1.5">
                  {WEEKDAYS.map((dayName) => (
                    <div key={dayName} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider py-1">
                      {dayName}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {calendarInfo.cells.map((cell, idx) => {
                    if (!cell.day || !cell.dateStr) {
                      return <div key={`empty_${idx}`} className="h-12 rounded-xl bg-slate-50/40" />;
                    }

                    const record = attendanceByDate.get(cell.dateStr);
                    const isPresent = !!record;
                    const isSelected = selectedDayStr === cell.dateStr;

                    const checkInShortTime = record
                      ? new Date(record.checkInTime).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })
                      : null;

                    let cellStyle = 'bg-white border-slate-200 text-slate-700 hover:border-slate-300';
                    if (isPresent) {
                      cellStyle = 'bg-emerald-50/90 border-emerald-300 text-emerald-950 hover:bg-emerald-100/80';
                    } else if (cell.isPast) {
                      cellStyle = 'bg-rose-50/40 border-rose-200/60 text-slate-400 hover:bg-rose-50';
                    } else if (cell.isFuture) {
                      cellStyle = 'bg-slate-50/70 border-slate-100 text-slate-400';
                    }

                    return (
                      <button
                        key={cell.dateStr}
                        type="button"
                        onClick={() => setSelectedDayStr(cell.dateStr)}
                        className={`h-12 rounded-xl border p-1 flex flex-col items-center justify-between transition-all relative ${cellStyle} ${
                          cell.isToday ? 'ring-2 ring-amber-500 ring-offset-1' : ''
                        } ${isSelected ? 'shadow-sm ring-2 ring-slate-900' : ''}`}
                        title={
                          isPresent
                            ? `Checked in on ${cell.dateStr} at ${checkInShortTime} (${record.verificationMethod})`
                            : `No check-in logged on ${cell.dateStr}`
                        }
                      >
                        <div className="w-full flex items-center justify-between px-1">
                          <span className={`text-xs font-bold ${cell.isToday ? 'text-amber-700' : ''}`}>
                            {cell.day}
                          </span>
                          {isPresent ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          ) : cell.isPast ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-300 shrink-0" />
                          ) : null}
                        </div>

                        {isPresent ? (
                          <span className="text-[10px] font-mono font-semibold text-emerald-700 tracking-tighter">
                            {checkInShortTime}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400">
                            {cell.isToday ? 'Today' : cell.isPast ? 'Absent' : '—'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-between flex-wrap gap-2 mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      Present (Checked-in)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-300 inline-block" />
                      Absent
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full border-2 border-amber-500 inline-block" />
                      Today
                    </span>
                  </div>
                  <span className="text-slate-400">Click any date to inspect or toggle log</span>
                </div>
              </div>

              {/* Selected Date Attendance Log Inspector Bar */}
              {selectedDayStr && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
                  {selectedDayRecord ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <Scan className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{formatDueDateDisplay(selectedDayStr)} &bull; Present</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            {selectedDayRecord.verificationMethod === 'QR_SCAN' ? 'QR Scan' : 'Manual Desk'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Checked in at{' '}
                          <strong className="text-slate-700">
                            {new Date(selectedDayRecord.checkInTime).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </strong>{' '}
                          &bull; Seat {selectedDayRecord.seatNumber}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">
                          {formatDueDateDisplay(selectedDayStr)} &bull; No Check-in Recorded
                        </div>
                        <p className="text-[11px] text-slate-500">
                          No attendance document found in <code className="font-mono">DailyAttendance</code> for this date.
                        </p>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleToggleDateAttendance(selectedDayStr)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                      selectedDayRecord
                        ? 'bg-white border border-rose-200 text-rose-700 hover:bg-rose-50'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                    }`}
                  >
                    {selectedDayRecord ? 'Remove Log' : 'Mark Present'}
                  </button>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Payment History
                  </h3>
                </div>

                <span className="text-xs text-slate-500 font-medium">
                  {paymentHistory.length} payments
                </span>
              </div>

              {paymentHistory.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">No payment logs found yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    When this student renews their fee, payment records will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {paymentHistory.map((record, index) => {
                    const paymentDate = new Date(record.paymentDate);
                    const formattedDate = paymentDate.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    });
                    const formattedTime = paymentDate.toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div 
                        key={record.id}
                        className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-amber-200 transition-all flex items-center justify-between shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                            {getModeIcon(record.paymentMode)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900">
                                ₹{record.amountPaid.toLocaleString('en-IN')}
                              </span>
                              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {record.paymentMode}
                              </span>
                              {index === 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider">
                                  Latest
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {formattedDate} &bull; {formattedTime}
                            </p>
                            {record.note && (
                              <p className="text-[11px] text-slate-400 italic mt-0.5">
                                {record.note}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-mono text-xs font-semibold text-slate-600 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                            {record.receiptNumber || record.id}
                          </div>
                          <span className="text-[10px] text-emerald-600 font-semibold block mt-1">
                            Verified in Firestore
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Kotlin Jetpack Compose Code Tab */
          <div className="flex-1 overflow-hidden flex flex-col bg-slate-900 text-slate-200">
            <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="font-mono text-slate-300">StudentDetailScreen.kt (DailyAttendance + PaymentHistory)</span>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-white transition-colors"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Composable</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3 bg-slate-800/50 text-[11px] text-slate-300 border-b border-slate-700 flex items-center gap-2">
              <Receipt className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                Demonstrates real-time Flow collection on <code>DailyAttendance</code> (current month calendar grid) and <code>students/{'{studentId}'}/PaymentHistory</code>.
              </span>
            </div>

            <pre className="flex-1 overflow-auto p-4 text-xs font-mono leading-relaxed text-amber-200 selection:bg-amber-500 selection:text-white">
              {detailSnippet?.code}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
