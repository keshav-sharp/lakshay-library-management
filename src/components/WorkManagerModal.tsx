import React, { useState, useEffect } from 'react';
import { Student, PaymentRecord } from '../types/student';
import { useTheme } from '../context/ThemeContext';
import { getDaysDifference, formatDueDateDisplay } from '../services/storageService';
import {
  DailyBackupRecord,
  WorkManagerBackupConfig,
  getStoredDailyBackups,
  getWorkManagerBackupConfig,
  saveWorkManagerBackupConfig,
  runDailyJsonBackupTask,
  downloadJsonFileToDevice,
} from '../services/exportService';
import { KotlinCodeHighlighter } from './KotlinCodeHighlighter';
import {
  Bell,
  X,
  Clock,
  Play,
  CheckCircle2,
  Code2,
  Copy,
  Check,
  HardDrive,
  Download,
  FileJson,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import { KOTLIN_CODE_SNIPPETS } from '../data/kotlinCodeSnippets';

interface WorkManagerModalProps {
  students: Student[];
  allPayments?: Record<string, PaymentRecord[]>;
  isOpen: boolean;
  onClose: () => void;
  onSendNotificationToast: (content: string) => void;
}

export const WorkManagerModal: React.FC<WorkManagerModalProps> = ({
  students,
  allPayments = {},
  isOpen,
  onClose,
  onSendNotificationToast,
}) => {
  const { darkModeClass, isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<'backup' | 'reminders' | 'code'>('backup');
  const [selectedCodeFile, setSelectedCodeFile] = useState<
    'DailyDatabaseBackupWorker.kt' | 'FeeReminderWorker.kt'
  >('DailyDatabaseBackupWorker.kt');

  // Fee Reminder Worker simulator state
  const [isSimulatingReminder, setIsSimulatingReminder] = useState(false);
  const [lastReminderResult, setLastReminderResult] = useState<string | null>(null);

  // Daily JSON Backup Worker state
  const [backupConfig, setBackupConfig] = useState<WorkManagerBackupConfig>(() =>
    getWorkManagerBackupConfig()
  );
  const [backupHistory, setBackupHistory] = useState<DailyBackupRecord[]>(() =>
    getStoredDailyBackups()
  );
  const [isRunningBackup, setIsRunningBackup] = useState(false);
  const [selectedPreviewBackup, setSelectedPreviewBackup] = useState<DailyBackupRecord | null>(
    null
  );
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const currentHistory = getStoredDailyBackups();
      setBackupHistory(currentHistory);
      setBackupConfig(getWorkManagerBackupConfig());
      if (currentHistory.length > 0 && !selectedPreviewBackup) {
        setSelectedPreviewBackup(currentHistory[0]);
      }
    }
  }, [isOpen, selectedPreviewBackup]);

  if (!isOpen) return null;

  // Filter students whose fee is due soon or overdue
  const dueAndOverdueStudents = students.filter((s) => {
    return getDaysDifference(s.nextFeeDueDate) <= 3;
  });

  const overdueStudents = students.filter((s) => {
    return getDaysDifference(s.nextFeeDueDate) < 0;
  });

  const activeWorkerSnippet = KOTLIN_CODE_SNIPPETS.find(
    (s) => s.name === selectedCodeFile
  );

  const handleToggleAutoDailyBackup = () => {
    const updated: WorkManagerBackupConfig = {
      ...backupConfig,
      autoDailyBackupEnabled: !backupConfig.autoDailyBackupEnabled,
    };
    setBackupConfig(updated);
    saveWorkManagerBackupConfig(updated);
    onSendNotificationToast(
      updated.autoDailyBackupEnabled
        ? 'WorkManager DailyDatabaseBackupWorker scheduled (Periodic 24h).'
        : 'WorkManager DailyDatabaseBackupWorker paused.'
    );
  };

  const handleToggleTwiceDailyReminders = () => {
    const updated: WorkManagerBackupConfig = {
      ...backupConfig,
      twiceDailyRemindersEnabled: !backupConfig.twiceDailyRemindersEnabled,
    };
    setBackupConfig(updated);
    saveWorkManagerBackupConfig(updated);
    onSendNotificationToast(
      updated.twiceDailyRemindersEnabled
        ? 'FeeReminderWorker configured to alert 2 times daily (Morning & Evening).'
        : 'FeeReminderWorker twice-daily alerts paused.'
    );
  };

  const handleRunDailyBackupNow = (triggerDownload: boolean) => {
    setIsRunningBackup(true);
    setTimeout(() => {
      const record = runDailyJsonBackupTask(students, allPayments, {
        triggerDownload,
        reason: 'MANUAL_WORKER_RUN',
      });
      const updatedHistory = getStoredDailyBackups();
      setBackupHistory(updatedHistory);
      setSelectedPreviewBackup(record);
      setBackupConfig(getWorkManagerBackupConfig());
      setIsRunningBackup(false);

      const kbSize = (record.sizeBytes / 1024).toFixed(1);
      onSendNotificationToast(
        triggerDownload
          ? `Exported ${record.fileName} (${record.studentCount} students • ${kbSize} KB) to local device storage!`
          : `DailyDatabaseBackupWorker saved ${record.fileName} (${kbSize} KB) to local device storage.`
      );
    }, 550);
  };

  const handleSimulateReminder = () => {
    setIsSimulatingReminder(true);
    setTimeout(() => {
      setIsSimulatingReminder(false);
      if (dueAndOverdueStudents.length > 0) {
        const names = dueAndOverdueStudents
          .map((s) => `${s.name} (Seat ${s.seatNumber}, Due: ${formatDueDateDisplay(s.nextFeeDueDate)})`)
          .join(', ');
        const notificationText = `Lakshay Library Twice-Daily Alert: Due date & overdue notice for ${dueAndOverdueStudents.length} student(s) — ${names}.`;
        setLastReminderResult(
          `Twice-Daily FeeReminderWorker executed successfully. Alerted ${dueAndOverdueStudents.length} student(s) for due dates & overdue payments (Morning & Evening cycle).`
        );
        onSendNotificationToast(notificationText);
      } else {
        setLastReminderResult(
          'Task completed. 0 students currently have due dates or overdue fees.'
        );
      }
    }, 600);
  };

  const handleCopyCode = () => {
    if (activeWorkerSnippet) {
      navigator.clipboard.writeText(activeWorkerSnippet.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const latestBackup = backupHistory[0] || null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200 ${darkModeClass}`}
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
        <div className="px-6 py-4 border-b border-slate-200/60 flex items-center justify-between bg-amber-500/10 shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/30">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Android WorkManager Background Tasks
              </h3>
              <p className="text-xs text-slate-500">
                Daily JSON Database Backup &bull; 3-Day Fee Reminder Worker
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-200/70 p-0.5 rounded-full text-xs font-medium border border-slate-200/60">
              <button
                type="button"
                onClick={() => setActiveTab('backup')}
                className={`px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                  activeTab === 'backup'
                    ? 'bg-amber-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>Daily JSON Backup</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reminders')}
                className={`px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                  activeTab === 'reminders'
                    ? 'bg-amber-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>3-Day Alerts</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('code')}
                className={`px-3 py-1 rounded-full transition-all flex items-center gap-1 ${
                  activeTab === 'code'
                    ? 'bg-amber-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Worker.kt</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab 1: Daily JSON Database Backup Worker */}
        {activeTab === 'backup' && (
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
            {/* PeriodicWorkRequest Schedule & Toggle Card */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-slate-900">
                      DailyDatabaseBackupWorker &bull; Periodic (Every 24 Hours)
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                        backupConfig.autoDailyBackupEnabled
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                          : 'bg-slate-200/70 text-slate-600 border-slate-300/60'
                      }`}
                    >
                      {backupConfig.autoDailyBackupEnabled ? 'ENQUEUED (ACTIVE)' : 'PAUSED'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Automatically serializes the Cloud Firestore <code>students</code> collection and{' '}
                    <code>PaymentHistory</code> sub-collections into a formatted JSON snapshot and
                    writes it to local device storage once every 24 hours.
                  </p>
                </div>

                {/* Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={backupConfig.autoDailyBackupEnabled}
                  onClick={handleToggleAutoDailyBackup}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    backupConfig.autoDailyBackupEnabled ? 'bg-amber-600' : 'bg-slate-300'
                  }`}
                  title="Toggle recurring 24-hour JSON database backup"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                      backupConfig.autoDailyBackupEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Target Local Storage Directory */}
              <div className="p-2.5 rounded-xl bg-white border border-slate-200/60 flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="font-mono text-slate-600 truncate">
                    {latestBackup
                      ? latestBackup.devicePath
                      : '/storage/emulated/0/Android/data/com.example.librarymanagement/files/backups/'}
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                  Local Storage
                </span>
              </div>
            </div>

            {/* Action Buttons: Run Worker & Export JSON File to Device */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleRunDailyBackupNow(true)}
                disabled={isRunningBackup}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 active:scale-95 disabled:opacity-50 rounded-2xl shadow-sm transition-all"
              >
                {isRunningBackup ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Exporting JSON Backup...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Export JSON to Device Now</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleRunDailyBackupNow(false)}
                disabled={isRunningBackup}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200/80 active:scale-95 disabled:opacity-50 rounded-2xl border border-slate-200/60 transition-all"
              >
                <Play className="w-4 h-4 text-amber-600" />
                <span>Simulate 24h Worker Run</span>
              </button>
            </div>

            {/* Stored Local Device Snapshots List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Local Device Backup Snapshots ({backupHistory.length})
                </h4>
                {latestBackup && (
                  <span className="text-[11px] font-mono text-emerald-600 font-semibold">
                    Latest: {latestBackup.dateKey}
                  </span>
                )}
              </div>

              {backupHistory.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                  No local JSON backups recorded yet. Click &quot;Export JSON to Device Now&quot; to
                  run <code>DailyDatabaseBackupWorker.doWork()</code>.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {backupHistory.map((item) => {
                    const isSelected = selectedPreviewBackup?.id === item.id;
                    const kb = (item.sizeBytes / 1024).toFixed(1);
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedPreviewBackup(item)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-xs ${
                          isSelected
                            ? 'bg-amber-50/70 border-amber-400/80 ring-1 ring-amber-400/40'
                            : 'bg-white hover:bg-slate-50 border-slate-200/60'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <FileJson className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="font-mono font-bold text-slate-900 truncate">
                              {item.fileName}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                                item.reason === 'SCHEDULED_DAILY'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {item.reason === 'SCHEDULED_DAILY' ? '24h Auto' : 'Manual Run'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {item.studentCount} students &bull; {item.paymentRecordCount} payments
                            &bull; {kb} KB &bull;{' '}
                            {new Date(item.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadJsonFileToDevice(item.jsonPayload, item.fileName);
                            onSendNotificationToast(
                              `Downloaded ${item.fileName} to your device.`
                            );
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-amber-500 hover:text-white text-slate-700 font-semibold text-[11px] flex items-center gap-1 shrink-0 transition-colors"
                          title="Download this JSON snapshot to your device"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Save .JSON</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Live JSON Snapshot Inspector */}
            {selectedPreviewBackup && (
              <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950">
                <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-300">
                  <span className="font-mono text-amber-400 truncate">
                    Preview: {selectedPreviewBackup.fileName}
                  </span>
                  <span className="font-mono text-slate-400">
                    {(selectedPreviewBackup.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                </div>
                <pre className="p-3.5 text-[11px] font-mono text-slate-200 max-h-48 overflow-auto leading-relaxed">
                  {selectedPreviewBackup.jsonPayload.slice(0, 1400)}
                  {selectedPreviewBackup.jsonPayload.length > 1400 ? '\n  ...\n}' : ''}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Fee Reminder & Overdue Worker Simulator (Twice Daily) */}
        {activeTab === 'reminders' && (
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs text-slate-700 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>FeeReminderWorker Schedule: Twice Daily (Morning 9:00 AM &amp; Evening 7:00 PM)</span>
                </div>
                {/* Twice Daily Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={backupConfig.twiceDailyRemindersEnabled}
                  onClick={handleToggleTwiceDailyReminders}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    backupConfig.twiceDailyRemindersEnabled ? 'bg-amber-600' : 'bg-slate-300'
                  }`}
                  title="Toggle twice-daily notifications for due dates & overdue payments"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                      backupConfig.twiceDailyRemindersEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Automatically queries Firestore <strong>2 times daily</strong> (Morning &amp; Evening) to alert library staff regarding both <strong>student due dates</strong> and <strong>overdue payments</strong>.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Target Due &amp; Overdue Students ({dueAndOverdueStudents.length})
                </h4>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                  {overdueStudents.length} overdue &bull; {dueAndOverdueStudents.length - overdueStudents.length} due soon
                </span>
              </div>

              {dueAndOverdueStudents.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                  No students currently have upcoming due dates or overdue payments. All active enrollments are paid!
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {dueAndOverdueStudents.map((s) => {
                    const diff = getDaysDifference(s.nextFeeDueDate);
                    const isOverdue = diff < 0;
                    return (
                      <div
                        key={s.id}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                          isOverdue
                            ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                            : 'bg-amber-50/70 border-amber-200 text-slate-900'
                        }`}
                      >
                        <div>
                          <div className="font-bold">{s.name}</div>
                          <div className="text-slate-600 text-[11px] mt-0.5">
                            Seat {s.seatNumber} &bull; ₹{s.monthlyFee} &bull; Due:{' '}
                            {formatDueDateDisplay(s.nextFeeDueDate)}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 font-bold rounded-lg text-[10px] uppercase tracking-wider ${
                            isOverdue
                              ? 'bg-rose-200 text-rose-900'
                              : 'bg-amber-200 text-amber-900'
                          }`}
                        >
                          {isOverdue ? `${Math.abs(diff)}d Overdue` : `Due in ${diff}d`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSimulateReminder}
                disabled={isSimulatingReminder}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 disabled:opacity-50 rounded-2xl shadow-sm transition-all"
              >
                {isSimulatingReminder ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Executing Twice-Daily FeeReminderWorker...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Simulate Twice-Daily Reminder Worker Now</span>
                  </>
                )}
              </button>
            </div>

            {lastReminderResult && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="font-medium">{lastReminderResult}</div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Kotlin CoroutineWorker Source Code */}
        {activeTab === 'code' && (
          <div className="flex-1 overflow-hidden flex flex-col bg-slate-950 text-slate-200">
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 text-xs flex-wrap">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedCodeFile('DailyDatabaseBackupWorker.kt')}
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs transition-all ${
                    selectedCodeFile === 'DailyDatabaseBackupWorker.kt'
                      ? 'bg-amber-600 text-white font-semibold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  DailyDatabaseBackupWorker.kt
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCodeFile('FeeReminderWorker.kt')}
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs transition-all ${
                    selectedCodeFile === 'FeeReminderWorker.kt'
                      ? 'bg-amber-600 text-white font-semibold'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  FeeReminderWorker.kt
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-white"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
            <KotlinCodeHighlighter
              code={activeWorkerSnippet?.code || ''}
              showToolbar={true}
              maxHeightClass="max-h-[72vh]"
            />
          </div>
        )}
      </div>
    </div>
  );
};
