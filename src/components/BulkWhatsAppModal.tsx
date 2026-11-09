import React, { useState } from 'react';
import { Student } from '../types/student';
import { ThemeColors } from '../types/theme';
import { useTheme } from '../context/ThemeContext';
import { formatDueDateDisplay, getDaysDifference } from '../services/storageService';
import { 
  X, 
  MessageSquare, 
  Send, 
  Check, 
  Copy, 
  ExternalLink, 
  Users, 
  ChevronRight, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';

interface BulkWhatsAppModalProps {
  students: Student[];
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeColors;
}

export const BulkWhatsAppModal: React.FC<BulkWhatsAppModalProps> = ({
  students,
  isOpen,
  onClose,
}) => {
  const { darkModeClass } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sentStudentIds, setSentStudentIds] = useState<Set<string>>(new Set());
  const [copiedAll, setCopiedAll] = useState(false);

  if (!isOpen || students.length === 0) return null;

  const currentStudent = students[currentIndex] || students[0];

  const generateMessage = (student: Student) => {
    const dueDate = formatDueDateDisplay(student.nextFeeDueDate);
    const diff = getDaysDifference(student.nextFeeDueDate);
    let urgency = 'is due soon';
    if (diff < 0) urgency = `is OVERDUE by ${Math.abs(diff)} days`;
    else if (diff === 0) urgency = 'is due TODAY';
    else if (diff <= 3) urgency = `is due in ${diff} days (${dueDate})`;

    return `Hello ${student.name}, this is a reminder from Lakshay Library that your monthly fee of ₹${student.monthlyFee} ${urgency} for Seat ${student.seatNumber} (${student.shiftTimings}). Please pay at the front desk or via UPI to maintain your reserved desk. Thank you!`;
  };

  const handleSendCurrent = () => {
    const cleanPhone = currentStudent.phoneNumber.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(generateMessage(currentStudent));
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');

    setSentStudentIds((prev) => new Set(prev).add(currentStudent.id));
    if (currentIndex < students.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleCopyAll = () => {
    const allText = students
      .map((s, idx) => `[Student ${idx + 1}/${students.length}] ${s.name} (${s.phoneNumber}):\n${generateMessage(s)}\n`)
      .join('\n----------------------------------------\n\n');
    navigator.clipboard.writeText(allText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const progressPercent = Math.round((sentStudentIds.size / students.length) * 100);

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 ${darkModeClass}`}>
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-600 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 border border-white/20">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Bulk WhatsApp Fee Reminders
              </h3>
              <p className="text-xs text-white/80">
                Lakshay Library &bull; Batch reminder dispatch queue ({students.length} recipients)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="bg-slate-100 h-1.5 w-full overflow-hidden">
          <div 
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Dispatch Summary */}
          <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-slate-900">{students.length} Students Selected</span>
              <span className="text-slate-400">&bull;</span>
              <span className="text-slate-600 font-semibold">{sentStudentIds.size} Reminders Dispatched</span>
            </div>

            <button
              type="button"
              onClick={handleCopyAll}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs hover:bg-emerald-50"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAll ? 'Copied All to Clipboard!' : 'Copy All Texts'}</span>
            </button>
          </div>

          {/* Current Student in Queue */}
          <div className="p-4 bg-emerald-50/70 border-2 border-emerald-300 rounded-3xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Current Queue Target ({currentIndex + 1} of {students.length})
              </span>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                Seat {currentStudent.seatNumber}
              </span>
            </div>

            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900">{currentStudent.name}</h4>
                <p className="text-xs text-slate-600 font-mono">{currentStudent.phoneNumber}</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-emerald-700">₹{currentStudent.monthlyFee}</span>
                <span className="block text-[10px] text-slate-500">{formatDueDateDisplay(currentStudent.nextFeeDueDate)}</span>
              </div>
            </div>

            {/* Formatted Message Preview */}
            <div className="p-3 bg-white rounded-2xl border border-emerald-200 text-xs text-slate-800 leading-relaxed font-sans shadow-2xs">
              {generateMessage(currentStudent)}
            </div>

            {/* Send Button for Current */}
            <div className="flex items-center justify-end gap-2 pt-1">
              {currentIndex < students.length - 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => prev + 1)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  Skip Student
                </button>
              )}

              <button
                type="button"
                onClick={handleSendCurrent}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>
                  {sentStudentIds.has(currentStudent.id) ? 'Re-open in WhatsApp' : 'Send WhatsApp Reminder'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List of all queue students */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              All Selected Recipients ({students.length})
            </h4>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {students.map((s, idx) => {
                const isSent = sentStudentIds.has(s.id);
                const isCurrent = idx === currentIndex;

                return (
                  <div
                    key={s.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`p-3 rounded-2xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                      isCurrent
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-400'
                        : isSent
                        ? 'border-slate-200 bg-slate-50/80 text-slate-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isSent ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {isSent ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <div>
                        <div className="font-bold">{s.name}</div>
                        <div className="text-[11px] text-slate-400">Seat {s.seatNumber} &bull; {s.phoneNumber}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">₹{s.monthlyFee}</span>
                      {isSent ? (
                        <span className="text-[10px] text-emerald-600 font-bold px-2 py-0.5 rounded-full bg-emerald-100">
                          Sent
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-700 font-bold px-2 py-0.5 rounded-full bg-amber-100">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {sentStudentIds.size} of {students.length} completed
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-xl"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
