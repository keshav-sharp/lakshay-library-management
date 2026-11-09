import React, { useState } from 'react';
import { Student } from '../types/student';
import { useTheme } from '../context/ThemeContext';
import { formatDueDateDisplay } from '../services/storageService';
import { 
  X, 
  MessageSquare, 
  Send, 
  Copy, 
  Check, 
  ExternalLink,
  Phone,
  User,
  Armchair
} from 'lucide-react';

interface WhatsAppModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  student,
  isOpen,
  onClose,
}) => {
  const { darkModeClass } = useTheme();
  if (!isOpen || !student) return null;

  const dueDateFormatted = formatDueDateDisplay(student.nextFeeDueDate);
  const defaultMessage = `Hello ${student.name}, a gentle reminder from Lakshay Library that your monthly fee of ₹${student.monthlyFee} is due on ${dueDateFormatted} for Seat ${student.seatNumber} (${student.shiftTimings}). Kindly complete the payment to maintain your reserved desk. Thank you!`;

  const [message, setMessage] = useState(defaultMessage);
  const [copied, setCopied] = useState(false);

  // Clean phone number (strip whitespace, +, dashes)
  const cleanPhone = student.phoneNumber.replace(/[^0-9]/g, '');

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${cleanPhone}?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 ${darkModeClass}`}>
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/30">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                WhatsApp Fee Reminder
              </h3>
              <p className="text-xs text-slate-500">
                Lakshay Library Management &bull; Android Intent Preview
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

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Recipient summary */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <span className="font-bold text-slate-900">{student.name}</span>
              <span className="text-slate-400">&bull;</span>
              <span className="font-mono text-indigo-600 font-semibold">Seat {student.seatNumber}</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-slate-600">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>{student.phoneNumber}</span>
            </div>
          </div>

          {/* Editable message preview styled like a WhatsApp chat bubble */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Message Preview (Customizable)
            </label>
            <div className="bg-[#EFEAE2] p-4 rounded-2xl border border-[#DAD2C7] relative">
              <div className="bg-white p-3.5 rounded-2xl rounded-tl-xs shadow-xs text-xs text-slate-800 leading-relaxed border border-emerald-100">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full bg-transparent resize-none border-none focus:outline-hidden text-xs text-slate-800 leading-relaxed"
                />
                <div className="text-[10px] text-slate-400 text-right mt-1 font-mono">
                  Lakshay Library Staff
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              On Android devices, this executes an Intent targeting <code>com.whatsapp</code> with pre-filled URI parameters.
            </span>
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Text</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs hover:shadow-emerald-600/20 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Open in WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
