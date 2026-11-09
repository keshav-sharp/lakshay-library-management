import React, { useState, useEffect, useMemo } from 'react';
import { Student, TabScreen } from './types/student';
import { ShiftItem } from './types/shift';
import { ThemeColors, ThemePalette, THEME_PALETTES } from './types/theme';
import { 
  getStoredStudents, 
  subscribeToFirestore, 
  getDaysDifference, 
  getStoredPayments, 
  resetFirestoreToDefaults,
  restorePreviousOrSampleData,
  formatDueDateDisplay
} from './services/storageService';
import { getStoredShifts, subscribeToShifts } from './services/shiftService';
import { getStoredSeats, subscribeToSeats, resetSeatsToDefaults, SeatItem } from './services/seatService';
import { useTheme } from './context/ThemeContext';
import { StudentCard } from './components/StudentCard';
import { AddStudentModal } from './components/AddStudentModal';
import { StudentDetailModal } from './components/StudentDetailModal';
import { PaymentConfirmModal } from './components/PaymentConfirmModal';
import { WhatsAppModal } from './components/WhatsAppModal';
import { WorkManagerModal } from './components/WorkManagerModal';
import { SeatMatrixModal } from './components/SeatMatrixModal';
import { ShiftManagerModal } from './components/ShiftManagerModal';
import { AnalyticsView } from './components/AnalyticsView';
import { StudentQrModal } from './components/StudentQrModal';
import { CheckInScannerModal } from './components/CheckInScannerModal';
import { BulkWhatsAppModal } from './components/BulkWhatsAppModal';
import { PrintableLibraryCardModal } from './components/PrintableLibraryCardModal';
import { ExpandableFabMenu } from './components/ExpandableFabMenu';
import { NavigationDrawer } from './components/NavigationDrawer';
import { SettingsModal } from './components/SettingsModal';
import { KotlinCodeHighlighter } from './components/KotlinCodeHighlighter';
import { MetricsHeaderSkeleton, StudentListSkeleton } from './components/DashboardSkeleton';
import { ApkExportModal } from './components/ApkExportModal';
import { GoogleDriveSyncModal } from './components/GoogleDriveSyncModal';
import { DiagnosticsLogsModal } from './components/DiagnosticsLogsModal';
import { UpiPaymentQrModal } from './components/UpiPaymentQrModal';
import {
  initClientPresenceEngine,
  subscribeToActiveClients,
  getActiveOnlineClientsCount,
} from './services/clientPresenceService';
import { addBreadcrumb } from './services/crashLogService';
import {
  exportStudentsToCSV,
  checkAndRunDueDailyBackup,
  runDailyJsonBackupTask,
} from './services/exportService';
import {
  getDriveAccessToken,
  getGoogleDriveSyncConfig,
  pullMasterSnapshotFromGoogleDrive,
} from './services/googleDriveSyncService';
import { 
  Users, 
  AlertTriangle, 
  AlertCircle, 
  Search, 
  Plus, 
  RotateCcw, 
  Smartphone, 
  Monitor, 
  Bell, 
  Armchair, 
  Code2, 
  BookOpen, 
  CheckCircle2,
  Filter,
  BarChart3,
  Settings2,
  Download,
  FileJson,
  PackageCheck,
  Cloud,
  CheckSquare,
  MessageSquare,
  ArrowUpDown,
  Menu,
  X,
  Activity,
  Clock
} from 'lucide-react';
import { KOTLIN_CODE_SNIPPETS } from './data/kotlinCodeSnippets';

export type StudentSortOption =
  | 'OVERDUE_PRIORITY'
  | 'NAME_ASC'
  | 'NAME_DESC'
  | 'DUE_DATE_ASC'
  | 'DUE_DATE_DESC'
  | 'SEAT_ASC'
  | 'SEAT_DESC'
  | 'RECENT_PAYMENTS';

const TAB_ORDER: Record<TabScreen, number> = {
  ALL: 0,
  DUE_SOON: 1,
  OVERDUE: 2,
  ANALYTICS: 3,
};

