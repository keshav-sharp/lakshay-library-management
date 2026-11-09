import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Student } from '../types/student';
import { useTheme } from '../context/ThemeContext';
import {
  DeviceSyncRole,
  DriveBackupFileMetadata,
  GoogleDriveSyncConfig,
  MASTER_DRIVE_BACKUP_FILENAME,
  MASTER_DRIVE_ROOT_FOLDER_NAME,
  MASTER_SYNC_SUBFOLDER_NAME,
  MASTER_DRIVE_SYNC_PATH,
  findMasterSyncFileOnDrive,
  getDriveAccessToken,
  getGoogleDriveSyncConfig,
  googleDriveLogout,
  googleDriveSignIn,
  initDriveAuth,
  pullMasterSnapshotFromGoogleDrive,
  pushPrimarySnapshotToGoogleDrive,
  saveGoogleDriveSyncConfig,
} from '../services/googleDriveSyncService';
import {
  X,
  Cloud,
  CloudUpload,
  CloudDownload,
  ShieldCheck,
  Smartphone,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  LogOut,
  Lock,
  Clock,
} from 'lucide-react';

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  onTriggerToast: (msg: string) => void;
}

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({
  isOpen,
  onClose,
  students,
  onTriggerToast,
}) => {
  const { darkModeClass, isDarkMode } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => getDriveAccessToken());
  const [needsAuth, setNeedsAuth] = useState<boolean>(() => !getDriveAccessToken());
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [syncConfig, setSyncConfig] = useState<GoogleDriveSyncConfig>(() =>
    getGoogleDriveSyncConfig()
  );
  const [driveFileMeta, setDriveFileMeta] = useState<DriveBackupFileMetadata | null>(null);
  const [isCheckingDrive, setIsCheckingDrive] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Explicit confirmation dialog state before updating/overwriting file in Google Drive
  const [showConfirmPushDialog, setShowConfirmPushDialog] = useState(false);

  const refreshDriveFileMetadata = useCallback(async (tokenToUse: string) => {
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
        setAccessToken(token);
        setNeedsAuth(false);
        refreshDriveFileMetadata(token);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsub();
  }, [refreshDriveFileMetadata]);

  useEffect(() => {
    if (isOpen) {
      setSyncConfig(getGoogleDriveSyncConfig());
      const currentToken = getDriveAccessToken();
      if (currentToken) {
        setAccessToken(currentToken);
        setNeedsAuth(false);
        refreshDriveFileMetadata(currentToken);
      } else {
        setNeedsAuth(true);
      }
    }
  }, [isOpen, refreshDriveFileMetadata]);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    setErrorMessage(null);
    try {
      const result = await googleDriveSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
        onTriggerToast(`Connected to Google Drive as ${result.user.email || result.user.displayName}!`);
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
  };

  const handleToggleAutoDailySync = () => {
    const updated: GoogleDriveSyncConfig = {
      ...syncConfig,
      autoDailySyncEnabled: !syncConfig.autoDailySyncEnabled,
    };
    setSyncConfig(updated);
    saveGoogleDriveSyncConfig(updated);
  };

  const handleConfirmedPrimaryPush = async () => {
    setShowConfirmPushDialog(false);
    if (!accessToken) {
      setNeedsAuth(true);
      return;
    }

    setIsSyncing(true);
    setErrorMessage(null);
    try {
      const res = await pushPrimarySnapshotToGoogleDrive(accessToken, driveFileMeta?.id);
      setSyncConfig(getGoogleDriveSyncConfig());
      await refreshDriveFileMetadata(accessToken);
      onTriggerToast(
        `Primary Snapshot synced to Google Drive (${res.studentCount} students in ${MASTER_DRIVE_BACKUP_FILENAME})!`
      );
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

  const handleSecondaryPullFromDrive = async () => {
    if (!accessToken) {
      setNeedsAuth(true);
      return;
    }

    setIsSyncing(true);
    setErrorMessage(null);
    try {
      const res = await pullMasterSnapshotFromGoogleDrive(accessToken);
      setSyncConfig(getGoogleDriveSyncConfig());
      await refreshDriveFileMetadata(accessToken);
      onTriggerToast(
        `Synced ${res.studentCount} students from Google Drive (written by ${res.primaryDeviceName})!`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to pull snapshot from Google Drive.';
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

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200 ${darkModeClass}`}
      onClick={onClose}
    >
      <div
        className={`w-full sm:max-w-xl h-[92vh] sm:h-full rounded-t-3xl sm:rounded-t-none sm:rounded-l-3xl shadow-2xl border-t sm:border-t-0 sm:border-l overflow-hidden flex flex-col animate-in slide-in-from-bottom sm:slide-in-from-right duration-200 ${
          isDarkMode
            ? 'bg-slate-900 border-slate-800/60 text-slate-100'
            : 'bg-white border-slate-200/60 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between bg-amber-500/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Google Drive Daily Sync &amp; Primary Role
              </h2>
              <p className="text-xs text-slate-500">
                Conflict-Free Multi-Phone Sync &bull; Primary Writer / Secondary Follower
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

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
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

            <p className="text-xs text-slate-600 leading-relaxed">
              To avoid multi-phone sync conflicts, set <strong>one phone as Primary</strong> (uploads
              the daily snapshot to Google Drive) and any other phone/tablet as{' '}
              <strong>Secondary</strong> (pulls the daily snapshot once a day without overwriting).
            </p>

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
                  Single source of truth. Pushes daily database snapshot to Google Drive.
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
                    Secondary Phone
                  </span>
                  {syncConfig.deviceRole === 'SECONDARY' && (
                    <CheckCircle2 className="w-4 h-4 text-amber-600" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Pulls daily updates from Primary via Google Drive. Uploads locked to prevent
                  conflicts.
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
          </div>

          {/* 2. Google Account Connection & Official Sign in with Google Button */}
          <div className="p-4 rounded-2xl border border-slate-200/60 bg-white space-y-3.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  2. Google Drive Account &amp; Master Folder
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Location:{' '}
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

            {needsAuth || !accessToken ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 flex flex-col items-center text-center space-y-3">
                <p className="text-xs text-slate-600 max-w-md">
                  Sign in with your Google account to allow Lakshay Library to create the{' '}
                  <code>{MASTER_DRIVE_ROOT_FOLDER_NAME}</code> master directory and sync inside{' '}
                  <code>{MASTER_SYNC_SUBFOLDER_NAME}/{MASTER_DRIVE_BACKUP_FILENAME}</code>.
                </p>

                {/* Official "Sign in with Google" Material Button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
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
              </div>
            ) : (
              <div className="space-y-3">
                {/* Connected Account & Remote File Status */}
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="truncate">
                      <span className="font-bold text-slate-900">
                        {user?.displayName || 'Google Drive Connected'}
                      </span>
                      {user?.email && (
                        <span className="text-slate-500 ml-1.5">({user.email})</span>
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
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingDrive ? 'animate-spin' : ''}`} />
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
                    Folder: <strong className="text-slate-700">{MASTER_DRIVE_ROOT_FOLDER_NAME} / {MASTER_SYNC_SUBFOLDER_NAME}</strong>
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
                      Master folder structure is ready. Push from your Primary phone to upload the snapshot into{' '}
                      <code>{MASTER_DRIVE_ROOT_FOLDER_NAME}/{MASTER_SYNC_SUBFOLDER_NAME}</code>.
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
                    onClick={handleSecondaryPullFromDrive}
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
                    {driveFileMeta ? 'overwrite the existing master sync file' : 'create a new master sync file'}{' '}
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
