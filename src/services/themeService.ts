import { ThemePalette, ThemeColors, THEME_PALETTES } from '../types/theme';

const THEME_STORAGE_KEY = 'lakshay_app_theme';
const DARK_MODE_STORAGE_KEY = 'lakshay_app_dark_mode';

type ThemeListener = (theme: ThemeColors, isDarkMode: boolean) => void;
const themeListeners: Set<ThemeListener> = new Set();

export const getStoredThemePalette = (): ThemePalette => {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw && raw in THEME_PALETTES) {
      return raw as ThemePalette;
    }
    return 'amber';
  } catch {
    return 'amber';
  }
};

export const getStoredDarkMode = (): boolean => {
  try {
    return localStorage.getItem(DARK_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const getActiveTheme = (): ThemeColors => {
  const palette = getStoredThemePalette();
  const base = THEME_PALETTES[palette] || THEME_PALETTES.amber;
  const isDark = getStoredDarkMode();

  if (isDark) {
    return {
      ...base,
      headerBg: base.darkHeaderBg,
      chartPrimary: palette === 'amber' ? '#f59e0b' : base.chartGradient,
    };
  }
  return base;
};

const notifyThemeListeners = () => {
  const activeTheme = getActiveTheme();
  const isDark = getStoredDarkMode();
  themeListeners.forEach((fn) => fn(activeTheme, isDark));
};

export const setAppTheme = (palette: ThemePalette) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, palette);
    notifyThemeListeners();
  } catch (e) {
    console.error('Error saving theme', e);
  }
};

export const setAppDarkMode = (isDark: boolean) => {
  try {
    localStorage.setItem(DARK_MODE_STORAGE_KEY, String(isDark));
    notifyThemeListeners();
  } catch (e) {
    console.error('Error saving dark mode preference', e);
  }
};

export const toggleAppDarkMode = (): boolean => {
  const next = !getStoredDarkMode();
  setAppDarkMode(next);
  return next;
};

export const subscribeToTheme = (callback: ThemeListener): (() => void) => {
  themeListeners.add(callback);
  return () => {
    themeListeners.delete(callback);
  };
};
