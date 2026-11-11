import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Student } from '../types/student';
import { useTheme } from '../context/ThemeContext';
import {
  DeviceSyncRole,
  DriveBackupFileMetadata,
  DrivePermissionVerificationReport,
  GoogleDriveSyncConfig,
  GOOGLE_AUTH_SESSION_STORAGE_KEY,
  MASTER_DRIVE_BACKUP_FILENAME,
  MASTER_DRIVE_ROOT_FOLDER_NAME,
  MASTER_SYNC_SUBFOLDER_NAME,
  MASTER_DRIVE_SYNC_PATH,
  MASTER_DRIVE_LOGS_PATH,
  copyTextToClipboard,
  findMasterSyncFileOnDrive,
  generateOfflineSyncPackageKey,
  getCurrentDriveUser,
  getDriveAccessToken,
  getGoogleDriveSyncConfig,
  getStoredDrivePermissionAuditReport,
  getStoredGoogleAuthSession,
  googleDriveLogout,
  googleDriveSignIn,
  initDriveAuth,
  pullMasterSnapshotFromGoogleDrive,
  pushPrimarySnapshotToGoogleDrive,
  revokeAndVerifyDrivePublicAccess,
  saveGoogleDriveSyncConfig,
  shareMasterFolderWithEmail,
} from '../services/googleDriveSyncService';
import {
  Phase0BackupVerificationReport,
  createAndVerifyPhase0LocalBackup,
  downloadPhase0VerifiedBackupFile,
  verifyBackupRestoreOnIsolatedProfile,
} from '../services/storageService';
import {
  LIBTRACK_IDB_NAME,
  LIBTRACK_IDB_VERSION,
  Phase1MigrationStateSummary,
  Phase1CopiedDataTestSuiteReport,
  getStoredPhase1MigrationState,
  runPhase1IndexedDbMigration,
  rollbackPhase1IndexedDbMigration,
  runPhase1CopiedDataTestSuite,
} from '../services/indexedDbService';
import {
  getStoredActiveClients,
  subscribeToActiveClients,
  sendPresenceHeartbeat,
  syncActiveClientsWithGoogleDrive,
  ActiveClientRecord,
} from '../services/clientPresenceService';
import {
  getCrashLogs,
  subscribeToCrashLogs,
  clearCrashLogs,
  exportCrashLogsAsJson,
  logCrash,
  syncCrashLogsToGoogleDrive,
  CrashLogEntry,
} from '../services/crashLogService';
import {
  getStoredDriveLogsFolderMeta,
  ensureLogsFolderOnDrive,
  LOGS_FOLDER_NAME,
  CRASH_LOGS_FILENAME,
  ACTIVE_CLIENTS_FILENAME,
} from '../services/driveLogsService';
import {
  X,
  Cloud,
  CloudUpload,
  CloudDownload,
  ShieldCheck,
  Smartphone,
  Laptop,
  Monitor,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Lock,
  Clock,
  Activity,
  Users,
  RotateCcw,
  Download,
  Trash2,
  Terminal,
  ChevronDown,
  ChevronUp,
  Bug,
  HelpCircle,
} from 'lucide-react';

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  onTriggerToast: (msg: string) => void;
  onOpenHelpFaq?: (category?: 'SYNC' | 'UPI' | 'SEATS' | 'SHIFTS' | 'RECEIPTS' | 'REMINDERS') => void;
}

