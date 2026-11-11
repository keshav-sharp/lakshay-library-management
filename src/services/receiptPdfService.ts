import { jsPDF } from 'jspdf';
import { PaymentRecord, Student } from '../types/student';
import { LibraryProfileSettings, getLibraryProfileSettings } from './librarySettingsService';
import { amountToWordsINR } from '../utils/numberToWords';

export interface ReceiptPdfResult {
  doc: jsPDF;
  blob: Blob;
  blobUrl: string;
  fileName: string;
}

export const formatReceiptDate = (isoString?: string): { dateStr: string; timeStr: string } => {
  if (!isoString) {
    const now = new Date();
    return {
      dateStr: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      timeStr: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    };
  }
  const d = new Date(isoString);
  return {
    dateStr: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    timeStr: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
  };
};

/**
 * Generates an A4 PDF Fee Receipt for a given PaymentRecord.
 * Strictly uses immutable snapshots from `record` (studentName, seatNumber, receiptNumber, amountPaid)
 * so subsequent student edits or seat reallocations NEVER mutate historical receipts.
 */
export const buildReceiptPdfDoc = (
  record: PaymentRecord,
  customSettings?: LibraryProfileSettings,
  student?: Student | null
): jsPDF => {
  const settings = customSettings || getLibraryProfileSettings();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // Outer decorative border
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.4);
  doc.rect(margin, margin, contentWidth, pageHeight - margin * 2);

  // Inner thin border
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.2);
  doc.rect(margin + 1.5, margin + 1.5, contentWidth - 3, pageHeight - margin * 2 - 3);

  // Top Accent Header Bar (deep amber/teal branding)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin + 2, margin + 2, contentWidth - 4, 28, 'F');

  // Library Name in Header
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(settings.libraryName || 'Lakshay Library', margin + 8, margin + 12);

  // Subtitle / Address / Contact in Header
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  const headerLines: string[] = [];
  if (settings.address) headerLines.push(settings.address);
  if (settings.contactNumber) headerLines.push(`Contact: ${settings.contactNumber}`);
  if (settings.email) headerLines.push(`Email: ${settings.email}`);

  if (headerLines.length > 0) {
    doc.text(headerLines.join('  •  '), margin + 8, margin + 19);
  } else {
    doc.text('Smart Digital Library Management • Self-Study & Reading Hall', margin + 8, margin + 19);
  }

  // Header Right Badge: "FEE RECEIPT"
  doc.setFillColor(245, 158, 11); // amber-500
  doc.roundedRect(pageWidth - margin - 52, margin + 7, 44, 16, 2, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('FEE RECEIPT', pageWidth - margin - 30, margin + 14, { align: 'center' });
  doc.setFontSize(7);
  doc.text('OFFICIAL COPY', pageWidth - margin - 30, margin + 19, { align: 'center' });

  // Receipt Metadata Strip
  let currentY = margin + 35;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.rect(margin + 2, currentY, contentWidth - 4, 14, 'FD');

  const { dateStr, timeStr } = formatReceiptDate(record.paymentDate);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFont('helvetica', 'normal');
  doc.text('Receipt No:', margin + 6, currentY + 6);
  doc.text('Date & Time:', margin + 70, currentY + 6);
  doc.text('Payment Mode:', margin + 130, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(record.receiptNumber || record.id, margin + 6, currentY + 11);
  doc.text(`${dateStr} at ${timeStr}`, margin + 70, currentY + 11);
  doc.text(record.paymentMode || 'Cash', margin + 130, currentY + 11);

  currentY += 20;

  // Student Information Box (uses immutable snapshot fields first!)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin + 2, currentY, contentWidth - 4, 34, 'S');

  // Title of section
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(margin + 2, currentY, contentWidth - 4, 7, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('STUDENT & DESK INFORMATION', margin + 6, currentY + 5);

  const studentName = record.studentName || student?.name || 'Library Student';
  const seatNumber = record.seatNumber || student?.seatNumber || 'N/A';
  const studentId = record.studentId || student?.id || 'N/A';
  const shiftTimings = student?.shiftTimings || 'Regular Shift';
  const contactPhone = student?.phoneNumber || '—';

  doc.setFontSize(8.5);
  // Column 1
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Student Name:', margin + 6, currentY + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(studentName, margin + 32, currentY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Student ID:', margin + 6, currentY + 22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(studentId, margin + 32, currentY + 22);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Phone No:', margin + 6, currentY + 30);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(contactPhone, margin + 32, currentY + 30);

  // Column 2
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Allocated Seat:', margin + 105, currentY + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Seat ${seatNumber}`, margin + 135, currentY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Shift Timing:', margin + 105, currentY + 22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(shiftTimings, margin + 135, currentY + 22);

  if (record.transactionId) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Transaction Ref:', margin + 105, currentY + 30);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(record.transactionId, margin + 135, currentY + 30);
  }

  currentY += 40;

  // Fee Particulars Table
  doc.setFillColor(15, 23, 42); // Header
  doc.rect(margin + 2, currentY, contentWidth - 4, 8, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('S.No.', margin + 6, currentY + 5.5);
  doc.text('Fee Description / Item', margin + 22, currentY + 5.5);
  doc.text('Period Covered', margin + 105, currentY + 5.5);
  doc.text('Amount (INR)', pageWidth - margin - 8, currentY + 5.5, { align: 'right' });

  currentY += 8;

  // Row 1: Monthly Fee
  doc.setFillColor(255, 255, 255);
  doc.rect(margin + 2, currentY, contentWidth - 4, 12, 'FD');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text('1.', margin + 6, currentY + 7);
  doc.setFont('helvetica', 'bold');
  doc.text('Monthly Library Study & Desk Seat Fee', margin + 22, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const periodText = record.feePeriod || '1 Month Monthly Renewal';
  doc.text(periodText, margin + 105, currentY + 7);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`INR ${record.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin - 8, currentY + 7, { align: 'right' });

  currentY += 12;

  // Note Row if note exists
  if (record.note) {
    doc.setFillColor(248, 250, 252);
    doc.rect(margin + 2, currentY, contentWidth - 4, 9, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text(`Remarks / Note: ${record.note}`, margin + 22, currentY + 5.5);
    currentY += 9;
  }

  // Total Summary Block
  currentY += 3;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin + 2, currentY, contentWidth - 4, 20, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin + 2, currentY, contentWidth - 4, 20, 'S');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Total Amount Received:', margin + 6, currentY + 8);

  doc.setFontSize(14);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(`INR ${record.amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin - 8, currentY + 8, { align: 'right' });

  // Amount in words
  const words = amountToWordsINR(record.amountPaid);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Amount in Words:', margin + 6, currentY + 15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(words, margin + 36, currentY + 15);

  currentY += 28;

  // Terms and Notice
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('Terms & Conditions:', margin + 6, currentY);
  doc.setFont('helvetica', 'normal');
  const termsText = settings.termsNotice || 'Fees once paid are non-refundable. Please keep this receipt for library desk records.';
  doc.text(termsText, margin + 6, currentY + 4, { maxWidth: contentWidth - 12 });

  // Signature Block
  currentY += 22;
  const signatureWidth = 55;
  const signatureX = pageWidth - margin - signatureWidth - 4;

  doc.setDrawColor(148, 163, 184); // slate-400
  doc.setLineWidth(0.3);
  doc.line(signatureX, currentY + 16, signatureX + signatureWidth, currentY + 16);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('Authorized Signatory', signatureX + signatureWidth / 2, currentY + 20, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(settings.libraryName || 'Lakshay Library Desk', signatureX + signatureWidth / 2, currentY + 24, { align: 'center' });

  // Desk Stamp Placeholder Box
  doc.setDrawColor(226, 232, 240);
  doc.setLineDashPattern([1, 1], 0);
  doc.roundedRect(margin + 6, currentY, 34, 24, 2, 2, 'S');
  doc.setLineDashPattern([], 0);
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Desk Stamp Area', margin + 23, currentY + 13, { align: 'center' });

  // Bottom Micro Footer
  const footerY = pageHeight - margin - 4;
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('This is an authentic computer-generated digital receipt from Lakshay Library Management (LibTrack v2.0.7).', margin + 6, footerY);
  doc.text(`Ref: ${record.receiptNumber || record.id}`, pageWidth - margin - 6, footerY, { align: 'right' });

  return doc;
};

/**
 * Builds the PDF and returns its Blob and DataUrl for downloading, printing, or in-app preview.
 */
export const generateReceiptPdfResult = (
  record: PaymentRecord,
  customSettings?: LibraryProfileSettings,
  student?: Student | null
): ReceiptPdfResult => {
  const doc = buildReceiptPdfDoc(record, customSettings, student);
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  const cleanReceiptNum = (record.receiptNumber || record.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Lakshay_Receipt_${cleanReceiptNum}.pdf`;

  return {
    doc,
    blob,
    blobUrl,
    fileName,
  };
};

/**
 * Downloads the PDF directly to device. Works seamlessly in Web browsers, PWAs, and Android WebViews.
 */
export const downloadReceiptPdf = (
  record: PaymentRecord,
  customSettings?: LibraryProfileSettings,
  student?: Student | null
): void => {
  const { doc, fileName } = generateReceiptPdfResult(record, customSettings, student);
  doc.save(fileName);
};

/**
 * Prints the receipt PDF directly via hidden iframe without opening popups or navigating away.
 */
export const printReceiptPdf = (
  record: PaymentRecord,
  customSettings?: LibraryProfileSettings,
  student?: Student | null
): void => {
  const { blobUrl } = generateReceiptPdfResult(record, customSettings, student);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = blobUrl;

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.warn('Iframe print failed, falling back to window print:', err);
      window.print();
    } finally {
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
          URL.revokeObjectURL(blobUrl);
        } catch {
          // ignore
        }
      }, 60000);
    }
  };

  document.body.appendChild(iframe);
};
