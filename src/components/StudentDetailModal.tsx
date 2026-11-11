import React, { useState, useEffect } from 'react';
import { Student, PaymentRecord } from '../types/student';
import { useTheme } from '../context/ThemeContext';
import { 
  getStudentPaymentHistory, 
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
  Sparkles,
  Download,
  FileText
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
  onOpenReceipt?: (record: PaymentRecord, student: Student) => void;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  student,
  isOpen,
  onClose,
  onMarkPaidClick,
  onWhatsAppClick,
  onQrCodeClick,
  onPrintCardClick,
  onOpenReceipt,
}) => {
  const { darkModeClass } = useTheme();
  const [activeTab, setActiveTab] = useState<'details' | 'kotlin_code'>('details');
  const [copiedCode, setCopiedCode] = useState(false);
  const [, setRefreshTick] = useState(0);

  useEffect(() => {
    const unsub = subscribeToFirestore(() => {
      setRefreshTick((t) => t + 1);
    });
    return unsub;
  }, []);

  if (!isOpen || !student) return null;

  const paymentHistory = getStudentPaymentHistory(student.id);
  const totalAmountPaid = paymentHistory.reduce((sum, p) => sum + p.amountPaid, 0);

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

        {/* Tab switch bar: Details vs Kotlin Code */}
        <div className="px-4 sm:px-6 pt-2 pb-0 bg-slate-50 border-b border-slate-200/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`px-3 py-1.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === 'details'
                  ? 'text-amber-700 border-amber-600 bg-white shadow-2xs'
                  : 'text-slate-500 border-transparent hover:text-slate-800'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Student &amp; Fee Ledger</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('kotlin_code')}
              className={`px-3 py-1.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === 'kotlin_code'
                  ? 'text-amber-700 border-amber-600 bg-white shadow-2xs'
                  : 'text-slate-500 border-transparent hover:text-slate-800'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Android Compose Code</span>
            </button>
          </div>

          <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
            ID: {student.id.slice(-8).toUpperCase()}
          </span>
        </div>

        {activeTab === 'details' ? (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1 min-w-0">
            {/* Quick Status Pill Bar */}
            <div className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-slate-600 font-medium">Shift:</span>
                <span className="font-semibold text-slate-900">{student.shiftTimings}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-medium">Status:</span>
                {isOverdue ? (
                  <span className="px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-700 flex items-center gap-1 text-[11px]">
                    <AlertCircle className="w-3 h-3" />
                    Overdue ({Math.abs(diffDays)}d)
                  </span>
                ) : isDueSoon ? (
                  <span className="px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 flex items-center gap-1 text-[11px]">
                    <AlertTriangle className="w-3 h-3" />
                    Due in {diffDays}d
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="w-3 h-3" />
                    Active (Paid)
                  </span>
                )}
              </div>
            </div>

            {/* Fee Overview Card */}
            <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent rounded-2xl border border-amber-200/70 p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Fee Subscription Summary
                </span>
                <span className="text-xs font-mono text-slate-500">
                  Total Paid: ₹{totalAmountPaid.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3 bg-white/80 rounded-xl border border-amber-200/50">
                  <span className="text-[11px] text-slate-500 block">Monthly Rate</span>
                  <span className="text-base sm:text-lg font-bold font-mono text-slate-900">
                    ₹{student.monthlyFee.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="p-3 bg-white/80 rounded-xl border border-amber-200/50">
                  <span className="text-[11px] text-slate-500 block">Next Due Date</span>
                  <span className={`text-base sm:text-lg font-bold font-mono ${isOverdue ? 'text-rose-600' : isDueSoon ? 'text-amber-700' : 'text-slate-900'}`}>
                    {formatDueDateDisplay(student.nextFeeDueDate)}
                  </span>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="pt-2 flex items-center justify-end gap-2 flex-wrap">
                {onQrCodeClick && (
                  <button
                    type="button"
                    onClick={() => onQrCodeClick(student)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-2xs"
                    title="Desk Pass"
                  >
                    <QrCode className="w-3.5 h-3.5 text-slate-500" />
                    <span>Desk Pass</span>
                  </button>
                )}

                {onPrintCardClick && (
                  <button
                    type="button"
                    onClick={() => onPrintCardClick(student)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-2xs"
                    title="Print Desk Card"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
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

            {/* Payment History & PDF Receipts Ledger */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Payment History &amp; Fee Receipts
                  </h3>
                </div>

                <span className="text-xs text-slate-500 font-medium">
                  {paymentHistory.length} payments recorded
                </span>
              </div>

              {paymentHistory.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">No payment logs found yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    When this student renews their fee, payment records and PDF receipts will appear here.
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
                        className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-amber-300 transition-all flex items-center justify-between shadow-2xs gap-3 flex-wrap"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                            {getModeIcon(record.paymentMode)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
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
                              <p className="text-[11px] text-slate-400 italic mt-0.5 truncate">
                                {record.note}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-2">
                          <div>
                            <div className="font-mono text-xs font-semibold text-slate-600 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                              {record.receiptNumber || record.id}
                            </div>
                            <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
                              Verified in Ledger
                            </span>
                          </div>

                          {onOpenReceipt && (
                            <button
                              type="button"
                              onClick={() => onOpenReceipt(record, student)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-xl transition-all inline-flex items-center gap-1 shadow-2xs"
                              title="View & Download PDF Receipt"
                            >
                              <FileText className="w-3.5 h-3.5 text-amber-600" />
                              <span>Receipt</span>
                            </button>
                          )}
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
                <span className="font-mono text-slate-300">StudentDetailScreen.kt (PaymentHistory + PDF Receipts)</span>
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
                Demonstrates real-time Flow collection on <code>students/{'{studentId}'}/PaymentHistory</code> with offline PDF receipt rendering.
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
