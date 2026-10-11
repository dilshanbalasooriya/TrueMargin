'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AppHeader } from '@/components/app/AppHeader';
import { BucketCard } from '@/components/calculator/BucketCard';
import { CostSheetSetup } from '@/components/calculator/CostSheetSetup';
import { MobileResultBar } from '@/components/calculator/MobileResultBar';
import { PricingControls } from '@/components/calculator/PricingControls';
import { ResultsPanel } from '@/components/calculator/ResultsPanel';
import { ApiError, calculateCostSheet, downloadVersionReport, saveCostSheet, syncUserProfile } from '@/lib/api-client';
import { isValidCurrencyCode } from '@/lib/currencies';
import { parseDecimalInput } from '@/lib/numbers';
import { useCalculatorStore } from '@/store/useCalculatorStore';
import { useAuth } from '@/components/auth/AuthProvider';
import type { CalculationResult } from '@/lib/api-client';
import type { BucketDraft, GuestDraft } from '@/store/useCalculatorStore';

const BUCKETS = [
  { key: 'material', titleKey: 'materials', questionKey: 'materialsQuestion' },
  { key: 'labor', titleKey: 'labor', questionKey: 'laborQuestion' },
  { key: 'transport', titleKey: 'transport', questionKey: 'transportQuestion' },
  { key: 'overhead', titleKey: 'overhead', questionKey: 'overheadQuestion' },
  { key: 'machinery', titleKey: 'machinery', questionKey: 'machineryQuestion' },
  { key: 'custom_fees', titleKey: 'customFees', questionKey: 'customFeesQuestion' },
] as const;

type CalculationError = 'offline' | 'stale' | 'invalid' | 'failed';

function hasValidNumber(value: string, locale: string, optional = false): boolean {
  if (value.trim() === '') return optional;
  return parseDecimalInput(value, locale) !== null;
}

function isValidDraft(draft: GuestDraft, locale: string): boolean {
  const unitsProduced = parseDecimalInput(draft.unitsProduced, locale);
  const defectiveUnits = draft.defectiveUnits.trim() === '' ? 0 : parseDecimalInput(draft.defectiveUnits, locale);
  const pricingPercentage = parseDecimalInput(draft.pricingPercentage, locale);
  if (unitsProduced === null || defectiveUnits === null || pricingPercentage === null) return false;
  if (!Number.isFinite(unitsProduced) || unitsProduced <= 0) return false;
  if (!Number.isFinite(defectiveUnits) || defectiveUnits < 0 || defectiveUnits >= unitsProduced) return false;
  if (!Number.isFinite(pricingPercentage) || pricingPercentage < 0) return false;
  if (draft.pricingType === 'margin' && pricingPercentage >= 100) return false;
  if (!isValidCurrencyCode(draft.currencyCode)) return false;

  for (const bucket of Object.values(draft.buckets)) {
    const bucketCoverage = bucket.unitsCovered.trim()
      ? parseDecimalInput(bucket.unitsCovered, locale)
      : null;
    if (bucket.totalSpent.trim() && !hasValidNumber(bucket.totalSpent, locale)) return false;
    if (bucket.unitsCovered.trim() && (bucketCoverage === null || bucketCoverage <= 0)) return false;
    for (const item of bucket.items) {
      if (item.name.trim() || item.amount.trim() || item.unitsCovered.trim()) {
        const itemCoverage = item.unitsCovered.trim()
          ? parseDecimalInput(item.unitsCovered, locale)
          : null;
        if (!item.name.trim() || !hasValidNumber(item.amount, locale) || !item.amount.trim()) return false;
        if (item.unitsCovered.trim() && (itemCoverage === null || itemCoverage <= 0)) return false;
      }
    }
  }
  return true;
}

function bucketIsAnswered(bucket: BucketDraft | undefined): boolean {
  return Boolean(
    bucket?.isNone
    || bucket?.totalSpent.trim()
    || bucket?.items.some((item) => item.name.trim() && item.amount.trim()),
  );
}

