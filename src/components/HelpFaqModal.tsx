import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  X,
  HelpCircle,
  Search,
  Cloud,
  QrCode,
  Armchair,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Sparkles,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { GITHUB_REPO_URL } from './NavigationDrawer';

export interface HelpFaqModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: 'SYNC' | 'UPI' | 'SEATS' | 'SHIFTS' | 'RECEIPTS' | 'REMINDERS' | 'ALL';
}

interface FaqItem {
  id: string;
  category: 'SYNC' | 'UPI' | 'SEATS' | 'SHIFTS' | 'RECEIPTS' | 'REMINDERS';
  question: string;
  answer: string;
  highlights?: string[];
}

const FAQ_ITEMS: FaqItem[] = [
  // SYNC
  {
    id: 'sync-roles',
    category: 'SYNC',
    question: 'How do Primary and Secondary device roles work?',
    answer:
      'Designate one device (usually the main reception phone or PC) as Primary Master. The Primary device hosts the master Google Drive folder. Any other phones or tablets act as Secondary / Follower devices. With real-time vice-versa sync, any change made on ANY active phone immediately updates all other connected devices.',
    highlights: [
      'Primary: Writes to master Google Drive folder and generates Sync Keys',
      'Secondary: Pulls from Primary via Sync Key or shared Drive folder',
      'Vice-Versa: Real-time live relay propagates updates across all phones',
    ],
  },
  {
    id: 'sync-method-1',
    category: 'SYNC',
    question: 'What is Method 1 (Master Sync Key) and why is it recommended?',
    answer:
      'Method 1 generates a simple Sync Key (e.g. LK-...) on your Primary device. On your secondary phone, simply paste this key and tap "Pull via Sync Key". It connects directly through our secure encrypted cloud relay and bypasses Google Error 403 sign-in blocks on different Gmail accounts.',
    highlights: [
      'Works with ANY Gmail account or without signing in on secondary phones',
      '1-tap copy & paste over WhatsApp or SMS',
      'Transfers all students, seats, shifts, payments, and UPI settings',
    ],
  },
  {
    id: 'sync-active-presence',
    category: 'SYNC',
    question: 'How do Active Clients and Heartbeat work?',
    answer:
      'Every connected phone or tablet automatically sends a lightweight presence heartbeat every 20 seconds while the app is open. You can check the "Active Clients & Heartbeat" tab inside Daily Sync to see exactly how many devices are online in your library in real time.',
  },
  {
    id: 'sync-offline-package',
    category: 'SYNC',
    question: 'Can I transfer data without an internet connection?',
    answer:
      'Yes. Tap "Copy Offline Sync Package (LKSYNC1:...)" in the Daily Sync menu on the Primary phone. Paste this text into WhatsApp, Bluetooth, or notes on your secondary phone. It decodes the entire library database offline instantly.',
  },

  // UPI & PAYMENTS
  {
    id: 'upi-cross-sync',
    category: 'UPI',
    question: 'Does updating UPI ID or payment standee sync to all phones?',
    answer:
      'Yes! Whenever you update your UPI ID, payee name, or reception QR standee photo on the Primary device, the update is bundled into the master sync package. All secondary and peer devices receive the updated payment QR and UPI handle immediately.',
    highlights: [
      'Updated in real time on all connected staff phones',
      'Dynamic QR codes auto-generate for Google Pay, PhonePe, Paytm, and BHIM',
      'Custom physical standee photos can be uploaded and synchronized',
    ],
  },
  {
    id: 'upi-handles',
    category: 'UPI',
    question: 'Which UPI IDs and handles are supported?',
    answer:
      'Lakshay Library supports all standard NPCI UPI handles, including @okaxis, @okhdfcbank, @okicici, @paytm, @ybl, @ibl, and custom bank IDs. Students scanning your digital standee can pay desk fees using any UPI application.',
  },

  // SEATS
  {
    id: 'seats-customization',
    category: 'SEATS',
    question: 'How do I add or customize library desks?',
    answer:
      'Open the Menu and tap "Customize Seats" to open the Minimalist Desk Matrix. Tap "Customize Desks" in the top-right corner to add individual seats (e.g. A-16) or create entire new sections (e.g. Section D with 10 seats for a Silent Study Zone).',
  },
  {
    id: 'seats-occupancy-indicators',
    category: 'SEATS',
    question: 'What do the seat status colors mean on the desk matrix?',
    answer:
      'Emerald (Green) indicates an Available/Vacant desk ready for student assignment. Amber indicates a desk where the occupant’s fee is expiring within 3 days. Slate (Gray) indicates an active occupied desk.',
  },

  // SHIFTS
  {
    id: 'shifts-management',
    category: 'SHIFTS',
    question: 'How do I change shift timings and default fees?',
    answer:
      'Open Menu $\\rightarrow$ "Shift Timings & Pricing". Here you can adjust standard library shifts (Morning 7AM-1PM, Evening 1PM-7PM, Full Day 7AM-10PM, Night Owl 10PM-6AM) and configure default monthly fees.',
  },

  // RECEIPTS
  {
    id: 'receipts-pdf-generation',
    category: 'RECEIPTS',
    question: 'How do PDF Fee Receipts work in Lakshay Library?',
    answer:
      'Every time you mark a student paid, the system automatically writes a verified ledger entry and generates an official, collision-resistant PDF fee receipt. Receipts can be downloaded offline or printed directly to desk printers with no internet connection required.',
    highlights: [
      '100% offline generation using client-side jsPDF rendering',
      'Immutable snapshot of student name, seat number, and fee amounts',
      'Download PDF, print directly, or share formatted text summaries over WhatsApp',
    ],
  },
  {
    id: 'receipts-manual-regeneration',
    category: 'RECEIPTS',
    question: 'Can I regenerate or re-download an older fee receipt?',
    answer:
      'Yes. Open the student’s profile from the dashboard, scroll down to Payment History, and tap the "Receipt" button next to any past payment. The receipt regenerates instantly with the exact historical receipt number, student name, and assigned seat.',
  },

  // REMINDERS
  {
    id: 'reminders-whatsapp',
    category: 'REMINDERS',
    question: 'How do WhatsApp fee reminders work?',
    answer:
      'Lakshay Library automatically calculates due dates and highlights accounts expiring in $\\le 3$ days or overdue. Tapping the "WhatsApp" button on any student card opens WhatsApp with a pre-filled, personalized reminder including student name, seat number, due date, and fee amount.',
  },
  {
    id: 'reminders-mark-paid',
    category: 'REMINDERS',
    question: 'What happens when I tap "Mark Paid"?',
    answer:
      'When you confirm payment collection, a payment log entry is added with payment mode (Cash, UPI, Online), and the student’s next fee due date is automatically extended forward by exactly one month.',
  },
];

