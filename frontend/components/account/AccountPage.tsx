'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/components/auth/AuthProvider';
import { LoginModal } from '@/components/auth/LoginModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  listCostSheets,
  syncUserProfile,
  type UserProfile,
} from '@/lib/api-client';
import { createClient } from '@/lib/supabase/client';
import { useRouter, Link } from '@/i18n/routing';
import { toast } from '@/store/useToast';
import {
  Briefcase,
  Building2,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Globe,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { SignOutConfirmModal } from '@/components/account/SignOutConfirmModal';
import { cn } from 'cn';

const POPULAR_CURRENCIES = [
  'LKR',
  'USD',
  'EUR',
  'GBP',
  'AUD',
  'CAD',
  'INR',
  'SGD',
  'AED',
  'MYR',
  'JPY',
  'CNY',
];

export function AccountPage() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('Account');
  const navT = useTranslations('Navigation');
  const authT = useTranslations('Auth');
  const { user, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoadedUserId, setProfileLoadedUserId] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState(false);

  // Profile Edit State
  const [displayName, setDisplayName] = useState('');
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('LKR');
  const [savingProfile, setSavingProfile] = useState(false);

  // Security / Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Activity Stats State
  const [sheetCount, setSheetCount] = useState<number | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);

  const userId = user?.id;
  const isSi = locale === 'si';

  // Load User Profile and Sheets Count
  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoadingProfile(true);

    syncUserProfile()
      .then((userProfile) => {
        if (!active) return;
        setProfile(userProfile);
        setDisplayName(userProfile.display_name || '');
        setCountry(userProfile.country || '');
        setCurrency(userProfile.currency || 'LKR');
        setError(false);

        const primaryWorkspace = userProfile.workspaces[0];
        if (primaryWorkspace) {
          return listCostSheets(primaryWorkspace.id);
        }
        return [];
      })
      .then((sheets) => {
        if (active && sheets) {
          setSheetCount(sheets.length);
        }
      })
      .catch((err) => {
        console.error('Failed to load profile details:', err);
        if (active) setError(true);
      })
      .finally(() => {
        if (active) {
          setLoadingProfile(false);
          setProfileLoadedUserId(userId);
        }
      });

    return () => {
      active = false;
    };
  }, [userId]);

  // Handle Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);

    try {
      const updated = await syncUserProfile({
        display_name: displayName.trim(),
        country: country.trim() || undefined,
        currency: currency.trim().toUpperCase(),
      });
      setProfile(updated);
      toast.success(t('profileUpdated'));
    } catch (err) {
      console.error('Failed to update profile:', err);
      toast.error(t('profileUpdateError'));
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Password Update
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error(
        isSi
          ? 'මුරපදය අවම වශයෙන් අක්ෂර 6කින් සමන්විත විය යුතුය.'
          : 'Password must be at least 6 characters long.',
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(authT('passwordsDoNotMatch'));
      return;
    }

    setUpdatingPassword(true);
    try {
      const supabase = createClient();
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) throw updateErr;

      setNewPassword('');
      setConfirmPassword('');
      toast.success(t('passwordChanged'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('passwordError');
      toast.error(msg);
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Handle Confirmed Sign Out
  const handleConfirmSignOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.persist('success', navT('signOutSuccess'));
      toast.success(navT('signOutSuccess'));
      window.location.href = `/${locale}`;
    } catch {
      toast.error(navT('signOutError'));
      setSigningOut(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'TM';
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pt-10">
      {/* Executive Profile Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-8 shadow-xs mb-8">
        <div className="absolute -top-12 -right-12 size-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* User Avatar with Glowing Ring */}
            <div className="relative flex size-16 sm:size-18 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-blue-600 text-primary-foreground text-xl font-extrabold shadow-lg shadow-primary/20 ring-4 ring-primary/10">
              {user ? getInitials(profile?.display_name || user.email) : 'TM'}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                  {profile?.display_name || user?.email?.split('@')[0] || t('title')}
                </h1>
                {user && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="size-3.5" />
                    <span>{isSi ? 'සත්‍යාපිත සාමාජික' : 'Verified Member'}</span>
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                <Mail className="size-3.5 text-muted-foreground/70" />
                <span>{user?.email || t('description')}</span>
              </p>
            </div>
          </div>

          {/* Header Quick Action */}
          {user && (
            <div className="shrink-0 flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={signingOut}
                onClick={() => setSignOutModalOpen(true)}
                className="gap-2 rounded-xl border-destructive/20 text-destructive bg-destructive/5 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive h-9 px-3.5 font-semibold text-xs shadow-2xs transition-all active:scale-95 cursor-pointer"
              >
                {signingOut ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <LogOut className="size-3.5" />
                )}
                <span>{t('signOut')}</span>
              </Button>
            </div>
          )}
        </div>

        {/* Quick Stats Pill Row */}
        {user && profile && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-border/60 pt-5">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <FileSpreadsheet className="size-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{t('totalSheets')}</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-foreground">
                    {sheetCount !== null ? sheetCount : '…'}
                  </p>
                  <Link
                    href="/sheets"
                    className="text-[11px] font-medium text-primary hover:underline flex items-center"
                  >
                    <ChevronRight className="size-3" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Globe className="size-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{t('currency')}</p>
                <p className="text-sm font-bold text-foreground font-mono">{currency}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                <Building2 className="size-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{t('workspace')}</p>
                <p className="text-sm font-bold text-foreground truncate max-w-28">
                  {profile.workspaces[0]?.name || 'Default'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                <Briefcase className="size-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{t('role')}</p>
                <p className="text-sm font-bold text-foreground capitalize">
                  {profile.workspaces[0]?.role || 'Owner'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {authLoading || loadingProfile ? (
        /* Rich Multi-card Skeleton Loader */
        <div className="space-y-6" aria-label={t('loading')}>
          <div className="grid gap-6 lg:grid-cols-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-border/70 bg-card p-6 shadow-xs animate-pulse space-y-4"
              >
                <div className="flex items-center gap-3 pb-4 border-b border-border/60">
                  <div className="size-9 rounded-xl bg-muted-foreground/20" />
                  <div className="h-5 w-36 rounded-md bg-muted-foreground/20" />
                </div>
                <div className="space-y-3 pt-2">
                  <div className="h-4 w-24 rounded bg-muted-foreground/15" />
                  <div className="h-10 w-full rounded-xl bg-muted-foreground/10" />
                  <div className="h-4 w-24 rounded bg-muted-foreground/15" />
                  <div className="h-10 w-full rounded-xl bg-muted-foreground/10" />
                  <div className="h-10 w-32 rounded-xl bg-muted-foreground/20 pt-2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !user ? (
        /* Sign In Callout */
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 sm:p-10 text-center shadow-xs">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 ring-8 ring-primary/5">
            <UserIcon className="size-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            {isSi ? 'ගිණුමට පිවිසෙන්න' : 'Sign in to Your Account'}
          </h2>
          <p className="mx-auto mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">
            {t('signInRequired')}
          </p>
          <div className="mt-6 flex justify-center">
            <LoginModal>
              <Button type="button" className="min-h-11 px-6 font-semibold rounded-xl shadow-md">
                {t('signIn')}
              </Button>
            </LoginModal>
          </div>
        </div>
      ) : error || !profile ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/20 bg-destructive/10 p-5 text-sm text-destructive text-center"
        >
          {t('loadError')}
        </div>
      ) : (
        <div className="space-y-7">
          <div className="grid gap-7 lg:grid-cols-2">
            {/* Section 1: Edit Profile */}
            <Card className="rounded-3xl border border-border/80 bg-card p-6 sm:p-7 shadow-xs">
              <div className="flex items-center gap-3 pb-4 border-b border-border/70">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-2xs">
                  <UserIcon className="size-4.5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {t('profileTitle')}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isSi ? 'ඔබගේ පුද්ගලික තොරතුරු සහ පෙරනිමි අගයන්' : 'Personal information and defaults'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
                {/* Display Name */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="account-display-name"
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                  >
                    {t('name')}
                  </label>
                  <Input
                    id="account-display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Dilshan Balasooriya"
                    required
                    className="h-10 text-sm rounded-xl"
                  />
                </div>

                {/* Email (Read-only) */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="account-email"
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                  >
                    {t('email')}
                  </label>
                  <Input
                    id="account-email"
                    type="email"
                    value={user.email ?? ''}
                    disabled
                    className="h-10 text-sm rounded-xl bg-muted/40 cursor-not-allowed opacity-80"
                  />
                </div>

                {/* Country */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="account-country"
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                  >
                    <Globe className="size-3.5 text-muted-foreground" />
                    {t('country')}
                  </label>
                  <Input
                    id="account-country"
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. Sri Lanka"
                    className="h-10 text-sm rounded-xl"
                  />
                </div>

                {/* Currency */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="account-currency"
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                  >
                    {t('currency')}
                  </label>
                  <select
                    id="account-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="flex h-10 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                  >
                    {POPULAR_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={savingProfile}
                    className="h-10 px-5 gap-2 font-semibold rounded-xl shadow-xs cursor-pointer active:scale-95 transition-all"
                  >
                    {savingProfile ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    {savingProfile ? t('savingChanges') : t('saveChanges')}
                  </Button>
                </div>
              </form>
            </Card>

            {/* Section 2: Security & Change Password */}
            <Card className="rounded-3xl border border-border/80 bg-card p-6 sm:p-7 shadow-xs">
              <div className="flex items-center gap-3 pb-4 border-b border-border/70">
                <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-2xs">
                  <KeyRound className="size-4.5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {t('securityTitle')}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isSi ? 'ගිණුමේ මුරපදය සහ පිවිසුම් ආරක්ෂාව' : 'Password and session security'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleUpdatePassword} className="mt-5 space-y-4">
                {/* New Password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="account-new-password"
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                  >
                    {t('newPassword')}
                  </label>
                  <div className="relative">
                    <Input
                      id="account-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="h-10 pr-10 text-sm rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-hidden"
                      aria-label={showNewPassword ? authT('hidePassword') : authT('showPassword')}
                    >
                      {showNewPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="account-confirm-password"
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                  >
                    {t('confirmNewPassword')}
                  </label>
                  <div className="relative">
                    <Input
                      id="account-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="h-10 pr-10 text-sm rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-hidden"
                      aria-label={showConfirmPassword ? authT('hidePassword') : authT('showPassword')}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                  {isSi
                    ? 'මුරපදය අවම වශයෙන් අක්ෂර 6කින් සමන්විත විය යුතුය. ආරක්ෂාව සඳහා අකුරු සහ ඉලක්කම් මිශ්‍රණයක් භාවිත කරන්න.'
                    : 'Minimum 6 characters. Use a mix of letters and numbers for higher safety.'}
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={updatingPassword || !newPassword}
                    variant="outline"
                    className="h-10 px-5 gap-2 font-semibold rounded-xl cursor-pointer active:scale-95 transition-all"
                  >
                    {updatingPassword ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <KeyRound className="size-4" />
                    )}
                    {updatingPassword ? t('updatingPassword') : t('changePassword')}
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          {/* Section 3: Workspaces */}
          <Card className="rounded-3xl border border-border/80 bg-card p-6 sm:p-7 shadow-xs">
            <div className="flex items-center gap-3 pb-4 border-b border-border/70">
              <span className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-2xs">
                <Building2 className="size-4.5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {t('workspaceTitle')}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isSi ? 'ඔබ සම්බන්ධ වී ඇති ආයතනික වැඩ අවකාශ' : 'Connected business environments'}
                </p>
              </div>
            </div>

            {profile.workspaces.length > 0 ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {profile.workspaces.map((ws) => (
                  <div
                    key={ws.id}
                    className="rounded-2xl border border-border/80 bg-muted/20 p-4.5 transition-all hover:border-primary/40 hover:bg-muted/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Briefcase className="size-4 text-primary" />
                        <h4 className="text-sm font-bold text-foreground">{ws.name}</h4>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary capitalize">
                        {ws.role}
                      </span>
                    </div>

                    <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">{t('currency')}:</span>{' '}
                        <strong className="text-foreground font-mono">{ws.currency}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('role')}:</span>{' '}
                        <strong className="text-foreground capitalize">{ws.role}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">{t('noWorkspace')}</p>
            )}
          </Card>

          {/* Section 4: Session & Danger Zone */}
          <Card className="rounded-3xl border border-destructive/20 bg-destructive/5 p-6 sm:p-7 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3.5">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mt-0.5">
                  <LogOut className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {isSi ? 'ක්‍රියාකාරී සැසියෙන් ඉවත් වීම' : 'Active Account Session'}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground max-w-lg leading-relaxed">
                    {isSi
                      ? 'මෙම උපාංගයේ ඔබගේ TrueMargin සැසියෙන් ඉවත් වන්න. ඔබගේ සුරැකි පිරිවැය පත්‍ර සහ ඉතිහාසය වලාකුළේ සුරක්ෂිතව පවතිනු ඇත.'
                      : 'Sign out of your active TrueMargin session on this browser. All your saved calculations and version history remain securely saved in the cloud.'}
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  disabled={signingOut}
                  onClick={() => setSignOutModalOpen(true)}
                  className="rounded-xl border-destructive/30 text-destructive bg-card hover:bg-destructive hover:text-destructive-foreground hover:border-destructive h-10 px-4 font-semibold text-xs sm:text-sm shadow-2xs transition-all active:scale-95 cursor-pointer"
                >
                  <LogOut className="size-4" />
                  <span>{t('signOut')}</span>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Modern Custom Sign Out Confirmation Modal */}
      <SignOutConfirmModal
        open={signOutModalOpen}
        onOpenChange={setSignOutModalOpen}
        onConfirm={handleConfirmSignOut}
        signingOut={signingOut}
      />
    </main>
  );
}
