'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AppHeader } from '@/components/app/AppHeader';
import { BucketCard } from '@/components/calculator/BucketCard';
import { CostSheetSetup } from '@/components/calculator/CostSheetSetup';
import { MobileResultBar } from '@/components/calculator/MobileResultBar';
import { PricingControls } from '@/components/calculator/PricingControls';
import { ResultsPanel } from '@/components/calculator/ResultsPanel';
import { Input } from '@/components/ui/input';
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
  if (
    !draft.productName.trim()
    || !draft.unitLabel.trim()
    || !draft.productionBasis
    || !draft.defaultUnitsCoveredScope
  ) return false;

  const unitsProduced = parseDecimalInput(draft.unitsProduced, locale);
  const defectiveUnits = draft.defectiveUnits.trim() === '' ? 0 : parseDecimalInput(draft.defectiveUnits, locale);
  const pricingPercentage = parseDecimalInput(draft.pricingPercentage, locale);
  if (unitsProduced === null || defectiveUnits === null || pricingPercentage === null) return false;
  if (!Number.isFinite(unitsProduced) || unitsProduced <= 0) return false;
  if (!Number.isFinite(defectiveUnits) || defectiveUnits < 0 || defectiveUnits >= unitsProduced) return false;
  if (!Number.isFinite(pricingPercentage) || pricingPercentage < 0) return false;
  if (draft.pricingType === 'margin' && pricingPercentage >= 100) return false;
  if (!isValidCurrencyCode(draft.currencyCode)) return false;

  const numericDetailKeys = new Set([
    'wastage_percentage',
    'scrap_recovery_amount',
    'statutory_percentage',
    'bonus_percentage',
    'allocation_percentage',
    'variable_percentage',
    'allocation_measure',
    'allocation_total_measure',
    'purchase_price',
    'salvage_value',
    'lifetime_units',
    'useful_life_periods',
    'amortization_units',
  ]);

  for (const [key, bucket] of Object.entries(draft.buckets)) {
    if (draft.defaultUnitsCoveredScope === 'overhead_only' && key !== 'overhead' && !bucket.isNone) {
      const hasCost = bucket.totalSpent.trim() !== ''
        || bucket.items.some((item) => item.name.trim() || item.amount.trim());
      if (hasCost && !bucket.unitsCovered.trim()) return false;
    }

    const bucketCoverage = bucket.unitsCovered.trim()
      ? parseDecimalInput(bucket.unitsCovered, locale)
      : null;
    if (bucket.totalSpent.trim() && !hasValidNumber(bucket.totalSpent, locale)) return false;
    if (bucket.unitsCovered.trim() && (bucketCoverage === null || bucketCoverage <= 0)) return false;
    for (const item of bucket.items) {
      const hasDetails = Object.values(item.details ?? {}).some((value) => value.trim());
      if (
        item.name.trim()
        || item.amount.trim()
        || item.unitsCovered.trim()
        || item.purchaseQuantity?.trim()
        || item.purchaseUnit?.trim()
        || hasDetails
      ) {
        if (item.purchaseQuantity?.trim()) {
          const quantity = parseDecimalInput(item.purchaseQuantity, locale);
          if (quantity === null || quantity <= 0) return false;
        }
        const itemCoverage = item.unitsCovered.trim()
          ? parseDecimalInput(item.unitsCovered, locale)
          : null;
        const calculatedByDepreciation = ['units', 'periods'].includes(
          item.details?.depreciation_method ?? '',
        );
        if (!item.name.trim()) return false;
        if (item.amount.trim() && !hasValidNumber(item.amount, locale)) return false;
        if (!item.amount.trim() && !calculatedByDepreciation) return false;
        if (item.unitsCovered.trim() && (itemCoverage === null || itemCoverage <= 0)) return false;

        for (const [field, value] of Object.entries(item.details ?? {})) {
          if (!value.trim()) continue;
          if (numericDetailKeys.has(field) && !hasValidNumber(value, locale)) return false;
          if (field.endsWith('_percentage')) {
            const percentage = parseDecimalInput(value, locale);
            if (percentage === null || percentage < 0 || percentage > 100) return false;
            if (field === 'wastage_percentage' && percentage >= 100) return false;
          }
        }

        const details = item.details ?? {};
        const allocationMeasure = details.allocation_measure?.trim();
        const allocationTotal = details.allocation_total_measure?.trim();
        if (Boolean(allocationMeasure) !== Boolean(allocationTotal)) return false;
        if (allocationMeasure && allocationTotal) {
          const amount = parseDecimalInput(allocationMeasure, locale);
          const total = parseDecimalInput(allocationTotal, locale);
          if (amount === null || total === null || amount <= 0 || total <= 0 || amount > total) return false;
        }

        if (details.depreciation_method === 'units' || details.depreciation_method === 'periods') {
          const purchase = parseDecimalInput(details.purchase_price ?? '', locale);
          const lifetime = parseDecimalInput(
            details.depreciation_method === 'units'
              ? details.lifetime_units ?? ''
              : details.useful_life_periods ?? '',
            locale,
          );
          const salvage = details.salvage_value?.trim()
            ? parseDecimalInput(details.salvage_value, locale)
            : 0;
          if (purchase === null || purchase < 0 || lifetime === null || lifetime <= 0 || salvage === null || salvage > purchase) return false;
        }

        if (
          details.amortization_method
          && details.amortization_method !== 'none'
          && (!details.amortization_units?.trim()
            || (parseDecimalInput(details.amortization_units, locale) ?? 0) <= 0)
        ) return false;
      }
    }
  }
  return true;
}

