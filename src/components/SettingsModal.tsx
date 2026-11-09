import React, { useState } from 'react';
import { ThemeColors, ThemePalette, THEME_PALETTES } from '../types/theme';
import { useTheme } from '../context/ThemeContext';
import { KotlinCodeHighlighter } from './KotlinCodeHighlighter';
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
  Code2,
  Copy,
  Sliders,
  Activity,
} from 'lucide-react';

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

const COMPOSE_THEME_KOTLIN_CODE = `package com.example.librarymanagement.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Warm Sunset Amber & Slate — Light Palette
private val SunsetAmberLightColorScheme = lightColorScheme(
    primary = Color(0xFFD97706),          // Amber 600
    onPrimary = Color(0xFFFFFFFF),
    primaryContainer = Color(0xFFFEF3C7), // Amber 100
    onPrimaryContainer = Color(0xFF78350F),
    secondary = Color(0xFF475569),        // Slate 600
    onSecondary = Color(0xFFFFFFFF),
    background = Color(0xFFF8FAFC),       // Slate 50
    onBackground = Color(0xFF0F172A),     // Slate 900
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF1E293B),        // Slate 800
    surfaceVariant = Color(0xFFF1F5F9),   // Slate 100
    onSurfaceVariant = Color(0xFF64748B)  // Slate 500
)

// Warm Sunset Amber & Slate — Dark Palette
private val SunsetAmberDarkColorScheme = darkColorScheme(
    primary = Color(0xFFF59E0B),          // Amber 500 (High-contrast glow)
    onPrimary = Color(0xFF0F172A),
    primaryContainer = Color(0xFF78350F), // Deep Sunset Amber
    onPrimaryContainer = Color(0xFFFDE68A),
    secondary = Color(0xFF94A3B8),        // Slate 400
    onSecondary = Color(0xFF0F172A),
    background = Color(0xFF0B1120),       // Deep Slate 950
    onBackground = Color(0xFFF8FAFC),     // Slate 50
    surface = Color(0xFF1E293B),          // Slate 800 Card Surface
    onSurface = Color(0xFFF1F5F9),        // Slate 100
    surfaceVariant = Color(0xFF0F172A),   // Slate 900
    onSurfaceVariant = Color(0xFF94A3B8)  // Slate 400
)

@Composable
fun LakshayLibraryTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) {
        SunsetAmberDarkColorScheme
    } else {
        SunsetAmberLightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}`;

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
  onOpenDiagnostics,
}) => {
  const { darkModeClass } = useTheme();
  const [activeTab, setActiveTab] = useState<'settings' | 'kotlin'>('settings');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyKotlin = () => {
    navigator.clipboard.writeText(COMPOSE_THEME_KOTLIN_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end bg-slate-950/55 backdrop-blur-xs animate-in fade-in duration-200 ${darkModeClass}`}
      onClick={onClose}
    >
      <div
        className={`w-full sm:max-w-xl h-[90vh] sm:h-full rounded-t-3xl sm:rounded-t-none sm:rounded-l-3xl shadow-2xl border-t sm:border-t-0 sm:border-l overflow-hidden flex flex-col animate-in slide-in-from-bottom sm:slide-in-from-right duration-200 ${
          isDarkMode
            ? 'bg-slate-900 border-slate-800/60 text-slate-100'
            : 'bg-white border-slate-200/60 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/60 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Sliders className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight tracking-tight">
                App Settings &amp; Appearance
              </h2>
              <p className="text-xs text-slate-500">
                Global Dark Mode &bull; Warm Sunset Amber &amp; Slate Theme
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100/80 p-1 rounded-full text-xs border border-slate-200/60">
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`px-3 py-1 rounded-full font-semibold transition-all ${
                  activeTab === 'settings'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Settings
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('kotlin')}
                className={`px-3 py-1 rounded-full font-semibold flex items-center gap-1 transition-all ${
                  activeTab === 'kotlin'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Theme.kt</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {activeTab === 'settings' ? (
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
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
                        Global Dark Mode
                      </h3>
                      <span className="text-[11px] font-mono font-semibold text-amber-600">
                        {isDarkMode ? 'Dark Variant Active' : 'Light Variant Active'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Switches between Light and Dark surface variants of the{' '}
                      <strong className="font-semibold">Warm Sunset Amber &amp; Slate</strong>{' '}
                      palette across all screens and analytics.
                    </p>
                  </div>
                </div>

                {/* Interactive Switch */}
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

              {/* Side-by-side Variant Preview */}
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
                      <div className="text-xs font-bold">Light Variant</div>
                      <div className="text-[10px] opacity-75">Amber 600 &bull; Slate 50</div>
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
                      <div className="text-xs font-bold text-white">Dark Variant</div>
                      <div className="text-[10px] text-slate-400">Amber 500 &bull; Slate 900</div>
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
                  <span>Color Palette Preset</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  Primary: Warm Sunset Amber &amp; Slate
                </span>
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
                            {paletteKey === 'amber' ? 'Default Primary Theme' : p.description}
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Library Management Configuration Shortcuts */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Library Configuration
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                  <div className="text-[11px] text-slate-500">Custom timings &amp; fees</div>
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
                  <div className="text-xs font-bold text-slate-900">WorkManager Alerts</div>
                  <div className="text-[11px] text-slate-500">3-day due reminders</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenDiagnostics) onOpenDiagnostics();
                  }}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-all"
                >
                  <Activity className="w-4 h-4 text-emerald-600 mb-1.5" />
                  <div className="text-xs font-bold text-slate-900">Diagnostics &amp; Active Clients</div>
                  <div className="text-[11px] text-slate-500">Crash logs &amp; Google Drive</div>
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
                <span>Reset Demo Database</span>
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
        ) : (
          /* Kotlin Jetpack Compose Dark/Light Theme.kt Code View */
          <div className="flex-1 overflow-hidden flex flex-col bg-slate-950 text-slate-200">
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
              <span className="font-mono text-amber-400">
                ui/theme/Theme.kt (Warm Sunset Amber &amp; Slate Dark/Light ColorScheme)
              </span>
              <button
                type="button"
                onClick={handleCopyKotlin}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1 text-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
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
              code={COMPOSE_THEME_KOTLIN_CODE}
              showToolbar={true}
              maxHeightClass="max-h-[65vh]"
            />
          </div>
        )}
      </div>
    </div>
  );
};
