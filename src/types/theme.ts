export type ThemePalette = 'amber' | 'indigo' | 'emerald' | 'navy' | 'rose';

export interface ThemeColors {
  id: ThemePalette;
  name: string;
  description: string;
  primary: string;         // e.g. "bg-amber-600"
  primaryHover: string;    // e.g. "hover:bg-amber-700"
  primaryText: string;     // e.g. "text-amber-600"
  primaryLight: string;    // e.g. "bg-amber-50"
  primaryBorder: string;   // e.g. "border-amber-200"
  primaryRing: string;     // e.g. "ring-amber-500"
  accentBadge: string;     // e.g. "bg-amber-100 text-amber-900 border-amber-300"
  headerBg: string;        // e.g. "bg-gradient-to-r from-amber-600 to-amber-700"
  darkHeaderBg: string;    // Dark variant header background
  headerBorder: string;
  chartPrimary: string;    // Hex color for Recharts
  chartGradient: string;   // Hex color for secondary fill
  chartBar: string;
}

export const THEME_PALETTES: Record<ThemePalette, ThemeColors> = {
  amber: {
    id: 'amber',
    name: 'Warm Sunset Amber & Slate',
    description: 'Cozy study atmosphere with warm amber accents and deep slate contrast',
    primary: 'bg-amber-600',
    primaryHover: 'hover:bg-amber-700',
    primaryText: 'text-amber-600',
    primaryLight: 'bg-amber-50',
    primaryBorder: 'border-amber-200',
    primaryRing: 'ring-amber-500',
    accentBadge: 'bg-amber-100 text-amber-900 border-amber-300',
    headerBg: 'bg-gradient-to-r from-amber-600 via-amber-700 to-slate-900',
    darkHeaderBg: 'bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900',
    headerBorder: 'border-amber-500/40',
    chartPrimary: '#d97706', // amber-600
    chartGradient: '#f59e0b', // amber-500
    chartBar: '#b45309',
  },
  indigo: {
    id: 'indigo',
    name: 'Classic Indigo & Violet',
    description: 'Modern corporate look with deep indigo tones and violet highlights',
    primary: 'bg-indigo-600',
    primaryHover: 'hover:bg-indigo-700',
    primaryText: 'text-indigo-600',
    primaryLight: 'bg-indigo-50',
    primaryBorder: 'border-indigo-200',
    primaryRing: 'ring-indigo-500',
    accentBadge: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    headerBg: 'bg-gradient-to-r from-indigo-600 to-indigo-700',
    darkHeaderBg: 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900',
    headerBorder: 'border-indigo-500/40',
    chartPrimary: '#4f46e5', // indigo-600
    chartGradient: '#6366f1',
    chartBar: '#4338ca',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Forest Green',
    description: 'Refreshing and calm natural green aesthetic suited for focused learning',
    primary: 'bg-emerald-600',
    primaryHover: 'hover:bg-emerald-700',
    primaryText: 'text-emerald-600',
    primaryLight: 'bg-emerald-50',
    primaryBorder: 'border-emerald-200',
    primaryRing: 'ring-emerald-500',
    accentBadge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    headerBg: 'bg-gradient-to-r from-emerald-600 to-teal-700',
    darkHeaderBg: 'bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900',
    headerBorder: 'border-emerald-500/40',
    chartPrimary: '#059669', // emerald-600
    chartGradient: '#10b981',
    chartBar: '#047857',
  },
  navy: {
    id: 'navy',
    name: 'Oceanic Navy & Cyan',
    description: 'High-focus deep ocean blues with sleek cyan highlights',
    primary: 'bg-sky-600',
    primaryHover: 'hover:bg-sky-700',
    primaryText: 'text-sky-600',
    primaryLight: 'bg-sky-50',
    primaryBorder: 'border-sky-200',
    primaryRing: 'ring-sky-500',
    accentBadge: 'bg-sky-100 text-sky-900 border-sky-300',
    headerBg: 'bg-gradient-to-r from-slate-900 via-sky-900 to-slate-900',
    darkHeaderBg: 'bg-gradient-to-r from-slate-950 via-sky-950 to-slate-950',
    headerBorder: 'border-sky-700/50',
    chartPrimary: '#0284c7', // sky-600
    chartGradient: '#38bdf8',
    chartBar: '#0369a1',
  },
  rose: {
    id: 'rose',
    name: 'Crimson Rose & Zinc',
    description: 'Energetic crimson rose tones with clean modern card contrast',
    primary: 'bg-rose-600',
    primaryHover: 'hover:bg-rose-700',
    primaryText: 'text-rose-600',
    primaryLight: 'bg-rose-50',
    primaryBorder: 'border-rose-200',
    primaryRing: 'ring-rose-500',
    accentBadge: 'bg-rose-100 text-rose-900 border-rose-300',
    headerBg: 'bg-gradient-to-r from-rose-600 to-rose-700',
    darkHeaderBg: 'bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900',
    headerBorder: 'border-rose-500/40',
    chartPrimary: '#e11d48', // rose-600
    chartGradient: '#f43f5e',
    chartBar: '#be123c',
  },
};
