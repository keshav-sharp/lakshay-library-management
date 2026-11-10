import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, CheckCircle2, RotateCcw, ShieldCheck, X } from 'lucide-react';

interface AppLaunchSplashProps {
  onComplete: () => void;
}

export const AppLaunchSplash: React.FC<AppLaunchSplashProps> = ({ onComplete }) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const startExitTimer = setTimeout(() => {
      setExiting(true);
    }, 1350);

    const finishTimer = setTimeout(() => {
      onComplete();
    }, 1800);

    return () => {
      clearTimeout(startExitTimer);
      clearTimeout(finishTimer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          key="launch-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.06, filter: 'blur(8px)' }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0B192C] text-white overflow-hidden select-none"
        >
          {/* Ambient Golden & Teal Glows */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 0.45, scale: 1.2 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="absolute w-80 h-80 rounded-full bg-amber-500/25 blur-3xl pointer-events-none"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.35, scale: 1.35 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
            className="absolute w-96 h-96 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none"
          />

          {/* Animated App Icon Container */}
          <div className="relative flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{
                type: 'spring',
                stiffness: 260,
                damping: 20,
                duration: 0.65,
              }}
              className="relative"
            >
              {/* Expanding Pulse Ring */}
              <motion.div
                initial={{ scale: 0.85, opacity: 0.7 }}
                animate={{ scale: 1.35, opacity: 0 }}
                transition={{
                  duration: 1.3,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
                className="absolute inset-0 rounded-3xl border-2 border-amber-400/50"
              />

              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden shadow-2xl border-2 border-amber-400/40 bg-[#0B192C] relative z-10">
                <img
                  src="/app-icon.png"
                  alt="Lakshay Library"
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>

            {/* Brand Title & Subtitle */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.45, ease: 'easeOut' }}
              className="mt-6 text-center px-6"
            >
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Lakshay Library
              </h1>
              <p className="text-xs sm:text-sm text-amber-300/90 font-medium mt-1 tracking-wide">
                Study Hall &amp; Desk Management
              </p>
            </motion.div>

            {/* Smooth Progress Indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-8 w-44 h-1.5 bg-slate-800/90 rounded-full overflow-hidden border border-white/10"
            >
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.15, ease: 'easeInOut' }}
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-300 to-teal-400"
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface ExitAppModalProps {
  isOpen: boolean;
  onCancel: () => void;
}

export const ExitAppModal: React.FC<ExitAppModalProps> = ({ isOpen, onCancel }) => {
  const [exitStage, setExitStage] = useState<'CONFIRM' | 'ANIMATING_OUT' | 'CLOSED'>('CONFIRM');

  useEffect(() => {
    if (isOpen) {
      setExitStage('CONFIRM');
    }
  }, [isOpen]);

  const handleConfirmExit = () => {
    setExitStage('ANIMATING_OUT');

    setTimeout(() => {
      // Attempt native Capacitor / Android WebView exit if available
      try {
        const nav = navigator as unknown as { app?: { exitApp?: () => void } };
        if (nav.app && typeof nav.app.exitApp === 'function') {
          nav.app.exitApp();
          return;
        }
      } catch {
        // Ignore
      }

      try {
        window.close();
      } catch {
        // Ignore
      }

      setExitStage('CLOSED');
    }, 1150);
  };

  const handleRelaunch = () => {
    setExitStage('CONFIRM');
    onCancel();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="exit-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md select-none"
          onClick={exitStage === 'CONFIRM' ? onCancel : undefined}
        >
          {exitStage === 'CONFIRM' && (
            <motion.div
              key="exit-confirm-card"
              initial={{ scale: 0.88, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden"
            >
              {/* Top Accent Banner */}
              <div className="px-6 pt-6 pb-4 flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden border border-amber-500/40 shadow-md shrink-0 bg-[#0B192C]">
                    <img
                      src="/app-icon.png"
                      alt="Lakshay Library"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                      Exit Lakshay Library?
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Confirm before closing the app
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onCancel}
                  className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Message Body */}
              <div className="px-6 pb-5 space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Are you sure you want to close <strong>Lakshay Library</strong>? All student
                  records, seat assignments, and payment histories are safely saved on your device.
                </p>

                <div className="p-2.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/50 flex items-center gap-2 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Database changes saved automatically</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200/70 dark:border-slate-800 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all active:scale-95"
                >
                  Stay in App
                </button>

                <button
                  type="button"
                  onClick={handleConfirmExit}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Exit App</span>
                </button>
              </div>
            </motion.div>
          )}

          {exitStage === 'ANIMATING_OUT' && (
            <motion.div
              key="exit-farewell"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.75 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="flex flex-col items-center text-center text-white p-8"
            >
              <motion.div
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.08, 0.82], rotate: [0, 0, -4] }}
                transition={{ duration: 1.05, ease: 'easeInOut' }}
                className="w-24 h-24 rounded-3xl overflow-hidden shadow-2xl border-2 border-amber-400/50 bg-[#0B192C] mb-5"
              >
                <img
                  src="/app-icon.png"
                  alt="Lakshay Library"
                  className="w-full h-full object-cover"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="space-y-1.5"
              >
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>All Library Records Saved</span>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-white">
                  Closing Lakshay Library...
                </h2>
                <p className="text-xs text-slate-300">
                  See you next time!
                </p>
              </motion.div>
            </motion.div>
          )}

          {exitStage === 'CLOSED' && (
            <motion.div
              key="exit-closed-screen"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center text-white p-8 max-w-sm"
            >
              <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-xl border border-white/15 bg-[#0B192C] mb-4 opacity-80">
                <img
                  src="/app-icon.png"
                  alt="Lakshay Library"
                  className="w-full h-full object-cover"
                />
              </div>
              <h2 className="text-lg font-bold text-white">Lakshay Library Closed</h2>
              <p className="text-xs text-slate-400 mt-1 mb-6">
                Your session has ended safely. You can close this window or relaunch the app below.
              </p>
              <button
                type="button"
                onClick={handleRelaunch}
                className="px-5 py-2.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Relaunch Lakshay Library</span>
              </button>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
