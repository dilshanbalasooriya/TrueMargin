'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { getCurrencyLabel, getSupportedCurrencies } from '@/lib/currencies';
import { toast } from '@/store/useToast';

export function LoginModal({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const currencies = getSupportedCurrencies();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [currency, setCurrency] = useState('LKR');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot_password'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const supabase = createClient();
  const isSignUp = mode === 'signup';
  const isForgotPassword = mode === 'forgot_password';

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setConfirmation(false);

    try {
      if (isSignUp) {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName, currency } },
        });
        if (authError) {
          setError(authError.message || t('authError'));
        } else if (!data.session) {
          setConfirmation(true);
        } else {
          toast.persist('success', t('signInSuccess'));
          toast.success(t('signInSuccess'));
          window.location.reload();
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) {
          setError(authError.message || t('authError'));
        } else {
          toast.persist('success', t('signInSuccess'));
          toast.success(t('signInSuccess'));
          window.location.reload();
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('authError');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResetSent(false);

    try {
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
      });
      if (resetError) {
        setError(resetError.message || t('authError'));
      } else {
        setResetSent(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('authError');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
      },
    });
    if (authError) {
      setError(t('authError'));
      setLoading(false);
    }
  };

  const switchMode = (newMode: 'signin' | 'signup' | 'forgot_password') => {
    setMode(newMode);
    setError(null);
    setConfirmation(false);
    setResetSent(false);
  };

  return (
    <Dialog>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-tight">
            {isForgotPassword
              ? t('resetPasswordTitle')
              : isSignUp
              ? t('createAccount')
              : t('signInToSave')}
          </DialogTitle>
          <DialogDescription>
            {isForgotPassword
              ? t('resetPasswordDesc')
              : isSignUp
              ? t('createDescription')
              : t('signInDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-3">
          {/* Forgot Password View */}
          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="flex flex-col gap-3">
              <div className="space-y-2">
                <label htmlFor="reset-email" className="text-xs font-semibold text-muted-foreground">{t('email')}</label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder={t('email')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="min-h-11"
                />
              </div>

              {error && (
                <div className="text-destructive text-sm font-medium">{error}</div>
              )}

              {resetSent && (
                <div role="status" className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                  {t('resetLinkSent')}
                </div>
              )}

              <Button
                type="submit"
                className="min-h-11 font-medium mt-1"
                disabled={loading || !email}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <KeyRound className="size-4" />
                    {t('sendResetLink')}
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => switchMode('signin')}
                className="mt-2 inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-medium"
              >
                <ArrowLeft className="size-3.5" />
                {t('backToSignIn')}
              </button>
            </form>
          ) : (
            /* Sign In & Sign Up View */
            <>
              <Button
                variant="outline"
                type="button"
                disabled={loading}
                onClick={handleGoogleLogin}
                className="w-full relative h-12 shadow-xs font-medium"
              >
                <svg className="w-5 h-5 absolute left-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  <path d="M1 1h22v22H1z" fill="none" />
                </svg>
                {t('continueGoogle')}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t('orEmail')}
                  </span>
                </div>
              </div>

              <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
                <div className="space-y-2">
                  {isSignUp && (
                    <>
                      <label htmlFor="auth-display-name" className="sr-only">{t('displayName')}</label>
                      <Input
                        id="auth-display-name"
                        type="text"
                        placeholder={t('displayName')}
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        required
                        minLength={2}
                        className="min-h-11"
                      />
                    </>
                  )}
                  <label htmlFor="auth-email" className="sr-only">{t('email')}</label>
                  <Input
                    id="auth-email"
                    type="email"
                    placeholder={t('email')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="min-h-11"
                  />

                  {/* Password with View Toggle */}
                  <div className="relative">
                    <label htmlFor="auth-password" className="sr-only">{t('password')}</label>
                    <Input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('password')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="min-h-11 pr-11"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  {!isSignUp && (
                    <div className="flex justify-end pt-0.5">
                      <button
                        type="button"
                        onClick={() => switchMode('forgot_password')}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        {t('forgotPassword')}
                      </button>
                    </div>
                  )}

                  {isSignUp && (
                    <>
                      <label htmlFor="auth-currency" className="block pt-1 text-sm font-medium">{t('currency')}</label>
                      <select
                        id="auth-currency"
                        value={currency}
                        onChange={(event) => setCurrency(event.target.value)}
                        className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {currencies.map((code) => (
                          <option key={code} value={code}>{getCurrencyLabel(code, locale)}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>

                {error && (
                  <div className="space-y-1">
                    <div className="text-destructive text-sm font-medium">{error}</div>
                    {error.toLowerCase().includes('invalid login credentials') && (
                      <p className="text-xs text-muted-foreground">
                        {locale === 'si'
                          ? 'ගිණුමක් සාදා නැතිනම්, පහත ඇති "ගිණුම සාදන්න" ක්ලික් කර නව ගිණුමක් ලියාපදිංචි කරන්න.'
                          : "If you don't have an account yet, click 'Create account' below to register."}
                      </p>
                    )}
                  </div>
                )}
                {confirmation && <div role="status" className="text-sm text-muted-foreground">{t('emailConfirmation')}</div>}

                <Button
                  type="submit"
                  className="min-h-11 font-medium mt-1"
                  disabled={loading || !email || !password || (isSignUp && !displayName.trim())}
                >
                  {loading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : isSignUp ? (
                    t('signUp')
                  ) : (
                    t('signIn')
                  )}
                </Button>
              </form>

              <div className="text-center text-sm text-muted-foreground mt-1">
                {isSignUp ? `${t('alreadyAccount')} ` : `${t('noAccount')} `}
                <button
                  type="button"
                  onClick={() => switchMode(isSignUp ? 'signin' : 'signup')}
                  className="text-primary hover:underline font-medium"
                >
                  {isSignUp ? t('signIn') : t('signUp')}
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

