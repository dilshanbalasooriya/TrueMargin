'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/auth/AuthProvider';
import { LoginModal } from '@/components/auth/LoginModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { syncUserProfile } from '@/lib/api-client';
import type { UserProfile } from '@/lib/api-client';
import { LoaderCircle } from 'lucide-react';

export function AccountPage() {
  const t = useTranslations('Account');
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoadedUserId, setProfileLoadedUserId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const userId = user?.id;
  const loadingProfile = Boolean(userId && profileLoadedUserId !== userId);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void syncUserProfile()
      .then((userProfile) => {
        if (active) {
          setProfile(userProfile);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setProfileLoadedUserId(userId);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-12 pt-8 sm:px-6 sm:pt-10">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('title')}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('description')}</p>
        </div>

        {authLoading || loadingProfile ? (
          <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {t('loading')}
          </div>
        ) : !user ? (
          <Card className="items-start p-5">
            <p className="text-sm text-muted-foreground">{t('signInRequired')}</p>
            <LoginModal>
              <Button type="button" className="mt-4 min-h-11">{t('signIn')}</Button>
            </LoginModal>
          </Card>
        ) : error || !profile || profileLoadedUserId !== userId ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{t('loadError')}</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <Card className="items-start p-5 sm:p-6">
              <h2 className="text-base font-semibold">{t('profileTitle')}</h2>
              <dl className="mt-5 w-full space-y-4">
                <ProfileField label={t('name')} value={profile.display_name} />
                <ProfileField label={t('email')} value={user.email ?? '—'} />
                <ProfileField label={t('country')} value={profile.country ?? '—'} />
                <ProfileField label={t('currency')} value={profile.currency} />
              </dl>
            </Card>

            <Card className="items-start p-5 sm:p-6">
              <h2 className="text-base font-semibold">{t('workspaceTitle')}</h2>
              {profile.workspaces.length ? (
                <dl className="mt-5 w-full space-y-4">
                  {profile.workspaces.map((workspace) => (
                    <div key={workspace.id} className="border-b border-border pb-4 last:border-0">
                      <ProfileField label={t('workspace')} value={workspace.name} />
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <ProfileField label={t('role')} value={workspace.role} />
                        <ProfileField label={t('currency')} value={workspace.currency} />
                      </div>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">{t('noWorkspace')}</p>
              )}
            </Card>
          </div>
        )}
      </main>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
    </div>
  );
}