export function CalculatorPage() {
  const locale = useLocale();
  const pageT = useTranslations('Index');
  const t = useTranslations('Calculator');
  const {
    draft,
    hydrated,
    updateDraft,
    updateBucket,
  } = useCalculatorStore();
  const { user } = useAuth();

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculationError, setCalculationError] = useState<CalculationError | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [reportError, setReportError] = useState(false);
  const requestSequence = useRef(0);
  const profileUserId = useRef<string | null>(null);
  const resultRef = useRef<CalculationResult | null>(null);

  const answeredCount = useMemo(
    () => BUCKETS.filter(({ key }) => bucketIsAnswered(draft.buckets[key])).length,
    [draft.buckets],
  );
  const unansweredCount = BUCKETS.length - answeredCount;
  const partial = unansweredCount > 0;

  useEffect(() => {
    void useCalculatorStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (!hydrated || !user) {
      profileUserId.current = null;
      return;
    }
    if (profileUserId.current === user.id) return;
    profileUserId.current = user.id;

    void syncUserProfile()
      .then((profile) => {
        const workspace = profile.workspaces[0];
        if (!workspace) {
          setProfileError(true);
          return;
        }
        updateDraft({
          workspaceId: workspace.id,
          ...(!draft.currencyOverridden && !draft.sheetId
          ? { currencyCode: (workspace.currency || profile.currency).toUpperCase() }
            : {}),
        });
        setProfileError(false);
      })
      .catch(() => setProfileError(true));
  }, [draft.currencyOverridden, draft.sheetId, hydrated, updateDraft, user]);

  useEffect(() => {
    if (!hydrated) return;

    const answered = BUCKETS.some(({ key }) => bucketIsAnswered(draft.buckets[key]));
    const started = Boolean(draft.unitsProduced.trim() || draft.defectiveUnits.trim() || answered);
    if (!started || !answered || !isValidDraft(draft, locale)) return;

    const controller = new AbortController();
    const sequence = ++requestSequence.current;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setCalculationError(null);
      void calculateCostSheet(draft, locale, controller.signal)
        .then((calculation) => {
          if (sequence !== requestSequence.current) return;
          resultRef.current = calculation;
          setResult(calculation);
          setCalculationError(null);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          if (sequence !== requestSequence.current) return;
          if (!navigator.onLine) {
            setCalculationError('offline');
          } else if (error instanceof ApiError && error.status === 422) {
            setCalculationError('invalid');
          } else {
            setCalculationError(resultRef.current ? 'stale' : 'failed');
          }
        })
        .finally(() => {
          if (sequence === requestSequence.current) setLoading(false);
        });
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [draft, hydrated, locale]);

  const changeDraft = (updates: Partial<GuestDraft>) => {
    updateDraft(updates);
    setSaved(false);
    setSaveError(false);
    setCalculationError(null);
  };

  const changeBucket = (key: string, updates: Partial<BucketDraft>) => {
    updateBucket(key, updates);
    setSaved(false);
    setSaveError(false);
    setCalculationError(null);
  };

  const answered = BUCKETS.some(({ key }) => bucketIsAnswered(draft.buckets[key]));
  const started = Boolean(draft.unitsProduced.trim() || draft.defectiveUnits.trim() || answered);
  const draftValid = isValidDraft(draft, locale);
  const visibleResult = answered ? result : null;
  const visibleError = started && !draftValid ? 'invalid' : calculationError;
  const visibleLoading = loading && started && answered && draftValid;

  const save = async () => {
    if (!user || !draft.productName.trim() || !visibleResult || !draftValid || visibleLoading) return;
    setSaving(true);
    setSaveError(false);
    try {
      let workspaceId = draft.workspaceId;
      if (!workspaceId) {
        const profile = await syncUserProfile();
        workspaceId = profile.workspaces[0]?.id;
      }
      if (!workspaceId) throw new Error('No workspace is available for this account.');

      const savedSheet = await saveCostSheet(draft, workspaceId, locale);
      if ('current_version_id' in savedSheet) {
        updateDraft({
          sheetId: savedSheet.id,
          versionId: savedSheet.current_version_id ?? undefined,
          workspaceId: savedSheet.workspace_id,
        });
      } else {
        updateDraft({
          sheetId: savedSheet.sheet_id,
          versionId: savedSheet.id,
          workspaceId,
        });
      }
      setSaved(true);
      setSaveError(false);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const downloadCsv = async () => {
    if (!draft.versionId) return;
    setReportError(false);
    try {
      const blob = await downloadVersionReport(draft.versionId, 'csv');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${draft.productName.trim() || 'truemargin'}-cost-report.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setReportError(true);
    }
  };

  const printReport = async () => {
    if (!draft.versionId) return;
    setReportError(false);
    const reportWindow = window.open('about:blank', '_blank');
    if (!reportWindow) {
      setReportError(true);
      return;
    }
    try {
      const blob = await downloadVersionReport(draft.versionId, 'pdf');
      const url = URL.createObjectURL(blob);
      reportWindow.location.href = url;
    } catch {
      reportWindow.close();
      setReportError(true);
    }
  };

  const resultProps = {
    result: visibleResult,
    currencyCode: draft.currencyCode,
    partial,
    unansweredCount,
    loading: visibleLoading,
    error: visibleError,
    saving,
    saved,
    versionId: draft.versionId,
    onSave: () => void save(),
    onDownloadCsv: () => void downloadCsv(),
    onPrint: () => void printReport(),
  };

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl px-4 pb-32 pt-7 sm:px-6 sm:pb-12 sm:pt-10 lg:px-8">
        <div className="mb-7 max-w-3xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">TrueMargin</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{pageT('title')}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">{pageT('description')}</p>
        </div>

        {(profileError || saveError || reportError) && (
          <div className="mb-5 space-y-2" aria-live="polite">
            {profileError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{t('profileError')}</p>}
            {saveError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{t('saveError')}</p>}
            {reportError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{t('reportError')}</p>}
          </div>
        )}

        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
          <div className="min-w-0 space-y-8">
            <CostSheetSetup draft={draft} onChange={changeDraft} />

            <section className="space-y-4" aria-labelledby="costs-heading">
              <div>
                <h2 id="costs-heading" className="text-lg font-semibold tracking-tight">{t('costsTitle')}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t('costsDescription')}</p>
              </div>
              <div className="space-y-3">
                {BUCKETS.map(({ key, titleKey, questionKey }) => (
                  <BucketCard
                    key={key}
                    bucketKey={key}
                    title={t(titleKey)}
                    question={t(questionKey)}
                    bucket={draft.buckets[key] ?? {
                      totalSpent: '',
                      unitsCovered: '',
                      isNone: false,
                      items: [],
                    }}
                    currencyCode={draft.currencyCode}
                    goodUnits={result?.good_units}
                    onChange={(updates) => changeBucket(key, updates)}
                  />
                ))}
              </div>
            </section>

            <PricingControls
              pricingType={draft.pricingType}
              percentage={draft.pricingPercentage}
              onChange={changeDraft}
            />
          </div>

          <aside className="hidden md:block md:col-span-1 lg:sticky lg:top-24" aria-live="polite">
            <ResultsPanel {...resultProps} />
          </aside>
        </div>

        <footer className="mt-10 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
          {t('footerDisclaimer')}
        </footer>
      </main>

      <MobileResultBar {...resultProps} />
    </div>
  );
}
