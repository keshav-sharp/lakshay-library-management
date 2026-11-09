import React from 'react';
import { Student } from '../types/student';
import { getDaysDifference, formatDueDateDisplay } from '../services/storageService';
import {
  Phone,
  Clock,
  Calendar,
  MessageSquare,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  Receipt,
  QrCode,
  Printer,
  CheckSquare,
  Square,
} from 'lucide-react';
import { ThemeColors } from '../types/theme';

interface StudentCardProps {
  student: Student;
  paymentCount: number;
  onWhatsAppClick: (student: Student) => void;
  onMarkPaidClick: (student: Student) => void;
  onViewDetails: (student: Student) => void;
  onQrCodeClick?: (student: Student) => void;
  onPrintCardClick?: (student: Student) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (studentId: string) => void;
  theme?: ThemeColors;
}

export const StudentCard: React.FC<StudentCardProps> = ({
  student,
  paymentCount,
  onWhatsAppClick,
  onMarkPaidClick,
  onViewDetails,
  onQrCodeClick,
  onPrintCardClick,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  theme,
}) => {
  const diffDays = getDaysDifference(student.nextFeeDueDate);
  const isOverdue = diffDays < 0;
  const isDueSoon = diffDays >= 0 && diffDays <= 3;

  const getStatusBadge = () => {
    if (isOverdue) {
      const days = Math.abs(diffDays);
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/70">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          <AlertCircle className="w-3 h-3 text-rose-600" />
          {days === 1 ? '1d overdue' : `${days}d overdue`}
        </span>
      );
    }
    if (isDueSoon) {
      let text = 'Due today';
      if (diffDays === 1) text = 'Due tomorrow';
      else if (diffDays > 1) text = `Due in ${diffDays}d`;

      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/70">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          {text}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        Due in {diffDays}d
      </span>
    );
  };

  return (
    <div
      className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
        isSelected
          ? 'border-amber-500/80 bg-amber-50/20 ring-2 ring-amber-400/50 shadow-md'
          : 'border-slate-200/60 shadow-sm hover:shadow-md'
      }`}
    >
      <div className="p-4 sm:p-5">
        {/* Header row: Checkbox + Name & Seat / Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Multi-select checkbox */}
            {isSelectionMode && onToggleSelect && (
              <button
                type="button"
                onClick={() => onToggleSelect(student.id)}
                className={`mt-0.5 p-1 rounded-lg transition-all ${
                  isSelected
                    ? 'text-amber-600 bg-amber-100'
                    : 'text-slate-400 hover:text-slate-600 bg-slate-100'
                }`}
                title={isSelected ? 'Deselect student' : 'Select for bulk action'}
              >
                {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              </button>
            )}

            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() =>
                isSelectionMode && onToggleSelect
                  ? onToggleSelect(student.id)
                  : onViewDetails(student)
              }
            >
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 hover:text-amber-600 transition-colors truncate">
                  {student.name}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200/60">
                  Seat {student.seatNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>{student.phoneNumber}</span>
              </p>
            </div>
          </div>

          <div className="shrink-0">{getStatusBadge()}</div>
        </div>

        {/* Unified Compact Metrics Strip inside Student Card */}
        <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/60 bg-slate-50/70 rounded-xl border border-slate-200/60 overflow-hidden">
          <div className="px-3 py-2">
            <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500">
              Shift Schedule
            </span>
            <div className="mt-0.5 text-xs font-semibold text-slate-800 truncate flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="truncate">{student.shiftTimings.split('(')[0].trim()}</span>
            </div>
          </div>

          <div className="px-3 py-2">
            <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500">
              Next Due Date
            </span>
            <div className="mt-0.5 text-xs font-bold text-slate-900 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{formatDueDateDisplay(student.nextFeeDueDate)}</span>
            </div>
          </div>

          <div className="px-3 py-2">
            <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500">
              Monthly Fee
            </span>
            <div className="mt-0.5 text-xs font-bold text-slate-900 font-mono">
              ₹{student.monthlyFee.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="px-3 py-2 flex items-center justify-between sm:justify-start">
            <div>
              <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                History
              </span>
              <button
                type="button"
                onClick={() => onViewDetails(student)}
                className="mt-0.5 flex items-center gap-1 text-amber-600 hover:text-amber-700 font-semibold text-xs"
              >
                <Receipt className="w-3 h-3" />
                <span>{paymentCount} logs</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-3.5 pt-3 border-t border-slate-200/60 flex items-center gap-2 justify-end flex-wrap">
          {onQrCodeClick && (
            <button
              type="button"
              onClick={() => onQrCodeClick(student)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100/80 hover:bg-slate-200/70 active:scale-95 border border-slate-200/60 rounded-xl transition-all"
              title="Generate Digital Desk Pass with QR Code"
            >
              <QrCode className="w-3.5 h-3.5 text-slate-500" />
              <span>QR Pass</span>
            </button>
          )}

          {onPrintCardClick && (
            <button
              type="button"
              onClick={() => onPrintCardClick(student)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100/80 hover:bg-slate-200/70 active:scale-95 border border-slate-200/60 rounded-xl transition-all"
              title="Print Physical Library Membership Badge"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Badge</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onWhatsAppClick(student)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:scale-95 border border-emerald-200/60 rounded-xl transition-all"
            title="Open WhatsApp with pre-filled fee reminder"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={() => onMarkPaidClick(student)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white ${
              theme?.primary || 'bg-amber-600'
            } ${
              theme?.primaryHover || 'hover:bg-amber-500'
            } active:scale-95 shadow-sm hover:shadow-md rounded-xl transition-all`}
            title="Confirm payment and advance due date by 1 month"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Mark Paid</span>
          </button>
        </div>
      </div>
    </div>
  );
};
