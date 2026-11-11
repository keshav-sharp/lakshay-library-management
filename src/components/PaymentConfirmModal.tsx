import React, { useState } from 'react';
import { PaymentRecord, Student } from '../types/student';
import { useTheme } from '../context/ThemeContext';
import { markStudentPaidInFirestore, advanceDateByOneMonth, formatDueDateDisplay } from '../services/storageService';
import { 
  CheckCircle2, 
  X, 
  Calendar, 
  IndianRupee, 
  Armchair, 
  ArrowRight, 
  Sparkles,
  CreditCard,
  Building,
  Banknote
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PaymentConfirmModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess?: (record?: PaymentRecord, updatedStudent?: Student) => void;
}

export const PaymentConfirmModal: React.FC<PaymentConfirmModalProps> = ({
  student,
  isOpen,
  onClose,
  onPaymentSuccess,
}) => {
  const { darkModeClass } = useTheme();
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'Cash' | 'Card' | 'Bank Transfer'>('UPI');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stable idempotency key per modal open session to guarantee zero duplicate submissions
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    student ? `idemp_${student.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` : ''
  );

  if (!isOpen || !student) return null;

  const currentFee = customAmount ? parseFloat(customAmount) : student.monthlyFee;
  const nextDate = advanceDateByOneMonth(student.nextFeeDueDate);

  const handleConfirm = () => {
    setErrorMessage(null);

    // Validate fee amount
    if (typeof currentFee !== 'number' || Number.isNaN(currentFee) || !Number.isFinite(currentFee) || currentFee <= 0) {
      setErrorMessage('Please enter a valid positive payment amount.');
      return;
    }
    if (currentFee > 10_000_000) {
      setErrorMessage('Payment amount exceeds maximum limit (₹1 Crore).');
      return;
    }

    setIsProcessing(true);

    setTimeout(() => {
      try {
        const { updatedStudent, newRecord } = markStudentPaidInFirestore(
          student.id,
          currentFee,
          paymentMode,
          note || `Monthly renewal (${paymentMode})`,
          {
            transactionId: transactionId.trim() || undefined,
            idempotencyKey,
          }
        );

        // Fire festive confetti
        try {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.65 }
          });
        } catch {
          // ignore if canvas not supported
        }

        setIsProcessing(false);
        onClose();
        if (onPaymentSuccess) {
          onPaymentSuccess(newRecord, updatedStudent);
        }
      } catch (err) {
        console.error('Payment confirmation error', err);
        setErrorMessage(err instanceof Error ? err.message : 'Failed to record payment');
        setIsProcessing(false);
      }
    }, 450);
  };


  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 ${darkModeClass}`}>
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (Android Material 3 AlertDialog style) */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Confirm Fee Collection
              </h3>
              <p className="text-xs text-slate-500">
                Lakshay Library Desk &bull; Seat {student.seatNumber}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-2 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <span className="font-bold">Error:</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Student Name</span>
              <span className="text-sm font-bold text-slate-900">{student.name}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Shift</span>
              <span className="text-xs font-medium text-slate-700">{student.shiftTimings}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Fee Amount</span>
              <span className="text-base font-bold text-indigo-600">
                ₹{student.monthlyFee.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Due Date Advancement Preview */}
            <div className="pt-2 border-t border-slate-200/70">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Due Date Extension (+1 Month)
              </span>
              <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 text-xs">
                <span className="text-rose-600 font-medium line-through">
                  {formatDueDateDisplay(student.nextFeeDueDate)}
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  {formatDueDateDisplay(nextDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Payment Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMode('UPI')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                  paymentMode === 'UPI'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-500'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Building className="w-4 h-4 text-indigo-500" />
                <span>UPI (GPay/Paytm)</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode('Cash')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                  paymentMode === 'Cash'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>Cash at Desk</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMode('Card')}
                className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                  paymentMode === 'Card'
                    ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span>Card / POS</span>
              </button>
            </div>
          </div>

          {/* Transaction / UTR ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Transaction Ref / UTR / Cheque No. (Optional)
            </label>
            <input
              type="text"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="e.g. UPI Ref / UTR / Cheque Number"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          {/* Receipt Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Receipt Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Paid in full for upcoming month"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <p className="text-[11px] text-slate-400">
            Confirming will write a timestamped record to the student&apos;s <code className="text-indigo-600 font-mono">PaymentHistory</code> sub-collection and automatically generate an official offline PDF Fee Receipt.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/50 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 rounded-xl shadow-sm transition-all"
          >
            {isProcessing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Updating Firestore...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Paid &bull; ₹{currentFee}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
