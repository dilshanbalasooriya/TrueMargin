'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';
import { getCurrencyLabel, getSupportedCurrencies } from '@/lib/currencies';

export function LoginModal({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const currencies = getSupportedCurrencies();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [currency, setCurrency] = useState('LKR');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  
  const supabase = createClient();

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

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    if (authError) {
      setError(t('authError'));
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-tight">
            {isSignUp ? t('createAccount') : t('signInToSave')}
          </DialogTitle>
          <DialogDescription>
            {isSignUp ? t('createDescription') : t('signInDescription')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-6 py-4">
          <Button 
            variant="outline" 
            type="button" 
            disabled={loading}
            onClick={handleGoogleLogin}
            className="w-full relative h-12 shadow-sm font-medium"
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
              <label htmlFor="auth-password" className="sr-only">{t('password')}</label>
              <Input 
                id="auth-password"
                type="password" 
                placeholder={t('password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="min-h-11"
              />
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
                      ? 'ගිණුමක් සාදා නැතිනම්, පහත ඇති "Sign up" ක්ලික් කර නව ගිණුමක් ලියාපදිංචි කරන්න.'
                      : "If you don't have an account yet, click 'Sign up' below to create one."}
                  </p>
                )}
              </div>
            )}
            {confirmation && <div role="status" className="text-sm text-muted-foreground">{t('emailConfirmation')}</div>}
            
            <Button type="submit" className="min-h-11 font-medium" disabled={loading || !email || !password || (isSignUp && !displayName.trim())}>
              {loading ? <Loader2 className="size-5 animate-spin" /> : (isSignUp ? t('signUp') : t('signIn'))}
            </Button>
          </form>
          
          <div className="text-center text-sm text-muted-foreground mt-2">
            {isSignUp ? `${t('alreadyAccount')} ` : `${t('noAccount')} `}
            <button 
              type="button" 
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setConfirmation(false);
              }}
              className="text-primary hover:underline font-medium"
            >
              {isSignUp ? t('signIn') : t('signUp')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
