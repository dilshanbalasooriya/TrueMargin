'use client';

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useServerInsertedHTML } from 'next/navigation';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'theme';
const THEME_CHANGE_EVENT = 'truemargin-theme-change';
const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var d=t==='dark';var el=document.documentElement;if(d){el.classList.add('dark');el.style.colorScheme='dark';}else{el.classList.remove('dark');el.style.colorScheme='light';}}catch(e){}})();`;

// Suppress React 19 false-positive script warning in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag')) {
      return;
    }
    originalError.apply(console, args);
  };
}

function getThemeSnapshot(): Theme {
  try {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === 'dark') return 'dark';
    if (stored === 'light') return 'light';
  } catch {
    // ignore
  }
  return 'light';
}

function getServerThemeSnapshot(): Theme {
  return 'light';
}

function subscribeToThemeChanges(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useServerInsertedHTML(() => (
    <script
      key="theme-init"
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  ));
  const resolvedTheme = useSyncExternalStore(
    subscribeToThemeChanges,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = (theme: Theme) => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, theme);
      }
    } catch {
      // ignore
    }
    applyTheme(theme);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    }
  };

  return (
    <ThemeContext.Provider value={{ resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
