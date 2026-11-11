import React from 'react';
import { ThemeColors, ThemePalette, THEME_PALETTES } from '../types/theme';
import { useTheme } from '../context/ThemeContext';
import {
  X,
  Moon,
  Sun,
  Palette,
  Check,
  Clock,
  Armchair,
  Bell,
  RotateCcw,
  Sliders,
} from 'lucide-react';

import {
  getLibraryProfileSettings,
  saveLibraryProfileSettings,
  LibraryProfileSettings,
} from '../services/librarySettingsService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeColors;
  isDarkMode: boolean;
  onToggleDarkMode: (nextValue: boolean) => void;
  onSelectTheme: (palette: ThemePalette) => void;
  onOpenShiftManager: () => void;
  onOpenSeatMatrix: () => void;
  onOpenWorkManager: () => void;
  onResetDatabase: () => void;
  onOpenDiagnostics?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  isDarkMode,
  onToggleDarkMode,
  onSelectTheme,
  onOpenShiftManager,
  onOpenSeatMatrix,
  onOpenWorkManager,
  onResetDatabase,
}) => {
  const { darkModeClass } = useTheme();
  const [librarySettings, setLibrarySettings] = React.useState<LibraryProfileSettings>(
    getLibraryProfileSettings()
  );

  React.useEffect(() => {
    if (isOpen) {
      setLibrarySettings(getLibraryProfileSettings());
    }
  }, [isOpen]);

  const handleUpdateSettings = (partial: Partial<LibraryProfileSettings>) => {
    const updated = saveLibraryProfileSettings(partial);
    setLibrarySettings(updated);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-slate-950/55 backdrop-blur-xs animate-in fade-in duration-200 ${darkModeClass}`}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-full sm:max-w-xl h-[90vh] sm:h-full rounded-t-3xl sm:rounded-t-none sm:rounded-l-3xl shadow-2xl border-t sm:border-t-0 sm:border-l overflow-hidden flex flex-col min-w-0 animate-in slide-in-from-bottom sm:slide-in-from-right duration-200 ${
          isDarkMode
            ? 'bg-slate-900 border-slate-800/60 text-slate-100'
            : 'bg-white border-slate-200/60 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200/60 bg-white flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0 truncate">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight tracking-tight truncate">
                Settings &amp; Appearance
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Color themes, dark mode, shifts &amp; preferences
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

        <div className="p-4 sm:p-6 overflow-y-auto overflow-x-hidden space-y-4 sm:space-y-5 flex-1 min-w-0 max-w-full">
          {/* 1. Global Dark Mode Toggle Card */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              isDarkMode
                ? 'bg-slate-800/90 border-amber-500/40'
                : 'bg-amber-50/70 border-amber-200'
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                    isDarkMode
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-amber-600 text-white'
                  }`}
                >
                  {isDarkMode ? (
                    <Moon className="w-5 h-5" />
                  ) : (
                    <Sun className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold">
                      Dark Mode
                    </h3>
                    <span className="text-[11px] font-mono font-semibold text-amber-600">
                      {isDarkMode ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Switch between Light and Dark appearance across all library screens.
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isDarkMode}
                onClick={() => onToggleDarkMode(!isDarkMode)}
                className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  isDarkMode ? 'bg-amber-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    isDarkMode ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => onToggleDarkMode(false)}
                className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                  !isDarkMode
                    ? 'bg-white border-amber-500 ring-2 ring-amber-500/30 text-slate-900'
                    : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <div className="text-xs font-bold">Light Mode</div>
                    <div className="text-[10px] opacity-75">Daytime surface</div>
                  </div>
                </div>
                {!isDarkMode && <Check className="w-4 h-4 text-amber-600" />}
              </button>

              <button
                type="button"
                onClick={() => onToggleDarkMode(true)}
                className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                  isDarkMode
                    ? 'bg-slate-950 border-amber-400 ring-2 ring-amber-400/30 text-white'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Moon className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white">Dark Mode</div>
                    <div className="text-[10px] text-slate-400">Low-light comfort</div>
                  </div>
                </div>
                {isDarkMode && <Check className="w-4 h-4 text-amber-400" />}
              </button>
            </div>
          </div>

          {/* 2. Accent Color Scheme Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                <span>Color Theme</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(THEME_PALETTES) as ThemePalette[]).map((paletteKey) => {
                const p = THEME_PALETTES[paletteKey];
                const isSelected = theme.id === paletteKey;

                return (
                  <button
                    key={paletteKey}
                    type="button"
                    onClick={() => onSelectTheme(paletteKey)}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between gap-2 transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/60 text-slate-900 ring-1 ring-amber-500'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: p.chartPrimary }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {paletteKey === 'amber' ? 'Default Theme' : p.description}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Library Profile & Receipt Settings */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Library Profile &amp; Receipt Settings
            </label>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Library Name
                </label>
                <input
                  type="text"
                  value={librarySettings.libraryName}
                  onChange={(e) => handleUpdateSettings({ libraryName: e.target.value })}
                  placeholder="Lakshay Library"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={librarySettings.contactPhone || ''}
                    onChange={(e) => handleUpdateSettings({ contactPhone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Email / Contact
                  </label>
                  <input
                    type="text"
                    value={librarySettings.contactEmail || ''}
                    onChange={(e) => handleUpdateSettings({ contactEmail: e.target.value })}
                    placeholder="desk@lakshaylibrary.in"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Library Address
                </label>
                <input
                  type="text"
                  value={librarySettings.libraryAddress || ''}
                  onChange={(e) => handleUpdateSettings({ libraryAddress: e.target.value })}
                  placeholder="e.g. Near Metro Station, Main Road"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Receipt Terms / Footer Note
                </label>
                <input
                  type="text"
                  value={librarySettings.termsAndConditions || ''}
                  onChange={(e) => handleUpdateSettings({ termsAndConditions: e.target.value })}
                  placeholder="Fees once paid are non-refundable & non-transferable."
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* 4. Library Configuration Shortcuts */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Library Configuration
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenShiftManager();
                }}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-all"
              >
                <Clock className="w-4 h-4 text-amber-600 mb-1.5" />
                <div className="text-xs font-bold text-slate-900">Shift &amp; Pricing</div>
                <div className="text-[11px] text-slate-500">Timings &amp; monthly fees</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSeatMatrix();
                }}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-all"
              >
                <Armchair className="w-4 h-4 text-amber-600 mb-1.5" />
                <div className="text-xs font-bold text-slate-900">Seat Customization</div>
                <div className="text-[11px] text-slate-500">Add or remove desks</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenWorkManager();
                }}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-all"
              >
                <Bell className="w-4 h-4 text-amber-600 mb-1.5" />
                <div className="text-xs font-bold text-slate-900">Backups &amp; Alerts</div>
                <div className="text-[11px] text-slate-500">Daily backups &amp; reminders</div>
              </button>
            </div>
          </div>

          {/* Footer Reset & Close */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onClose();
                onResetDatabase();
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Data (0 Students)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className={`px-5 py-2 rounded-xl text-xs font-bold text-white ${theme.primary} ${theme.primaryHover} shadow-sm transition-all`}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