export default function App() {
  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState<TabScreen>('ALL');
  const [prevTabIndex, setPrevTabIndex] = useState<number>(0);
  const [tabDirection, setTabDirection] = useState<'left' | 'right'>('right');
  const [deviceMode, setDeviceMode] = useState<'mobile' | 'desktop'>('mobile');
  const [searchQuery, setSearchQuery] = useState('');
  const [shiftFilter, setShiftFilter] = useState<string>('ALL');
  // Automated default sorting rule: prioritize students with the most overdue payments to the top upon app launch
  const [sortOption, setSortOption] = useState<StudentSortOption>('OVERDUE_PRIORITY');

  // Active clients & diagnostics state
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [onlineClientsCount, setOnlineClientsCount] = useState<number>(getActiveOnlineClientsCount());

  const handleTabSwitch = (newTab: TabScreen) => {
    if (newTab === activeTab) return;
    const newIdx = TAB_ORDER[newTab] ?? 0;
    const direction = newIdx >= prevTabIndex ? 'right' : 'left';
    setTabDirection(direction);
    setPrevTabIndex(newIdx);
    setActiveTab(newTab);
    addBreadcrumb('NAVIGATION', `Switched tab to ${newTab}`);
  };

  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    const threshold = 60; // min distance for horizontal swipe

    const tabSequence: TabScreen[] = ['ALL', 'DUE_SOON', 'OVERDUE', 'ANALYTICS'];
    if (Math.abs(diff) > threshold) {
      const currentIndex = tabSequence.indexOf(activeTab);
      if (diff > 0 && currentIndex < tabSequence.length - 1) {
        // Swiped left -> next tab
        handleTabSwitch(tabSequence[currentIndex + 1]);
      } else if (diff < 0 && currentIndex > 0) {
        // Swiped right -> previous tab
        handleTabSwitch(tabSequence[currentIndex - 1]);
      }
    }
    setTouchStartX(null);
  };

  // Theme & Global Dark Mode State via ThemeContext Provider
  const {
    theme: currentTheme,
    isDarkMode,
    darkModeClass,
    setPalette,
    setDarkMode,
  } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Firestore, Shifts & Seats Live State + Initial Fetching Shimmer State
  const [isInitialFetching, setIsInitialFetching] = useState<boolean>(true);
  const [students, setStudents] = useState<Student[]>(getStoredStudents());
  const [allPayments, setAllPayments] = useState(getStoredPayments());
  const [shifts, setShifts] = useState<ShiftItem[]>(getStoredShifts());
  const [seats, setSeats] = useState<SeatItem[]>(getStoredSeats());

  // Modals & Drawers
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [selectedSeatForAdd, setSelectedSeatForAdd] = useState<string>('');
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<Student | null>(null);
  const [studentToMarkPaid, setStudentToMarkPaid] = useState<Student | null>(null);
  const [studentForWhatsApp, setStudentForWhatsApp] = useState<Student | null>(null);
  const [isWorkManagerOpen, setIsWorkManagerOpen] = useState(false);
  const [isSeatMatrixOpen, setIsSeatMatrixOpen] = useState(false);
  const [isShiftManagerOpen, setIsShiftManagerOpen] = useState(false);
  const [studentForQrPass, setStudentForQrPass] = useState<Student | null>(null);
  const [isCheckInScannerOpen, setIsCheckInScannerOpen] = useState(false);
  const [studentToPreScan, setStudentToPreScan] = useState<Student | null>(null);
  const [isCodeViewerOpen, setIsCodeViewerOpen] = useState(false);
  const [selectedCodeSnippetIndex, setSelectedCodeSnippetIndex] = useState(0);
  const [isApkExportOpen, setIsApkExportOpen] = useState(false);
  const [isGoogleDriveSyncOpen, setIsGoogleDriveSyncOpen] = useState(false);
  const [isUpiPaymentQrOpen, setIsUpiPaymentQrOpen] = useState(false);
  const [isNotificationStatusOpen, setIsNotificationStatusOpen] = useState(false);

  // Multi-select & Bulk Reminders state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isBulkWhatsAppOpen, setIsBulkWhatsAppOpen] = useState(false);

  // Printable Card Modal state
  const [studentForPrintCard, setStudentForPrintCard] = useState<Student | null>(null);

  // Notification Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Subscriptions & Initial Firestore Snapshot Hydration
  useEffect(() => {
    const initialFetchTimer = setTimeout(() => {
      setStudents([...getStoredStudents()]);
      setAllPayments({ ...getStoredPayments() });
      setShifts([...getStoredShifts()]);
      setSeats([...getStoredSeats()]);
      setIsInitialFetching(false);
    }, 650);

    const unsubFirestore = subscribeToFirestore(() => {
      setStudents([...getStoredStudents()]);
      setAllPayments({ ...getStoredPayments() });
    });

    const unsubShifts = subscribeToShifts(() => {
      setShifts([...getStoredShifts()]);
    });

    const unsubSeats = subscribeToSeats(() => {
      setSeats([...getStoredSeats()]);
    });

    return () => {
      clearTimeout(initialFetchTimer);
      unsubFirestore();
      unsubShifts();
      unsubSeats();
    };
  }, []);

  // Reopen Google Drive Sync modal automatically when returning from mobile OAuth redirect
  useEffect(() => {
    try {
      if (sessionStorage.getItem('lakshay_library_pending_drive_redirect') === '1') {
        sessionStorage.removeItem('lakshay_library_pending_drive_redirect');
        setIsGoogleDriveSyncOpen(true);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Real-time Active Client Presence & Heartbeat Engine
  useEffect(() => {
    const cleanupPresence = initClientPresenceEngine();
    const unsubPresence = subscribeToActiveClients((clients) => {
      const online = clients.filter((c) => c.status === 'ONLINE').length;
      setOnlineClientsCount(Math.max(1, online));
    });

    return () => {
      cleanupPresence();
      unsubPresence();
    };
  }, []);

  // Recurring WorkManager DailyDatabaseBackupWorker (24h Periodic Check)
  useEffect(() => {
    if (isInitialFetching) return;

    // Run check immediately after initial Firestore snapshot hydration
    const initialBackupRecord = checkAndRunDueDailyBackup(students, allPayments);
    if (initialBackupRecord) {
      const kbSize = (initialBackupRecord.sizeBytes / 1024).toFixed(1);
      setToastMessage(
        `WorkManager DailyDatabaseBackupWorker saved ${initialBackupRecord.fileName} (${kbSize} KB) to local device storage.`
      );
      setTimeout(() => setToastMessage(null), 4500);
    }

    // Periodic background check for date rollover while app stays open
    const periodicWorkerInterval = setInterval(() => {
      checkAndRunDueDailyBackup(getStoredStudents(), getStoredPayments());
    }, 60 * 1000);

    // Automated Once-a-Day Google Drive Pull when device is in SECONDARY (Follower) mode
    const driveConfig = getGoogleDriveSyncConfig();
    const driveToken = getDriveAccessToken();
    const todayKey = new Date().toISOString().split('T')[0];
    if (
      driveConfig.autoDailySyncEnabled &&
      driveConfig.deviceRole === 'SECONDARY' &&
      driveToken &&
      driveConfig.lastSyncedDateKey !== todayKey
    ) {
      pullMasterSnapshotFromGoogleDrive(driveToken)
        .then((res) => {
          setToastMessage(
            `Daily Google Drive Sync: Pulled ${res.studentCount} students from Primary (${res.primaryDeviceName}).`
          );
          setTimeout(() => setToastMessage(null), 4500);
        })
        .catch(() => {
          // Ignore silent background pull errors
        });
    }

    return () => clearInterval(periodicWorkerInterval);
  }, [isInitialFetching, students, allPayments]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleThemeChange = (palette: ThemePalette) => {
    setPalette(palette);
    triggerToast(`Theme switched to ${THEME_PALETTES[palette].name}!`);
  };

  const handleToggleDarkMode = (nextDark: boolean) => {
    setDarkMode(nextDark);
    triggerToast(
      `Switched to ${nextDark ? 'Dark' : 'Light'} variant of ${currentTheme.name}!`
    );
  };

  const handleToggleSelect = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedStudentIds(new Set(filteredStudents.map((s) => s.id)));
  };

  const handleSelectOverdue = () => {
    const overdueIds = filteredStudents
      .filter((s) => getDaysDifference(s.nextFeeDueDate) < 0)
      .map((s) => s.id);
    setSelectedStudentIds(new Set(overdueIds));
    triggerToast(`Selected ${overdueIds.length} overdue student(s)`);
  };

  const handleSelectDueSoon = () => {
    const dueSoonIds = filteredStudents
      .filter((s) => {
        const diff = getDaysDifference(s.nextFeeDueDate);
        return diff >= 0 && diff <= 3;
      })
      .map((s) => s.id);
    setSelectedStudentIds(new Set(dueSoonIds));
    triggerToast(`Selected ${dueSoonIds.length} student(s) due soon`);
  };

  const handleClearSelection = () => {
    setSelectedStudentIds(new Set());
  };

  const selectedStudentsList = useMemo(() => {
    return students.filter((s) => selectedStudentIds.has(s.id));
  }, [students, selectedStudentIds]);

  // Student filtering & sorting based on active tab, search query, shift filter, and sort option
  const filteredStudents = useMemo(() => {
    const filtered = students.filter((student) => {
      const diffDays = getDaysDifference(student.nextFeeDueDate);
      const isOverdue = diffDays < 0;
      const isDueSoon = diffDays >= 0 && diffDays <= 3;

      // Tab Screen Filter
      if (activeTab === 'DUE_SOON' && !isDueSoon) return false;
      if (activeTab === 'OVERDUE' && !isOverdue) return false;

      // Shift Filter
      if (shiftFilter !== 'ALL' && !student.shiftTimings.includes(shiftFilter)) {
        return false;
      }

      // Search Query Filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        student.name.toLowerCase().includes(q) ||
        student.seatNumber.toLowerCase().includes(q) ||
        student.phoneNumber.toLowerCase().includes(q) ||
        student.shiftTimings.toLowerCase().includes(q)
      );
    });

    // Helper for latest payment timestamp per student
    const getLatestPaymentTimestamp = (studentId: string): number => {
      const records = allPayments[studentId] || [];
      if (records.length === 0) return 0;
      let maxTime = 0;
      for (const r of records) {
        const t = new Date(r.paymentDate).getTime();
        if (!isNaN(t) && t > maxTime) {
          maxTime = t;
        }
      }
      return maxTime;
    };

    return [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'OVERDUE_PRIORITY': {
          const diffA = getDaysDifference(a.nextFeeDueDate);
          const diffB = getDaysDifference(b.nextFeeDueDate);
          const isOverdueA = diffA < 0;
          const isOverdueB = diffB < 0;

          // 1. Prioritize overdue accounts above non-overdue accounts
          if (isOverdueA && !isOverdueB) return -1;
          if (!isOverdueA && isOverdueB) return 1;

          // 2. Among overdue students, prioritize the most overdue payments (most negative diffDays first)
          if (diffA !== diffB) return diffA - diffB;

          // 3. Tie-breaker: higher monthly fee first, then alphabetical
          if (b.monthlyFee !== a.monthlyFee) return b.monthlyFee - a.monthlyFee;
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        }
        case 'NAME_ASC':
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        case 'NAME_DESC':
          return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
        case 'SEAT_ASC':
          return a.seatNumber.localeCompare(b.seatNumber, undefined, {
            numeric: true,
            sensitivity: 'base',
          });
        case 'SEAT_DESC':
          return b.seatNumber.localeCompare(a.seatNumber, undefined, {
            numeric: true,
            sensitivity: 'base',
          });
        case 'RECENT_PAYMENTS': {
          const timeDiff = getLatestPaymentTimestamp(b.id) - getLatestPaymentTimestamp(a.id);
          if (timeDiff !== 0) return timeDiff;
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        }
        case 'DUE_DATE_DESC': {
          const dateA = new Date(a.nextFeeDueDate).getTime() || 0;
          const dateB = new Date(b.nextFeeDueDate).getTime() || 0;
          return dateB - dateA;
        }
        case 'DUE_DATE_ASC':
        default: {
          const dateA = new Date(a.nextFeeDueDate).getTime() || 0;
          const dateB = new Date(b.nextFeeDueDate).getTime() || 0;
          return dateA - dateB;
        }
      }
    });
  }, [students, activeTab, searchQuery, shiftFilter, sortOption, allPayments]);

  // Statistics
  const counts = useMemo(() => {
    let dueSoon = 0;
    let overdue = 0;
    let totalMonthlyRevenue = 0;

    students.forEach((s) => {
      totalMonthlyRevenue += s.monthlyFee;
      const diff = getDaysDifference(s.nextFeeDueDate);
      if (diff < 0) overdue++;
      else if (diff <= 3) dueSoon++;
    });

    return {
      total: students.length,
      dueSoon,
      overdue,
      totalMonthlyRevenue,
    };
  }, [students]);

  // Bottom Navigation tabs configuration (Including requested ANALYTICS tab!)
  const navTabs = [
    {
      id: 'ALL' as TabScreen,
      title: 'All Students',
      icon: Users,
      badge: counts.total,
      badgeColor: 'bg-slate-200 text-slate-800',
    },
    {
      id: 'DUE_SOON' as TabScreen,
      title: 'Due Soon',
      icon: AlertTriangle,
      badge: counts.dueSoon,
      badgeColor: 'bg-amber-100 text-amber-900',
    },
    {
      id: 'OVERDUE' as TabScreen,
      title: 'Overdue',
      icon: AlertCircle,
      badge: counts.overdue,
      badgeColor: 'bg-rose-100 text-rose-800',
    },
    {
      id: 'ANALYTICS' as TabScreen,
      title: 'Analytics',
      icon: BarChart3,
      badge: 0,
      badgeColor: '',
    },
  ];

  const handleResetData = () => {
    setIsInitialFetching(true);
    resetFirestoreToDefaults();
    resetSeatsToDefaults();
    setTimeout(() => {
      setStudents([...getStoredStudents()]);
      setAllPayments({ ...getStoredPayments() });
      setSeats([...getStoredSeats()]);
      setIsInitialFetching(false);
      triggerToast('Database reset to clean state (0 example students, all 45 seats available).');
    }, 600);
  };

  const handleRestoreData = () => {
    setIsInitialFetching(true);
    const result = restorePreviousOrSampleData();
    resetSeatsToDefaults();
    setTimeout(() => {
      setStudents([...getStoredStudents()]);
      setAllPayments({ ...getStoredPayments() });
      setSeats([...getStoredSeats()]);
      setIsInitialFetching(false);
      triggerToast(
        `Restored ${result.count} previous student records & verified fee payment histories!`
      );
    }, 600);
  };

  // Main UI content (renderable inside mobile frame or desktop dashboard)
  const renderAppContent = () => (
    <div
      className={`flex flex-col h-full bg-slate-50 text-slate-800 relative overflow-hidden transition-colors duration-200 ${darkModeClass}`}
    >
      {/* 1. Ultra-Clean SaaS Top App Bar: Hamburger Drawer Icon, Title, Quick Global Search Bar & Notification Indicator */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/60 px-4 py-3 sm:px-6 shrink-0 z-10 transition-colors duration-200">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Hamburger Menu Icon & Title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Open Navigation Drawer"
              title="Open Navigation Drawer (Settings, Color Palette, Scan QR, History & Shifts, Reset & Restore)"
              className="w-9 h-9 rounded-xl bg-slate-100/80 hover:bg-slate-200/70 active:scale-95 flex items-center justify-center shrink-0 border border-slate-200/60 text-slate-700 transition-all"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-xl overflow-hidden shadow-xs border border-amber-500/30 hidden sm:flex items-center justify-center shrink-0">
              <img src="/app-icon.png" alt="Lakshay Library" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 leading-tight">
                  Lakshay Library
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  LibTrack SaaS
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {currentTheme.name.split('&')[0].trim()} &bull; {isDarkMode ? 'Dark' : 'Light'}
              </p>
            </div>
          </div>

          {/* Center: Quick Global Search Bar & Search Header Sort Dropdown */}
          <div className="flex-1 max-w-md flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student, seat (A-12)..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-100/70 hover:bg-slate-100 focus:bg-white border border-slate-200/60 rounded-full text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Search Bar Header Sorting Dropdown Menu ('Overdue Priority', 'Name (A-Z)', 'Next Due Date', 'Recent Payments') */}
            <div className="relative hidden sm:flex items-center shrink-0">
              <ArrowUpDown className="w-3 h-3 text-amber-600 absolute left-2.5 pointer-events-none" />
              <select
                aria-label="Sort students in search bar"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as StudentSortOption)}
                className="pl-7 pr-2.5 py-1.5 rounded-full border border-slate-200/60 bg-slate-100/70 hover:bg-slate-100 text-[11px] font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 cursor-pointer transition-all"
                title="Sort student list by Overdue Priority, Name (A-Z), Next Due Date, or Recent Payments"
              >
                <option value="OVERDUE_PRIORITY">Overdue Priority (Default)</option>
                <option value="NAME_ASC">Name (A-Z)</option>
                <option value="NAME_DESC">Name (Z-A)</option>
                <option value="DUE_DATE_ASC">Next Due Date</option>
                <option value="RECENT_PAYMENTS">Recent Payments</option>
                <option value="SEAT_ASC">Seat Number (A-Z)</option>
                <option value="SEAT_DESC">Seat Number (Z-A)</option>
              </select>
            </div>
          </div>

          {/* Right: Active Clients, Get APK, Google Drive Sync, Minimalist Desk Matrix Trigger & Notification Indicator */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Active Clients Online & Crash Diagnostics Indicator */}
            <button
              type="button"
              onClick={() => setIsDiagnosticsOpen(true)}
              className="px-2.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 border border-emerald-500/30 transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Active Clients & Crash Diagnostics (Lakshay_Library_Logs on Google Drive)"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <Activity className="w-3.5 h-3.5 text-emerald-600 hidden sm:inline" />
              <span>{onlineClientsCount} Active</span>
            </button>

            <button
              type="button"
              onClick={() => setIsNotificationStatusOpen(true)}
              className="px-2.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 border border-amber-500/30 transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Notification Alert Status: Due, Overdue & Backup Status"
            >
              <Bell className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>{counts.overdue} Overdue &bull; {counts.dueSoon} Due</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Scrollable Workspace with Consistent 16px-24px Rhythm */}
      <main
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 pb-24"
      >
        {/* 2. Unified KPI Metrics Header Bar with Subtle Divider Lines (or Shimmer Skeleton while fetching) */}
        {isInitialFetching ? (
          <MetricsHeaderSkeleton />
        ) : (
          <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/60 overflow-hidden">
            <div className="p-3.5 sm:p-4">
              <span className="block text-xs uppercase tracking-wider font-semibold text-slate-500">
                Active Students
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-mono">
                  {counts.total}
                </span>
                <span className="text-[11px] font-medium text-emerald-600">Enrolled</span>
              </div>
            </div>

            <div
              onClick={() => setIsSeatMatrixOpen(true)}
              className="p-3.5 sm:p-4 cursor-pointer hover:bg-slate-50/70 transition-colors"
              title="Click to open Minimalist Desk Matrix"
            >
              <span className="block text-xs uppercase tracking-wider font-semibold text-slate-500">
                Total Desks Occupied
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-mono">
                  {counts.total}
                  <span className="text-xs font-normal text-slate-400">/{seats.length}</span>
                </span>
                <span className="text-[11px] font-semibold text-amber-600">
                  {Math.max(0, seats.length - counts.total)} free
                </span>
              </div>
            </div>

            <div className="p-3.5 sm:p-4">
              <span className="block text-xs uppercase tracking-wider font-semibold text-slate-500">
                Pending Dues
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg sm:text-xl font-bold text-amber-600 tracking-tight font-mono">
                  {counts.overdue + counts.dueSoon}
                </span>
                <span className="text-[11px] font-medium text-rose-600">
                  {counts.overdue} overdue
                </span>
              </div>
            </div>

            <div className="p-3.5 sm:p-4">
              <span className="block text-xs uppercase tracking-wider font-semibold text-slate-500">
                Monthly Run-Rate
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-mono">
                  ₹{counts.totalMonthlyRevenue.toLocaleString('en-IN')}
                </span>
                <button
                  type="button"
                  onClick={handleResetData}
                  className="text-[11px] text-slate-400 hover:text-amber-600 inline-flex items-center gap-0.5 transition-colors"
                  title="Refresh Firestore snapshot & replay shimmer skeleton"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* 3. Compact Segmented Pill Controls for Primary Navigation & Action Tools */}
        <section className="flex items-center justify-between gap-2.5 flex-wrap">
          {/* Segmented Pill Container */}
          <div className="flex items-center bg-slate-200/70 p-1 rounded-full border border-slate-200/60 overflow-x-auto no-scrollbar max-w-full">
            {navTabs.map((tab) => {
              const IconComponent = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabSwitch(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <IconComponent className="w-3.5 h-3.5" />
                  <span>{tab.title}</span>
                  {tab.badge > 0 && (
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-white/80 text-slate-700'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Compact Utility Pills (Mobile Search Sort, CSV Export & Multi-Select) */}
          {activeTab !== 'ANALYTICS' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Mobile Search Header Sort Dropdown */}
              <div className="relative flex sm:hidden items-center">
                <ArrowUpDown className="w-3 h-3 text-amber-600 absolute left-2.5 pointer-events-none" />
                <select
                  aria-label="Sort students mobile"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as StudentSortOption)}
                  className="pl-7 pr-2.5 py-1.5 rounded-full border border-slate-200/60 bg-white text-[11px] font-semibold text-slate-800 shadow-2xs"
                >
                  <option value="OVERDUE_PRIORITY">Overdue First (Auto)</option>
                  <option value="NAME_ASC">Name (A-Z)</option>
                  <option value="DUE_DATE_ASC">Next Due Date</option>
                  <option value="RECENT_PAYMENTS">Recent Payments</option>
                  <option value="SEAT_ASC">Seat (A-Z)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => exportStudentsToCSV(filteredStudents, activeTab)}
                className="px-3 py-1.5 rounded-full border border-slate-200/60 bg-white hover:bg-slate-100/80 active:scale-95 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs transition-all"
                title="Download CSV report of current student list"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>CSV</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const record = runDailyJsonBackupTask(students, allPayments, {
                    triggerDownload: true,
                    reason: 'MANUAL_WORKER_RUN',
                  });
                  const kb = (record.sizeBytes / 1024).toFixed(1);
                  triggerToast(
                    `Exported ${record.fileName} (${record.studentCount} students • ${kb} KB) to local device storage!`
                  );
                }}
                className="px-3 py-1.5 rounded-full border border-slate-200/60 bg-white hover:bg-slate-100/80 active:scale-95 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-2xs transition-all"
                title="Export JSON copy of Firestore database to local device storage (WorkManager DailyDatabaseBackupWorker)"
              >
                <FileJson className="w-3.5 h-3.5 text-amber-600" />
                <span>JSON</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSelectionMode(!isSelectionMode);
                  if (isSelectionMode) setSelectedStudentIds(new Set());
                }}
                className={`px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 ${
                  isSelectionMode
                    ? 'bg-amber-50 border-amber-300/80 text-amber-900 font-bold'
                    : 'border-slate-200/60 bg-white hover:bg-slate-100/80 text-slate-700'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                <span>{isSelectionMode ? 'Done' : 'Select'}</span>
              </button>
            </div>
          )}
        </section>

        {/* Animated Tab Content Container with Subtle Horizontal Slide Transition */}
        <div
          key={activeTab}
          className={`space-y-4 sm:space-y-5 ${
            tabDirection === 'right' ? 'animate-tab-slide-right' : 'animate-tab-slide-left'
          }`}
        >
          {/* When in ANALYTICS tab, show Recharts 6-Month Revenue & Fee Collection Forecast View */}
          {activeTab === 'ANALYTICS' ? (
          <AnalyticsView
            students={students}
            allPayments={allPayments}
            theme={currentTheme}
            isDarkMode={isDarkMode}
            onSelectStudent={(s) => setSelectedStudentForDetail(s)}
            onOpenAddStudent={() => {
              setSelectedSeatForAdd('');
              setIsAddStudentOpen(true);
            }}
            onRestorePreviousData={handleRestoreData}
          />
        ) : (
          <>
            {/* Compact Segmented Shift Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 shrink-0 flex items-center gap-1 mr-1">
                <Filter className="w-3 h-3" /> Shift
              </span>
              <button
                type="button"
                onClick={() => setShiftFilter('ALL')}
                className={`px-3 py-1 rounded-full whitespace-nowrap text-[11px] font-semibold transition-all border ${
                  shiftFilter === 'ALL'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200/60 hover:bg-slate-100'
                }`}
              >
                All Shifts
              </button>
              {shifts.map((shift) => {
                const shiftKey = shift.label.split(' ')[0];
                const isSelected = shiftFilter === shiftKey;
                return (
                  <button
                    key={shift.id}
                    type="button"
                    onClick={() => setShiftFilter(shiftKey)}
                    className={`px-3 py-1 rounded-full whitespace-nowrap text-[11px] font-medium transition-all border ${
                      isSelected
                        ? 'bg-amber-600 text-white border-amber-600 shadow-2xs font-semibold'
                        : 'bg-white text-slate-600 border-slate-200/60 hover:bg-slate-100'
                    }`}
                  >
                    {shift.label} (₹{shift.defaultFee})
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setIsShiftManagerOpen(true)}
                className="px-2.5 py-1 rounded-full bg-slate-100/80 hover:bg-slate-200/70 text-slate-600 border border-slate-200/60 text-[11px] font-medium flex items-center gap-1 shrink-0"
                title="Manage shifts"
              >
                <Settings2 className="w-3 h-3" />
                <span>Shifts</span>
              </button>
            </div>

            {/* Batch Selector Bar when Multi-Select is active */}
            {isSelectionMode && (
              <div className="p-2.5 bg-amber-50/70 rounded-2xl border border-amber-200/60 flex items-center justify-between text-xs animate-in fade-in flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-amber-900 mr-1">Quick Select:</span>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="px-2.5 py-1 rounded-full bg-white hover:bg-amber-100 text-amber-900 border border-amber-200/60 text-[11px] font-semibold"
                  >
                    All ({filteredStudents.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectOverdue}
                    className="px-2.5 py-1 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/60 text-[11px] font-semibold"
                  >
                    Overdue ({counts.overdue})
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectDueSoon}
                    className="px-2.5 py-1 rounded-full bg-amber-100/80 hover:bg-amber-200 text-amber-950 border border-amber-300/60 text-[11px] font-semibold"
                  >
                    Due Soon ({counts.dueSoon})
                  </button>
                </div>

                {selectedStudentIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="text-[11px] text-slate-500 hover:text-slate-800 underline font-medium"
                  >
                    Clear ({selectedStudentIds.size})
                  </button>
                )}
              </div>
            )}

            {/* Student List Header & Student Cards (or Shimmer Skeleton while Firestore is initially fetching) */}
            {isInitialFetching ? (
              <StudentListSkeleton count={4} />
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-slate-500 px-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                      {activeTab === 'ALL' && 'Student Directory'}
                      {activeTab === 'DUE_SOON' && 'Expiring in ≤ 3 Days'}
                      {activeTab === 'OVERDUE' && 'Overdue Accounts'}
                    </span>
                    <span className="font-mono text-slate-400 text-[11px]">
                      &bull; {filteredStudents.length} {filteredStudents.length === 1 ? 'record' : 'records'}
                    </span>
                    {sortOption === 'OVERDUE_PRIORITY' && counts.overdue > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                        <AlertCircle className="w-3 h-3" />
                        <span>Overdue Prioritized ({counts.overdue} at top)</span>
                      </span>
                    )}
                  </div>

                  {/* Student List Header Sorting Dropdown Menu */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1">
                      <ArrowUpDown className="w-3 h-3 text-amber-500" />
                      <span>Sort:</span>
                    </span>
                    <select
                      aria-label="Sort student list header"
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value as StudentSortOption)}
                      className="px-3 py-1 rounded-full border border-slate-200/60 bg-white text-[11px] font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 cursor-pointer shadow-2xs"
                    >
                      <option value="OVERDUE_PRIORITY">Overdue Priority (Most Overdue First)</option>
                      <option value="NAME_ASC">Name (A-Z)</option>
                      <option value="NAME_DESC">Name (Z-A)</option>
                      <option value="DUE_DATE_ASC">Fee Due Date (Earliest)</option>
                      <option value="DUE_DATE_DESC">Fee Due Date (Latest)</option>
                      <option value="SEAT_ASC">Seat Number (A-Z)</option>
                      <option value="SEAT_DESC">Seat Number (Z-A)</option>
                      <option value="RECENT_PAYMENTS">Recent Payments</option>
                    </select>
                  </div>
                </div>

                {filteredStudents.length === 0 ? (
                  <div className="text-center py-12 px-4 bg-white rounded-3xl border border-slate-200/60 shadow-sm">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden border border-amber-200/60 shadow-md mx-auto mb-4">
                      <img src="/empty_students.jpg" alt="No Students" className="w-full h-full object-cover" />
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      {activeTab === 'OVERDUE'
                        ? 'No Overdue Students'
                        : activeTab === 'DUE_SOON'
                        ? 'No Fees Due in Next 3 Days'
                        : 'No Students Match Your Filter'}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      {activeTab === 'OVERDUE'
                        ? 'All Lakshay Library desks are up to date on fee payments.'
                        : activeTab === 'DUE_SOON'
                        ? 'No student due dates fall within the 3-day reminder window right now.'
                        : 'Try adjusting your search query or register a new student.'}
                    </p>
                    {activeTab === 'ALL' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSeatForAdd('');
                          setIsAddStudentOpen(true);
                        }}
                        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-full shadow-sm transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Student</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3.5">
                    {filteredStudents.map((student) => {
                      const studentPayments = allPayments[student.id] || [];
                      return (
                        <StudentCard
                          key={student.id}
                          student={student}
                          paymentCount={studentPayments.length}
                          onWhatsAppClick={(s) => setStudentForWhatsApp(s)}
                          onMarkPaidClick={(s) => setStudentToMarkPaid(s)}
                          onViewDetails={(s) => setSelectedStudentForDetail(s)}
                          onQrCodeClick={(s) => setStudentForQrPass(s)}
                          onPrintCardClick={(s) => setStudentForPrintCard(s)}
                          isSelectionMode={isSelectionMode}
                          isSelected={selectedStudentIds.has(student.id)}
                          onToggleSelect={handleToggleSelect}
                          theme={currentTheme}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
        </div>
      </main>

      {/* Floating Bulk Action Bar (when students are selected) */}
      {isSelectionMode && selectedStudentIds.size > 0 && (
        <div className="absolute bottom-20 inset-x-4 z-30 bg-slate-900/90 backdrop-blur-md text-white p-3 rounded-2xl shadow-xl border border-slate-700/70 flex items-center justify-between gap-2 animate-in slide-in-from-bottom-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="text-xs font-bold font-mono whitespace-nowrap">
              {selectedStudentIds.size} Selected
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => exportStudentsToCSV(selectedStudentsList, 'Selected_Batch')}
              className="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkWhatsAppOpen(true)}
              className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Bulk WhatsApp ({selectedStudentIds.size})</span>
            </button>

            <button
              type="button"
              onClick={handleClearSelection}
              className="p-1.5 text-slate-400 hover:text-white rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Left-Sliding ModalNavigationDrawer (Settings, Color Palette, Scan / QR Check-in, History & Shift Timings, Customize Seats) */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        theme={currentTheme}
        isDarkMode={isDarkMode}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSelectTheme={handleThemeChange}
        onOpenScanner={() => {
          setStudentToPreScan(null);
          setIsCheckInScannerOpen(true);
        }}
        onOpenShiftAndHistory={() => setIsShiftManagerOpen(true)}
        onOpenSeatMatrix={() => setIsSeatMatrixOpen(true)}
        onViewKotlinDrawerCode={() => {
          setSelectedCodeSnippetIndex(0);
          setIsCodeViewerOpen(true);
        }}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onResetDatabase={handleResetData}
        onRestorePreviousData={handleRestoreData}
        onOpenUpiPaymentQr={() => setIsUpiPaymentQrOpen(true)}
        onOpenApkExport={() => setIsApkExportOpen(true)}
        onOpenWorkManager={() => setIsWorkManagerOpen(true)}
        onOpenGoogleDriveSync={() => setIsGoogleDriveSyncOpen(true)}
      />

      {/* Frosted-Glass Pill Expandable '+ Actions' FAB Menu (Keeping ONLY Add Student & Toggle Theme) */}
      <ExpandableFabMenu
        theme={currentTheme}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onAddStudent={() => {
          setSelectedSeatForAdd('');
          setIsAddStudentOpen(true);
        }}
        onViewKotlinFabCode={() => {
          setSelectedCodeSnippetIndex(0);
          setIsCodeViewerOpen(true);
        }}
      />

      {/* In-app Notification Banner */}
      {toastMessage && (
        <div className="absolute top-20 inset-x-3 z-50 p-3.5 bg-slate-900/95 text-white rounded-2xl shadow-xl border border-slate-700 flex items-start gap-3 animate-in slide-in-from-top-4 duration-200 backdrop-blur-md">
          <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <div className="flex-1 text-xs">
            <h4 className="font-bold text-white">Lakshay Library Notification</h4>
            <p className="text-slate-200 mt-0.5">{toastMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen h-dvh bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-white overflow-hidden">
      {/* Top Desktop Control Bar (Shown on Desktop/Laptop viewports; hidden on native phone screens so the app runs full-screen) */}
      <div className="hidden sm:flex bg-slate-900 border-b border-slate-800 px-4 py-2 items-center justify-between text-xs text-slate-300 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-white">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Lakshay Library Management App</span>
          </div>
          <span className="hidden md:inline text-slate-500">|</span>
          <span className="hidden md:inline text-slate-400">
            Warm Sunset Amber &bull; Recharts 6-Month Analytics &bull; Custom Shifts
          </span>
        </div>

        {/* Device View Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setDeviceMode('mobile')}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1 text-xs transition-colors ${
                deviceMode === 'mobile'
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android Pixel</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode('desktop')}
              className={`px-2.5 py-1 rounded-md flex items-center gap-1 text-xs transition-colors ${
                deviceMode === 'desktop'
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Full Screen</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsDiagnosticsOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
            title="Active Clients & Crash Diagnostics (Lakshay_Library_Logs on Google Drive)"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <Activity className="w-3.5 h-3.5" />
            <span>{onlineClientsCount} Active</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCodeViewerOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1 border border-slate-700"
          >
            <Code2 className="w-3.5 h-3.5 text-amber-400" />
            <span>View Kotlin Code</span>
          </button>
        </div>
      </div>

      {/* Main Preview Container: Native Full-Screen on Mobile Phones (<640px), Simulator/Full-Screen on Laptop/Desktop */}
      <div className="flex-1 flex items-center justify-center sm:p-6 overflow-hidden">
        {/* On actual mobile phones (<640px), always render full-screen without fake bezel */}
        <div className={`flex sm:hidden w-full h-full flex-col bg-slate-50 overflow-hidden ${darkModeClass}`}>
          {renderAppContent()}
        </div>

        {/* On Laptop / Desktop (>=640px), honor deviceMode ('mobile' bezel vs 'desktop' full view) */}
        <div className="hidden sm:flex w-full h-full items-center justify-center">
          {deviceMode === 'mobile' ? (
            /* Realistic Android Phone Device Shell for Laptop Preview */
            <div className="relative w-full max-w-[440px] h-[870px] max-h-[90vh] bg-black rounded-[48px] p-3 shadow-2xl border-4 border-slate-800 ring-1 ring-white/10 flex flex-col overflow-hidden">
              {/* Phone Speaker & Camera Notch */}
              <div className="absolute top-4 inset-x-0 flex justify-center items-center z-30 pointer-events-none">
                <div className="w-24 h-4 bg-black rounded-full flex items-center justify-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700" />
                  <div className="w-8 h-1 bg-slate-900 rounded-full" />
                </div>
              </div>

              {/* Inner Phone Screen */}
              <div className={`flex-1 rounded-[38px] overflow-hidden flex flex-col bg-slate-50 relative pt-4 ${darkModeClass}`}>
                {renderAppContent()}
              </div>
            </div>
          ) : (
            /* Full Desktop View */
            <div className={`w-full max-w-5xl h-[870px] max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col ${darkModeClass}`}>
              {renderAppContent()}
            </div>
          )}
        </div>
      </div>

      {/* MODALS (Wrapped with active Light/Dark Mode theme scope for dynamic onSurface input visibility) */}
      <div className={isDarkMode ? 'lakshay-dark-mode text-slate-100' : 'text-slate-900'}>
      {/* 1. Add Student Composable Form & Kotlin Code */}
      <AddStudentModal
        isOpen={isAddStudentOpen}
        onClose={() => setIsAddStudentOpen(false)}
        suggestedSeat={selectedSeatForAdd}
        theme={currentTheme}
        shifts={shifts}
        onOpenShiftManager={() => setIsShiftManagerOpen(true)}
        onOpenSeatManager={() => {
          setIsAddStudentOpen(false);
          setIsSeatMatrixOpen(true);
        }}
        onStudentAdded={() => {
          triggerToast('Student added successfully to Lakshay Library Firestore!');
        }}
      />

      {/* 2. Central Shift Manager Modal */}
      <ShiftManagerModal
        shifts={shifts}
        isOpen={isShiftManagerOpen}
        onClose={() => setIsShiftManagerOpen(false)}
        theme={currentTheme}
      />

      {/* 3. Detailed View for Student & PaymentHistory Subcollection */}
      <StudentDetailModal
        student={selectedStudentForDetail}
        isOpen={!!selectedStudentForDetail}
        onClose={() => setSelectedStudentForDetail(null)}
        onMarkPaidClick={(s) => {
          setSelectedStudentForDetail(null);
          setStudentToMarkPaid(s);
        }}
        onWhatsAppClick={(s) => {
          setStudentForWhatsApp(s);
        }}
        onQrCodeClick={(s) => {
          setSelectedStudentForDetail(null);
          setStudentForQrPass(s);
        }}
        onPrintCardClick={(s) => {
          setSelectedStudentForDetail(null);
          setStudentForPrintCard(s);
        }}
      />

      {/* 4. Mark Paid Confirmation Modal */}
      <PaymentConfirmModal
        student={studentToMarkPaid}
        isOpen={!!studentToMarkPaid}
        onClose={() => setStudentToMarkPaid(null)}
        onPaymentSuccess={() => {
          triggerToast('Fee collected! Next due date extended by 1 month and logged to PaymentHistory subcollection.');
        }}
      />

      {/* 5. WhatsApp Reminder Modal */}
      <WhatsAppModal
        student={studentForWhatsApp}
        isOpen={!!studentForWhatsApp}
        onClose={() => setStudentForWhatsApp(null)}
      />

      {/* 6. WorkManager Daily JSON Database Backup & 3-Day Automated Alert Simulator */}
      <WorkManagerModal
        students={students}
        allPayments={allPayments}
        isOpen={isWorkManagerOpen}
        onClose={() => setIsWorkManagerOpen(false)}
        onSendNotificationToast={(text) => triggerToast(text)}
      />

      {/* 7. Desk & Seat Matrix Map */}
      <SeatMatrixModal
        students={students}
        isOpen={isSeatMatrixOpen}
        onClose={() => setIsSeatMatrixOpen(false)}
        onSelectStudent={(s) => setSelectedStudentForDetail(s)}
        onAddStudentToSeat={(seat) => {
          setSelectedSeatForAdd(seat);
          setIsAddStudentOpen(true);
        }}
      />

      {/* 8. Unique Student QR Code Desk Pass Modal */}
      <StudentQrModal
        student={studentForQrPass}
        isOpen={!!studentForQrPass}
        onClose={() => setStudentForQrPass(null)}
        theme={currentTheme}
        onOpenScannerWithStudent={(s) => {
          setStudentForQrPass(null);
          setStudentToPreScan(s);
          setIsCheckInScannerOpen(true);
        }}
      />

      {/* 9. Front-Desk Quick Digital Check-in Scanner View */}
      <CheckInScannerModal
        students={students}
        isOpen={isCheckInScannerOpen}
        onClose={() => {
          setIsCheckInScannerOpen(false);
          setStudentToPreScan(null);
        }}
        theme={currentTheme}
        preSelectedStudent={studentToPreScan}
        onCheckInSuccess={(s) => {
          triggerToast(`✓ Check-in recorded in Firestore for ${s.name} (Seat ${s.seatNumber})!`);
        }}
      />

      {/* 10. Bulk WhatsApp Reminders Queue Modal */}
      <BulkWhatsAppModal
        students={selectedStudentsList}
        isOpen={isBulkWhatsAppOpen}
        onClose={() => setIsBulkWhatsAppOpen(false)}
        theme={currentTheme}
      />

      {/* 11. Printable Library Badge & QR Card View */}
      <PrintableLibraryCardModal
        student={studentForPrintCard}
        isOpen={!!studentForPrintCard}
        onClose={() => setStudentForPrintCard(null)}
        theme={currentTheme}
      />

      {/* 12. Settings Menu Modal with Global Dark Mode Toggle */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={currentTheme}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onSelectTheme={handleThemeChange}
        onOpenShiftManager={() => setIsShiftManagerOpen(true)}
        onOpenSeatMatrix={() => setIsSeatMatrixOpen(true)}
        onOpenWorkManager={() => setIsWorkManagerOpen(true)}
        onResetDatabase={handleResetData}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
      />

      {/* 13. Android WebAPK Installer & Native APK Project Bundle Exporter */}
      <ApkExportModal
        isOpen={isApkExportOpen}
        onClose={() => setIsApkExportOpen(false)}
        onTriggerToast={triggerToast}
      />

      {/* 14. Google Drive Daily Sync & Primary/Secondary Device Role Modal */}
      <GoogleDriveSyncModal
        isOpen={isGoogleDriveSyncOpen}
        onClose={() => setIsGoogleDriveSyncOpen(false)}
        students={students}
        onTriggerToast={triggerToast}
      />

      {/* 15. Real-time Active Clients, Diagnostics & Google Drive Crash Logs Modal */}
      <DiagnosticsLogsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        onTriggerToast={triggerToast}
        onOpenDriveSyncModal={() => setIsGoogleDriveSyncOpen(true)}
      />

      {/* 16. Reception UPI ID & Payment QR Standee Modal (with warning on modification) */}
      <UpiPaymentQrModal
        isOpen={isUpiPaymentQrOpen}
        onClose={() => setIsUpiPaymentQrOpen(false)}
        onTriggerToast={triggerToast}
      />

      {/* 17. Notification Alert Status Modal (showing overdue, due soon & backup status) */}
      <NotificationStatusModal
        isOpen={isNotificationStatusOpen}
        onClose={() => setIsNotificationStatusOpen(false)}
        students={students}
        onOpenWorkManager={() => setIsWorkManagerOpen(true)}
        onOpenGoogleDriveSync={() => setIsGoogleDriveSyncOpen(true)}
      />

      {/* 8. Full Kotlin Jetpack Compose Codebase Inspector */}
      {isCodeViewerOpen && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in ${darkModeClass}`}>
          <div 
            className="bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col border border-slate-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Lakshay Library &bull; Android Jetpack Compose Codebase
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCodeViewerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
              >
                &times;
              </button>
            </div>

            {/* File Tabs */}
            <div className="flex items-center gap-1 px-4 py-2 bg-slate-950 border-b border-slate-800 overflow-x-auto text-xs no-scrollbar">
              {KOTLIN_CODE_SNIPPETS.map((file, idx) => (
                <button
                  key={file.name}
                  type="button"
                  onClick={() => setSelectedCodeSnippetIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl whitespace-nowrap font-mono text-xs transition-all ${
                    selectedCodeSnippetIndex === idx
                      ? 'bg-amber-600 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {file.name}
                </button>
              ))}
            </div>

            {/* File Description */}
            <div className="p-3 bg-slate-800/60 border-b border-slate-800 text-xs text-slate-300 flex items-center justify-between">
              <div>
                <span className="font-mono text-amber-400">
                  {KOTLIN_CODE_SNIPPETS[selectedCodeSnippetIndex].path}
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {KOTLIN_CODE_SNIPPETS[selectedCodeSnippetIndex].description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(KOTLIN_CODE_SNIPPETS[selectedCodeSnippetIndex].code);
                  triggerToast(`Copied ${KOTLIN_CODE_SNIPPETS[selectedCodeSnippetIndex].name} to clipboard!`);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600/90 hover:bg-amber-600 text-white text-xs font-semibold shrink-0"
              >
                Copy File
              </button>
            </div>

            {/* Syntax-Highlighted Kotlin Jetpack Compose Code Output */}
            <KotlinCodeHighlighter
              code={KOTLIN_CODE_SNIPPETS[selectedCodeSnippetIndex].code}
              showToolbar={true}
              maxHeightClass="flex-1"
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

interface NotificationStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  onOpenWorkManager: () => void;
  onOpenGoogleDriveSync: () => void;
}

const NotificationStatusModal: React.FC<NotificationStatusModalProps> = ({
  isOpen,
  onClose,
  students,
  onOpenWorkManager,
  onOpenGoogleDriveSync,
}) => {
  if (!isOpen) return null;

  const overdueList = students.filter(s => getDaysDifference(s.nextFeeDueDate) < 0);
  const dueSoonList = students.filter(s => {
    const diff = getDaysDifference(s.nextFeeDueDate);
    return diff >= 0 && diff <= 3;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 bg-amber-500/10 border-b border-slate-200/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">Notification &amp; Backup Status</h3>
              <p className="text-xs text-slate-500">Twice-daily checks &amp; active fee alerts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Overdue Section */}
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200/70 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-rose-900">
              <span className="flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                Overdue Students ({overdueList.length})
              </span>
              <span className="px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 text-[10px] font-mono">
                Action Required
              </span>
            </div>
            {overdueList.length === 0 ? (
              <p className="text-xs text-slate-600">No overdue student accounts.</p>
            ) : (
              <div className="space-y-1.5 pt-1">
                {overdueList.map(s => (
                  <div key={s.id} className="p-2 rounded-xl bg-white border border-rose-100 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{s.name}</span>
                      <span className="text-slate-500 ml-1.5">(Seat {s.seatNumber})</span>
                    </div>
                    <span className="font-mono font-bold text-rose-600">
                      {Math.abs(getDaysDifference(s.nextFeeDueDate))}d overdue
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Due Soon Section */}
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/70 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-amber-900">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                Due in 3 Days or Less ({dueSoonList.length})
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-mono">
                Upcoming
              </span>
            </div>
            {dueSoonList.length === 0 ? (
              <p className="text-xs text-slate-600">No renewals due in the next 3 days.</p>
            ) : (
              <div className="space-y-1.5 pt-1">
                {dueSoonList.map(s => (
                  <div key={s.id} className="p-2 rounded-xl bg-white border border-amber-100 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900">{s.name}</span>
                      <span className="text-slate-500 ml-1.5">(Seat {s.seatNumber})</span>
                    </div>
                    <span className="font-mono font-semibold text-amber-700">
                      Due {formatDueDateDisplay(s.nextFeeDueDate)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/60 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenWorkManager();
            }}
            className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <Bell className="w-4 h-4" />
            <span>Configure WorkManager Tasks</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenGoogleDriveSync();
            }}
            className="py-2.5 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <Cloud className="w-4 h-4 text-amber-600" />
            <span>Drive Sync</span>
          </button>
        </div>
      </div>
    </div>
  );
};

