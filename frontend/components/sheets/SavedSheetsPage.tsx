'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AppHeader } from '@/components/app/AppHeader';
import { LoginModal } from '@/components/auth/LoginModal';
import { useAuth } from '@/components/auth/AuthProvider';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { downloadVersionReport, listCostSheets, syncUserProfile } from '@/lib/api-client';
import type { CostSheet } from '@/lib/api-client';
import { ArrowDownToLine, LoaderCircle, Printer } from 'lucide-react';

export function SavedSheetsPage() {
  const t = useTranslations('Sheets');
  const locale = useLocale();
  const { user, loading: authLoading } = useAuth();
  const [sheets, setSheets] = useState<CostSheet[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [reportError, setReportError] = useState(false);

  const userId = user?.id;
  const loadingSheets = Boolean(userId && loadedUserId !== userId);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    void syncUserProfile()
      .then((profile) => {
        const workspaceId = profile.workspaces[0]?.id;
        if (!workspaceId) throw new Error('No workspace found.');
        return listCostSheets(workspaceId);
      })
      .then((items) => {
        if (active) {
          setSheets(items);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoadedUserId(userId);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  const downloadCsv = async (sheet: CostSheet) => {
    const versionId = sheet.current_version?.id;
    if (!versionId) return;
    setReportError(false);
    try {
      const blob = await downloadVersionReport(versionId, 'csv');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sheet.name || 'truemargin'}-v${sheet.current_version?.version_number}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setReportError(true);
    }
  };

  const openPrintView = async (sheet: CostSheet) => {
    const versionId = sheet.current_version?.id;
    if (!versionId) return;
    setReportError(false);
    const reportWindow = window.open('about:blank', '_blank');
    if (!reportWindow) {
      setReportError(true);
      return;
    }
    try {
      const blob = await downloadVersionReport(versionId, 'pdf');
      reportWindow.location.href = URL.createObjectURL(blob);
    } catch {
      reportWindow.close();
      setReportError(true);
    }
  };

  const formatMoney = (value: string, currencyCode: string) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: 2,
      }).format(Number(value));
    } catch {
      return `${currencyCode} ${value}`;
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 pb-12 pt-8 sm:px-6 sm:pt-10">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('title')}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('description')}</p>
        </div>

        {reportError && (
          <p role="status" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{t('reportError')}</p>
        )}

        {authLoading || loadingSheets ? (
          <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {t('loading')}
          </div>
        ) : !user ? (
          <Card className="items-start p-5 sm:p-7">
            <p className="text-sm text-muted-foreground">{t('signInRequired')}</p>
            <LoginModal>
              <Button type="button" className="mt-4 min-h-11">{t('signIn')}</Button>
            </LoginModal>
          </Card>
        ) : error ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{t('loadError')}</p>
        ) : sheets.length === 0 ? (
          <Card className="items-start p-5 sm:p-7">
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
            <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              {t('openCalculator')}
            </Link>
          </Card>
        ) : (
          <div className="space-y-3">
            {sheets.map((sheet) => {
              const version = sheet.current_version;
              return (
                <Card key={sheet.id} className="gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">{sheet.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {version
                        ? `${t('version', { number: version.version_number })} · ${formatMoney(version.unit_cost, version.currency_code)} / ${sheet.unit_label}`
                        : t('noVersion')}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={!version}
                      onClick={() => void downloadCsv(sheet)}
                    >
                      <ArrowDownToLine className="size-4" aria-hidden="true" />
                      {t('downloadCsv')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={!version}
                      onClick={() => void openPrintView(sheet)}
                    >
                      <Printer className="size-4" aria-hidden="true" />
                      {t('printReport')}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
