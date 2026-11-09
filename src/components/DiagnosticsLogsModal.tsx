import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
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
import { getDriveAccessToken } from '../services/googleDriveSyncService';
import {
  X,
  Activity,
  Users,
  AlertTriangle,
  Cloud,
  RotateCcw,
  Download,
  Trash2,
  CheckCircle2,
  Smartphone,
  Laptop,
  Monitor,
  Terminal,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Bug,
  Sparkles,
} from 'lucide-react';

interface DiagnosticsLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerToast: (msg: string) => void;
  onOpenDriveSyncModal?: () => void;
}

export const DiagnosticsLogsModal: React.FC<DiagnosticsLogsModalProps> = ({
  isOpen,
  onClose,
  onTriggerToast,
  onOpenDriveSyncModal,
}) => {
  const { darkModeClass, isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<'CLIENTS' | 'CRASHES' | 'DRIVE_FOLDER'>('CLIENTS');
  const [clients, setClients] = useState<ActiveClientRecord[]>(getStoredActiveClients());
  const [crashLogs, setCrashLogs] = useState<CrashLogEntry[]>(getCrashLogs());
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [folderMeta, setFolderMeta] = useState(getStoredDriveLogsFolderMeta());

  useEffect(() => {
    if (isOpen) {
      setClients(getStoredActiveClients());
      setCrashLogs(getCrashLogs());
      setFolderMeta(getStoredDriveLogsFolderMeta());
    }

    const unsubClients = subscribeToActiveClients((updated) => setClients([...updated]));
    const unsubCrashes = subscribeToCrashLogs((updated) => setCrashLogs([...updated]));

    return () => {
      unsubClients();
      unsubCrashes();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const accessToken = getDriveAccessToken();
  const onlineClients = clients.filter((c) => c.status === 'ONLINE');
  const idleClients = clients.filter((c) => c.status === 'IDLE');

  const handleManualHeartbeat = () => {
    const updated = sendPresenceHeartbeat();
    setClients(updated);
    onTriggerToast('Heartbeat ping sent. Presence timestamp updated.');
  };

  const handleSyncLogsToDrive = async () => {
    if (!accessToken) {
      onTriggerToast('Please connect Google Drive via Drive Sync first.');
      if (onOpenDriveSyncModal) onOpenDriveSyncModal();
      return;
    }

    setIsSyncingDrive(true);
    try {
      // 1. Ensure folder exists
      await ensureLogsFolderOnDrive(accessToken);

      // 2. Sync active clients status
      await syncActiveClientsWithGoogleDrive(accessToken);

      // 3. Sync crash logs
      await syncCrashLogsToGoogleDrive(accessToken);

      setFolderMeta(getStoredDriveLogsFolderMeta());
      onTriggerToast(`✓ Successfully synced active clients & crash logs to Google Drive folder '${LOGS_FOLDER_NAME}'!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onTriggerToast(`Sync failed: ${msg}`);
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleSimulateTestError = () => {
    try {
      // Intentionally simulate a test exception with simulated stack trace
      throw new Error(`Test Diagnostic Exception [Simulated at ${new Date().toLocaleTimeString()}]`);
    } catch (err: unknown) {
      logCrash(err instanceof Error ? err : new Error(String(err)), {
        type: 'TEST_SIMULATION',
        severity: 'WARNING',
        extraMessage: 'Manual Test Diagnostic triggered by user',
      });
      onTriggerToast('Simulated error logged successfully to local diagnostics & Drive queue!');
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
      className={`fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-200 ${darkModeClass}`}
      onClick={onClose}
    >
      <div
        className={`w-full sm:max-w-2xl h-[92vh] sm:h-full rounded-t-3xl sm:rounded-t-none sm:rounded-l-3xl shadow-2xl border-t sm:border-t-0 sm:border-l overflow-hidden flex flex-col animate-in slide-in-from-bottom sm:slide-in-from-right duration-200 ${
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
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  Diagnostics &amp; Active Clients
                </h2>
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {onlineClients.length} Online
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Live Device Presence &bull; Crash &amp; Error Logs &bull; Google Drive Folder
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

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-200/60 flex items-center gap-1.5 bg-slate-50/70 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('CLIENTS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'CLIENTS'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Active Clients ({onlineClients.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CRASHES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'CRASHES'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Crash Logs ({crashLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DRIVE_FOLDER')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === 'DRIVE_FOLDER'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Google Drive Folder</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: ACTIVE CLIENTS ONLINE */}
          {activeTab === 'CLIENTS' && (
            <div className="space-y-4">
              {/* Summary Banner */}
              <div className="p-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>{onlineClients.length} Device{onlineClients.length === 1 ? '' : 's'} Online &amp; Active</span>
                      {idleClients.length > 0 && (
                        <span className="text-[11px] font-normal text-amber-700">
                          ({idleClients.length} idle)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Devices actively using Lakshay Library update their heartbeat every 20 seconds.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleManualHeartbeat}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all shrink-0"
                  title="Send immediate presence heartbeat"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ping</span>
                </button>
              </div>

              {/* Client Cards List */}
              <div className="space-y-2.5">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-400 block px-0.5">
                  Connected Client Devices ({clients.length})
                </span>

                {clients.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl border border-slate-200/60 bg-slate-50 text-xs text-slate-500">
                    No active clients recorded yet.
                  </div>
                ) : (
                  clients.map((client) => {
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
                                  {client.deviceRole === 'PRIMARY' ? 'Primary Master' : 'Secondary Follower'}
                                </span>
                              </div>

                              <div className="text-[11px] text-slate-500">
                                {client.platform} &bull; {client.browser}
                              </div>

                              <div className="text-[10px] font-mono text-slate-400">
                                Last Active:{' '}
                                {new Date(client.lastActiveAt).toLocaleTimeString()}{' '}
                                ({Math.max(0, Math.round((Date.now() - client.lastActiveTimestamp) / 1000))}s ago)
                              </div>
                            </div>
                          </div>

                          {/* Status Badge */}
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
                  })
                )}
              </div>

              {/* Multi-Device Drive Sync Note */}
              <div className="p-3.5 rounded-xl bg-slate-100/80 border border-slate-200/60 text-xs text-slate-600 flex items-start gap-2.5">
                <Cloud className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-slate-800">Multi-Device Cloud Telemetry:</span>
                  <p className="leading-relaxed">
                    When your devices connect to Google Drive, their heartbeats are automatically
                    merged into <code className="font-mono text-amber-700">Lakshay_Library_Logs/{ACTIVE_CLIENTS_FILENAME}</code> so you can see your phone and laptop active statuses from anywhere.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CRASH & ERROR LOGS */}
          {activeTab === 'CRASHES' && (
            <div className="space-y-4">
              {/* Header stats & actions */}
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
                        <span>{crashLogs.length} Crash / Error Log{crashLogs.length === 1 ? '' : 's'}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Any render crash, unhandled script error, or promise rejection is captured with stack traces.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSimulateTestError}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
                    title="Simulate a test error to verify crash logging"
                  >
                    <Bug className="w-3.5 h-3.5" />
                    <span>Test Crash Log</span>
                  </button>

                  <button
                    type="button"
                    onClick={exportCrashLogsAsJson}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-200/80 text-xs font-semibold flex items-center gap-1.5 transition-all"
                    title="Download crash logs as JSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>

                  {crashLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        clearCrashLogs();
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

              {/* Logs List */}
              <div className="space-y-2.5">
                {crashLogs.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-slate-200/60 bg-white space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-bold text-slate-900">No Application Crashes Recorded</div>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      The application is running smoothly without unhandled exceptions. Click{' '}
                      <strong>&quot;Test Crash Log&quot;</strong> above if you would like to test the error recording and stack trace viewer.
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
                              Platform: {log.platform} &bull; URL: {log.url.split('?')[0]}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                            title="Toggle stack trace"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* Expanded Stack Trace & Breadcrumbs */}
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

                            {log.componentStack && (
                              <div>
                                <span className="text-[11px] font-bold text-slate-700 block mb-1">
                                  React Component Stack:
                                </span>
                                <pre className="p-2.5 rounded-xl bg-slate-950 text-slate-300 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap break-all">
                                  {log.componentStack}
                                </pre>
                              </div>
                            )}

                            {log.breadcrumbs && log.breadcrumbs.length > 0 && (
                              <div>
                                <span className="text-[11px] font-bold text-slate-700 block mb-1">
                                  Recent Breadcrumbs Before Crash ({log.breadcrumbs.length}):
                                </span>
                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                  {log.breadcrumbs.map((b, bIdx) => (
                                    <div
                                      key={bIdx}
                                      className="text-[10px] font-mono text-slate-600 flex items-center gap-2"
                                    >
                                      <span className="text-slate-400">
                                        {new Date(b.timestamp).toLocaleTimeString()}
                                      </span>
                                      <span className="font-bold text-amber-700">[{b.category}]</span>
                                      <span>{b.message}</span>
                                    </div>
                                  ))}
                                </div>
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

          {/* TAB 3: GOOGLE DRIVE LOGS FOLDER */}
          {activeTab === 'DRIVE_FOLDER' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-amber-200/70 bg-amber-50/60 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-amber-600 text-white">
                    Google Drive Cloud Logs
                  </span>
                  <span className="text-[11px] font-mono text-amber-900 font-semibold">
                    Folder: {LOGS_FOLDER_NAME}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-amber-600" />
                  <span>Automated Log Storage in Google Drive</span>
                </h3>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Lakshay Library automatically organizes your logs into a dedicated folder named{' '}
                  <strong className="text-slate-900">{LOGS_FOLDER_NAME}</strong> in your Google Drive:
                </p>

                <div className="space-y-2 text-xs text-slate-700 bg-white p-3.5 rounded-xl border border-slate-200/70">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-mono text-amber-700">{CRASH_LOGS_FILENAME}</strong>
                      <p className="text-[11px] text-slate-500">
                        Contains all crash reports, stack traces, and device info.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-mono text-amber-700">{ACTIVE_CLIENTS_FILENAME}</strong>
                      <p className="text-[11px] text-slate-500">
                        Contains active device heartbeats, platforms, and online statuses.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Folder status card */}
                {folderMeta ? (
                  <div className="p-3 bg-white rounded-xl border border-slate-200/70 text-xs space-y-1">
                    <div className="font-bold text-slate-800 flex items-center justify-between">
                      <span>Drive Folder Status: Active</span>
                      <span className="text-[10px] font-mono text-emerald-600 font-semibold">ID: {folderMeta.folderId.slice(0, 12)}...</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Last Synced: {folderMeta.lastSyncedAtISO ? new Date(folderMeta.lastSyncedAtISO).toLocaleString() : 'Pending sync'}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-white rounded-xl border border-slate-200/70 text-xs text-slate-500">
                    Folder will be created in Google Drive on your first sync.
                  </div>
                )}

                {/* Actions */}
                <div className="pt-1 flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSyncLogsToDrive}
                    disabled={isSyncingDrive}
                    className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                  >
                    <Cloud className="w-4 h-4" />
                    <span>{isSyncingDrive ? 'Syncing to Drive...' : 'Sync Logs to Google Drive Now'}</span>
                  </button>

                  {!accessToken && onOpenDriveSyncModal && (
                    <button
                      type="button"
                      onClick={onOpenDriveSyncModal}
                      className="px-3 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200/80 transition-all flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Sign In with Google</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Instructions on how to view in Google Drive */}
              <div className="p-4 rounded-2xl border border-slate-200/60 bg-slate-50 space-y-2 text-xs text-slate-600">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <ExternalLink className="w-4 h-4 text-amber-600" />
                  <span>How to View These Logs in Google Drive:</span>
                </span>
                <ol className="space-y-1 list-decimal list-inside pl-1 text-slate-700 leading-relaxed">
                  <li>Open the <strong>Google Drive app</strong> on your phone or visit <code className="font-mono text-amber-700">drive.google.com</code>.</li>
                  <li>Search for or open the folder named <strong>&quot;{LOGS_FOLDER_NAME}&quot;</strong>.</li>
                  <li>Open <code className="font-mono text-amber-700">{CRASH_LOGS_FILENAME}</code> or <code className="font-mono text-amber-700">{ACTIVE_CLIENTS_FILENAME}</code> to inspect live records!</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
