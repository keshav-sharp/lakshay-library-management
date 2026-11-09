import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeColors, ThemePalette } from '../types/theme';
import {
  getActiveTheme,
  getStoredDarkMode,
  setAppDarkMode,
  setAppTheme,
  subscribeToTheme,
  toggleAppDarkMode,
} from '../services/themeService';

export interface ThemeContextValue {
  theme: ThemeColors;
  isDarkMode: boolean;
  darkModeClass: string;
  setPalette: (palette: ThemePalette) => void;
  setDarkMode: (isDark: boolean) => void;
  toggleDarkMode: () => boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeColors>(getActiveTheme());
  const [isDarkMode, setIsDarkMode] = useState<boolean>(getStoredDarkMode());

  useEffect(() => {
    const unsubscribe = subscribeToTheme((updatedTheme, updatedDark) => {
      setTheme(updatedTheme);
      setIsDarkMode(updatedDark);
    });
    return unsubscribe;
  }, []);

  const value: ThemeContextValue = {
    theme,
    isDarkMode,
    darkModeClass: isDarkMode ? 'lakshay-dark-mode' : '',
    setPalette: (palette: ThemePalette) => setAppTheme(palette),
    setDarkMode: (isDark: boolean) => setAppDarkMode(isDark),
    toggleDarkMode: () => toggleAppDarkMode(),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    const fallbackDark = getStoredDarkMode();
    return {
      theme: getActiveTheme(),
      isDarkMode: fallbackDark,
      darkModeClass: fallbackDark ? 'lakshay-dark-mode' : '',
      setPalette: setAppTheme,
      setDarkMode: setAppDarkMode,
      toggleDarkMode: toggleAppDarkMode,
    };
  }
  return ctx;
};