export const HelpFaqModal: React.FC<HelpFaqModalProps> = ({
  isOpen,
  onClose,
  initialCategory = 'ALL',
}) => {
  const { darkModeClass, isDarkMode } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories = [
    { id: 'ALL', label: 'All Topics' },
    { id: 'SYNC', label: 'Device Sync & Drive' },
    { id: 'UPI', label: 'UPI & Payments' },
    { id: 'SEATS', label: 'Seats & Desks' },
    { id: 'SHIFTS', label: 'Shifts & Fees' },
    { id: 'RECEIPTS', label: 'PDF Fee Receipts' },
    { id: 'REMINDERS', label: 'WhatsApp & Dues' },
  ];

  const filteredFaqs = FAQ_ITEMS.filter((item) => {
    const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    if (!matchesCat) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.question.toLowerCase().includes(query) ||
      item.answer.toLowerCase().includes(query) ||
      item.highlights?.some((h) => h.toLowerCase().includes(query))
    );
  });

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200 ${darkModeClass}`}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-full sm:max-w-xl h-[92vh] sm:h-full rounded-t-3xl sm:rounded-t-none sm:rounded-l-3xl shadow-2xl border-t sm:border-t-0 sm:border-l overflow-hidden flex flex-col min-w-0 animate-in slide-in-from-bottom sm:slide-in-from-right duration-200 ${
          isDarkMode
            ? 'bg-slate-900 border-slate-800/60 text-slate-100'
            : 'bg-white border-slate-200/60 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200/60 flex items-center justify-between bg-amber-500/10 shrink-0 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0 truncate">
              <h2 className="text-base font-bold text-slate-900 leading-tight truncate">
                Help &amp; Documentation (FAQ)
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Clear explanations for sync, seating, UPI &amp; library workflows
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Category Chips */}
        <div className="p-4 border-b border-slate-200/60 bg-slate-50/70 shrink-0 space-y-3 min-w-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guides (sync, UPI, seat, due date)..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200/80 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 p-1"
              >
                &times;
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                  selectedCategory === cat.id
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200/70 hover:bg-slate-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ Accordion List */}
        <div className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden space-y-3 flex-1 min-w-0 max-w-full">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl border border-slate-200/60 bg-white space-y-2">
              <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-800">No matching guides found</div>
              <p className="text-xs text-slate-500">
                Try searching for another keyword or select &quot;All Topics&quot; above.
              </p>
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isExpanded = expandedId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isExpanded
                      ? 'border-amber-300/80 bg-amber-50/20 shadow-xs'
                      : 'border-slate-200/70 bg-white hover:border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                    className="w-full p-3.5 sm:p-4 text-left flex items-start justify-between gap-3 min-w-0 touch-manipulation"
                  >
                    <span className="text-xs sm:text-sm font-bold text-slate-900 leading-snug flex-1">
                      {faq.question}
                    </span>
                    <div className="p-1 rounded-lg bg-slate-100 text-slate-500 shrink-0 mt-0.5">
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-3.5 pb-4 sm:px-4 sm:pb-4 pt-0 border-t border-slate-100 text-xs text-slate-600 space-y-2.5 animate-in fade-in duration-150">
                      <p className="leading-relaxed mt-2.5 text-slate-700">{faq.answer}</p>
                      {faq.highlights && faq.highlights.length > 0 && (
                        <ul className="space-y-1.5 pl-1 pt-1">
                          {faq.highlights.map((h, i) => (
                            <li key={i} className="flex items-start gap-2 text-slate-700">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span className="leading-snug">{h}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Bottom Security & Git Reference Card */}
          <div className="p-4 rounded-2xl bg-slate-100/70 border border-slate-200/70 text-xs text-slate-600 space-y-2 mt-4">
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Official GitHub Security Policy &amp; Open Source</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              For complete security documentation, vulnerability disclosure procedures, and APK release notes, visit our official repository.
            </p>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 underline"
            >
              <span>View GitHub Security Policy (SECURITY.md)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
