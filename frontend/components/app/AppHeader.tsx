'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname, Link } from '@/i18n/routing';
import { useAuth } from '@/components/auth/AuthProvider';
import { LoginModal } from '@/components/auth/LoginModal';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/app/ThemeProvider';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeftRight, Calculator, FileText, LogOut, Moon, Sun } from 'lucide-react';
import { useState } from 'react';

export function AppHeader() {
  const locale = useLocale();
  const t = useTranslations('Navigation');
  const { user } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const dark = resolvedTheme === 'dark';

  const switchLocale = () => {
    router.replace(pathname, { locale: locale === 'en' ? 'si' : 'en' });
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

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="TrueMargin">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              TM
            </span>
            <span className="text-base font-semibold tracking-tight">TrueMargin</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main navigation">
            <Link
              href="/"
              className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Calculator className="size-4" aria-hidden="true" />
              {t('calculator')}
            </Link>
            <Link
              href="/sheets"
              className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <FileText className="size-4" aria-hidden="true" />
              {t('sheets')}
            </Link>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-10 min-w-10"
            onClick={switchLocale}
            aria-label={t('language')}
            title={t('language')}
          >
            <ArrowLeftRight className="size-4" aria-hidden="true" />
            <span className="sr-only">{t('language')}</span>
            <span className="text-xs font-semibold uppercase">{locale === 'en' ? 'සිං' : 'EN'}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-10 min-w-10"
            onClick={() => setTheme(dark ? 'light' : 'dark')}
            aria-label={t('theme')}
            title={t('theme')}
          >
            {dark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
          </Button>

          {user ? (
            <details className="relative" aria-label={t('account')}>
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md px-2.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                  {(user.email?.[0] ?? 'U').toUpperCase()}
                </span>
                <span className="hidden max-w-32 truncate md:inline">{user.email}</span>
              </summary>
              <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg">
                <p className="text-xs text-muted-foreground">{t('signedInAs')}</p>
                <p className="truncate text-sm font-medium">
                  {typeof user.user_metadata.display_name === 'string'
                    ? user.user_metadata.display_name
                    : user.email}
                </p>
                <p className="mb-3 truncate text-xs text-muted-foreground">{user.email}</p>
                <Link href="/account" className="mb-2 flex min-h-10 items-center rounded-md px-3 text-sm hover:bg-muted">
                  {t('account')}
                </Link>
                {signOutError && <p role="alert" className="mb-2 text-xs text-destructive">{t('signOutError')}</p>}
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10 w-full justify-start"
                  onClick={signOut}
                  disabled={loggingOut}
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  {t('signOut')}
                </Button>
              </div>
            </details>
          ) : (
            <LoginModal>
              <Button type="button" variant="outline" className="min-h-10 px-3">
                {t('signIn')}
              </Button>
            </LoginModal>
          )}
        </div>
      </div>
      <nav className="flex gap-1 border-t border-border/60 px-3 py-1 sm:hidden" aria-label="Mobile navigation">
        <Link href="/" className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md text-sm font-medium">
          <Calculator className="size-4" aria-hidden="true" />
          {t('calculator')}
        </Link>
        <Link href="/sheets" className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md text-sm font-medium text-muted-foreground">
          <FileText className="size-4" aria-hidden="true" />
          {t('sheets')}
        </Link>
      </nav>
    </header>
  );
}