function bucketIsAnswered(bucket: BucketDraft | undefined): boolean {
  return Boolean(
    bucket?.isNone
    || bucket?.totalSpent.trim()
    || bucket?.items.some((item) =>
      item.name.trim()
      && (
        item.amount.trim()
        || ['units', 'periods'].includes(item.details?.depreciation_method ?? '')
      ),
    ),
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
  const [saveError, setSaveError] = useState<number | null>(null);
  const [profileError, setProfileError] = useState<number | null>(null);
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
          setProfileError(0);
          return;
        }
        updateDraft({
          workspaceId: workspace.id,
          ...(!draft.currencyOverridden && !draft.sheetId
          ? { currencyCode: (workspace.currency || profile.currency).toUpperCase() }
            : {}),
        });
        setProfileError(null);
      })
      .catch((error: unknown) => {
        profileUserId.current = null;
        setProfileError(error instanceof ApiError ? error.status : 0);
      });
  }, [draft.currencyOverridden, draft.sheetId, hydrated, updateDraft, user]);

  useEffect(() => {
    if (!hydrated) return;

    const answered = BUCKETS.some(({ key }) => bucketIsAnswered(draft.buckets[key]));
    const started = Boolean(
      draft.productName.trim()
      || draft.unitLabel.trim()
      || draft.unitsProduced.trim()
      || draft.defectiveUnits.trim()
      || answered,
    );
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
    setSaveError(null);
    setCalculationError(null);
  };

  const changeBucket = (key: string, updates: Partial<BucketDraft>) => {
    updateBucket(key, updates);
    setSaved(false);
    setSaveError(null);
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
    setSaveError(null);
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
      setSaveError(null);
    } catch (error: unknown) {
      setSaveError(error instanceof ApiError ? error.status : 0);
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

        {(profileError !== null || saveError !== null || reportError) && (
          <div className="mb-5 space-y-2" aria-live="polite">
            {profileError !== null && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{profileError === 401 ? t('backendAuthError') : profileError === 503 ? t('backendAuthUnavailable') : t('profileError')}</p>}
            {saveError !== null && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{saveError === 401 ? t('backendAuthError') : saveError === 503 ? t('backendAuthUnavailable') : t('saveError')}</p>}
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
                    unitsCoveredRequired={
                      draft.defaultUnitsCoveredScope === 'overhead_only'
                      && key !== 'overhead'
                      && !draft.buckets[key]?.isNone
                      && Boolean(
                        draft.buckets[key]?.totalSpent.trim()
                        || draft.buckets[key]?.items.some((item) => item.name.trim() || item.amount.trim()),
                      )
                    }
                    defaultUnitsCovered={
                      draft.defaultUnitsCoveredScope === 'all' || key === 'overhead'
                        ? result?.good_units
                        : undefined
                    }
                    onChange={(updates) => changeBucket(key, updates)}
                  />
                ))}
              </div>
              <details className="rounded-xl border border-border bg-card p-4 sm:p-5">
                <summary className="cursor-pointer text-sm font-semibold">{t('level3ProductionDetails')}</summary>
                <div className="mt-4 max-w-sm space-y-2">
                  <label htmlFor="defective-units" className="text-sm font-medium">
                    {t('defects')} <span className="font-normal text-muted-foreground">({t('optional')})</span>
                  </label>
                  <Input
                    id="defective-units"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={draft.defectiveUnits}
                    onChange={(event) => changeDraft({ defectiveUnits: event.target.value })}
                    placeholder="0"
                    className="min-h-11"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">{t('defectsHint')}</p>
                </div>
              </details>
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
