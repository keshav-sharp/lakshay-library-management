import React, { useState } from 'react';
import { ThemeColors } from '../types/theme';
import { useTheme } from '../context/ThemeContext';
import {
  Plus,
  UserPlus,
  Code2,
  X,
  Layers,
  ChevronRight,
  Moon,
  Sun,
} from 'lucide-react';

export interface FabMenuActionItem {
  id: string;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeText?: string;
  isPrimary?: boolean;
  onClick: () => void;
}

interface ExpandableFabMenuProps {
  theme: ThemeColors;
  isDarkMode: boolean;
  onToggleDarkMode: (nextValue: boolean) => void;
  onAddStudent: () => void;
  onViewKotlinFabCode: () => void;
}

export const ExpandableFabMenu: React.FC<ExpandableFabMenuProps> = ({
  theme,
  isDarkMode,
  onToggleDarkMode,
  onAddStudent,
  onViewKotlinFabCode,
}) => {
  const { darkModeClass } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<'speed_dial' | 'bottom_sheet'>('speed_dial');

  const handleClose = () => {
    setIsOpen(false);
  };

  // Cleaned-up "+ Actions" FAB Menu: ONLY "Add Student" and "Toggle Theme"
  const menuActions: FabMenuActionItem[] = [
    {
      id: 'add_student',
      label: 'Add Student',
      subtitle: 'Register desk, shift & fee in Firestore',
      icon: UserPlus,
      isPrimary: true,
      onClick: () => {
        handleClose();
        onAddStudent();
      },
    },
    {
      id: 'toggle_theme',
      label: 'Toggle Theme',
      subtitle: isDarkMode
        ? 'Dark Mode active • Tap for Light Mode'
        : 'Light Mode active • Tap for Dark Mode',
      icon: isDarkMode ? Sun : Moon,
      badgeText: isDarkMode ? 'DARK' : 'LIGHT',
      onClick: () => {
        onToggleDarkMode(!isDarkMode);
      },
    },
  ];

  return (
    <>
      {/* Scrim Backdrop when FAB menu is open */}
      {isOpen && (
        <div
          className="absolute inset-0 z-30 bg-slate-950/35 backdrop-blur-[2px] animate-in fade-in duration-150"
          onClick={handleClose}
        />
      )}

      {/* MODE A: Frosted-Glass Pill Speed Dial Container */}
      {isOpen && menuStyle === 'speed_dial' && (
        <div
          className={`absolute right-4 bottom-24 z-40 w-72 sm:w-80 flex flex-col bg-white/85 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-200 ${darkModeClass}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Container Header with Mode Switcher */}
          <div className="px-4 py-2.5 bg-slate-900/90 backdrop-blur-md text-white flex items-center justify-between border-b border-slate-800/60 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-tight">Quick Actions</span>
              <span className="text-[10px] text-slate-400 font-mono">
                · {menuActions.length} items
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMenuStyle('bottom_sheet')}
                className="px-2.5 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-[10px] font-medium text-slate-300 transition-colors"
                title="Switch to ModalBottomSheet presentation"
              >
                Sheet View
              </button>
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  onViewKotlinFabCode();
                }}
                className="p-1 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors"
                title="View Jetpack Compose Speed Dial Code"
              >
                <Code2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Rounded-Full Pill Action Items */}
          <div className="p-2.5 space-y-2">
            {menuActions.map((item) => {
              const Icon = item.icon;
              const isToggleThemeItem = item.id === 'toggle_theme';

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className={`w-full px-3.5 py-2.5 rounded-full text-left flex items-center justify-between gap-3 border transition-all shadow-sm hover:shadow-md ${
                    item.isPrimary
                      ? 'bg-amber-50/90 border-amber-300/70 hover:bg-amber-100/90'
                      : 'bg-slate-50/80 border-slate-200/60 hover:bg-slate-100/90'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-xs ${
                        item.isPrimary
                          ? `${theme.primary} text-white`
                          : isToggleThemeItem
                          ? 'bg-amber-500/15 text-amber-600'
                          : 'bg-slate-200/70 text-slate-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                        <span>{item.label}</span>
                        {item.badgeText && (
                          <span className="text-[9px] font-mono uppercase tracking-wider text-amber-600">
                            · {item.badgeText}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE B: Modal Bottom Sheet Presentation */}
      {isOpen && menuStyle === 'bottom_sheet' && (
        <div
          className={`absolute inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur-md rounded-t-3xl shadow-2xl border-t border-slate-200/60 max-h-[75vh] flex flex-col animate-in slide-in-from-bottom duration-200 ${darkModeClass}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pt-2.5 pb-1 flex justify-center shrink-0">
            <div className="w-10 h-1.5 rounded-full bg-slate-300" />
          </div>

          <div className="px-5 py-3 border-b border-slate-200/60 flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Quick Actions</h3>
              <p className="text-[11px] text-slate-500">Add Student &amp; Toggle Theme</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMenuStyle('speed_dial')}
                className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors"
              >
                <Layers className="w-3 h-3" />
                <span>Speed Dial</span>
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 overflow-y-auto space-y-2.5 pb-6">
            {menuActions.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className={`w-full px-4 py-3 rounded-full border text-left flex items-center justify-between gap-3 transition-all shadow-sm ${
                    item.isPrimary
                      ? `${theme.primaryLight} border-amber-300/70`
                      : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        item.isPrimary
                          ? `${theme.primary} text-white`
                          : 'bg-white text-slate-700 border border-slate-200/60'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-slate-900">
                        {item.label}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{item.subtitle}</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Primary Expandable '+ Actions' Floating Action Button (FAB) with Frosted-Glass Blur & Rounded-Full Pill Styling */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close quick actions menu' : 'Open quick actions menu'}
        className={`absolute right-5 bottom-6 z-30 h-12 px-5 rounded-full backdrop-blur-md ${
          isOpen
            ? 'bg-slate-900/90 hover:bg-slate-800 text-white ring-4 ring-amber-500/25'
            : 'bg-amber-600/95 hover:bg-amber-500 text-white ring-1 ring-amber-400/40'
        } active:scale-95 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transition-all duration-200`}
        title="Expand + Actions (Add Student & Toggle Theme)"
      >
        <Plus
          className={`w-5 h-5 transition-transform duration-200 ${
            isOpen ? 'rotate-45' : ''
          }`}
        />
        <span className="text-xs font-bold tracking-tight">
          {isOpen ? 'Close' : 'Actions'}
        </span>
      </button>
    </>
  );
};
