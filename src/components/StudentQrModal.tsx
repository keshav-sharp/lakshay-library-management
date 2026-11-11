import React, { useState } from 'react';
import { Student } from '../types/student';
import { ThemeColors } from '../types/theme';
import { useTheme } from '../context/ThemeContext';
import { formatDueDateDisplay, getDaysDifference } from '../services/storageService';
import { QRCodeSVG } from 'qrcode.react';
import { 
  X, 
  QrCode, 
  Share2, 
  Copy, 
  Check, 
  Clock, 
  Armchair, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  BookOpen
} from 'lucide-react';

interface StudentQrModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeColors;
}

export const StudentQrModal: React.FC<StudentQrModalProps> = ({
  student,
  isOpen,
  onClose,
  theme,
}) => {
  const { darkModeClass } = useTheme();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !student) return null;

  // Payload encoded in the QR code for student desk identification
  const qrPayload = JSON.stringify({
    app: 'lakshay_library',
    studentId: student.id,
    name: student.name,
    seatNumber: student.seatNumber,
    shift: student.shiftTimings,
    ts: Date.now()
  });

  const diffDays = getDaysDifference(student.nextFeeDueDate);
  const isOverdue = diffDays < 0;
  const isDueSoon = diffDays >= 0 && diffDays <= 3;

  const handleCopy = () => {
    navigator.clipboard.writeText(qrPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const cleanPhone = student.phoneNumber.replace(/[^0-9]/g, '');
    const message = `Hello ${student.name}, here is your Lakshay Library Digital Desk Pass for Seat ${student.seatNumber} (${student.shiftTimings}). Desk ID: ${student.id}`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 ${darkModeClass}`}>
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b border-slate-100 flex items-center justify-between ${theme.headerBg} text-white`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0 border border-white/20">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Digital Library Desk Pass
              </h3>
              <p className="text-xs text-white/80">
                Lakshay Library &bull; Member Identification Pass
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

        {/* Pass Card Container */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Virtual ID Card / Pass */}
          <div className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 text-white p-5 rounded-3xl shadow-lg border border-slate-700 relative overflow-hidden">
            {/* Watermark accent */}
            <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full bg-amber-500/10 pointer-events-none blur-2xl" />

            {/* Header of Pass */}
            <div className="flex items-start justify-between border-b border-slate-700/80 pb-3">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 uppercase tracking-widest">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Lakshay Library</span>
                </div>
                <h4 className="text-lg font-bold text-white mt-0.5">{student.name}</h4>
                <p className="text-xs text-slate-400 font-mono">{student.phoneNumber}</p>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Assigned Seat</span>
                <span className="text-lg font-black font-mono px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 inline-block shadow-xs">
                  {student.seatNumber}
                </span>
              </div>
            </div>

            {/* QR Code Container */}
            <div className="my-5 flex flex-col items-center justify-center">
              <div className="p-4 bg-white rounded-2xl shadow-md border-2 border-slate-200">
                <QRCodeSVG
                  value={qrPayload}
                  size={170}
                  level="H"
                  includeMargin={false}
                  imageSettings={{
                    src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d97706'><circle cx='12' cy='12' r='10'/></svg>",
                    x: undefined,
                    y: undefined,
                    height: 24,
                    width: 24,
                    excavate: true,
                  }}
                />
              </div>
              <span className="text-[11px] text-slate-400 font-mono mt-2">
                Lakshay Member Desk QR
              </span>
            </div>

            {/* Pass Metadata Footer */}
            <div className="pt-3 border-t border-slate-700/80 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">Shift Timing</span>
                <span className="font-semibold text-slate-200 truncate block">
                  {student.shiftTimings}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block">Fee Status</span>
                {isOverdue ? (
                  <span className="text-rose-400 font-bold flex items-center gap-1 text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Fee Overdue
                  </span>
                ) : isDueSoon ? (
                  <span className="text-amber-400 font-bold flex items-center gap-1 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Due in {diffDays}d
                  </span>
                ) : (
                  <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Active / Valid
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick action triggers */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
            >
              <Share2 className="w-4 h-4 text-emerald-600" />
              <span>Send to WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Copied Pass!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>Copy Pass Data</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
