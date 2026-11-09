import React from 'react';
import { Student } from '../types/student';
import { ThemeColors } from '../types/theme';
import { useTheme } from '../context/ThemeContext';
import { QRCodeSVG } from 'qrcode.react';
import { 
  X, 
  Printer, 
  BookOpen, 
  ShieldCheck, 
  Armchair, 
  Clock, 
  Phone, 
  Calendar,
  CheckCircle2
} from 'lucide-react';

interface PrintableLibraryCardModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeColors;
}

export const PrintableLibraryCardModal: React.FC<PrintableLibraryCardModalProps> = ({
  student,
  isOpen,
  onClose,
  theme,
}) => {
  const { darkModeClass } = useTheme();
  if (!isOpen || !student) return null;

  const qrPayload = JSON.stringify({
    app: 'lakshay_library',
    studentId: student.id,
    name: student.name,
    seatNumber: student.seatNumber,
    shift: student.shiftTimings,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 ${darkModeClass}`}>
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Action Header (hidden during print) */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Printable Library Desk Card
              </h3>
              <p className="text-xs text-slate-500">
                Official physical badge documentation with scannable QR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs text-white ${theme.primary} ${theme.primaryHover} shadow-xs flex items-center gap-1.5 active:scale-95 transition-all`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Badge</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Card Canvas Area (Target of @media print) */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100/60 flex flex-col items-center justify-center print:p-0 print:bg-white print:m-0">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-library-card, #printable-library-card * {
                visibility: visible !important;
              }
              #printable-library-card {
                position: absolute !important;
                left: 50% !important;
                top: 50px !important;
                transform: translateX(-50%) !important;
                width: 380px !important;
                box-shadow: none !important;
                border: 2px solid #334155 !important;
              }
            }
          `}} />

          {/* Physical Badge Layout */}
          <div 
            id="printable-library-card"
            className="w-full max-w-[380px] bg-white rounded-3xl border-2 border-slate-300 shadow-xl overflow-hidden text-slate-900 font-sans"
          >
            {/* Badge Top Header */}
            <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700 text-white p-4 text-center relative">
              <div className="flex items-center justify-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-100" />
                <h2 className="text-sm font-black tracking-wider uppercase">
                  Lakshay Library
                </h2>
              </div>
              <p className="text-[10px] text-amber-100 tracking-widest uppercase font-semibold mt-0.5">
                Official Desk Pass &bull; Study Zone
              </p>
              <div className="absolute right-3 top-3 px-1.5 py-0.5 rounded-full bg-white/20 text-[9px] font-mono font-bold">
                MEMBER
              </div>
            </div>

            {/* Student Info Body */}
            <div className="p-5 space-y-4">
              {/* Photo & Name Row */}
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0 font-bold text-xl">
                  {student.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate leading-tight">
                    {student.name}
                  </h3>
                  <p className="text-xs font-mono text-slate-500 mt-0.5 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{student.phoneNumber}</span>
                  </p>
                  <span className="inline-block mt-1 text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                    ID: {student.id.slice(-8).toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Reserved Seat Highlight */}
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                    Reserved Study Desk
                  </span>
                  <span className="text-xs text-amber-900 font-medium">
                    {student.shiftTimings}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-2xl font-black text-amber-700 px-2.5 py-0.5 bg-white rounded-xl border border-amber-300 inline-block shadow-2xs">
                    {student.seatNumber}
                  </span>
                </div>
              </div>

              {/* QR Code Section */}
              <div className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-200">
                  <QRCodeSVG
                    value={qrPayload}
                    size={135}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <span className="text-[10px] text-slate-500 font-mono mt-1.5 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Scan for Digital Desk Check-in</span>
                </span>
              </div>

              {/* Terms & Signature Strip */}
              <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                <div>
                  <span className="block font-bold text-slate-700">Rules:</span>
                  <span>Maintain silence. Keep desk clean &amp; tidy.</span>
                </div>
                <div className="text-right">
                  <span className="block font-bold text-slate-700">Authorized:</span>
                  <div className="font-mono text-[9px] text-slate-400 italic mt-0.5">
                    Lakshay Admin Seal
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Color Accent */}
            <div className="bg-slate-900 text-slate-400 py-1.5 text-center text-[9px] font-mono border-t border-slate-800">
              NON-TRANSFERABLE &bull; PROPERTY OF LAKSHAY LIBRARY
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 print:hidden">
          <span>Standard ID badge dimensions (3.375&quot; &times; 4.5&quot;)</span>
          <button
            type="button"
            onClick={handlePrint}
            className={`px-4 py-1.5 font-bold text-white ${theme.primary} ${theme.primaryHover} rounded-xl shadow-xs`}
          >
            Print Now
          </button>
        </div>
      </div>
    </div>
  );
};
