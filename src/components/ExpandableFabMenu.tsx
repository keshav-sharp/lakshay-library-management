import React, { useState } from 'react';
import { ThemeColors } from '../types/theme';
import { useTheme } from '../context/ThemeContext';
import {
  Plus,
  UserPlus,
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
  onViewKotlinFabCode?: () => void;
}

export const ExpandableFabMenu: React.FC<ExpandableFabMenuProps> = ({
  theme,
  isDarkMode,
  onToggleDarkMode,
  onAddStudent,
}) => {
  const { darkModeClass } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = () => {
    setIsOpen(false);
  };

  const menuActions: FabMenuActionItem[] = [
    {
      id: 'add_student',
      label: 'Add Student',
      subtitle: 'Register new student, seat & shift',
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
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-[2px] animate-in fade-in duration-150"
          onClick={handleClose}
        />
      )}

      {isOpen && (
        <div
          className={`fixed right-4 bottom-24 z-40 w-72 sm:w-80 flex flex-col bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-200 ${darkModeClass}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800/60 shrink-0">
            <span className="text-xs font-bold tracking-tight">Quick Actions</span>
          </div>

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

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close quick actions menu' : 'Open quick actions menu'}
        className={`fixed right-5 bottom-6 z-30 h-12 px-5 rounded-full backdrop-blur-md ${
          isOpen
            ? 'bg-slate-900/90 hover:bg-slate-800 text-white ring-4 ring-amber-500/25'
            : 'bg-amber-600/95 hover:bg-amber-500 text-white ring-1 ring-amber-400/40'
        } active:scale-95 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transition-all duration-200`}
        title="Quick Actions"
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
