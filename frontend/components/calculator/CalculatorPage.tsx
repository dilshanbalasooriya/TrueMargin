'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { BucketCard } from '@/components/calculator/BucketCard';
import { CostSheetSetup } from '@/components/calculator/CostSheetSetup';
import { MobileResultBar } from '@/components/calculator/MobileResultBar';
import { ResultsPanel } from '@/components/calculator/ResultsPanel';
import { ApiError, calculateCostSheet, downloadVersionReport, isCalculableLineItem, saveCostSheet, syncUserProfile } from '@/lib/api-client';
import { isValidCurrencyCode } from '@/lib/currencies';
import { parseDecimalInput } from '@/lib/numbers';
import { useCalculatorStore } from '@/store/useCalculatorStore';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from '@/store/useToast';
import { Lock, PieChart, Zap, Ban } from 'lucide-react';
import { cn } from 'cn';
import type { CalculationResult } from '@/lib/api-client';
import type { BucketDraft, GuestDraft } from '@/store/useCalculatorStore';

const BUCKETS = [
  { key: 'material', titleKey: 'materials', questionKey: 'materialsQuestion' },
  { key: 'labor', titleKey: 'labor', questionKey: 'laborQuestion' },
  { key: 'overhead', titleKey: 'overhead', questionKey: 'overheadQuestion' },
  { key: 'transport', titleKey: 'transport', questionKey: 'transportQuestion' },
  { key: 'machinery', titleKey: 'machinery', questionKey: 'machineryQuestion' },
  { key: 'custom_fees', titleKey: 'customFees', questionKey: 'customFeesQuestion' },
] as const;

type CalculationError = 'offline' | 'stale' | 'invalid' | 'failed';

function hasValidNumber(value: string, locale: string, optional = false): boolean {
  if (value.trim() === '') return optional;
  return parseDecimalInput(value, locale) !== null;
}

function hasInputError(draft: GuestDraft, locale: string): boolean {
  if (draft.unitsProduced.trim()) {
    const units = parseDecimalInput(draft.unitsProduced, locale);
    if (units === null || units <= 0) return true;
  }
  if (draft.defectiveUnits.trim()) {
    const defects = parseDecimalInput(draft.defectiveUnits, locale);
    const units = parseDecimalInput(draft.unitsProduced, locale);
    if (defects === null || defects < 0) return true;
    if (units !== null && defects >= units) return true;
  }
  if (draft.pricingPercentage.trim()) {
    const pct = parseDecimalInput(draft.pricingPercentage, locale);
    if (pct === null || pct < 0) return true;
    if (draft.pricingType === 'margin' && pct >= 100) return true;
  }

  // Check any items for explicit errors (e.g. salvage > purchase, wastage >= 100)
  for (const bucket of Object.values(draft.buckets)) {
    for (const item of bucket.items) {
      const details = item.details ?? {};
      if (details.salvage_value && details.purchase_price) {
        const salvage = parseDecimalInput(details.salvage_value, locale);
        const purchase = parseDecimalInput(details.purchase_price, locale);
        if (salvage !== null && purchase !== null && salvage > purchase) return true;
      }
      if (details.wastage_percentage) {
        const wastage = parseDecimalInput(details.wastage_percentage, locale);
        if (wastage !== null && (wastage < 0 || wastage >= 100)) return true;
      }
      if (details.allocation_measure && details.allocation_total_measure) {
        const alloc = parseDecimalInput(details.allocation_measure, locale);
        const total = parseDecimalInput(details.allocation_total_measure, locale);
        if (alloc !== null && total !== null && (alloc <= 0 || total <= 0 || alloc > total)) return true;
      }
    }
  }
  return false;
}

function isCalculableDraft(draft: GuestDraft, locale: string): boolean {
  // Units produced is strictly required for calculation
  const unitsProduced = parseDecimalInput(draft.unitsProduced, locale);
  if (unitsProduced === null || !Number.isFinite(unitsProduced) || unitsProduced <= 0) return false;

  // Defective units: if provided, must be valid and less than units produced
  if (draft.defectiveUnits.trim()) {
    const defectiveUnits = parseDecimalInput(draft.defectiveUnits, locale);
    if (defectiveUnits === null || !Number.isFinite(defectiveUnits) || defectiveUnits < 0 || defectiveUnits >= unitsProduced) {
      return false;
    }
  }

  // Pricing percentage: must be >= 0, and if margin, < 100
  if (draft.pricingPercentage.trim()) {
    const pricingPercentage = parseDecimalInput(draft.pricingPercentage, locale);
    if (pricingPercentage === null || !Number.isFinite(pricingPercentage) || pricingPercentage < 0) return false;
    if (draft.pricingType === 'margin' && pricingPercentage >= 100) return false;
  }

  if (!isValidCurrencyCode(draft.currencyCode)) return false;

  // Don't calculate if explicit mathematical input errors exist
  if (hasInputError(draft, locale)) return false;

  // Must have at least one answered bucket
  return BUCKETS.some(({ key }) => bucketIsAnswered(draft.buckets[key], locale));
}

