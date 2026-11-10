import React, { useState, useEffect } from 'react';
import { ThemeColors, ThemePalette, THEME_PALETTES } from '../types/theme';
import { useTheme } from '../context/ThemeContext';
import {
  getActiveOnlineClientsCount,
  subscribeToActiveClients,
} from '../services/clientPresenceService';
import {
  Settings,
  Palette,
  Scan,
  Clock,
  Armchair,
  X,
  ChevronRight,
  Check,
  Trash2,
  QrCode,
  Bell,
  Cloud,
  ExternalLink,
  GitBranch,
  LogOut,
} from 'lucide-react';

export const APP_VERSION = 'v2.0.5';
export const GITHUB_REPO_URL = 'https://github.com/keshav-sharp/lakshay-library-management';

export interface DrawerMenuItem {
  id: string;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeColors;
  isDarkMode: boolean;
  onOpenSettings: () => void;
  onSelectTheme: (palette: ThemePalette) => void;
  onOpenScanner: () => void;
  onOpenShiftAndHistory: () => void;
  onOpenSeatMatrix: () => void;
  onResetDatabase?: () => void;
  onOpenUpiPaymentQr?: () => void;
  onOpenApkExport?: () => void;
  onOpenWorkManager?: () => void;
  onOpenGoogleDriveSync?: () => void;
  onRequestExitApp?: () => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  theme,
  isDarkMode,
  onOpenSettings,
  onSelectTheme,
  onOpenScanner,
  onOpenShiftAndHistory,
  onOpenSeatMatrix,
  onResetDatabase,
  onOpenUpiPaymentQr,
  onOpenWorkManager,
  onOpenGoogleDriveSync,
  onRequestExitApp,
}) => {
  const { darkModeClass } = useTheme();
  const [isPaletteExpanded, setIsPaletteExpanded] = useState(false);
  const [activeClientsCount, setActiveClientsCount] = useState<number>(() =>
    getActiveOnlineClientsCount()
  );

  useEffect(() => {
    setActiveClientsCount(getActiveOnlineClientsCount());
    const unsub = subscribeToActiveClients((clients) => {
      const onlineCount = clients.filter((c) => c.status === 'ONLINE').length;
      setActiveClientsCount(Math.max(1, onlineCount));
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCloseDrawer = () => {
    setIsPaletteExpanded(false);
    onClose();
  };

  const drawerItems: DrawerMenuItem[] = [
    {
      id: 'settings',
      label: 'Settings',
      subtitle: 'Appearance & library configuration',
      icon: Settings,
      onClick: () => {
        handleCloseDrawer();
        onOpenSettings();
      },
    },
    {
      id: 'color_palette',
      label: 'Color Palette',
      subtitle: `Active: ${theme.name}`,
      icon: Palette,
      onClick: () => {
        setIsPaletteExpanded((prev) => !prev);
      },
    },
    {
      id: 'scan_qr',
      label: 'Scan / QR Check-in',
      subtitle: 'Front-desk digital attendance scanner',
      icon: Scan,
      onClick: () => {
        handleCloseDrawer();
        onOpenScanner();
      },
    },
    {
      id: 'history_shifts',
      label: 'Shift Timings & Pricing',
      subtitle: 'Configure study shifts & monthly fees',
      icon: Clock,
      onClick: () => {
        handleCloseDrawer();
        onOpenShiftAndHistory();
      },
    },
    {
      id: 'customize_seats',
      label: 'Customize Seats',
      subtitle: 'Manage library desks & seating layout',
      icon: Armchair,
      onClick: () => {
        handleCloseDrawer();
        onOpenSeatMatrix();
      },
    },
    {
      id: 'library_upi_qr',
      label: 'Library UPI & Payment QR',
      subtitle: 'Reception UPI ID & QR code standee',
      icon: QrCode,
      onClick: () => {
        handleCloseDrawer();
        if (onOpenUpiPaymentQr) onOpenUpiPaymentQr();
      },
    },
    {
      id: 'work_manager',
      label: 'Backups & Fee Reminders',
      subtitle: 'Daily local backup & due-date alerts',
      icon: Bell,
      onClick: () => {
        handleCloseDrawer();
        if (onOpenWorkManager) onOpenWorkManager();
      },
    },
    {
      id: 'gdrive_sync',
      label: 'Google Drive Daily Sync & Primary Role',
      subtitle: `${activeClientsCount} Active ${
        activeClientsCount === 1 ? 'Client' : 'Clients'
      } • Heartbeat & Crash Logs`,
      icon: Cloud,
      onClick: () => {
        handleCloseDrawer();
        if (onOpenGoogleDriveSync) onOpenGoogleDriveSync();
      },
    },
    {
      id: 'reset_database',
      label: 'Reset All Data',
      subtitle: 'Clear all student records to 0',
      icon: Trash2,
      onClick: () => {
        handleCloseDrawer();
        if (onResetDatabase) onResetDatabase();
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-40 overflow-hidden">
      {/* Scrim Backdrop */}
      <div
        onClick={handleCloseDrawer}
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px] animate-in fade-in duration-200"
      />

      {/* ModalDrawerSheet Sliding in from the Left */}
      <aside
        onClick={(e) => e.stopPropagation()}
        className={`absolute top-0 bottom-0 left-0 w-[84%] max-w-[310px] bg-white border-r border-slate-200/60 shadow-2xl rounded-r-3xl flex flex-col animate-in slide-in-from-left duration-200 ${darkModeClass}`}
      >
        {/* Drawer Header */}
        <div className="px-5 py-5 border-b border-slate-200/60 bg-white shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-xs border border-amber-500/30 flex items-center justify-center shrink-0">
                <img src="/app-icon.png" alt="Lakshay Library" className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight text-slate-900 leading-tight">
                  Lakshay Library
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Study Hall Management
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseDrawer}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close navigation drawer"
              title="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Section Label */}
        <div className="px-5 pt-4 pb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Menu
          </span>
        </div>

        {/* NavigationDrawerItem List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          {drawerItems.map((item) => {
            const Icon = item.icon;
            const isPaletteItem = item.id === 'color_palette';

            return (
              <div key={item.id} className="rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={item.onClick}
                  className="w-full px-3.5 py-3 rounded-2xl text-left flex items-center justify-between gap-3 hover:bg-slate-100/90 active:bg-slate-200/70 transition-all group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isPaletteItem && isPaletteExpanded
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 text-slate-700 group-hover:bg-amber-500/15 group-hover:text-amber-600'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <ChevronRight
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                      isPaletteItem && isPaletteExpanded ? 'rotate-90 text-amber-600' : ''
                    }`}
                  />
                </button>

                {/* Inline Color Palette Picker inside Navigation Drawer */}
                {isPaletteItem && isPaletteExpanded && (
                  <div className="mx-2 mb-2 mt-1 p-2.5 bg-slate-900 rounded-2xl space-y-1 animate-in fade-in duration-150">
                    <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Select Theme Color
                    </div>
                    {(Object.keys(THEME_PALETTES) as ThemePalette[]).map((paletteKey) => {
                      const p = THEME_PALETTES[paletteKey];
                      const isSelected = theme.id === paletteKey;
                      return (
                        <button
                          key={paletteKey}
                          type="button"
                          onClick={() => {
                            onSelectTheme(paletteKey);
                            handleCloseDrawer();
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between text-xs transition-all ${
                            isSelected
                              ? 'bg-white/15 text-white font-bold'
                              : 'text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0"
                              style={{ backgroundColor: p.chartPrimary }}
                            />
                            <span className="truncate">{p.name}</span>
                          </div>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Last Item in Navigation Drawer: App Version with embedded Git Repository URL */}
          <div className="pt-2 mt-2 border-t border-slate-200/60">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-3.5 py-3 rounded-2xl text-left flex items-center justify-between gap-3 hover:bg-amber-500/10 active:bg-amber-500/20 transition-all group border border-transparent hover:border-amber-500/30"
              title="Open App Version & Release Information"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <span>App Version</span>
                    <span className="font-mono text-amber-600 underline decoration-amber-500/50 underline-offset-2">
                      {APP_VERSION}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    Production Release
                  </div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-amber-600 shrink-0" />
            </a>
          </div>
        </div>

        {/* Clean Production Drawer Footer */}
        <div className="p-3.5 border-t border-slate-200/60 bg-slate-50/80 shrink-0">
          <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
            <span>Lakshay Library</span>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono font-bold text-amber-600 hover:text-amber-500 underline underline-offset-2 inline-flex items-center gap-1 transition-colors"
              title="Version & Release Notes"
            >
              <span>{APP_VERSION}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
};