type DriveModalSubTab = 'SYNC_ROLE' | 'HEARTBEAT_CLIENTS' | 'CRASH_LOGS';

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({
  isOpen,
  onClose,
  students,
  onTriggerToast,
  onOpenHelpFaq,
}) => {
  const { darkModeClass, isDarkMode } = useTheme();
  const [activeSubTab, setActiveSubTab] = useState<DriveModalSubTab>('SYNC_ROLE');

  const [user, setUser] = useState<User | null>(() => getCurrentDriveUser());
  const [storedAuthSession, setStoredAuthSession] = useState(() => getStoredGoogleAuthSession());
  const [accessToken, setAccessToken] = useState<string | null>(() => getDriveAccessToken());
  const [needsAuth, setNeedsAuth] = useState<boolean>(() => !getDriveAccessToken());
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [syncConfig, setSyncConfig] = useState<GoogleDriveSyncConfig>(() =>
    getGoogleDriveSyncConfig()
  );
  const [driveFileMeta, setDriveFileMeta] = useState<DriveBackupFileMetadata | null>(null);
  const [isCheckingDrive, setIsCheckingDrive] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shareEmailInput, setShareEmailInput] = useState('');
  const [isSharingEmail, setIsSharingEmail] = useState(false);

  // Phase 0 Security Containment & Verified Backup state
  const [phase0BackupReport, setPhase0BackupReport] = useState<Phase0BackupVerificationReport>(() =>
    createAndVerifyPhase0LocalBackup(false)
  );
  const [drivePermissionAudit, setDrivePermissionAudit] =
    useState<DrivePermissionVerificationReport | null>(() => getStoredDrivePermissionAuditReport());
  const [isAuditingDrivePermissions, setIsAuditingDrivePermissions] = useState(false);

  // Phase 1 IndexedDB Migration & Copied-Data Test Lab state (Production Auto-Activation Disabled)
  const [phase1State, setPhase1State] = useState<Phase1MigrationStateSummary>(() =>
    getStoredPhase1MigrationState()
  );
  const [phase1TestReport, setPhase1TestReport] = useState<Phase1CopiedDataTestSuiteReport | null>(
    null
  );
  const [isRunningPhase1, setIsRunningPhase1] = useState(false);

  // Active Clients, Heartbeat & Crash Logs state
  const [clients, setClients] = useState<ActiveClientRecord[]>(() => getStoredActiveClients());
  const [crashLogs, setCrashLogs] = useState<CrashLogEntry[]>(() => getCrashLogs());
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isSyncingLogsToDrive, setIsSyncingLogsToDrive] = useState(false);
  const [logsFolderMeta, setLogsFolderMeta] = useState(() => getStoredDriveLogsFolderMeta());

  // Explicit confirmation dialog state before updating/overwriting file in Google Drive
  const [showConfirmPushDialog, setShowConfirmPushDialog] = useState(false);

  const refreshDriveFileMetadata = useCallback(async (tokenToUse?: string | null) => {
    setIsCheckingDrive(true);
    setErrorMessage(null);
    try {
      const meta = await findMasterSyncFileOnDrive(tokenToUse);
      setDriveFileMeta(meta);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to check Google Drive';
      if (msg === 'AUTH_REQUIRED') {
        setNeedsAuth(true);
        setAccessToken(null);
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsCheckingDrive(false);
    }
  }, []);

  useEffect(() => {
    const unsub = initDriveAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setStoredAuthSession(getStoredGoogleAuthSession());
        setAccessToken(token);
        setNeedsAuth(false);
        refreshDriveFileMetadata(token);
      },
      () => {
        setUser(null);
        setStoredAuthSession(null);
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsub();
  }, [refreshDriveFileMetadata]);

  useEffect(() => {
    if (isOpen) {
      const latestCfg = getGoogleDriveSyncConfig();
      setSyncConfig(latestCfg);
      setStoredAuthSession(getStoredGoogleAuthSession());
      setSyncSuccessMessage(null);
      setErrorMessage(null);
      setPhase0BackupReport(createAndVerifyPhase0LocalBackup(false));
      setDrivePermissionAudit(getStoredDrivePermissionAuditReport());
      const updatedClients = sendPresenceHeartbeat();
      setClients(updatedClients);
      setCrashLogs(getCrashLogs());
      setLogsFolderMeta(getStoredDriveLogsFolderMeta());

      const currentToken = getDriveAccessToken();
      if (currentToken) {
        setAccessToken(currentToken);
        setNeedsAuth(false);
        refreshDriveFileMetadata(currentToken);
      } else {
        setNeedsAuth(true);
      }
    }

    const unsubClients = subscribeToActiveClients((updated) => setClients([...updated]));
    const unsubCrashes = subscribeToCrashLogs((updated) => setCrashLogs([...updated]));

    return () => {
      unsubClients();
      unsubCrashes();
    };
  }, [isOpen, refreshDriveFileMetadata]);

  if (!isOpen) return null;

  const onlineClients = clients.filter((c) => c.status === 'ONLINE');
  const idleClients = clients.filter((c) => c.status === 'IDLE');
  const activeClientCount = Math.max(1, onlineClients.length);
  const currentDeviceClient = clients.find((c) => c.isCurrentDevice) || clients[0];

  const handleGoogleLogin = async (identityOnly = false) => {
    setIsSigningIn(true);
    setErrorMessage(null);
    try {
      const result = await googleDriveSignIn({ identityOnly });
      if (result) {
        setUser(result.user);
        setStoredAuthSession(getStoredGoogleAuthSession());
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
        onTriggerToast(
          `Connected as ${result.user.email || result.user.displayName}!`
        );
        await refreshDriveFileMetadata(result.accessToken);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setErrorMessage(msg);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    await googleDriveLogout();
    setUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
    setDriveFileMeta(null);
    onTriggerToast('Disconnected from Google Drive.');
  };

  const handleRoleChange = (newRole: DeviceSyncRole) => {
    const updated: GoogleDriveSyncConfig = {
      ...syncConfig,
      deviceRole: newRole,
      deviceName:
        newRole === 'PRIMARY'
          ? syncConfig.deviceName.replace('Secondary', 'Primary')
          : syncConfig.deviceName.replace('Primary', 'Secondary'),
    };
    setSyncConfig(updated);
    saveGoogleDriveSyncConfig(updated);
    setClients(sendPresenceHeartbeat());
    onTriggerToast(
      newRole === 'PRIMARY'
        ? 'Device set to PRIMARY (Master Writer). Daily snapshots will push from this phone.'
        : 'Device set to SECONDARY (Follower). Uploads locked to prevent conflicts; daily sync will pull from Google Drive.'
    );
  };

  const handleDeviceNameChange = (name: string) => {
    const updated: GoogleDriveSyncConfig = {
      ...syncConfig,
      deviceName: name,
    };
    setSyncConfig(updated);
    saveGoogleDriveSyncConfig(updated);
    setClients(sendPresenceHeartbeat());
  };

  const handleToggleAutoDailySync = () => {
    const updated: GoogleDriveSyncConfig = {
      ...syncConfig,
      autoDailySyncEnabled: !syncConfig.autoDailySyncEnabled,
    };
    setSyncConfig(updated);
    saveGoogleDriveSyncConfig(updated);
  };

  const handleSharedFolderInputChange = (val: string) => {
    const updated: GoogleDriveSyncConfig = {
      ...syncConfig,
      sharedFolderInput: val,
    };
    setSyncConfig(updated);
    saveGoogleDriveSyncConfig(updated);
  };

  const handleShareFolderWithSecondaryEmail = async () => {
    if (!accessToken) {
      setNeedsAuth(true);
      onTriggerToast('Please sign in with Google on this Primary phone first.');
      return;
    }
    if (!shareEmailInput.trim()) return;
    setIsSharingEmail(true);
    setErrorMessage(null);
    try {
      const res = await shareMasterFolderWithEmail(accessToken, shareEmailInput);
      setSyncConfig(getGoogleDriveSyncConfig());
      setShareEmailInput('');
      onTriggerToast(
        `Shared Lakshay_Library_Master folder with ${res.sharedEmail}!`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to share folder.';
      setErrorMessage(msg);
    } finally {
      setIsSharingEmail(false);
    }
  };

  const handleCopyOfflineSyncPackage = async () => {
    setErrorMessage(null);
    const offlineKey = generateOfflineSyncPackageKey();
    await copyTextToClipboard(offlineKey);
    const msg = `Copied Self-Contained Offline Sync Package (LKSYNC1:..., ${students.length} active students)! Paste in the Sync Package box on your Secondary Phone.`;
    setSyncSuccessMessage(msg);
    onTriggerToast(msg);
  };

  const handleVerifyAndDownloadPhase0Backup = () => {
    const report = downloadPhase0VerifiedBackupFile();
    setPhase0BackupReport(report);
    const msg = `Downloaded ${report.downloadedFileName} (${report.downloadedFileSizeBytes.toLocaleString()} bytes) • File SHA-256: ${report.downloadedFileSha256Hex.slice(0, 16)}... • Immutable Backup Preserved: ${report.originalBackupPreservedImmutable ? 'YES' : 'NO'}`;
    setSyncSuccessMessage(msg);
    onTriggerToast(msg);
  };

  const handleTestNonDestructiveRestore = () => {
    const res = verifyBackupRestoreOnIsolatedProfile();
    setPhase0BackupReport(createAndVerifyPhase0LocalBackup(false));
    if (res.reproducedBitForBit && res.productionStorageUntouched) {
      const msg = `✓ Isolated Profile Restore Verified Bit-for-Bit (SHA-256: ${res.postRestoreSha256Hex.slice(0, 16)}..., ${res.restoredLocalKeySlots} localStorage + ${res.restoredSessionKeySlots} sessionStorage slots verified, Active Production Storage Untouched)!`;
      setSyncSuccessMessage(msg);
      onTriggerToast(msg);
    } else {
      setErrorMessage('Backup restore integrity check reported a mismatch.');
    }
  };

  const handleRunPhase1CopiedDataTests = async () => {
    setIsRunningPhase1(true);
    setErrorMessage(null);
    try {
      const report = await runPhase1CopiedDataTestSuite();
      setPhase1TestReport(report);
      setPhase1State(getStoredPhase1MigrationState());
      const msg = `✓ Phase 1 Copied-Data Suite: ${report.passedScenarios}/${report.totalScenarios} Scenarios Passed • Production Storage Untouched: ${report.productionStorageUntouched ? 'YES' : 'NO'}`;
      setSyncSuccessMessage(msg);
      onTriggerToast(msg);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Phase 1 test suite failed.');
    } finally {
      setIsRunningPhase1(false);
    }
  };

  const handleRunPhase1DevMigration = async () => {
    setIsRunningPhase1(true);
    setErrorMessage(null);
    try {
      const res = await runPhase1IndexedDbMigration({ enableDualWriteAfterVerify: true });
      setPhase1State(res);
      const msg = `✓ IndexedDB (${LIBTRACK_IDB_NAME} v${LIBTRACK_IDB_VERSION}) Dev Migration: ${res.status} (${res.counts.totalStudents} students, ${res.counts.totalPayments} payments, localStorage Untouched: ${res.localStoragePreservedUntouched ? 'YES' : 'NO'})`;
      setSyncSuccessMessage(msg);
      onTriggerToast(msg);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'IndexedDB migration failed.');
    } finally {
      setIsRunningPhase1(false);
    }
  };

  const handleRollbackPhase1Migration = async () => {
    setIsRunningPhase1(true);
    setErrorMessage(null);
    try {
      const res = await rollbackPhase1IndexedDbMigration('Manual rollback triggered in Dev Lab');
      setPhase1State(res);
      const msg = `✓ Phase 1 IndexedDB Migration Rolled Back (${res.status}) • Active Read Source: ${res.activeReadSource} • localStorage Intact: ${res.localStoragePreservedUntouched ? 'YES' : 'NO'}`;
      setSyncSuccessMessage(msg);
      onTriggerToast(msg);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Rollback failed.');
    } finally {
      setIsRunningPhase1(false);
    }
  };

  const handleRevokeAndVerifyDrivePublicPermissions = async (revokePublicAnyone = false) => {
    if (!accessToken) {
      setNeedsAuth(true);
      onTriggerToast('Please sign in with Google first to audit Google Drive permissions.');
      return;
    }
    setIsAuditingDrivePermissions(true);
    setErrorMessage(null);
    try {
      const report = await revokeAndVerifyDrivePublicAccess(accessToken, {
        revokePublicAnyone,
      });
      setDrivePermissionAudit(report);
      if (report.overallStatus === 'VERIFIED_PRIVATE') {
        const msg = revokePublicAnyone
          ? `✓ Google Drive Public Access Revoked & Verified Private (${report.totalResourcesInspected} resources audited, ${report.totalPublicPermissionsRevoked} public permissions revoked)!`
          : `✓ Live Google Drive Permission Audit Complete: VERIFIED_PRIVATE (${report.totalResourcesInspected} resources inspected, 0 public permissions found)!`;
        setSyncSuccessMessage(msg);
        onTriggerToast(msg);
      } else {
        setErrorMessage(
          `Drive Permission Audit status: ${report.overallStatus} (${report.totalResourcesInspected}/${report.totalResourcesDiscovered} inspected, ${report.unverifiedResources.length} unverified). ${report.errorMessage || ''}`
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to audit Google Drive permissions.';
      setErrorMessage(msg);
    } finally {
      setIsAuditingDrivePermissions(false);
    }
  };

  const handleConfirmedPrimaryPush = async () => {
    setShowConfirmPushDialog(false);
    if (!accessToken) {
      setNeedsAuth(true);
      return;
    }

    setIsSyncing(true);
    setErrorMessage(null);
    setSyncSuccessMessage(null);
    try {
      const res = await pushPrimarySnapshotToGoogleDrive(accessToken, driveFileMeta?.id);
      setSyncConfig(getGoogleDriveSyncConfig());
      await refreshDriveFileMetadata(accessToken);
      const msg = `Primary Snapshot synced privately to Google Drive (${res.studentCount} students)!`;
      setSyncSuccessMessage(msg);
      onTriggerToast(msg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to push snapshot to Google Drive.';
      if (msg === 'AUTH_REQUIRED') {
        setNeedsAuth(true);
        setAccessToken(null);
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSecondaryPullFromDrive = async (customKeyOverride?: string) => {
    const keyToUse =
      customKeyOverride !== undefined
        ? customKeyOverride.trim()
        : (syncConfig.sharedFolderInput || '').trim();
    const isOfflineSyncPackage = keyToUse.toUpperCase().startsWith('LKSYNC1:');
    if (!accessToken && !isOfflineSyncPackage) {
      setNeedsAuth(true);
      const msg =
        'Sync Key Only (LK-... via public ntfy.sh) is disabled in Phase 0 Security Containment. Please sign in with Google Drive OAuth or paste a self-contained Offline Sync Package (LKSYNC1:...).';
      setErrorMessage(msg);
      onTriggerToast(msg);
      return;
    }

    setIsSyncing(true);
    setErrorMessage(null);
    setSyncSuccessMessage(null);
    try {
      const res = await pullMasterSnapshotFromGoogleDrive(accessToken, keyToUse);
      setSyncConfig(getGoogleDriveSyncConfig());
      if (accessToken) {
        await refreshDriveFileMetadata(accessToken);
      }
      const successMsg = `✓ Successfully synced ${res.studentCount} students from ${res.primaryDeviceName}!`;
      setSyncSuccessMessage(successMsg);
      onTriggerToast(successMsg);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to pull snapshot.';
      if (msg === 'AUTH_REQUIRED') {
        setNeedsAuth(true);
        setAccessToken(null);
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualHeartbeatPing = () => {
    const updated = sendPresenceHeartbeat();
    setClients(updated);
    onTriggerToast('Local heartbeat refreshed! Use "Sync to Drive" to sync telemetry via authenticated Google Drive.');
  };

  const handleSyncHeartbeatAndCrashLogsToDrive = async () => {
    if (!accessToken) {
      setNeedsAuth(true);
      setActiveSubTab('SYNC_ROLE');
      onTriggerToast('Please sign in with Google first to sync Heartbeat & Crash Logs to Drive.');
      return;
    }

    setIsSyncingLogsToDrive(true);
    setErrorMessage(null);
    try {
      await ensureLogsFolderOnDrive(accessToken);
      const clientSyncResult = await syncActiveClientsWithGoogleDrive(accessToken);
      await syncCrashLogsToGoogleDrive(accessToken);
      setClients(clientSyncResult.clients);
      setLogsFolderMeta(getStoredDriveLogsFolderMeta());
      onTriggerToast(
        `✓ Synced ${clientSyncResult.activeCount} active client heartbeat(s) & ${crashLogs.length} crash log(s) to '${LOGS_FOLDER_NAME}'!`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Telemetry sync failed: ${msg}`);
    } finally {
      setIsSyncingLogsToDrive(false);
    }
  };

  const handleSimulateTestCrashLog = () => {
    try {
      throw new Error(
        `Diagnostic Heartbeat & Crash Test [Logged at ${new Date().toLocaleTimeString()}]`
      );
    } catch (err: unknown) {
      logCrash(err instanceof Error ? err : new Error(String(err)), {
        type: 'TEST_SIMULATION',
        severity: 'WARNING',
        extraMessage: 'Manual diagnostic crash log test from Google Drive Sync & Primary Role modal',
      });
      setCrashLogs(getCrashLogs());
      onTriggerToast('Diagnostic test log recorded in Crash Logs!');
    }
  };

  const getDeviceIcon = (platform: string) => {
    if (platform.includes('Android') || platform.includes('iOS')) {
      return Smartphone;
    }
    if (platform.includes('Windows') || platform.includes('Laptop')) {
      return Laptop;
    }
    return Monitor;
  };

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
        {/* Header with Active Client Count Badge */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200/60 flex items-center justify-between bg-amber-500/10 shrink-0 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Cloud className="w-5 h-5" />
            </div>
            <div className="min-w-0 truncate">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                  Google Drive Daily Sync &amp; Primary Role
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-700 border border-emerald-500/30 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    {activeClientCount} Active {activeClientCount === 1 ? 'Client' : 'Clients'}
                  </span>
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Primary/Secondary Sync &bull; Live Heartbeat &bull; Crash &amp; Error Logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenHelpFaq && (
              <button
                type="button"
                onClick={() => onOpenHelpFaq('SYNC')}
                className="px-2.5 py-1.5 rounded-xl text-amber-700 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-bold flex items-center gap-1 transition-colors touch-manipulation"
                title="Open Sync Help & FAQ"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">FAQ &amp; Guide</span>
                <span className="sm:hidden">FAQ</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 touch-manipulation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs inside Google Drive Daily Sync & Primary Role */}
        <div className="px-3.5 sm:px-6 pt-2.5 pb-2 border-b border-slate-200/60 flex items-center gap-1.5 bg-slate-50/70 shrink-0 overflow-x-auto no-scrollbar min-w-0 max-w-full">
          <button
            type="button"
            onClick={() => setActiveSubTab('SYNC_ROLE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeSubTab === 'SYNC_ROLE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Daily Sync &amp; Role</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('HEARTBEAT_CLIENTS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeSubTab === 'HEARTBEAT_CLIENTS'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Active Clients &amp; Heartbeat ({activeClientCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('CRASH_LOGS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeSubTab === 'CRASH_LOGS'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Crash Logs ({crashLogs.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden space-y-4 sm:space-y-5 flex-1 min-w-0 max-w-full">
          {activeSubTab === 'SYNC_ROLE' && (
            <>
              {/* Active Client Count, Heartbeat & Crash Logs Overview Banner */}
              <div className="p-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/50 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <span>
                          Active Client Count: {activeClientCount}{' '}
                          {activeClientCount === 1 ? 'Device' : 'Devices'} Online
                        </span>
                        {idleClients.length > 0 && (
                          <span className="text-[10px] font-medium text-amber-700">
                            ({idleClients.length} idle)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Heartbeat:{' '}
                        <span className="font-mono font-semibold text-emerald-700">
                          {currentDeviceClient
                            ? new Date(currentDeviceClient.lastActiveAt).toLocaleTimeString()
                            : 'Active'}{' '}
                          (Every 20s)
                        </span>{' '}
                        &bull; Crash Logs:{' '}
                        <span className="font-mono font-semibold text-slate-800">
                          {crashLogs.length} recorded
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleManualHeartbeatPing}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs transition-all"
                      title="Send immediate presence heartbeat ping"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Ping Heartbeat</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('HEARTBEAT_CLIENTS')}
                      className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 text-[11px] font-semibold transition-all"
                    >
                      Details
                    </button>
                  </div>
                </div>

                {/* Quick Telemetry Bar */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('HEARTBEAT_CLIENTS')}
                    className="p-2 rounded-xl bg-white border border-slate-200/70 hover:border-amber-400 transition-all"
                  >
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                      Active Clients
                    </div>
                    <div className="text-sm font-extrabold text-emerald-600 font-mono mt-0.5">
                      {activeClientCount} Online
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSubTab('HEARTBEAT_CLIENTS')}
                    className="p-2 rounded-xl bg-white border border-slate-200/70 hover:border-amber-400 transition-all"
                  >
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                      Heartbeat Status
                    </div>
                    <div className="text-xs font-bold text-slate-800 font-mono mt-1">
                      LIVE (20s)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSubTab('CRASH_LOGS')}
                    className="p-2 rounded-xl bg-white border border-slate-200/70 hover:border-amber-400 transition-all"
                  >
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                      Crash Logs
                    </div>
                    <div
                      className={`text-sm font-extrabold font-mono mt-0.5 ${
                        crashLogs.length === 0 ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {crashLogs.length === 0 ? '0 (Healthy)' : `${crashLogs.length} Logged`}
                    </div>
                  </button>
                </div>
              </div>

              {/* 1. Primary vs Secondary Device Role Selector (Conflict Prevention) */}
              <div className="p-4 rounded-2xl border border-slate-200/60 bg-slate-50 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      1. Device Sync Role (Conflict Prevention)
                    </h3>
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      syncConfig.deviceRole === 'PRIMARY'
                        ? 'bg-amber-100 text-amber-900 border-amber-300/70'
                        : 'bg-sky-50 text-sky-700 border-sky-200/70'
                    }`}
                  >
                    {syncConfig.deviceRole === 'PRIMARY'
                      ? 'PRIMARY (MASTER WRITER)'
                      : 'SECONDARY (READ-ONLY FOLLOWER)'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5 flex-wrap gap-1">
                  <span>Seamless real-time synchronization between library devices.</span>
                  {onOpenHelpFaq && (
                    <button
                      type="button"
                      onClick={() => onOpenHelpFaq('SYNC')}
                      className="text-[11px] font-semibold text-amber-600 hover:underline inline-flex items-center gap-0.5"
                    >
                      <span>Role Guide &amp; FAQ</span>
                      &rarr;
                    </button>
                  )}
                </div>

                {/* Role Segmented Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleRoleChange('PRIMARY')}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      syncConfig.deviceRole === 'PRIMARY'
                        ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-500/25'
                        : 'bg-white border-slate-200/70 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <CloudUpload className="w-4 h-4 text-amber-600" />
                        Primary Phone
                      </span>
                      {syncConfig.deviceRole === 'PRIMARY' && (
                        <CheckCircle2 className="w-4 h-4 text-amber-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Master Drive host &amp; sync key generator.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleChange('SECONDARY')}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      syncConfig.deviceRole === 'SECONDARY'
                        ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-500/25'
                        : 'bg-white border-slate-200/70 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <CloudDownload className="w-4 h-4 text-amber-600" />
                        Secondary / Peer Phone
                      </span>
                      {syncConfig.deviceRole === 'SECONDARY' && (
                        <CheckCircle2 className="w-4 h-4 text-amber-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Follower device. Pulls via Sync Key.
                    </p>
                  </button>
                </div>

                {/* Device Name & Daily Schedule */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      This Phone&apos;s Label
                    </label>
                    <div className="relative">
                      <Smartphone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={syncConfig.deviceName}
                        onChange={(e) => handleDeviceNameChange(e.target.value)}
                        placeholder="e.g. Front Desk Primary Phone"
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200/70 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-slate-900">Once-a-Day Auto Sync</div>
                        <div className="text-[10px] text-slate-500">
                          {syncConfig.deviceRole === 'PRIMARY'
                            ? 'Auto-check daily push'
                            : 'Auto-pull once daily'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={syncConfig.autoDailySyncEnabled}
                      onClick={handleToggleAutoDailySync}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        syncConfig.autoDailySyncEnabled ? 'bg-amber-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition ${
                          syncConfig.autoDailySyncEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Phase 0 Emergency Security & Data-Loss Containment Card */}
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Phase 0 Security &amp; Data-Loss Containment Active</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold">
                      ntfy.sh DISABLED &bull; PAYMENTS PROTECTED
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    Public <code>ntfy.sh</code> broadcasting/polling and public Google Drive{' '}
                    <code>anyoneWithLink</code> permissions are permanently disabled. Note:{' '}
                    <strong>Sync Key Only (LK-... via ntfy.sh) synchronization is disabled</strong>{' '}
                    to protect student and payment privacy. Use{' '}
                    <strong>Authenticated Google Drive OAuth</strong> or{' '}
                    <strong>100% Offline Sync Packages (LKSYNC1:...)</strong> below.
                  </p>

                  {/* Pre-Containment Local Backup Verification */}
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200/80 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-slate-900">
                        1. Verified Local Backup Snapshot ({phase0BackupReport.capturedKeySlotsCount}/
                        {phase0BackupReport.expectedTotalKeySlots} Slots Captured:{' '}
                        {phase0BackupReport.populatedKeyCount} Populated,{' '}
                        {phase0BackupReport.uninitializedNullKeyCount} Uninitialized)
                      </span>
                      <span className="font-mono text-[10px] font-bold text-emerald-700">
                        SHA-256: {phase0BackupReport.sha256Hex.slice(0, 16)}&hellip; (FNV-1a: {phase0BackupReport.checksumHex})
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-600 break-all bg-slate-50 px-2 py-1.5 rounded border border-slate-200/60 space-y-0.5">
                      <div>
                        <strong>Canonical 23-Slot SHA-256:</strong> {phase0BackupReport.sha256Hex}
                      </div>
                      <div>
                        <strong>Download File:</strong> {phase0BackupReport.downloadedFileName} (
                        {phase0BackupReport.downloadedFileSizeBytes.toLocaleString()} bytes &bull;{' '}
                        {phase0BackupReport.downloadedFileTimestampISO})
                      </div>
                      <div>
                        <strong>Downloaded File SHA-256:</strong>{' '}
                        {phase0BackupReport.downloadedFileSha256Hex}
                      </div>
                      <div>
                        <strong>Immutable Original Preserved:</strong>{' '}
                        {phase0BackupReport.originalBackupPreservedImmutable ? 'TRUE (Write-Once)' : 'FALSE'}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-mono text-slate-600">
                      <div className="p-1.5 rounded bg-slate-50 border border-slate-200/60">
                        Active: <strong>{phase0BackupReport.activeStudentCount}</strong>
                      </div>
                      <div className="p-1.5 rounded bg-slate-50 border border-slate-200/60">
                        Archived: <strong>{phase0BackupReport.archivedStudentCount}</strong>
                      </div>
                      <div className="p-1.5 rounded bg-slate-50 border border-slate-200/60">
                        Payments: <strong>{phase0BackupReport.totalPaymentRecordsCount}</strong>
                      </div>
                      <div className="p-1.5 rounded bg-slate-50 border border-slate-200/60">
                        Total: <strong>₹{phase0BackupReport.totalPaymentAmountINR.toLocaleString('en-IN')}</strong>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
                      <span className="text-[10px] text-slate-500">
                        Immutable Baseline Created: {new Date(phase0BackupReport.createdAtISO).toLocaleString()}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={handleTestNonDestructiveRestore}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Verify Restore (Isolated Profile)</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleVerifyAndDownloadPhase0Backup}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download Verified Backup (.JSON)</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Google Drive Public Access Revocation & Effective Permission Verification */}
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200/80 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-slate-900">
                        2. Live Google Drive Public Access &amp; Inherited Permission Audit
                      </span>
                      <span
                        className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          drivePermissionAudit?.overallStatus === 'VERIFIED_PRIVATE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {drivePermissionAudit?.overallStatus || 'READY TO VERIFY LIVE'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-snug">
                      Inspects <code>{MASTER_DRIVE_ROOT_FOLDER_NAME}</code>, subfolders, and child{' '}
                      <code>.json</code> files using your authenticated Google account. Removes{' '}
                      <code>type: &apos;anyone&apos;</code> permissions at their source (
                      <code>inheritedFrom</code>), preserves existing pre-containment Drive backups,
                      and flags any <code>domain</code> or staff permissions without auto-revoking them.
                    </p>
                    {drivePermissionAudit && drivePermissionAudit.resources.length > 0 && (
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                        {drivePermissionAudit.resources.map((res) => (
                          <div
                            key={res.id}
                            className="flex items-center justify-between text-[10px] font-mono p-1 rounded bg-slate-50 border border-slate-200/60"
                          >
                            <span className="truncate mr-2">
                              [{res.resourceType}] {res.name}
                            </span>
                            <span
                              className={
                                res.hasPublicAnyoneAccess
                                  ? 'text-rose-600 font-bold shrink-0'
                                  : 'text-emerald-700 font-bold shrink-0'
                              }
                            >
                              {res.hasPublicAnyoneAccess
                                ? 'PUBLIC (ACTION NEEDED)'
                                : `PRIVATE${
                                    res.revokedPermissionIds.length > 0
                                      ? ` (${res.revokedPermissionIds.length} revoked)`
                                      : ''
                                  }`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {drivePermissionAudit?.unverifiedResources &&
                      drivePermissionAudit.unverifiedResources.length > 0 && (
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200/80 space-y-1">
                          <div className="text-[10px] font-bold text-rose-900">
                            UNVERIFIED / Inaccessible Resources ({drivePermissionAudit.unverifiedResources.length}):
                          </div>
                          {drivePermissionAudit.unverifiedResources.map((ur, idx) => (
                            <div
                              key={`${ur.idOrName}-${idx}`}
                              className="text-[10px] font-mono text-rose-800"
                            >
                              &bull; [{ur.resourceType}] {ur.idOrName} &mdash; {ur.reason}
                            </div>
                          ))}
                        </div>
                      )}
                    {drivePermissionAudit?.flaggedDomainOrStaffPermissions &&
                      drivePermissionAudit.flaggedDomainOrStaffPermissions.length > 0 && (
                        <div className="p-2 rounded-lg bg-amber-50 border border-amber-200/80 space-y-1">
                          <div className="text-[10px] font-bold text-amber-900">
                            Preserved Domain / Named Staff Permissions (Requires Explicit Approval to Revoke):
                          </div>
                          {drivePermissionAudit.flaggedDomainOrStaffPermissions.map((fp, idx) => (
                            <div
                              key={`${fp.resourceId}-${fp.permissionId}-${idx}`}
                              className="text-[10px] font-mono text-amber-800"
                            >
                              &bull; [{fp.resourceName}] {fp.type}:{fp.role} (
                              {fp.emailAddress || fp.domain || fp.displayName || fp.permissionId}) &mdash;{' '}
                              {fp.inherited ? `inherited from ${fp.inheritedFrom}` : 'direct'}
                            </div>
                          ))}
                        </div>
                      )}
                    <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
                      <span className="text-[10px] text-slate-500">
                        {drivePermissionAudit?.verifiedAtISO
                          ? `Last Live Audit (${drivePermissionAudit.mode}): ${new Date(drivePermissionAudit.verifiedAtISO).toLocaleString()}`
                          : 'Sign in with Google to run Live Drive Permission Audit'}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          disabled={isAuditingDrivePermissions}
                          onClick={() => handleRevokeAndVerifyDrivePublicPermissions(false)}
                          className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-[10px] font-bold inline-flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>1. Live Audit Only (Read-Only)</span>
                        </button>
                        <button
                          type="button"
                          disabled={isAuditingDrivePermissions}
                          onClick={() => handleRevokeAndVerifyDrivePublicPermissions(true)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-[10px] font-bold inline-flex items-center gap-1"
                        >
                          {isAuditingDrivePermissions ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Processing...</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>2. Authorize &amp; Revoke Public Access</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Phase 1 IndexedDB Migration & Copied-Data Verification Lab (Dev Only — Auto-Activation Disabled) */}
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200/80 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-slate-900">
                        3. Phase 1 IndexedDB Adapter &amp; Copied-Data Lab (
                        <code>
                          {LIBTRACK_IDB_NAME} v{LIBTRACK_IDB_VERSION}
                        </code>
                        )
                      </span>
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
                        {phase1State.status} &bull; PROD AUTO-MIGRATION: OFF
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-snug">
                      Non-destructive 8-checkpoint migration into <code>{LIBTRACK_IDB_NAME}</code>{' '}
                      (11 object stores). Production auto-activation is disabled pending explicit
                      approval. Original <code>localStorage</code> is never deleted or cleared.
                    </p>
                    {phase1TestReport && (
                      <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200/80 space-y-1 text-[10px] font-mono">
                        <div className="font-bold text-emerald-950">
                          Copied-Data Suite: {phase1TestReport.passedScenarios}/
                          {phase1TestReport.totalScenarios} Scenarios PASSED &bull; Production
                          Untouched: {phase1TestReport.productionStorageUntouched ? 'TRUE' : 'FALSE'}
                        </div>
                        {phase1TestReport.scenarios.map((sc) => (
                          <div key={sc.scenarioId} className="text-emerald-900">
                            {sc.passed ? '✓' : '✗'} {sc.title}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
                      <span className="text-[10px] text-slate-500 font-mono">
                        Active Read Source: <strong>{phase1State.activeReadSource}</strong>
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          disabled={isRunningPhase1}
                          onClick={handleRunPhase1CopiedDataTests}
                          className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-[10px] font-bold inline-flex items-center gap-1"
                        >
                          <span>Run Copied-Data Test Suite</span>
                        </button>
                        <button
                          type="button"
                          disabled={isRunningPhase1}
                          onClick={handleRunPhase1DevMigration}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-[10px] font-bold inline-flex items-center gap-1"
                        >
                          <span>Test Dev Migration</span>
                        </button>
                        <button
                          type="button"
                          disabled={isRunningPhase1}
                          onClick={handleRollbackPhase1Migration}
                          className="px-2.5 py-1 rounded-lg bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white text-[10px] font-bold inline-flex items-center gap-1"
                        >
                          <span>Rollback to localStorage</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Offline Sync Package & Authenticated Email Sharing */}
                {syncConfig.deviceRole === 'PRIMARY' ? (
                  <div className="p-3 rounded-xl bg-white border border-slate-200/70 space-y-2.5">
                    <div className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                      <span>🔐 Private Transfer to Secondary Phone</span>
                      <span className="text-[10px] font-mono text-emerald-700 font-bold">
                        {students.length} Active Students
                      </span>
                    </div>

                    {/* Method 1: Self-Contained Offline Sync Package */}
                    <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center justify-between">
                        <span>Method 1: Self-Contained Offline Sync Package (LKSYNC1:...)</span>
                        <span className="font-mono text-[10px] text-amber-800">
                          Zero Cloud Relay
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-snug">
                        Generates a self-contained encoded package directly in your clipboard without
                        transmitting any data to third-party servers.
                      </p>
                      <button
                        type="button"
                        onClick={handleCopyOfflineSyncPackage}
                        className="w-full px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <span>Copy Self-Contained Offline Sync Package (LKSYNC1:...)</span>
                      </button>
                    </div>

                    {/* Method 2: Email Permission Grant */}
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        Method 2: Grant Specific Google Drive User Access by Email
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="email"
                          value={shareEmailInput}
                          onChange={(e) => setShareEmailInput(e.target.value)}
                          placeholder="secondary-user@gmail.com"
                          className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200/80 bg-slate-50 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                        />
                        <button
                          type="button"
                          onClick={handleShareFolderWithSecondaryEmail}
                          disabled={isSharingEmail || !shareEmailInput.trim()}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold shrink-0 transition-all"
                        >
                          {isSharingEmail ? 'Sharing...' : 'Grant Access'}
                        </button>
                      </div>
                      {syncConfig.sharedWithEmails && syncConfig.sharedWithEmails.length > 0 && (
                        <div className="text-[10px] text-emerald-700 font-mono">
                          Shared privately with: {syncConfig.sharedWithEmails.join(', ')}
                        </div>
                      )}
                    </div>

                    {syncSuccessMessage && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{syncSuccessMessage}</span>
                      </div>
                    )}
                    {errorMessage && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{errorMessage}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-white border border-slate-200/70 space-y-2.5">
                    <div className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
                      <span>🔐 Import Offline Sync Package (LKSYNC1:...)</span>
                      <span className="text-[10px] font-mono text-amber-700 font-bold">
                        LK-... Relay Disabled
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">
                      Paste a <strong>Self-Contained Offline Sync Package</strong> (starts with{' '}
                      <code>LKSYNC1:...</code>) from your Primary Phone below, or sign in with Google
                      Drive OAuth in Section 2 to pull directly from Google Drive.
                    </p>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="relative flex-1 flex items-center">
                        <input
                          type="text"
                          value={syncConfig.sharedFolderInput || ''}
                          onChange={(e) => handleSharedFolderInputChange(e.target.value)}
                          placeholder="Paste LKSYNC1:... Offline Sync Package"
                          className="w-full px-3 py-2 pr-8 rounded-xl border border-slate-200/80 bg-slate-50 text-xs text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                        />
                        {syncConfig.sharedFolderInput && (
                          <button
                            type="button"
                            onClick={() => handleSharedFolderInputChange('')}
                            className="absolute right-2 text-slate-400 hover:text-slate-600 p-1"
                            title="Clear Sync Package"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSecondaryPullFromDrive()}
                        disabled={isSyncing || !syncConfig.sharedFolderInput?.trim()}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shrink-0 flex items-center justify-center gap-1.5 transition-all"
                      >
                        {isSyncing ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Importing...</span>
                          </>
                        ) : (
                          <>
                            <CloudDownload className="w-3.5 h-3.5" />
                            <span>Import Package</span>
                          </>
                        )}
                      </button>
                    </div>

                    {syncSuccessMessage && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{syncSuccessMessage}</span>
                      </div>
                    )}
                    {errorMessage && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{errorMessage}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Google Account Connection & Sign-In Data Storage */}
              <div className="p-4 rounded-2xl border border-slate-200/60 bg-white space-y-3.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      2. Google Drive Account &amp; Sign-In Storage
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Master Path:{' '}
                      <code className="font-mono text-[11px] text-amber-700 font-semibold">
                        {MASTER_DRIVE_SYNC_PATH}
                      </code>
                    </p>
                  </div>

                  {!needsAuth && accessToken && (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-semibold inline-flex items-center gap-1"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>

                {/* Where Sign-In & Sync Data Is Stored Card */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold uppercase tracking-wider text-slate-700">
                      Where Sign-In &amp; Sync Data Is Stored
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                        !needsAuth && accessToken
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {!needsAuth && accessToken ? 'SESSION PERSISTED' : 'AWAITING SIGN-IN'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-slate-600 font-mono text-[10px]">
                    <div>
                      <span className="font-semibold text-slate-700">1. Device Sign-In Session:</span>{' '}
                      IndexedDB + LocalStorage (<code>{GOOGLE_AUTH_SESSION_STORAGE_KEY}</code>)
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">2. Google Drive Master Sync:</span>{' '}
                      <code>{MASTER_DRIVE_SYNC_PATH}</code>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">3. Heartbeat &amp; Crash Logs:</span>{' '}
                      <code>{MASTER_DRIVE_LOGS_PATH}/</code>
                    </div>
                    {storedAuthSession?.savedAtISO && (
                      <div className="text-emerald-700 font-sans text-[11px] pt-0.5">
                        Last Sign-In Session Saved:{' '}
                        <strong>{new Date(storedAuthSession.savedAtISO).toLocaleString()}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {needsAuth || !accessToken ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 flex flex-col items-center text-center space-y-3">
                    <p className="text-xs text-slate-600 max-w-md">
                      Sign in with your Google account to allow Lakshay Library to create the{' '}
                      <code>{MASTER_DRIVE_ROOT_FOLDER_NAME}</code> master directory and sync inside{' '}
                      <code>
                        {MASTER_SYNC_SUBFOLDER_NAME}/{MASTER_DRIVE_BACKUP_FILENAME}
                      </code>{' '}
                      as well as automated heartbeat &amp; crash logs.
                    </p>

                    {/* Official "Sign in with Google" Material Button */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full">
                      <button
                        type="button"
                        onClick={() => handleGoogleLogin(false)}
                        disabled={isSigningIn}
                        className="gsi-material-button"
                      >
                        <div className="gsi-material-button-state" />
                        <div className="gsi-material-button-content-wrapper">
                          <div className="gsi-material-button-icon">
                            <svg
                              version="1.1"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 48 48"
                              style={{ display: 'block' }}
                            >
                              <path
                                fill="#EA4335"
                                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                              />
                              <path
                                fill="#4285F4"
                                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                              />
                              <path
                                fill="#FBBC05"
                                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                              />
                              <path
                                fill="#34A853"
                                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                              />
                              <path fill="none" d="M0 0h48v48H0z" />
                            </svg>
                          </div>
                          <span className="gsi-material-button-contents">
                            {isSigningIn ? 'Connecting to Google Drive...' : 'Sign in with Google'}
                          </span>
                          <span style={{ display: 'none' }}>Sign in with Google</span>
                        </div>
                      </button>

                      {syncConfig.deviceRole === 'SECONDARY' && (
                        <button
                          type="button"
                          onClick={() => handleGoogleLogin(true)}
                          disabled={isSigningIn}
                          className="px-3.5 py-2.5 rounded-full border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition-all"
                        >
                          Sign in with Another Gmail (Bypasses Error 403)
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Connected Account & Remote File Status */}
                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div className="truncate">
                          <span className="font-bold text-slate-900">
                            {user?.displayName ||
                              storedAuthSession?.displayName ||
                              'Google Drive Connected'}
                          </span>
                          {(user?.email || storedAuthSession?.email) && (
                            <span className="text-slate-500 ml-1.5">
                              ({user?.email || storedAuthSession?.email})
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => refreshDriveFileMetadata(accessToken)}
                        disabled={isCheckingDrive}
                        className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-700"
                        title="Refresh Google Drive file status"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isCheckingDrive ? 'animate-spin' : ''}`}
                        />
                      </button>
                    </div>

                    {/* Remote Drive File Card */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-slate-900 break-all">
                          {MASTER_DRIVE_BACKUP_FILENAME}
                        </span>
                        <span className="text-[11px] font-semibold text-amber-600 shrink-0">
                          {driveFileMeta ? 'Found in Master Folder' : 'Not uploaded yet'}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        Folder:{' '}
                        <strong className="text-slate-700">
                          {driveFileMeta?.folderPath ||
                            `${MASTER_DRIVE_ROOT_FOLDER_NAME} / ${MASTER_SYNC_SUBFOLDER_NAME}`}
                        </strong>
                      </div>
                      {driveFileMeta ? (
                        <div className="text-[11px] text-slate-500 space-y-0.5">
                          <div>
                            Last Drive Modified:{' '}
                            <strong className="text-slate-700">
                              {new Date(driveFileMeta.modifiedTime).toLocaleString()}
                            </strong>
                          </div>
                          {syncConfig.lastPrimaryWriterName && (
                            <div>
                              Primary Source Device:{' '}
                              <strong className="text-slate-700">
                                {syncConfig.lastPrimaryWriterName}
                              </strong>{' '}
                              ({syncConfig.lastSyncedStudentCount ?? students.length} students)
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500">
                          Master folder structure is ready. Push from your Primary phone to upload
                          the snapshot into{' '}
                          <code>
                            {MASTER_DRIVE_ROOT_FOLDER_NAME}/{MASTER_SYNC_SUBFOLDER_NAME}
                          </code>
                          .
                        </p>
                      )}
                    </div>

                    {/* Role-Gated Action Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {syncConfig.deviceRole === 'PRIMARY' ? (
                        <button
                          type="button"
                          onClick={() => setShowConfirmPushDialog(true)}
                          disabled={isSyncing}
                          className="w-full px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                        >
                          {isSyncing ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Uploading to Google Drive...</span>
                            </>
                          ) : (
                            <>
                              <CloudUpload className="w-4 h-4" />
                              <span>Push Primary Snapshot to Drive</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="w-full px-4 py-3 rounded-xl bg-slate-100 text-slate-400 border border-slate-200/60 text-xs font-semibold flex items-center justify-center gap-2 cursor-not-allowed">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Upload Locked (Secondary Mode)</span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleSecondaryPullFromDrive()}
                        disabled={isSyncing}
                        className={`w-full px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${
                          syncConfig.deviceRole === 'SECONDARY'
                            ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/70'
                        }`}
                      >
                        {isSyncing ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Syncing from Google Drive...</span>
                          </>
                        ) : (
                          <>
                            <CloudDownload className="w-4 h-4" />
                            <span>Pull Latest Snapshot from Drive</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/70 text-rose-700 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* SUB-TAB 2: ACTIVE CLIENTS & HEARTBEAT */}
          {activeSubTab === 'HEARTBEAT_CLIENTS' && (
            <div className="space-y-4">
              {/* Summary Banner */}
              <div className="p-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                      <span>
                        {activeClientCount} Active {activeClientCount === 1 ? 'Client' : 'Clients'}{' '}
                        Online
                      </span>
                      {idleClients.length > 0 && (
                        <span className="text-[11px] font-normal text-amber-700">
                          ({idleClients.length} idle)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Each connected phone or laptop sends a live presence heartbeat every 20
                      seconds.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleManualHeartbeatPing}
                    className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all shrink-0 touch-manipulation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Send Heartbeat Ping</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncHeartbeatAndCrashLogsToDrive}
                    disabled={isSyncingLogsToDrive}
                    className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all shrink-0 disabled:opacity-50 touch-manipulation"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>{isSyncingLogsToDrive ? 'Syncing...' : 'Sync to Drive'}</span>
                  </button>
                </div>
              </div>

              {/* Connected Client Devices List */}
              <div className="space-y-2.5">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-400 block px-0.5">
                  Connected Client Devices ({clients.length})
                </span>

                {clients.map((client) => {
                  const DeviceIcon = getDeviceIcon(client.platform);
                  const isOnline = client.status === 'ONLINE';
                  const isIdle = client.status === 'IDLE';

                  return (
                    <div
                      key={client.clientId}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        client.isCurrentDevice
                          ? 'border-amber-300/80 bg-amber-50/40 shadow-xs'
                          : 'border-slate-200/60 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isOnline
                                ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                                : isIdle
                                ? 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
                                : 'bg-slate-200/60 text-slate-500'
                            }`}
                          >
                            <DeviceIcon className="w-4 h-4" />
                          </div>

                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900">
                                {client.deviceName}
                              </span>
                              {client.isCurrentDevice && (
                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-500 text-white">
                                  This Device
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  client.deviceRole === 'PRIMARY'
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {client.deviceRole === 'PRIMARY'
                                  ? 'Primary Master'
                                  : 'Secondary Follower'}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-500">
                              {client.platform} &bull; {client.browser}
                            </div>

                            <div className="text-[10px] font-mono text-slate-400">
                              Last Heartbeat: {new Date(client.lastActiveAt).toLocaleTimeString()} (
                              {Math.max(
                                0,
                                Math.round((Date.now() - client.lastActiveTimestamp) / 1000)
                              )}
                              s ago)
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isOnline
                                ? 'bg-emerald-500 animate-pulse'
                                : isIdle
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span
                            className={`text-[11px] font-bold ${
                              isOnline
                                ? 'text-emerald-600'
                                : isIdle
                                ? 'text-amber-600'
                                : 'text-slate-400'
                            }`}
                          >
                            {client.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Google Drive Automated_Logs Path Note */}
              <div className="p-3.5 rounded-xl bg-slate-100/80 border border-slate-200/60 text-xs text-slate-600 flex items-start gap-2.5 min-w-0">
                <Cloud className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="font-bold text-slate-800 break-all block">
                    Google Drive Heartbeat Sync ({LOGS_FOLDER_NAME}/{ACTIVE_CLIENTS_FILENAME}):
                  </span>
                  <p className="leading-relaxed break-words">
                    Connected devices automatically merge their active client counts and heartbeat
                    timestamps in your Google Drive master folder.
                    {logsFolderMeta?.lastSyncedAtISO && (
                      <span className="block font-mono text-[11px] text-emerald-700 mt-1 break-all">
                        Last Drive Telemetry Sync:{' '}
                        {new Date(logsFolderMeta.lastSyncedAtISO).toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SUB-TAB 3: CRASH & ERROR LOGS */}
          {activeSubTab === 'CRASH_LOGS' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-slate-200/60 bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    {crashLogs.length === 0 ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>System Healthy &bull; 0 Crashes</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>
                          {crashLogs.length} Crash / Error Log{crashLogs.length === 1 ? '' : 's'}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Synced to{' '}
                    <code className="font-mono text-amber-700">
                      {LOGS_FOLDER_NAME}/{CRASH_LOGS_FILENAME}
                    </code>{' '}
                    on Google Drive.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSimulateTestCrashLog}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
                  >
                    <Bug className="w-3.5 h-3.5" />
                    <span>Test Log</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncHeartbeatAndCrashLogsToDrive}
                    disabled={isSyncingLogsToDrive}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>{isSyncingLogsToDrive ? 'Syncing...' : 'Sync to Drive'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={exportCrashLogsAsJson}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-200/80 text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JSON</span>
                  </button>

                  {crashLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        clearCrashLogs();
                        setCrashLogs([]);
                        onTriggerToast('Crash logs cleared.');
                      }}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 transition-colors"
                      title="Clear crash logs"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2.5">
                {crashLogs.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-slate-200/60 bg-white space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      No Application Crashes Recorded
                    </div>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Lakshay Library is running cleanly with 0 unhandled exceptions. Tap{' '}
                      <strong>&quot;Test Log&quot;</strong> above to verify crash log capture and
                      Google Drive syncing.
                    </p>
                  </div>
                ) : (
                  crashLogs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const isCritical = log.severity === 'CRITICAL';

                    return (
                      <div
                        key={log.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          isCritical
                            ? 'border-rose-200/80 bg-rose-50/40'
                            : 'border-slate-200/60 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  isCritical
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-amber-600 text-white'
                                }`}
                              >
                                {log.type}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                              {log.syncedToDrive && (
                                <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5">
                                  <Cloud className="w-3 h-3" /> Synced to Drive
                                </span>
                              )}
                            </div>

                            <p className="text-xs font-mono font-bold text-slate-900 break-words">
                              {log.message}
                            </p>

                            <div className="text-[11px] text-slate-500">
                              Platform: {log.platform}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                            title="Toggle stack trace"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-2.5">
                            {log.stack && (
                              <div>
                                <span className="text-[11px] font-bold text-slate-700 block mb-1 flex items-center gap-1">
                                  <Terminal className="w-3 h-3 text-amber-600" />
                                  <span>Stack Trace:</span>
                                </span>
                                <pre className="p-2.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                                  {log.stack}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mandatory User Confirmation Dialog before mutating/overwriting file in Google Drive */}
        {showConfirmPushDialog && (
          <div className="absolute inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-md w-full p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <CloudUpload className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {driveFileMeta
                      ? `Update '${MASTER_DRIVE_BACKUP_FILENAME}' in Google Drive?`
                      : `Create '${MASTER_DRIVE_BACKUP_FILENAME}' in Google Drive?`}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    You are about to{' '}
                    {driveFileMeta
                      ? 'overwrite the existing master sync file'
                      : 'create a new master sync file'}{' '}
                    in your Google Drive with <strong>{students.length} student records</strong>,
                    payment histories, attendance logs, shifts, and seat assignments from{' '}
                    <strong>{syncConfig.deviceName}</strong> (Primary).
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setShowConfirmPushDialog(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmedPrimaryPush}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm"
                >
                  Confirm &amp; Upload to Google Drive
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
