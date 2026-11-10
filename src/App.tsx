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
import { MetricsHeaderSkeleton, StudentListSkeleton } from './components/DashboardSkeleton';
import { ApkExportModal } from './components/ApkExportModal';
import { GoogleDriveSyncModal } from './components/GoogleDriveSyncModal';
import { UpiPaymentQrModal } from './components/UpiPaymentQrModal';
import { HelpFaqModal } from './components/HelpFaqModal';
import { AppLaunchSplash, ExitAppModal } from './components/AppLifecycleAnimations';
import { initClientPresenceEngine } from './services/clientPresenceService';
import { addBreadcrumb } from './services/crashLogService';
import {
  exportStudentsToCSV,
  checkAndRunDueDailyBackup,
  runDailyJsonBackupTask,
} from './services/exportService';
import {
  getDriveAccessToken,
  getGoogleDriveSyncConfig,
  initDriveAuth,
  pullMasterSnapshotFromGoogleDrive,
  checkAndApplyLiveRelaySync,
} from './services/googleDriveSyncService';
import { 
  Users, 
  AlertTriangle, 
  AlertCircle, 
  Search, 
  Plus, 
  RotateCcw, 
  Bell, 
  Filter,
  BarChart3,
  Settings2,
  Download,
  FileJson,
  Cloud,
  CheckSquare,
  MessageSquare,
  ArrowUpDown,
  Menu,
  X,
  Clock
} from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [shiftFilter, setShiftFilter] = useState<string>('ALL');
  // Automated default sorting rule: prioritize students with the most overdue payments to the top upon app launch
  const [sortOption, setSortOption] = useState<StudentSortOption>('OVERDUE_PRIORITY');

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

  // Live State + Initial Fetching Shimmer State
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
  const [isApkExportOpen, setIsApkExportOpen] = useState(false);
  const [isGoogleDriveSyncOpen, setIsGoogleDriveSyncOpen] = useState(false);
  const [isUpiPaymentQrOpen, setIsUpiPaymentQrOpen] = useState(false);
  const [isNotificationStatusOpen, setIsNotificationStatusOpen] = useState(false);
  const [isHelpFaqOpen, setIsHelpFaqOpen] = useState(false);
  const [helpFaqCategory, setHelpFaqCategory] = useState<'SYNC' | 'UPI' | 'SEATS' | 'SHIFTS' | 'ATTENDANCE' | 'REMINDERS' | 'ALL'>('ALL');

  const handleOpenHelpFaq = (category: 'SYNC' | 'UPI' | 'SEATS' | 'SHIFTS' | 'ATTENDANCE' | 'REMINDERS' | 'ALL' = 'ALL') => {
    setHelpFaqCategory(category);
    setIsHelpFaqOpen(true);
  };

  // Multi-select & Bulk Reminders state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isBulkWhatsAppOpen, setIsBulkWhatsAppOpen] = useState(false);

  // Printable Card Modal state
  const [studentForPrintCard, setStudentForPrintCard] = useState<Student | null>(null);

  // App Launch Splash & Exit Confirmation Modal state
  const [isLaunching, setIsLaunching] = useState(true);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  // Notification Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Intercept Android System Back Gesture, Native Back Event & Browser Back Gesture to prompt Exit Confirmation
  useEffect(() => {
    const pushRootGuard = () => {
      try {
        if (!window.history.state?.lakshayRootGuard) {
          window.history.pushState({ lakshayRootGuard: true }, '', window.location.href);
        }
      } catch {
        // Ignore history API restrictions
      }
    };

    pushRootGuard();

    // Reinforce history guard on first user interaction (satisfies Chromium user-activation requirement for back-gesture popstate)
    const handleFirstUserInteraction = () => {
      try {
        window.history.pushState({ lakshayRootGuard: true }, '', window.location.href);
      } catch {
        // Ignore
      }
    };
    window.addEventListener('pointerdown', handleFirstUserInteraction, { once: true, passive: true });

    const handleBackAction = () => {
      // If any modal or drawer is open, close it first
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
      } else if (isAddStudentOpen) {
        setIsAddStudentOpen(false);
      } else if (selectedStudentForDetail) {
        setSelectedStudentForDetail(null);
      } else if (studentToMarkPaid) {
        setStudentToMarkPaid(null);
      } else if (studentForWhatsApp) {
        setStudentForWhatsApp(null);
      } else if (isWorkManagerOpen) {
        setIsWorkManagerOpen(false);
      } else if (isSeatMatrixOpen) {
        setIsSeatMatrixOpen(false);
      } else if (isShiftManagerOpen) {
        setIsShiftManagerOpen(false);
      } else if (studentForQrPass) {
        setStudentForQrPass(null);
      } else if (isCheckInScannerOpen) {
        setIsCheckInScannerOpen(false);
      } else if (isBulkWhatsAppOpen) {
        setIsBulkWhatsAppOpen(false);
      } else if (studentForPrintCard) {
        setStudentForPrintCard(null);
      } else if (isSettingsOpen) {
        setIsSettingsOpen(false);
      } else if (isGoogleDriveSyncOpen) {
        setIsGoogleDriveSyncOpen(false);
      } else if (isUpiPaymentQrOpen) {
        setIsUpiPaymentQrOpen(false);
      } else if (isNotificationStatusOpen) {
        setIsNotificationStatusOpen(false);
      } else if (isHelpFaqOpen) {
        setIsHelpFaqOpen(false);
      } else {
        // On root screen: prompt Exit Confirmation & Exit Animation when user tries to exit by gesture
        setIsExitModalOpen(true);
      }

      try {
        window.history.pushState({ lakshayRootGuard: true }, '', window.location.href);
      } catch {
        // Ignore
      }
    };

    // Edge back-swipe gesture detector for mobile web / PWA viewports
    let edgeStartX: number | null = null;
    let edgeStartY: number | null = null;

    const handleEdgeTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const vw = window.innerWidth;
      if (x <= 24 || x >= vw - 24) {
        edgeStartX = x;
        edgeStartY = y;
      } else {
        edgeStartX = null;
        edgeStartY = null;
      }
    };

    const handleEdgeTouchEnd = (e: TouchEvent) => {
      if (edgeStartX === null || edgeStartY === null || e.changedTouches.length !== 1) return;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const vw = window.innerWidth;
      const deltaX = Math.abs(endX - edgeStartX);
      const deltaY = Math.abs(endY - edgeStartY);
      const swipedInwardFromLeft = edgeStartX <= 24 && endX - edgeStartX > 70;
      const swipedInwardFromRight = edgeStartX >= vw - 24 && edgeStartX - endX > 70;

      edgeStartX = null;
      edgeStartY = null;

      if ((swipedInwardFromLeft || swipedInwardFromRight) && deltaX > deltaY * 1.8) {
        handleBackAction();
      }
    };

    window.addEventListener('popstate', handleBackAction);
    window.addEventListener('lakshay-native-back', handleBackAction);
    window.addEventListener('touchstart', handleEdgeTouchStart, { passive: true });
    window.addEventListener('touchend', handleEdgeTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleFirstUserInteraction);
      window.removeEventListener('popstate', handleBackAction);
      window.removeEventListener('lakshay-native-back', handleBackAction);
      window.removeEventListener('touchstart', handleEdgeTouchStart);
      window.removeEventListener('touchend', handleEdgeTouchEnd);
    };
  }, [
    isDrawerOpen,
    isAddStudentOpen,
    selectedStudentForDetail,
    studentToMarkPaid,
    studentForWhatsApp,
    isWorkManagerOpen,
    isSeatMatrixOpen,
    isShiftManagerOpen,
    studentForQrPass,
    isCheckInScannerOpen,
    isBulkWhatsAppOpen,
    studentForPrintCard,
    isSettingsOpen,
    isGoogleDriveSyncOpen,
    isUpiPaymentQrOpen,
    isNotificationStatusOpen,
    isHelpFaqOpen,
  ]);

  // Subscriptions & Initial Hydration
  useEffect(() => {
    const initialFetchTimer = setTimeout(() => {
      setStudents([...getStoredStudents()]);
      setAllPayments({ ...getStoredPayments() });
      setShifts([...getStoredShifts()]);
      setSeats([...getStoredSeats()]);
      setIsInitialFetching(false);
    }, 350);

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

  // Initialize Google Drive Auth listener at app startup & reopen modal after OAuth redirect
  useEffect(() => {
    try {
      const hasPendingRedirect =
        sessionStorage.getItem('lakshay_library_pending_drive_redirect') === '1' ||
        localStorage.getItem('lakshay_library_pending_drive_redirect') === '1';
      if (hasPendingRedirect) {
        sessionStorage.removeItem('lakshay_library_pending_drive_redirect');
        localStorage.removeItem('lakshay_library_pending_drive_redirect');
        setIsGoogleDriveSyncOpen(true);
      }
    } catch {
      // Ignore storage errors
    }

    const unsubDriveAuth = initDriveAuth();
    return () => {
      unsubDriveAuth();
    };
  }, []);

  // Silent Background Client Presence Engine (for Drive sync only, no UI indicator)
  useEffect(() => {
    const cleanupPresence = initClientPresenceEngine();
    return () => {
      cleanupPresence();
    };
  }, []);

  // Active-State Real-Time Live Sync (Vice-Versa & Consecutive across all connected devices):
  // When ANY device is active in foreground, sync immediately whenever new data is entered on any peer device
  useEffect(() => {
    const runActiveLiveSync = () => {
      const config = getGoogleDriveSyncConfig();
      const cleanDeviceId = (config.deviceId || 'default').replace(/[^a-zA-Z0-9]/g, '');
      const topic =
        config.masterSyncChannelTopic ||
        (config.deviceRole === 'PRIMARY' ? `lakshay_ch_${cleanDeviceId}` : null);
      if (!topic) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

      checkAndApplyLiveRelaySync()
        .then((res) => {
          if (res.synced) {
            setToastMessage(
              `⚡ Live Synced: Received updated ${res.studentCount} students from ${res.primaryDeviceName || 'Peer Device'}!`
            );
            setTimeout(() => setToastMessage(null), 4500);
          }
        })
        .catch(() => {});
    };

    // Immediate sync on launch
    runActiveLiveSync();

    // Fast active-state poll every 3.5 seconds
    const liveSyncInterval = setInterval(runActiveLiveSync, 3500);

    // Immediate sync on app focus / visibility change
    const handleActiveResume = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        runActiveLiveSync();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleActiveResume);
      document.addEventListener('visibilitychange', handleActiveResume);
    }

    return () => {
      clearInterval(liveSyncInterval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleActiveResume);
        document.removeEventListener('visibilitychange', handleActiveResume);
      }
    };
  }, []);

  // Silent Recurring Daily Backup Check (24h Periodic Check, no startup toast logs)
  useEffect(() => {
    if (isInitialFetching) return;

    checkAndRunDueDailyBackup(students, allPayments);

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
      triggerToast('Database reset to 0 students.');
    }, 450);
  };

  // Main UI content
  const renderAppContent = () => (
    <div
      className={`flex flex-col h-full w-full bg-slate-50 text-slate-800 relative overflow-hidden transition-colors duration-200 ${darkModeClass}`}
    >
      {/* 1. Clean Top App Bar: Responsive 2-Row on Mobile, Single Row on Desktop */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/60 px-3.5 py-2.5 sm:px-6 sm:py-3 shrink-0 z-10 transition-colors duration-200">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3">
          {/* Top row on mobile / Left group on desktop */}
          <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0 w-full sm:w-auto">
            {/* Hamburger Menu Icon & Title */}
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                aria-label="Open Navigation Drawer"
                title="Open Menu"
                className="w-9 h-9 rounded-xl bg-slate-100/80 hover:bg-slate-200/70 active:scale-95 flex items-center justify-center shrink-0 border border-slate-200/60 text-slate-700 transition-all touch-manipulation"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden shadow-2xs border border-amber-500/30 flex items-center justify-center shrink-0">
                <img src="/app-icon.png" alt="Lakshay Library" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 truncate">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 leading-tight truncate">
                  Lakshay Library
                </h1>
                <p className="text-[10px] sm:text-[11px] text-slate-500 truncate">
                  Study Hall Management
                </p>
              </div>
            </div>

            {/* Mobile-only Notification Bell Button */}
            <div className="flex sm:hidden items-center shrink-0">
              <button
                type="button"
                onClick={() => setIsNotificationStatusOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 border border-amber-500/30 transition-colors flex items-center gap-1.5 text-xs font-bold shrink-0 touch-manipulation"
                title="Due & Overdue Alerts"
              >
                <Bell className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-mono text-xs font-bold text-amber-900">
                  {counts.overdue + counts.dueSoon}
                </span>
                <span className="text-[10px] text-amber-700 font-medium">Alerts</span>
              </button>
            </div>
          </div>

          {/* Quick Global Search Bar & Desktop Header Sort Dropdown */}
          <div className="flex-1 max-w-full sm:max-w-md flex items-center gap-2 min-w-0 w-full">
            <div className="relative flex-1 min-w-0">
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
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 w-5 h-5 flex items-center justify-center"
                >
                  &times;
                </button>
              )}
            </div>

            <div className="relative hidden sm:flex items-center shrink-0">
              <ArrowUpDown className="w-3 h-3 text-amber-600 absolute left-2.5 pointer-events-none" />
              <select
                aria-label="Sort students in search bar"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as StudentSortOption)}
                className="pl-7 pr-2.5 py-1.5 rounded-full border border-slate-200/60 bg-slate-100/70 hover:bg-slate-100 text-[11px] font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 cursor-pointer transition-all"
                title="Sort student list"
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

          {/* Desktop-only Notification Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsNotificationStatusOpen(true)}
              className="px-2.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 border border-amber-500/30 transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Due & Overdue Alerts"
            >
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span>{counts.overdue} Overdue &bull; {counts.dueSoon} Due</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Scrollable Workspace */}
      <main
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-6 pb-28 min-w-0 max-w-full"
      >
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-5 min-w-0 w-full">
        {/* 2. Unified KPI Metrics Header Bar with Subtle Divider Lines (or Shimmer Skeleton while fetching) */}
        {isInitialFetching ? (
          <MetricsHeaderSkeleton />
        ) : (
          <section className="bg-white rounded-2xl border border-slate-200/60 shadow-xs hover:shadow-md transition-shadow grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/60 overflow-hidden min-w-0 w-full">
            <div className="p-3 sm:p-4 border-r border-slate-200/60 sm:border-r-0">
              <span className="block text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-slate-500">
                Active Students
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-mono">
                  {counts.total}
                </span>
                <span className="text-[10px] sm:text-[11px] font-medium text-emerald-600">Enrolled</span>
              </div>
            </div>

            <div
              onClick={() => setIsSeatMatrixOpen(true)}
              className="p-3 sm:p-4 cursor-pointer hover:bg-slate-50/70 transition-colors"
              title="Click to open Minimalist Desk Matrix"
            >
              <span className="block text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-slate-500">
                Total Desks Occupied
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-mono">
                  {counts.total}
                  <span className="text-xs font-normal text-slate-400">/{seats.length}</span>
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-amber-600">
                  {Math.max(0, seats.length - counts.total)} free
                </span>
              </div>
            </div>

            <div className="p-3 sm:p-4 border-r border-slate-200/60 sm:border-r-0">
              <span className="block text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-slate-500">
                Pending Dues
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg sm:text-xl font-bold text-amber-600 tracking-tight font-mono">
                  {counts.overdue + counts.dueSoon}
                </span>
                <span className="text-[10px] sm:text-[11px] font-medium text-rose-600">
                  {counts.overdue} overdue
                </span>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              <span className="block text-[10px] sm:text-xs uppercase tracking-wider font-semibold text-slate-500">
                Monthly Run-Rate
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight font-mono">
                  ₹{counts.totalMonthlyRevenue.toLocaleString('en-IN')}
                </span>
                <button
                  type="button"
                  onClick={handleResetData}
                  className="text-[11px] text-slate-400 hover:text-amber-600 inline-flex items-center gap-0.5 transition-colors p-1"
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
          className={`space-y-4 sm:space-y-5 min-w-0 max-w-full overflow-x-hidden ${
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

            {/* Student List Header & Student Cards */}
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
                      className="px-3 py-1 rounded-full border border-slate-200/60 bg-white text-[11px] font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 cursor-pointer shadow-2xs max-w-[160px] sm:max-w-none truncate"
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
                        : 'No Students Registered Yet'}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      {activeTab === 'OVERDUE'
                        ? 'All Lakshay Library desks are up to date on fee payments.'
                        : activeTab === 'DUE_SOON'
                        ? 'No student due dates fall within the 3-day reminder window right now.'
                        : 'Get started by registering your first student and assigning a library desk.'}
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
        </div>
      </main>

      {/* Floating Bulk Action Bar (when students are selected) */}
      {isSelectionMode && selectedStudentIds.size > 0 && (
        <div className="fixed bottom-20 inset-x-4 max-w-2xl mx-auto z-30 bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-xl border border-slate-700/70 flex items-center justify-between gap-2 animate-in slide-in-from-bottom-3">
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

      {/* Left-Sliding Navigation Drawer */}
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
        onResetDatabase={handleResetData}
        onOpenUpiPaymentQr={() => setIsUpiPaymentQrOpen(true)}
        onOpenApkExport={() => setIsApkExportOpen(true)}
        onOpenWorkManager={() => setIsWorkManagerOpen(true)}
        onOpenGoogleDriveSync={() => setIsGoogleDriveSyncOpen(true)}
        onOpenHelpFaq={() => handleOpenHelpFaq('ALL')}
      />

      {/* Frosted-Glass Pill Expandable '+ Actions' FAB Menu */}
      <ExpandableFabMenu
        theme={currentTheme}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onAddStudent={() => {
          setSelectedSeatForAdd('');
          setIsAddStudentOpen(true);
        }}
      />

      {/* In-app Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 inset-x-3 max-w-lg mx-auto z-50 p-3.5 bg-slate-900/95 text-white rounded-2xl shadow-xl border border-slate-700 flex items-start gap-3 animate-in slide-in-from-top-4 duration-200 backdrop-blur-md">
          <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <div className="flex-1 text-xs">
            <h4 className="font-bold text-white">Lakshay Library</h4>
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
    <div className={`min-h-screen h-dvh w-full flex flex-col font-sans selection:bg-amber-500 selection:text-white overflow-hidden bg-slate-50 ${darkModeClass}`}>
      {/* App Launch Animation Splash Screen */}
      {isLaunching && (
        <AppLaunchSplash onComplete={() => setIsLaunching(false)} />
      )}

      {/* Full-Screen Production App Content */}
      {renderAppContent()}

      {/* Exit App Confirmation & Farewell Animation Modal */}
      <ExitAppModal
        isOpen={isExitModalOpen}
        onCancel={() => setIsExitModalOpen(false)}
      />

      {/* MODALS (Wrapped with active Light/Dark Mode theme scope) */}
      <div className={isDarkMode ? 'lakshay-dark-mode text-slate-100' : 'text-slate-900'}>
        {/* 1. Add Student Modal */}
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
            triggerToast('Student registered successfully in Lakshay Library.');
          }}
        />

        {/* 2. Central Shift Manager Modal */}
        <ShiftManagerModal
          shifts={shifts}
          isOpen={isShiftManagerOpen}
          onClose={() => setIsShiftManagerOpen(false)}
          theme={currentTheme}
        />

        {/* 3. Detailed View for Student & Payment History */}
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
            triggerToast('Fee collected! Next due date extended by 1 month.');
          }}
        />

        {/* 5. WhatsApp Reminder Modal */}
        <WhatsAppModal
          student={studentForWhatsApp}
          isOpen={!!studentForWhatsApp}
          onClose={() => setStudentForWhatsApp(null)}
        />

        {/* 6. Daily Backup & 3-Day Automated Fee Alert Settings */}
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
            triggerToast(`✓ Check-in recorded for ${s.name} (Seat ${s.seatNumber})!`);
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
        />

        {/* 13. Android WebAPK Installer & Native APK Exporter */}
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
          onOpenHelpFaq={(cat) => handleOpenHelpFaq(cat || 'SYNC')}
        />

        {/* 15. Reception UPI ID & Payment QR Standee Modal */}
        <UpiPaymentQrModal
          isOpen={isUpiPaymentQrOpen}
          onClose={() => setIsUpiPaymentQrOpen(false)}
          onTriggerToast={triggerToast}
          onOpenHelpFaq={(cat) => handleOpenHelpFaq(cat || 'UPI')}
        />

        {/* 16. Notification Alert Status Modal */}
        <NotificationStatusModal
          isOpen={isNotificationStatusOpen}
          onClose={() => setIsNotificationStatusOpen(false)}
          students={students}
          onOpenWorkManager={() => setIsWorkManagerOpen(true)}
          onOpenGoogleDriveSync={() => setIsGoogleDriveSyncOpen(true)}
        />

        {/* 17. Help & Documentation (FAQ) Section Modal */}
        <HelpFaqModal
          isOpen={isHelpFaqOpen}
          onClose={() => setIsHelpFaqOpen(false)}
          initialCategory={helpFaqCategory}
        />
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
            <span>Auto Backups &amp; Alerts</span>
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


