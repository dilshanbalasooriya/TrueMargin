'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LoginModal } from '@/components/auth/LoginModal';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  CostDonutChart,
  BUCKET_COLORS,
  formatPercent,
  type DonutSegment,
} from '@/components/calculator/CostDonutChart';
import { computeCostingAccuracy } from '@/lib/accuracy';
import {
  ArrowDownToLine,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  LoaderCircle,
  Printer,
  Sparkles,
  Target,
  AlertTriangle,
} from 'lucide-react';
import { cn } from 'cn';
import type { CalculationResult } from '@/lib/api-client';
import type { BucketDraft } from '@/store/useCalculatorStore';

export interface ResultsPanelProps {
  result: CalculationResult | null;
  currencyCode: string;
  partial: boolean;
  unansweredCount: number;
  loading: boolean;
  error: 'offline' | 'stale' | 'invalid' | 'failed' | null;
  saving: boolean;
  saved: boolean;
  versionId?: string;
  pricingType?: 'markup' | 'margin';
  pricingPercentage?: string;
  buckets?: Record<string, BucketDraft>;
  onPricingChange?: (updates: { pricingType?: 'markup' | 'margin'; pricingPercentage?: string }) => void;
  onSave: () => void;
  onDownloadCsv: () => void;
  onPrint: () => void;
}

function formatCurrency(value: string | number, currencyCode: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `${currencyCode} ${value}`;
  }
}

