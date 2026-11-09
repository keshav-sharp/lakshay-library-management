import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  getStoredUpiConfig,
  saveUpiConfig,
  getDynamicQrImageUrl,
  LibraryUpiConfig,
} from '../services/upiConfigService';
import {
  X,
  QrCode,
  Copy,
  Check,
  AlertTriangle,
  Upload,
  Trash2,
  Download,
  IndianRupee,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Edit3,
  Sparkles,
} from 'lucide-react';

interface UpiPaymentQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerToast: (msg: string) => void;
}

export const UpiPaymentQrModal: React.FC<UpiPaymentQrModalProps> = ({
  isOpen,
  onClose,
  onTriggerToast,
}) => {
  const { darkModeClass, isDarkMode } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<LibraryUpiConfig>(getStoredUpiConfig());
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showWarningDialog, setShowWarningDialog] = useState<boolean>(false);

  // Form edit fields
  const [upiIdInput, setUpiIdInput] = useState<string>('');
  const [payeeNameInput, setPayeeNameInput] = useState<string>('');
  const [customQrImage, setCustomQrImage] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredUpiConfig();
      setConfig(stored);
      setUpiIdInput(stored.upiId || '');
      setPayeeNameInput(stored.payeeName || 'Lakshay Library');
      setCustomQrImage(stored.customQrImageUrl || '');
      setNotesInput(stored.notes || '');
      // If no UPI ID is configured yet, open directly in edit mode
      setIsEditing(!stored.isConfigured && !stored.upiId);
      setShowWarningDialog(false);
      setFormError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyUpiId = () => {
    if (!config.upiId) return;
    navigator.clipboard.writeText(config.upiId);
    setCopied(true);
    onTriggerToast(`Copied UPI ID "${config.upiId}" to clipboard!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRequestEdit = () => {
    // If already configured with a UPI ID or custom QR, show mandatory warning first!
    if (config.isConfigured || config.upiId || config.customQrImageUrl) {
      setShowWarningDialog(true);
    } else {
      setIsEditing(true);
    }
  };

  const handleConfirmProceedToEdit = () => {
    setShowWarningDialog(false);
    setIsEditing(true);
    setFormError('');
    onTriggerToast('Editing unlocked. Update the UPI ID or attach a new QR code.');
  };

  const handleCancelWarning = () => {
    setShowWarningDialog(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormError('Please select a valid image file (.png, .jpg, .webp, or .svg).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormError('Image size exceeds 5MB limit. Please choose a smaller file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      setCustomQrImage(base64Url);
      setFormError('');
      onTriggerToast('QR Code image attached successfully!');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomQr = () => {
    setCustomQrImage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onTriggerToast('Custom QR removed. System will auto-generate dynamic QR from UPI ID.');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUpi = upiIdInput.trim();

    if (!cleanUpi && !customQrImage) {
      setFormError('Please enter a valid UPI ID (e.g. yourname@upi) or attach a QR Code image.');
      return;
    }

    if (cleanUpi && !cleanUpi.includes('@')) {
      setFormError('UPI ID must include an "@" symbol (e.g., lakshaylibrary@okhdfcbank or 9876543210@paytm).');
      return;
    }

    const updated = saveUpiConfig({
      upiId: cleanUpi,
      payeeName: payeeNameInput.trim() || 'Lakshay Library',
      customQrImageUrl: customQrImage,
      notes: notesInput.trim(),
    });

    setConfig(updated);
    setIsEditing(false);
    setFormError('');
    onTriggerToast('✓ Library UPI & Payment QR details saved successfully!');
  };

  const activeQrSrc = config.customQrImageUrl || (config.upiId ? getDynamicQrImageUrl(config.upiId, config.payeeName) : '');
  const previewQrSrc = customQrImage || (upiIdInput.trim() ? getDynamicQrImageUrl(upiIdInput.trim(), payeeNameInput.trim()) : '');

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200 ${darkModeClass}`}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-3xl shadow-2xl border overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200/60 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between bg-amber-500/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Library UPI ID &amp; Payment QR
              </h2>
              <p className="text-xs text-slate-500">
                Front-Desk Payment Standee &bull; WhatsApp &amp; Invoices
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Active Config Display (View Mode) */}
          {!isEditing && config.isConfigured ? (
            <div className="space-y-4">
              {/* Standee Card */}
              <div className="p-5 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-white rounded-3xl border border-amber-300/60 shadow-sm text-center">
                <span className="text-[10px] uppercase font-bold tracking-widest text-amber-800 block">
                  Official Reception Payment QR
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {config.payeeName}
                </h3>

                {/* QR Code Frame */}
                <div className="mt-4 p-3 bg-white rounded-2xl shadow-md border border-slate-200/80 inline-block mx-auto max-w-[240px]">
                  {activeQrSrc ? (
                    <img
                      src={activeQrSrc}
                      alt="Lakshay Library Payment QR"
                      className="w-48 h-48 object-contain rounded-xl mx-auto"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                      No QR Attached
                    </div>
                  )}
                  <div className="mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {config.customQrImageUrl ? 'Attached Custom QR' : 'Dynamic Auto-Generated QR'}
                  </div>
                </div>

                {/* UPI ID Pill with 1-Click Copy */}
                {config.upiId && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <div className="px-3.5 py-1.5 rounded-full bg-slate-900 text-amber-300 font-mono text-xs font-bold flex items-center gap-2 shadow-xs border border-slate-800">
                      <span>UPI ID: {config.upiId}</span>
                      <button
                        type="button"
                        onClick={handleCopyUpiId}
                        className="text-white hover:text-amber-400 transition-colors"
                        title="Copy UPI ID"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Accepted Payment Modes Pill Badges */}
                <div className="mt-4 flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-700">
                    GPay
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-purple-700">
                    PhonePe
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-sky-700">
                    Paytm
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-emerald-700">
                    BHIM UPI
                  </span>
                </div>

                {config.notes && (
                  <p className="text-[11px] text-slate-500 mt-3 max-w-sm mx-auto">
                    {config.notes}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleRequestEdit}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit / Change UPI &amp; QR Details</span>
                </button>
                {activeQrSrc && (
                  <a
                    href={activeQrSrc}
                    download="Lakshay_Library_Payment_QR.png"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-colors"
                    title="Download QR Image"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                )}
              </div>
            </div>
          ) : (
            /* Editable Form Mode */
            <form onSubmit={handleSave} className="space-y-4">
              <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/70 text-xs text-amber-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  Attach your front-desk UPI QR code (image upload) or enter your library UPI ID. Students can scan this directly to pay their desk dues.
                </p>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Field 1: UPI ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Library UPI ID (Virtual Payment Address)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={upiIdInput}
                    onChange={(e) => setUpiIdInput(e.target.value)}
                    placeholder="e.g. lakshaylibrary@upi or 9876543210@paytm"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-xs font-mono font-semibold"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Accepted handles: @okaxis, @okhdfcbank, @paytm, @ybl, @ibl, @upi, etc.
                </p>
              </div>

              {/* Field 2: Payee / Business Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Payee / Account Name
                </label>
                <input
                  type="text"
                  value={payeeNameInput}
                  onChange={(e) => setPayeeNameInput(e.target.value)}
                  placeholder="Lakshay Library"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-xs font-semibold"
                />
              </div>

              {/* Field 3: Custom QR Code Image Upload */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 block">
                    Attach Custom QR Code (Sticker / Standee Photo)
                  </label>
                  {customQrImage && (
                    <button
                      type="button"
                      onClick={handleRemoveCustomQr}
                      className="text-[11px] text-rose-600 hover:text-rose-700 flex items-center gap-1 font-semibold"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {customQrImage ? (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-3">
                    <img
                      src={customQrImage}
                      alt="Custom Attached QR"
                      className="w-16 h-16 object-contain bg-white rounded-xl border border-slate-200 p-1"
                    />
                    <div className="text-xs space-y-1 flex-1">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Custom QR Code Attached</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Will be displayed on student payment prompts and front-desk standees.
                      </p>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-300 hover:border-amber-500 bg-slate-50/60 hover:bg-amber-50/30 flex flex-col items-center justify-center gap-1.5 text-xs text-slate-600 transition-colors"
                  >
                    <Upload className="w-5 h-5 text-amber-600" />
                    <span className="font-bold">Click to Attach QR Code Image</span>
                    <span className="text-[10px] text-slate-400">PNG, JPG, SVG up to 5MB</span>
                  </button>
                )}
              </div>

              {/* Real-time Preview */}
              {previewQrSrc && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-center space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Live QR Preview
                  </span>
                  <img
                    src={previewQrSrc}
                    alt="Preview"
                    className="w-36 h-36 mx-auto object-contain bg-white rounded-xl p-2 border border-slate-200 shadow-2xs"
                  />
                  <div className="text-[11px] font-mono text-slate-600 font-bold">
                    {upiIdInput.trim() ? `UPI: ${upiIdInput.trim()}` : 'Custom Photo Standee'}
                  </div>
                </div>
              )}

              {/* Field 4: Optional Instructions */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Payment Instructions / Notes
                </label>
                <input
                  type="text"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Scan with GPay/PhonePe to pay monthly desk fee"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-xs"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                {config.isConfigured && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  Save Payment QR &amp; UPI
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* POPUP WARNING DIALOG (Mandatory warning when attempting to edit or replace an active UPI ID / QR Code) */}
      {showWarningDialog && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border animate-in zoom-in-95 duration-150 ${
              isDarkMode ? 'bg-slate-900 border-rose-500/40 text-white' : 'bg-white border-rose-200 text-slate-900'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-center text-slate-900">
              Warning: Modifying Active Fee Collection Details
            </h3>

            <div className="mt-3 p-3.5 bg-rose-50/70 rounded-2xl border border-rose-200/80 text-xs text-rose-900 space-y-2">
              <p className="font-semibold">
                Changing the library UPI ID or payment QR code will immediately update payment instructions across all student records and digital fee receipts.
              </p>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                If students or parents attempt to scan or transfer using old cached details, payment reconciliation might fail or transfer funds to an unlinked account.
              </p>
            </div>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] font-mono text-slate-600 space-y-1">
              <div>Current Active UPI: <span className="font-bold text-slate-900">{config.upiId || 'None'}</span></div>
              <div>QR Standee: <span className="font-bold text-slate-900">{config.customQrImageUrl ? 'Custom Attached Image' : 'Dynamic Auto-Generated'}</span></div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleCancelWarning}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
              >
                Cancel (Keep Current)
              </button>
              <button
                type="button"
                onClick={handleConfirmProceedToEdit}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition-colors"
              >
                I Understand, Proceed to Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
