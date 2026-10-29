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

const STORAGE_KEY = 'truemargin-theme';
const FALLBACK_KEY = 'theme';
const THEME_CHANGE_EVENT = 'truemargin-theme-change';
const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )truemargin-theme=([^;]*)/);var v=m?decodeURIComponent(m[1]):localStorage.getItem('${STORAGE_KEY}')||localStorage.getItem('${FALLBACK_KEY}');var d=v==='dark';var el=document.documentElement;if(d){el.classList.add('dark');el.style.colorScheme='dark';document.cookie='${STORAGE_KEY}=dark; path=/; max-age=31536000; SameSite=Lax';document.cookie='${FALLBACK_KEY}=dark; path=/; max-age=31536000; SameSite=Lax';}else if(v==='light'){el.classList.remove('dark');el.style.colorScheme='light';document.cookie='${STORAGE_KEY}=light; path=/; max-age=31536000; SameSite=Lax';document.cookie='${FALLBACK_KEY}=light; path=/; max-age=31536000; SameSite=Lax';}if(typeof MutationObserver!=='undefined'){var mo=new MutationObserver(function(){var ck=document.cookie.match(/(?:^|; )truemargin-theme=([^;]*)/);var cur=ck?decodeURIComponent(ck[1]):(localStorage.getItem('${STORAGE_KEY}')||localStorage.getItem('${FALLBACK_KEY}'));if(cur==='dark'&&!el.classList.contains('dark')){el.classList.add('dark');el.style.colorScheme='dark';}});mo.observe(el,{attributes:true,attributeFilter:['class']});}}catch(e){}})();`;

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

let transitionTimer: ReturnType<typeof setTimeout> | null = null;

function enableThemeTransition() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.add('theme-transitioning');
  if (transitionTimer) clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => {
    root.classList.remove('theme-transitioning');
  }, 400);
}

function getThemeSnapshot(): Theme {
  try {
    if (typeof window !== 'undefined') {
      const stored =
        window.localStorage.getItem(STORAGE_KEY) ||
        window.localStorage.getItem(FALLBACK_KEY);
      if (stored === 'dark') return 'dark';
      if (stored === 'light') return 'light';
      if (document.documentElement.classList.contains('dark')) return 'dark';
    }
  } catch {
    // ignore
  }
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
  if (typeof document === 'undefined') return;
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = theme;
}

function persistTheme(theme: Theme) {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, theme);
      window.localStorage.setItem(FALLBACK_KEY, theme);
      // Set long-lived cookies for server layout rendering across route transitions
      document.cookie = `${STORAGE_KEY}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
      document.cookie = `${FALLBACK_KEY}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
    }
  } catch {
    // ignore
  }
}

export function ThemeProvider({
  children,
  initialTheme = 'light',
}: {
  children: ReactNode;
  initialTheme?: Theme;
}) {
  useServerInsertedHTML(() => (
    <script
      key="theme-init"
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  ));

  const resolvedTheme = useSyncExternalStore(
    subscribeToThemeChanges,
    getThemeSnapshot,
    () => initialTheme,
  );

  // Auto-sync cookie on client mount if absent
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const hasCookie = /(?:^|; )truemargin-theme=/.test(document.cookie);
      if (!hasCookie && resolvedTheme) {
        persistTheme(resolvedTheme);
      }
    }
  }, [resolvedTheme]);

  // Keep DOM class in sync
  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = (theme: Theme) => {
    persistTheme(theme);

    // Modern View Transitions API with fallback to CSS animation
    if (
      typeof document !== 'undefined' &&
      'startViewTransition' in document &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      (document as unknown as { startViewTransition: (cb: () => void) => void }).startViewTransition(() => {
        applyTheme(theme);
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      });
      return;
    }

    // Smooth CSS morph fallback for browsers without View Transitions
    enableThemeTransition();
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

