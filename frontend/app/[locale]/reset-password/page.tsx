'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock } from 'lucide-react';
import { toast } from '@/store/useToast';

export default function ResetPasswordPage() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message || t('authError'));
      } else {
        setSuccess(true);
        toast.success(t('passwordUpdated'));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('authError');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-140px)] w-full max-w-md items-center justify-center px-4 py-12">
      <Card className="w-full p-6 sm:p-8 shadow-md border-border/80">
        {success ? (
          <div className="flex flex-col items-center text-center space-y-4 py-4">
            <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="size-7" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {t('passwordUpdated')}
            </h1>
            <p className="text-sm text-muted-foreground">
              Your new password is now active. You can continue using TrueMargin securely.
            </p>
            <div className="pt-2 w-full flex flex-col gap-2">
              <Link
                href="/"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Go to Calculator
              </Link>
              <Link
                href="/account"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium hover:bg-muted/60 transition-colors"
              >
                Go to Account
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div className="space-y-2">
              <div className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-1">
                <Lock className="size-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Set New Password
              </h1>
              <p className="text-sm text-muted-foreground">
                Create a strong password of at least 8 characters for your TrueMargin account.
              </p>
            </div>

            <div className="space-y-4">
              {/* New Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="new-password"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  {t('newPassword')}
                </label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="••••••••"
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
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="confirm-password"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  {t('confirmPassword')}
                </label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    className="min-h-11 pr-11"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirm((prev) => !prev)}
                    aria-label={showConfirm ? t('hidePassword') : t('showPassword')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    {showConfirm ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive font-medium">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full min-h-11 font-medium text-base gap-2"
              disabled={loading || !password || !confirmPassword}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <KeyRound className="size-4" />
                  {t('updatePasswordAction')}
                </>
              )}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