function bucketIsAnswered(bucket: BucketDraft | undefined, locale = 'en'): boolean {
  if (!bucket) return false;
  if (bucket.isNone) return true;
  if (bucket.totalSpent.trim() && (parseDecimalInput(bucket.totalSpent, locale) ?? -1) >= 0) return true;
  return bucket.items.some((item) => isCalculableLineItem(item, locale));
}

export function CalculatorPage() {
  const locale = useLocale();
  const pageT = useTranslations('Index');
  const t = useTranslations('Calculator');
  const {
    draft,
    hydrated,
    setupCollapsed,
    setSetupCollapsed,
    updateDraft,
    updateBucket,
    setIsDirty,
    markClean,
    resetCount,
  } = useCalculatorStore();
  const { user } = useAuth();

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculationError, setCalculationError] = useState<CalculationError | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedBucketKey, setExpandedBucketKey] = useState<string | null>(() => {
    const isComplete = Boolean(
      draft.productName.trim() &&
      draft.unitLabel.trim() &&
      Number(draft.unitsProduced.trim()) > 0,
    );
    return isComplete ? (draft.kind === 'service' ? 'labor' : 'material') : null;
  });
  const requestSequence = useRef(0);
  const profileUserId = useRef<string | null>(null);
  const resultRef = useRef<CalculationResult | null>(null);

  const answeredCount = useMemo(
    () => BUCKETS.filter(({ key }) => bucketIsAnswered(draft.buckets[key])).length,
    [draft.buckets],
  );
  const unansweredCount = BUCKETS.length - answeredCount;
  const partial = unansweredCount > 0;

  const isSetupComplete = useMemo(() => {
    const vol = Number(draft.unitsProduced.trim());
    return Boolean(
      draft.productName.trim() &&
      draft.unitLabel.trim() &&
      !isNaN(vol) &&
      vol > 0,
    );
  }, [draft.productName, draft.unitLabel, draft.unitsProduced]);

  useEffect(() => {
    void useCalculatorStore.persist.rehydrate();
  }, []);

  // Reset or initialize expanded bucket when draft resets, loads, or switches
  useEffect(() => {
    const isComplete = Boolean(
      draft.productName.trim() &&
      draft.unitLabel.trim() &&
      Number(draft.unitsProduced.trim()) > 0,
    );
    if (isComplete) {
      setExpandedBucketKey(draft.kind === 'service' ? 'labor' : 'material');
    } else {
      setExpandedBucketKey(null);
    }
  }, [resetCount, draft.kind]);

  const handleSetupContinue = () => {
    setSetupCollapsed(true);
    const firstKey = draft.kind === 'service' ? 'labor' : 'material';
    setExpandedBucketKey(firstKey);
    window.setTimeout(() => {
      const targetInput = document.getElementById(`bucket-${firstKey}-amount`);
      if (targetInput) {
        targetInput.focus({ preventScroll: true });
        const rect = targetInput.getBoundingClientRect();
        const isComfortablyVisible = rect.top >= 80 && rect.bottom <= (window.innerHeight - 60);
        if (!isComfortablyVisible) {
          targetInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 120);
  };

  const handleBucketToggle = (key: string, expanded: boolean) => {
    if (expanded) {
      setExpandedBucketKey(key);
      window.setTimeout(() => {
        const el = document.getElementById(`bucket-card-${key}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top < 80 || rect.top > window.innerHeight * 0.75) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      }, 70);
    } else {
      setExpandedBucketKey(null);
    }
  };

  // Auto-close open bucket when clicking outside
  useEffect(() => {
    if (!expandedBucketKey) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Element | null;
      if (!target) return;

      // 1. If clicking inside the active bucket card, do not close
      const activeCard = document.getElementById(`bucket-card-${expandedBucketKey}`);
      if (activeCard && activeCard.contains(target)) {
        return;
      }

      // 2. If clicking on any other bucket card, let that card's toggle handler run
      if (target.closest('[id^="bucket-card-"]')) {
        return;
      }

      // 3. If clicking inside modal dialogs, popovers, alerts/toasts, or dropdown portals
      if (
        target.closest('[role="dialog"]') ||
        target.closest('[role="alert"]') ||
        target.closest('[data-radix-portal]') ||
        target.closest('[data-radix-popper-content-wrapper]') ||
        target.closest('.toaster')
      ) {
        return;
      }

      // 4. Clicked outside: close the active bucket!
      setExpandedBucketKey(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [expandedBucketKey]);

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
        if (!workspace) return;
        updateDraft({
          workspaceId: workspace.id,
          ...(!draft.currencyOverridden && !draft.sheetId
          ? { currencyCode: (workspace.currency || profile.currency).toUpperCase() }
            : {}),
        });
      })
      .catch(() => {
        profileUserId.current = null;
      });
  }, [draft.currencyOverridden, draft.sheetId, hydrated, updateDraft, user]);

  useEffect(() => {
    if (!hydrated) return;

    const answered = BUCKETS.some(({ key }) => bucketIsAnswered(draft.buckets[key], locale));
    const started = Boolean(
      draft.unitsProduced.trim()
      || draft.defectiveUnits.trim()
      || answered,
    );
    if (!started || !answered || !isCalculableDraft(draft, locale)) return;

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
          console.warn('[TrueMargin Calculator] Calculation error:', error);
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
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [draft, hydrated, locale]);

  const changeDraft = (updates: Partial<GuestDraft>) => {
    updateDraft(updates);
    setIsDirty(true);
    setSaved(false);
    setCalculationError(null);
  };

  const changeBucket = (key: string, updates: Partial<BucketDraft>) => {
    updateBucket(key, updates);
    setIsDirty(true);
    setSaved(false);
    setCalculationError(null);
  };

  const orderedBuckets = useMemo(() => {
    if (draft.kind === 'service') {
      return [
        { key: 'labor', titleKey: 'labor', questionKey: 'laborQuestion' },
        { key: 'material', titleKey: 'materials', questionKey: 'materialsQuestion' },
        { key: 'overhead', titleKey: 'overhead', questionKey: 'overheadQuestion' },
        { key: 'transport', titleKey: 'transport', questionKey: 'transportQuestion' },
        { key: 'machinery', titleKey: 'machinery', questionKey: 'machineryQuestion' },
        { key: 'custom_fees', titleKey: 'customFees', questionKey: 'customFeesQuestion' },
      ] as const;
    }
    return BUCKETS;
  }, [draft.kind]);

  const answered = BUCKETS.some(({ key }) => bucketIsAnswered(draft.buckets[key], locale));
  const started = Boolean(draft.unitsProduced.trim() || draft.defectiveUnits.trim() || answered);
  const draftCalculable = isCalculableDraft(draft, locale);
  const inputHasError = hasInputError(draft, locale);
  const visibleResult = answered ? result : null;
  const visibleError = inputHasError ? 'invalid' : calculationError;
  const visibleLoading = loading && started && answered && draftCalculable;

  const save = async () => {
    if (!user) {
      toast.error(t('saveNeedsLogin'));
      return;
    }
    if (!draft.productName.trim()) {
      toast.error(locale === 'si' ? 'කරුණාකර නිෂ්පාදනයේ නම ඇතුළත් කරන්න.' : 'Please enter a product name before saving.');
      return;
    }
    if (!visibleResult || !draftCalculable || visibleLoading) return;
    setSaving(true);
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
      markClean();
      setSaved(true);
      toast.success(t('saveSuccess'));
      window.dispatchEvent(new CustomEvent('truemargin-sheets-updated', { detail: { action: 'save' } }));
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        toast.error(t('saveNeedsLogin'));
      } else {
        toast.error(t('saveError'));
      }
    } finally {
      setSaving(false);
    }
  };

  const downloadCsv = async () => {
    if (!draft.versionId) {
      toast.error(t('reportRequiresSave'));
      return;
    }
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
      toast.error(t('reportError'));
    }
  };

  const printReport = async () => {
    if (!draft.versionId) {
      toast.error(t('reportRequiresSave'));
      return;
    }
    const reportWindow = window.open('about:blank', '_blank');
    if (!reportWindow) {
      toast.error(t('reportError'));
      return;
    }
    try {
      const blob = await downloadVersionReport(draft.versionId, 'pdf');
      const url = URL.createObjectURL(blob);
      reportWindow.location.href = url;
    } catch {
      reportWindow.close();
      toast.error(t('reportError'));
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
    pricingType: draft.pricingType,
    pricingPercentage: draft.pricingPercentage,
    buckets: draft.buckets,
    onPricingChange: changeDraft,
    onSave: () => void save(),
    onDownloadCsv: () => void downloadCsv(),
    onPrint: () => void printReport(),
  };

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-4 pb-32 pt-6 sm:px-6 sm:pb-12 sm:pt-8 lg:px-8">
        {/* Simple & Focused Hero Section */}
        <div className="mb-6 space-y-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl sm:leading-9">
            {pageT('title')}
          </h1>

          {/* Visual 3-step guide showing the purpose of this application at a glance */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/80 px-2.5 py-1.5 text-foreground/90 font-medium shadow-2xs">
              <span className="size-1.5 rounded-full bg-blue-500" />
              {locale === 'si' ? '1. වියදම් ඇතුළත් කරන්න' : '1. Enter Costs'}
            </span>
            <span className="text-muted-foreground/40 hidden sm:inline">→</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/80 px-2.5 py-1.5 text-foreground/90 font-medium shadow-2xs">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {locale === 'si' ? '2. නියම ඒකක පිරිවැය' : '2. Real Unit Cost'}
            </span>
            <span className="text-muted-foreground/40 hidden sm:inline">→</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/80 px-2.5 py-1.5 text-foreground/90 font-medium shadow-2xs">
              <span className="size-1.5 rounded-full bg-amber-500" />
              {locale === 'si' ? '3. ලාභය සහිත විකුණුම් මිල' : '3. Profitable Price'}
            </span>
          </div>
        </div>

        <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_28rem] xl:grid-cols-[minmax(0,1fr)_30rem] lg:gap-8">
          <div className="min-w-0 space-y-8">
            <CostSheetSetup
              key={`setup-${resetCount}-${draft.sheetId || 'new'}`}
              draft={draft}
              onChange={changeDraft}
              isCollapsed={setupCollapsed}
              onToggleCollapse={setSetupCollapsed}
              onContinue={handleSetupContinue}
            />

            {!isSetupComplete && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSetupCollapsed(false);
                  document.getElementById('cost-sheet-name')?.focus();
                  toast.info(t('costsLockedNotice'));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    document.getElementById('cost-sheet-name')?.focus();
                  }
                }}
                className="max-w-xl sm:max-w-2xl flex items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-xs cursor-pointer transition-colors hover:bg-primary/10"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Lock className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{t('costsLockedTitle')}</p>
                  <p className="text-muted-foreground">{t('costsLockedNotice')}</p>
                </div>
              </div>
            )}

            <section
              className={`max-w-xl sm:max-w-2xl space-y-4 transition-all duration-300 ${
                !isSetupComplete ? 'opacity-40 pointer-events-none select-none filter blur-[0.4px]' : ''
              }`}
              aria-labelledby="costs-heading"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                      <PieChart className="size-4" />
                    </span>
                    <h2 id="costs-heading" className="text-sm font-bold tracking-tight text-foreground sm:text-base">
                      {draft.productName.trim()
                        ? t('costsTitle', { productName: draft.productName.trim() })
                        : t('costsTitleGeneric')}
                    </h2>
                  </div>

                  {/* Category Progress Pill */}
                  <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground shadow-2xs">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <span>
                      {t('categoriesAnswered', { answered: answeredCount, total: BUCKETS.length })}
                    </span>
                  </div>
                </div>

                {/* Visual Action Guide pills (Step 1 removed) */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 py-1 text-foreground/80 font-medium shadow-2xs">
                    <Zap className="size-3 text-amber-500" />
                    {t('costGuideStep2')}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 py-1 text-foreground/80 font-medium shadow-2xs">
                    <Ban className="size-3 text-muted-foreground" />
                    {t('costGuideStep3')}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {orderedBuckets.map(({ key, titleKey, questionKey }) => (
                  <div
                    key={`${resetCount}-${draft.sheetId || 'new'}-${key}`}
                    className={cn(
                      "transition-all duration-300 ease-out",
                      expandedBucketKey && expandedBucketKey !== key
                        ? "opacity-75 hover:opacity-100 scale-[0.995] hover:scale-100"
                        : "opacity-100 scale-100"
                    )}
                  >
                    <BucketCard
                      key={`${resetCount}-${draft.sheetId || 'new'}-${key}`}
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
                      monthlyUnits={draft.unitsProduced}
                      unitLabel={draft.unitLabel}
                      relatedMaterials={
                        key === 'transport'
                          ? (draft.buckets.material?.items ?? [])
                            .filter((item) => item.name.trim())
                            .map(({ id, name }) => ({ id, name }))
                          : []
                      }
                      isExpanded={expandedBucketKey === key}
                      onToggleExpand={(expanded) => handleBucketToggle(key, expanded)}
                      onChange={(updates) => changeBucket(key, updates)}
                    />
                  </div>
                ))}
              </div>
            </section>
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
    </>
  );
}