function ResultDetails({
  result,
  currencyCode,
  partial,
  unansweredCount,
  loading,
  error,
  pricingType = 'markup',
  pricingPercentage = '30',
  buckets = {},
  onPricingChange,
}: Pick<
  ResultsPanelProps,
  | 'result'
  | 'currencyCode'
  | 'partial'
  | 'unansweredCount'
  | 'loading'
  | 'error'
  | 'pricingType'
  | 'pricingPercentage'
  | 'buckets'
  | 'onPricingChange'
>) {
  const t = useTranslations('Calculator');
  const locale = useLocale();
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Accuracy calculation based on progressive levels (L1, L2, L3)
  const accuracy = useMemo(() => computeCostingAccuracy(buckets), [buckets]);

  // Donut chart segments
  const donutSegments: DonutSegment[] = useMemo(() => {
    if (!result) return [];
    return result.bucket_breakdown
      .filter((b) => Number(b.cost_per_unit) > 0)
      .map((b) => ({
        type: b.type,
        label: t(`bucketLabels.${b.type}` as const) || b.label || b.type,
        costPerUnit: Number(b.cost_per_unit),
        percentage: Number(b.percentage_of_total),
        formattedAmount: formatCurrency(b.cost_per_unit, currencyCode, locale),
        color: BUCKET_COLORS[b.type] || '#64748b',
      }));
  }, [result, currencyCode, locale, t]);

  if (!result) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-5 text-center text-xs text-muted-foreground">
        {t('resultAwaiting')}
      </div>
    );
  }

  const profitNum = Number(result.profit_per_unit);
  const isLoss = profitNum < 0;
  const equivalentKey =
    result.pricing_type === 'markup' ? 'equivalentMargin' : 'equivalentMarkup';

  return (
    <div className="space-y-3">
      {/* Accuracy & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          {partial ? (
            <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
              <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              {t('bucketsRemaining', { count: unansweredCount })}
            </span>
          ) : (
            <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
              {t('allBucketsAnswered')}
            </span>
          )}
        </div>

        {/* Costing Reliability Badge */}
        <div
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium shadow-2xs ${
            accuracy.levelKey === 'accountingGrade'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : accuracy.levelKey === 'detailed'
                ? 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          }`}
          title={t('accuracyTooltip')}
        >
          <span
            className={`size-1.5 rounded-full ${
              accuracy.levelKey === 'accountingGrade'
                ? 'bg-emerald-500'
                : accuracy.levelKey === 'detailed'
                  ? 'bg-blue-500'
                  : 'bg-amber-500'
            }`}
          />
          <span className="font-bold tabular-nums">{accuracy.score}%</span>
          <span>•</span>
          <span>{t(`accuracyLevels.${accuracy.levelKey}` as const)}</span>
        </div>
      </div>

      {error && (
        <p role="status" className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error === 'offline'
            ? t('offline')
            : error === 'invalid'
              ? t('invalidInputs')
              : error === 'stale'
                ? t('outOfDate')
                : t('calculationError')}
        </p>
      )}

      {result.is_loss_making && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-2.5 text-xs font-semibold text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{t('lossWarning')}</span>
        </div>
      )}

      {/* TIER 1: MAIN METRICS (Image 2 style with equal focus on both numbers) */}
      <div className="rounded-xl border border-border/80 bg-card p-3 shadow-2xs">
        <div className="grid grid-cols-2 gap-3 divide-x divide-border/60">
          {/* Main 1: Unit Cost Price */}
          <div className="pr-2 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="flex size-5 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Coins className="size-3" />
              </span>
              <span className="truncate">{t('unitCostPrice')}</span>
            </div>
            <div className="text-xl sm:text-2xl font-black tracking-tight text-foreground tabular-nums">
              {formatCurrency(result.unit_cost, currencyCode, locale)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              per {result.unit_label}
            </p>
          </div>

          {/* Main 2: Suggested Selling Price */}
          <div className="pl-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Target className="size-3" />
              </span>
              <span className="truncate">{t('finalSellingPrice')}</span>
            </div>
            <div className="text-xl sm:text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatCurrency(result.suggested_price, currencyCode, locale)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              per {result.unit_label}
            </p>
          </div>
        </div>

        {/* Real-Time Pricing Strip */}
        {onPricingChange && (
          <div className="mt-3 border-t border-border/60 pt-2.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1">
                <Sparkles className="size-3.5 text-primary" />
                {t('realtimePricing')}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t(equivalentKey)}: <strong className="text-foreground">{formatPercent(result.equivalent_markup_or_margin)}%</strong>
              </span>
            </div>

            <div className="grid grid-cols-[1fr_80px] gap-2 items-center">
              {/* Markup vs Margin Segmented Switch */}
              <div className="grid grid-cols-2 rounded-lg border border-border bg-muted/40 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => onPricingChange({ pricingType: 'markup' })}
                  className={`min-h-7 rounded-md transition-colors text-xs ${
                    pricingType === 'markup'
                      ? 'bg-background text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('markup')}
                </button>
                <button
                  type="button"
                  onClick={() => onPricingChange({ pricingType: 'margin' })}
                  className={`min-h-7 rounded-md transition-colors text-xs ${
                    pricingType === 'margin'
                      ? 'bg-background text-foreground shadow-2xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('margin')}
                </button>
              </div>

              {/* Percentage Input */}
              <div className="relative">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={pricingPercentage}
                  onChange={(e) => onPricingChange({ pricingPercentage: e.target.value })}
                  className="min-h-8 pr-5 text-xs font-bold tabular-nums text-center"
                />
                <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
                  %
                </span>
              </div>
            </div>

            {/* Quick preset chips & Profit badge */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
              <div className="flex items-center gap-1">
                {['15', '25', '35', '50'].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => onPricingChange({ pricingPercentage: pct })}
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      pricingPercentage === pct
                        ? 'border-primary bg-primary/10 text-primary font-bold'
                        : 'border-border/60 bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    +{pct}%
                  </button>
                ))}
              </div>
              <span className={`text-[11px] font-bold tabular-nums ${isLoss ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {isLoss ? 'Loss' : 'Profit'}: +{formatCurrency(Math.abs(profitNum), currencyCode, locale)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* TIER 2: PROGRESSIVE DISCLOSURE ACCORDION (Collapsed by Default) */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setShowBreakdown((prev) => !prev)}
          className="flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors cursor-pointer select-none"
        >
          <span>{showBreakdown ? t('hideBreakdown') : t('viewBreakdown')}</span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-in-out",
              showBreakdown ? "rotate-180 text-foreground" : "rotate-0"
            )}
          />
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
            showBreakdown ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
          )}
        >
          <div className="overflow-hidden min-h-0">
            <div className="space-y-3 border-t border-border/60 p-3 bg-muted/10">
              {/* Visual Donut Chart */}
              <div className="rounded-lg border border-border/60 bg-card p-3">
                <div className="mb-2 flex items-center justify-between border-b border-border/40 pb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t('costBreakdown')}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {t('costShare')}
                  </span>
                </div>
                <CostDonutChart
                  segments={donutSegments}
                  totalCostFormatted={formatCurrency(result.unit_cost, currencyCode, locale)}
                  unitLabel={result.unit_label}
                  currencyCode={currencyCode}
                />
              </div>

              {/* Key Financial Insights Grid */}
              <div className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t('keyInsights')}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {/* 1. Profit per unit */}
                  <div className="flex flex-col justify-between rounded-md border border-border/50 bg-muted/20 p-2">
                    <span className="text-[10px] font-medium leading-tight text-muted-foreground">
                      {t('profitPerUnit')}
                    </span>
                    <span className={`mt-1 text-xs font-bold tabular-nums leading-tight ${
                      isLoss ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {formatCurrency(result.profit_per_unit, currencyCode, locale)}
                    </span>
                  </div>

                  {/* 2. Total Period Profit */}
                  <div className="flex flex-col justify-between rounded-md border border-border/50 bg-muted/20 p-2">
                    <span className="text-[10px] font-medium leading-tight text-muted-foreground">
                      {t('totalProfit')}
                    </span>
                    <span className={`mt-1 text-xs font-bold tabular-nums leading-tight ${
                      isLoss ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {formatCurrency(result.total_expected_profit, currencyCode, locale)}
                    </span>
                    <span className="mt-0.5 text-[9px] text-muted-foreground leading-tight">
                      {t('totalProfitSub', { count: result.good_units, unit: result.unit_label })}
                    </span>
                  </div>

                  {/* 3. Break-even volume */}
                  <div className="flex flex-col justify-between rounded-md border border-border/50 bg-muted/20 p-2" title={!result.break_even_ready ? t('breakEvenTooltip') : undefined}>
                    <span className="text-[10px] font-medium leading-tight text-muted-foreground">
                      {t('breakEvenUnits')}
                    </span>
                    {result.break_even_units !== null ? (
                      <span className="mt-1 text-xs font-bold text-foreground tabular-nums leading-tight">
                        {result.break_even_units} {result.unit_label}
                      </span>
                    ) : !result.break_even_ready ? (
                      <span className="mt-1 text-[10px] font-medium text-muted-foreground leading-tight">
                        {t('breakEvenNeedsSplit')}
                      </span>
                    ) : (
                      <span className="mt-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 leading-tight">
                        {t('breakEvenUnavailable')}
                      </span>
                    )}
                  </div>

                  {/* 4. Full Economic Cost */}
                  <div className="flex flex-col justify-between rounded-md border border-border/50 bg-muted/20 p-2">
                    <span className="text-[10px] font-medium leading-tight text-muted-foreground">
                      {t('economicUnitCost')}
                    </span>
                    <span className="mt-1 text-xs font-bold text-foreground tabular-nums leading-tight">
                      {formatCurrency(result.economic_unit_cost, currencyCode, locale)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResultsPanel(props: ResultsPanelProps) {
  const t = useTranslations('Calculator');
  const { user } = useAuth();

  return (
    <Card className="gap-0 overflow-visible p-0 shadow-sm border-border/80">
      <div className="border-b border-border px-4 py-3 sm:px-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight text-foreground sm:text-base">
            {t('resultsTitle')}
          </h2>
          {props.loading && (
            <LoaderCircle className="size-4 animate-spin text-primary" aria-label={t('loading')} />
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{t('resultsDescription')}</p>
      </div>
      <div className="space-y-3 p-3.5 sm:p-4">
        <ResultDetails {...props} />

        <div className="space-y-2 border-t border-border pt-3">
          {user ? (
            <Button
              type="button"
              className="min-h-10 w-full font-semibold shadow-xs"
              onClick={props.onSave}
              disabled={props.saving || !props.result || props.loading || Boolean(props.error)}
            >
              {props.saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
              {props.saving ? t('saving') : props.saved ? t('saved') : t('save')}
            </Button>
          ) : (
            <LoginModal>
              <Button type="button" className="min-h-10 w-full font-semibold shadow-xs">
                {t('save')}
              </Button>
            </LoginModal>
          )}

          {props.versionId ? (
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="min-h-9 text-xs" onClick={props.onDownloadCsv}>
                <ArrowDownToLine className="size-3.5" aria-hidden="true" />
                <span className="truncate">{t('reportCsv')}</span>
              </Button>
              <Button type="button" variant="outline" className="min-h-9 text-xs" onClick={props.onPrint}>
                <Printer className="size-3.5" aria-hidden="true" />
                <span className="truncate">{t('reportPrint')}</span>
              </Button>
            </div>
          ) : (
            <p className="text-center text-[10px] text-muted-foreground">{t('reportRequiresSave')}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

export { ResultDetails };
