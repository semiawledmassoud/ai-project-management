import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const colorSchemes = {
  dark: {
    page: '#070b14',
    panel: '#131620',
    panelAlt: '#1a1d28',
    border: '#252a3d',
    text: '#e8eaf6',
    muted: '#9ba3c8',
    subtle: '#5c6490',
    accent: '#4f8fff',
    accentSoft: 'rgba(79,143,255,0.14)',
    success: '#34d399',
    warning: '#f59e0b',
    danger: '#f87171',
    purple: '#a78bfa',
    hero: 'linear-gradient(135deg, rgba(79,143,255,0.18), rgba(167,139,250,0.12))',
  },
  light: {
    page: '#f5f7ff',
    panel: '#ffffff',
    panelAlt: '#f8faff',
    border: '#dfe4f2',
    text: '#0f172a',
    muted: '#475569',
    subtle: '#64748b',
    accent: '#2563eb',
    accentSoft: 'rgba(37,99,235,0.12)',
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    purple: '#7c3aed',
    hero: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(124,58,237,0.08))',
  },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const storedTheme = typeof window !== 'undefined' ? window.localStorage.getItem('theme') : null;
  const [theme, setTheme] = useState(storedTheme || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  };

  const colors = useMemo(() => colorSchemes[theme], [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
