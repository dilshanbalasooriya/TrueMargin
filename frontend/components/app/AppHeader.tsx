'use client';

import { useState, useSyncExternalStore } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname, Link } from '@/i18n/routing';
import { useAuth } from '@/components/auth/AuthProvider';
import { LoginModal } from '@/components/auth/LoginModal';
import { useSidebarStore } from '@/store/useSidebarStore';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/app/ThemeProvider';
import { createClient } from '@/lib/supabase/client';
import {
  ChevronDown,
  FileText,
  LogOut,
  Menu,
  Moon,
  Sun,
  User,
} from 'lucide-react';
import { cn } from 'cn';

export function AppHeader() {
  const locale = useLocale();
  const t = useTranslations('Navigation');
  const { user } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { toggleMobileOpen } = useSidebarStore();

  const [loggingOut, setLoggingOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);

  const mounted = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false,
  );

  const dark = mounted ? resolvedTheme === 'dark' : false;

  const switchLocale = (targetLocale: 'en' | 'si') => {
    if (locale === targetLocale) return;
    router.replace(pathname, { locale: targetLocale });
  };

  const signOut = async () => {
    setLoggingOut(true);
    setSignOutError(false);
    const { error } = await createClient().auth.signOut();
    if (error) {
      setLoggingOut(false);
      setSignOutError(true);
      return;
    }
    router.replace('/');
    router.refresh();
  };

  const displayName =
    typeof user?.user_metadata?.display_name === 'string' && user.user_metadata.display_name.trim()
      ? user.user_metadata.display_name
      : user?.email?.split('@')[0] || '';

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md supports-backdrop-filter:bg-background/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          {/* Left section: Mobile hamburger + TrueMargin Brand Title */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="flex md:hidden size-9 rounded-lg text-foreground hover:bg-muted active:scale-95 transition-all shrink-0"
              onClick={toggleMobileOpen}
              aria-label={t('menu')}
              title={t('menu')}
            >
              <Menu className="size-5" aria-hidden="true" />
            </Button>

            <Link
              href="/"
              className="flex h-9 items-center group transition-opacity hover:opacity-90 select-none"
            >
              <span className="text-base sm:text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                TrueMargin
              </span>
            </Link>
          </div>

          {/* Right section: Language Pill + Dark Mode Toggle + User Profile */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            {/* Segmented Language Pill: Unified h-9 height */}
            <div
              className="flex h-9 items-center rounded-lg border border-border/80 bg-muted/60 p-0.5 text-xs font-semibold shadow-xs"
              role="group"
              aria-label={t('language')}
            >
              <button
                type="button"
                onClick={() => switchLocale('en')}
                className={cn(
                  'h-full px-2.5 rounded-md transition-all text-xs flex items-center justify-center font-medium',
                  locale === 'en'
                    ? 'bg-background text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={locale === 'en'}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => switchLocale('si')}
                className={cn(
                  'h-full px-2.5 rounded-md transition-all font-sinhala text-xs flex items-center justify-center font-medium',
                  locale === 'si'
                    ? 'bg-background text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                aria-pressed={locale === 'si'}
              >
                සිං
              </button>
            </div>

            {/* Dark / Light Mode Toggle */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 rounded-lg hover:bg-muted transition-all"
              onClick={() => setTheme(dark ? 'light' : 'dark')}
              aria-label={t('theme')}
              title={dark ? t('lightMode') : t('darkMode')}
              suppressHydrationWarning
            >
              {dark ? (
                <Sun className="size-4.5 text-amber-400 transition-transform duration-200 rotate-0 hover:rotate-45" aria-hidden="true" />
              ) : (
                <Moon className="size-4.5 text-slate-700 dark:text-slate-300 transition-transform duration-200 rotate-0 hover:-rotate-12" aria-hidden="true" />
              )}
            </Button>

            {/* Auth: User Profile or Sign In */}
            {user ? (
              <details className="relative" aria-label={t('account')}>
                <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-2.5 text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shadow-xs">
                    {(user.email?.[0] ?? 'U').toUpperCase()}
                  </span>
                  <span className="hidden max-w-28 truncate font-medium md:inline text-foreground">
                    {displayName}
                  </span>
                  <ChevronDown className="size-3 text-muted-foreground" aria-hidden="true" />
                </summary>

                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 z-50">
                  <div className="mb-2.5 border-b border-border/70 pb-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('signedInAs')}
                    </p>
                    <p className="truncate text-sm font-semibold text-foreground">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>

                  <Link
                    href="/account"
                    className="flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <User className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>{t('account')}</span>
                  </Link>
                  <Link
                    href="/sheets"
                    className="flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <FileText className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>{t('sheets')}</span>
                  </Link>

                  {signOutError && (
                    <p role="alert" className="my-2 rounded bg-destructive/10 p-1.5 text-xs text-destructive">
                      {t('signOutError')}
                    </p>
                  )}

                  <div className="my-1.5 border-t border-border/70" />

                  <button
                    type="button"
                    className="flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    onClick={signOut}
                    disabled={loggingOut}
                  >
                    <LogOut className="size-3.5" aria-hidden="true" />
                    <span>{t('signOut')}</span>
                  </button>
                </div>
              </details>
            ) : (
              <LoginModal>
                <Button type="button" className="min-h-9 px-3.5 text-xs font-semibold shadow-xs">
                  {t('signIn')}
                </Button>
              </LoginModal>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
