import React, { useState, useEffect } from 'react';
import { ShiftItem } from '../types/shift';
import { ThemeColors } from '../types/theme';
import { useTheme } from '../context/ThemeContext';
import { 
  addStudentToFirestore, 
  getStoredStudents, 
  advanceDateByOneMonth, 
  formatDueDateDisplay 
} from '../services/storageService';
import { addCustomSeat, getStoredSeats } from '../services/seatService';
import { 
  X, 
  User, 
  Phone, 
  Armchair, 
  Clock, 
  IndianRupee, 
  Calendar, 
  Save, 
  Code2, 
  Check, 
  Copy,
  Info,
  Settings2,
  Plus
} from 'lucide-react';
import { KOTLIN_CODE_SNIPPETS } from '../data/kotlinCodeSnippets';

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentAdded?: () => void;
  suggestedSeat?: string;
  theme: ThemeColors;
  shifts: ShiftItem[];
  onOpenShiftManager: () => void;
  onOpenSeatManager?: () => void;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({
  isOpen,
  onClose,
  onStudentAdded,
  suggestedSeat,
  theme,
  shifts,
  onOpenShiftManager,
  onOpenSeatManager,
}) => {
  const { darkModeClass } = useTheme();
  const [activeTab, setActiveTab] = useState<'form' | 'kotlin_code'>('form');

  // Form states
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(''); // Strict 10-digit phone number
  const [seatNumber, setSeatNumber] = useState(suggestedSeat || '');
  
  // Selected Shift or Custom Shift mode
  const [selectedShiftId, setSelectedShiftId] = useState<string>(shifts[0]?.id || 'custom');
  const [isCustomShift, setIsCustomShift] = useState(false);
  const [customShiftTimings, setCustomShiftTimings] = useState('');

  const [monthlyFee, setMonthlyFee] = useState(shifts[0]?.defaultFee?.toString() || '1200');
  
  // Payment Recorded Date replaces manual nextFeeDueDate picker; auto-calculates exactly 1 month ahead
  const getTodayDateStr = () => new Date().toISOString().split('T')[0];
  const [paymentDate, setPaymentDate] = useState<string>(getTodayDateStr());
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'Cash' | 'Card' | 'Bank Transfer'>('UPI');
  const [nextFeeDueDate, setNextFeeDueDate] = useState<string>(() => advanceDateByOneMonth(getTodayDateStr()));
  const [notes, setNotes] = useState('');

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successAnimation, setSuccessAnimation] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (suggestedSeat) {
      setSeatNumber(suggestedSeat);
    }
  }, [suggestedSeat]);

  // When shift selection changes, auto-fill default fee
  const handleShiftSelect = (shiftId: string) => {
    setSelectedShiftId(shiftId);
    if (shiftId === 'custom') {
      setIsCustomShift(true);
    } else {
      setIsCustomShift(false);
      const shift = shifts.find((s) => s.id === shiftId);
      if (shift) {
        setMonthlyFee(shift.defaultFee.toString());
      }
    }
  };

  // Strictly filter non-numeric characters and limit to 10 digits
  const handlePhoneChange = (val: string) => {
    const rawDigits = val.replace(/\D/g, '').slice(0, 10);
    setPhoneNumber(rawDigits);
    if (errors.phoneNumber) {
      setErrors((prev) => ({ ...prev, phoneNumber: '' }));
    }
  };

  // Change payment recorded date and automatically recalculate nextFeeDueDate as 1 month ahead
  const handlePaymentDateChange = (newDate: string) => {
    setPaymentDate(newDate);
    if (newDate) {
      setNextFeeDueDate(advanceDateByOneMonth(newDate));
    }
    if (errors.paymentDate) {
      setErrors((prev) => ({ ...prev, paymentDate: '' }));
    }
  };

  if (!isOpen) return null;

  const occupiedSeats = new Set(
    getStoredStudents().map((s) => s.seatNumber.toUpperCase())
  );
  const vacantSeats = getStoredSeats()
    .map((s) => s.seatNumber)
    .filter((seat) => !occupiedSeats.has(seat.toUpperCase()))
    .slice(0, 6);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Full name is required';
    
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (!cleanPhone) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (cleanPhone.length !== 10) {
      newErrors.phoneNumber = 'Enter exactly 10-digit mobile number';
    }

    if (!seatNumber.trim()) newErrors.seatNumber = 'Seat number is required';
    
    if (isCustomShift && !customShiftTimings.trim()) {
      newErrors.shiftTimings = 'Please specify custom shift timings';
    }

    const feeNum = parseFloat(monthlyFee);
    if (isNaN(feeNum) || feeNum <= 0) {
      newErrors.monthlyFee = 'Enter a valid fee amount > 0';
    }
    if (!paymentDate) {
      newErrors.paymentDate = 'Payment recorded date is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    let finalShiftTiming = '';
    if (isCustomShift) {
      finalShiftTiming = customShiftTimings.trim();
    } else {
      const shift = shifts.find((s) => s.id === selectedShiftId) || shifts[0];
      finalShiftTiming = `${shift.label} (${shift.timings})`;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      try {
        const normalizedSeat = seatNumber.trim().toUpperCase();
        // Ensure custom seat is registered in the library seat layout
        addCustomSeat(normalizedSeat);

        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const formattedPhone = `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}`;
        const calculatedNextDue = advanceDateByOneMonth(paymentDate);

        addStudentToFirestore(
          {
            name: name.trim(),
            phoneNumber: formattedPhone,
            seatNumber: normalizedSeat,
            shiftTimings: finalShiftTiming,
            monthlyFee: parseFloat(monthlyFee),
            nextFeeDueDate: calculatedNextDue,
            admissionDate: paymentDate,
            notes: notes.trim() || undefined,
          },
          {
            paymentDate,
            amountPaid: parseFloat(monthlyFee),
            paymentMode,
            note: `Admission fee payment (${paymentMode}) on ${formatDueDateDisplay(paymentDate)}`,
          }
        );

        setIsSubmitting(false);
        setSuccessAnimation(true);

        setTimeout(() => {
          setSuccessAnimation(false);
          onClose();
          if (onStudentAdded) onStudentAdded();
        }, 800);
      } catch (err) {
        console.error(err);
        setIsSubmitting(false);
      }
    }, 400);
  };

  const addStudentSnippet = KOTLIN_CODE_SNIPPETS.find(
    (s) => s.name === 'AddStudentScreen.kt'
  );

  const handleCopyCode = () => {
    if (addStudentSnippet) {
      navigator.clipboard.writeText(addStudentSnippet.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-slate-950/55 backdrop-blur-xs animate-in fade-in duration-200 text-slate-900 ${darkModeClass}`} onClick={onClose}>
      <div 
        className="bg-white text-slate-900 w-full max-w-full sm:max-w-xl h-[92vh] sm:h-full rounded-t-3xl sm:rounded-t-none sm:rounded-l-3xl shadow-2xl border-t sm:border-t-0 sm:border-l border-slate-200/60 overflow-hidden flex flex-col min-w-0 animate-in slide-in-from-bottom sm:slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className={`px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between ${theme.headerBg} text-white min-w-0`}>
          <div className="min-w-0 truncate">
            <h2 className="text-base sm:text-lg font-bold text-white truncate">
              Add New Student
            </h2>
            <p className="text-[11px] sm:text-xs text-white/80 mt-0.5 truncate">
              Assign desk, shift timing &amp; monthly fee
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors shrink-0 touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {activeTab === 'form' ? (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 min-w-0 max-w-full">
            {successAnimation && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-2xl flex items-center gap-3 animate-in zoom-in-95">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">Student Registered Successfully!</h4>
                  <p className="text-xs text-emerald-700">Document and PaymentHistory sub-collection initialized in Firestore.</p>
                </div>
              </div>
            )}

            {/* 1. Student Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors({ ...errors, name: '' });
                  }}
                  placeholder="e.g. Aarav Sharma"
                  className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 text-slate-900 placeholder:text-slate-400 border rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 ${theme.primaryRing} transition-all ${
                    errors.name ? 'border-rose-400 ring-rose-200' : 'border-slate-200'
                  }`}
                />
              </div>
              {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name}</p>}
            </div>

            {/* 2. Phone Number & 3. Seat Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[10px] font-mono font-semibold ${
                    phoneNumber.length === 10 ? 'text-emerald-600' : 'text-slate-400'
                  }`}>
                    {phoneNumber.length}/10 digits
                  </span>
                </div>
                <div className="relative flex rounded-xl shadow-2xs overflow-hidden">
                  <span className="inline-flex items-center px-3 bg-slate-100 border border-r-0 border-slate-200 text-slate-700 text-xs font-bold font-mono select-none">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    value={phoneNumber}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="98765 43210"
                    className={`w-full pl-3 pr-8 py-2.5 bg-slate-50 text-slate-900 placeholder:text-slate-400 border rounded-r-xl text-sm font-mono tracking-wider focus:bg-white focus:outline-hidden focus:ring-2 ${theme.primaryRing} transition-all ${
                      errors.phoneNumber ? 'border-rose-400 ring-rose-200' : 'border-slate-200'
                    }`}
                  />
                  {phoneNumber.length === 10 && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-600">
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  )}
                </div>
                {errors.phoneNumber && <p className="text-rose-500 text-xs mt-1">{errors.phoneNumber}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Seat / Desk Number <span className="text-rose-500">*</span>
                  </label>
                  {onOpenSeatManager && (
                    <button
                      type="button"
                      onClick={onOpenSeatManager}
                      className="text-[11px] text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-1"
                    >
                      <Settings2 className="w-3 h-3" />
                      <span>Customize Seats</span>
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Armchair className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={seatNumber}
                    onChange={(e) => {
                      setSeatNumber(e.target.value);
                      if (errors.seatNumber) setErrors({ ...errors, seatNumber: '' });
                    }}
                    placeholder="e.g. A-14, B-02 or custom"
                    className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 text-slate-900 placeholder:text-slate-400 border rounded-xl text-sm uppercase font-mono focus:bg-white focus:outline-hidden focus:ring-2 ${theme.primaryRing} transition-all ${
                      errors.seatNumber ? 'border-rose-400 ring-rose-200' : 'border-slate-200'
                    }`}
                  />
                </div>
                {vacantSeats.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-medium">Vacant:</span>
                    {vacantSeats.map((vSeat) => (
                      <button
                        key={vSeat}
                        type="button"
                        onClick={() => {
                          setSeatNumber(vSeat);
                          if (errors.seatNumber) setErrors({ ...errors, seatNumber: '' });
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                          seatNumber.toUpperCase() === vSeat
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-slate-100 hover:bg-amber-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {vSeat}
                      </button>
                    ))}
                  </div>
                )}
                {errors.seatNumber && <p className="text-rose-500 text-xs mt-1">{errors.seatNumber}</p>}
              </div>
            </div>

            {/* 4. Shift Timings (With Custom Shift & Pricing Auto-fill) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Shift Schedule &amp; Timings <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={onOpenShiftManager}
                  className="text-xs text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-1"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Manage Shifts &amp; Pricing</span>
                </button>
              </div>

              {/* Grid of registered shifts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                {shifts.map((shift) => (
                  <button
                    key={shift.id}
                    type="button"
                    onClick={() => handleShiftSelect(shift.id)}
                    className={`p-2.5 rounded-xl border text-left flex items-start justify-between gap-2 transition-all text-xs ${
                      !isCustomShift && selectedShiftId === shift.id
                        ? 'border-amber-600 bg-amber-50/80 text-amber-950 ring-2 ring-amber-500'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Clock className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${!isCustomShift && selectedShiftId === shift.id ? 'text-amber-600' : 'text-slate-400'}`} />
                      <div>
                        <div className="font-bold">{shift.label}</div>
                        <div className="text-[11px] text-slate-500">{shift.timings}</div>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-xs shrink-0 text-slate-800">
                      ₹{shift.defaultFee}
                    </span>
                  </button>
                ))}

                {/* Option to specify custom shift on-the-fly */}
                <button
                  type="button"
                  onClick={() => handleShiftSelect('custom')}
                  className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all text-xs ${
                    isCustomShift
                      ? 'border-amber-600 bg-amber-50/80 text-amber-950 ring-2 ring-amber-500'
                      : 'border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-amber-600" />
                    <div>
                      <div className="font-bold">Custom On-the-fly Shift</div>
                      <div className="text-[11px] text-slate-500">Custom hours &amp; custom fee</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                    Custom
                  </span>
                </button>
              </div>

              {/* On-the-fly custom shift input */}
              {isCustomShift && (
                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2 animate-in fade-in">
                  <label className="block text-[11px] font-bold text-amber-900">
                    Enter Custom Shift Hours &bull; e.g. &quot;07:00 AM - 11:30 AM (Morning Lite)&quot;
                  </label>
                  <input
                    type="text"
                    value={customShiftTimings}
                    onChange={(e) => setCustomShiftTimings(e.target.value)}
                    placeholder="e.g. 06:00 AM - 11:00 AM"
                    className="w-full px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-amber-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
                  />
                  {errors.shiftTimings && (
                    <p className="text-rose-500 text-xs">{errors.shiftTimings}</p>
                  )}
                </div>
              )}
            </div>

            {/* 5. Monthly Fee Amount & 6. Next Fee Due Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monthly Fee Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <IndianRupee className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    value={monthlyFee}
                    onChange={(e) => {
                      setMonthlyFee(e.target.value);
                      if (errors.monthlyFee) setErrors({ ...errors, monthlyFee: '' });
                    }}
                    placeholder="1200"
                    min="100"
                    step="50"
                    className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 text-slate-900 placeholder:text-slate-400 border rounded-xl text-sm font-semibold focus:bg-white focus:outline-hidden focus:ring-2 ${theme.primaryRing} transition-all ${
                      errors.monthlyFee ? 'border-rose-400 ring-rose-200' : 'border-slate-200'
                    }`}
                  />
                </div>
                {errors.monthlyFee && <p className="text-rose-500 text-xs mt-1">{errors.monthlyFee}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Recorded Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => handlePaymentDateChange(e.target.value)}
                    className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 text-slate-900 border rounded-xl text-sm focus:bg-white focus:outline-hidden focus:ring-2 ${theme.primaryRing} transition-all ${
                      errors.paymentDate ? 'border-rose-400 ring-rose-200' : 'border-slate-200'
                    }`}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-700 font-semibold">
                    Next Due: {formatDueDateDisplay(nextFeeDueDate)} (+1 Month)
                  </span>
                  <span className="text-slate-400">Auto-calculated</span>
                </div>
                {errors.paymentDate && <p className="text-rose-500 text-xs mt-1">{errors.paymentDate}</p>}
              </div>
            </div>

            {/* Payment Mode Selector */}
            <div className="pt-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Payment Mode
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['UPI', 'Cash', 'Card', 'Bank Transfer'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all ${
                      paymentMode === mode
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Student Note */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Student Notes / Remarks (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. UPSC prep, CA Inter, prefers corner desk"
                className="w-full px-4 py-2 bg-slate-50 text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white ${theme.primary} ${theme.primaryHover} active:scale-95 disabled:opacity-50 rounded-xl shadow-md transition-all`}
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Student...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Student</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Kotlin Jetpack Compose Code Tab */
          <div className="flex-1 overflow-hidden flex flex-col bg-slate-900 text-slate-200">
            <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="font-mono text-slate-300">AddStudentScreen.kt (Jetpack Compose Composable)</span>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-white"
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

            <pre className="flex-1 overflow-auto p-4 text-xs font-mono leading-relaxed text-amber-200 selection:bg-amber-600 selection:text-white">
              {addStudentSnippet?.code}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
