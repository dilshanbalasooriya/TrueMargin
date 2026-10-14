'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus,
  Trash2,
  SlidersHorizontal,
  Zap,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  Users,
  Truck,
  Building2,
  Cog,
  Receipt,
  HelpCircle,
  Ban,
  Sparkles,
  Scale,
} from 'lucide-react';
import { cn } from 'cn';
import type { BucketDraft, LineItemDraft } from '@/store/useCalculatorStore';
import { Level3DetailsModal, getActiveLevel3Count } from './Level3DetailsModal';
import {
  calculateRecipeCoverageClient,
  areUnitsCompatible,
  POPULAR_UNITS,
} from '@/lib/unitConverter';

interface BucketCardProps {
  bucketKey: string;
  title: string;
  question: string;
  bucket: BucketDraft;
  currencyCode: string;
  unitsCoveredRequired: boolean;
  defaultUnitsCovered?: string;
  monthlyUnits?: string;
  unitLabel?: string;
  onChange: (updates: Partial<BucketDraft>) => void;
}

// Category Theme Mapping with Distinct Icons & Accent Colors
const CATEGORY_THEMES: Record<
  string,
  {
    icon: typeof Layers;
    color: string;
    bg: string;
    border: string;
  }
> = {
  material: {
    icon: Layers,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  materials: {
    icon: Layers,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  labor: {
    icon: Users,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  transport: {
    icon: Truck,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  overhead: {
    icon: Building2,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  machinery: {
    icon: Cog,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
  custom_fees: {
    icon: Receipt,
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
  },
};

function getRecipeCoverage(
  purchaseQtyStr?: string,
  purchaseUnitStr?: string,
  usageQtyStr?: string,
  usageUnitStr?: string
): { unitsCovered?: number; error?: string } {
  const pQty = parseFloat(purchaseQtyStr ?? '');
  const uQty = parseFloat(usageQtyStr ?? '');
  const pUnit = purchaseUnitStr?.trim() || '';
  const uUnit = usageUnitStr?.trim() || '';

  if (isNaN(pQty) || pQty <= 0 || isNaN(uQty) || uQty <= 0) {
    return { error: 'incomplete' };
  }

  // If neither has a unit, calculate direct ratio
  if (!pUnit && !uUnit) {
    return { unitsCovered: pQty / uQty };
  }

  return calculateRecipeCoverageClient(pQty, pUnit || 'pcs', uQty, uUnit || 'pcs');
}

function getSuggestedUsageUnit(purchaseUnit?: string): string {
  if (!purchaseUnit) return 'g';
  const norm = purchaseUnit.trim().toLowerCase();
  if (norm === 'kg' || norm === 'kilogram' || norm === 'kilo' || norm === 'kgs') return 'g';
  if (norm === 'l' || norm === 'liter' || norm === 'litre' || norm === 'ltr') return 'ml';
  if (norm === 'm' || norm === 'meter' || norm === 'metre' || norm === 'mtr') return 'cm';
  if (norm === 'dz' || norm === 'dozen') return 'pcs';
  return norm;
}

export function BucketCard({
  bucketKey,
  title,
  question,
  bucket,
  currencyCode,
  unitsCoveredRequired,
  defaultUnitsCovered,
  monthlyUnits,
  unitLabel,
  onChange,
}: BucketCardProps) {
  const t = useTranslations('Calculator');
  const [expanded, setExpanded] = useState(bucket.items.length > 0);
  const [selectedLevel3Item, setSelectedLevel3Item] = useState<LineItemDraft | null>(null);
  const prefix = `bucket-${bucketKey}`;

  // Track whether the user entered a Level 1 quick estimate before expanding into Level 2
  const [initialEstimate, setInitialEstimate] = useState<number | null>(() => {
    const val = parseFloat(bucket.totalSpent);
    if (bucket.items.length > 0) {
      const sum = bucket.items.reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0);
      return !isNaN(val) && val > 0 && Math.abs(val - sum) > 0.01 ? val : null;
    }
    return !isNaN(val) && val > 0 ? val : null;
  });

  const theme = CATEGORY_THEMES[bucketKey] ?? CATEGORY_THEMES.material ?? {
    icon: HelpCircle,
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
  };
  const CategoryIcon = theme.icon;

  // User's direct itemized cost sum (what the user actually typed into the boxes)
  const itemSum = bucket.items.reduce((acc, it) => {
    const val = parseFloat(it.amount);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // Level 1 batch coverage units (defaulting to monthlyUnits or defaultUnitsCovered or 1)
  const batchCoverageUnits =
    parseFloat(bucket.unitsCovered || monthlyUnits || defaultUnitsCovered || '1') || 1;

  // Batch-allocated cost for all items: sum of ((amount / itemCoverage) * batchCoverageUnits)
  const batchAllocatedItemSum = bucket.items.reduce((acc, it) => {
    const val = parseFloat(it.amount);
    if (isNaN(val) || val <= 0) return acc;
    const itCoverage = parseFloat(it.unitsCovered) || batchCoverageUnits;
    return acc + ((val / itCoverage) * batchCoverageUnits);
  }, 0);

  const hasInitialGuess = initialEstimate !== null && initialEstimate > 0;
  const hasItems = bucket.items.length > 0;

  // Level 1 -> Level 2 comparison is based on the real cash amount the user typed
  const unallocatedCost = hasInitialGuess ? Math.max(0, initialEstimate - itemSum) : 0;
  const exceededCost = hasInitialGuess ? Math.max(0, itemSum - initialEstimate) : 0;
  const isExceeded = exceededCost > 0.01;
  const isMatched =
    hasInitialGuess && Math.abs(itemSum - initialEstimate) <= 0.01 && itemSum > 0;

  const updateItem = (id: string, updates: Partial<LineItemDraft>) => {
    const nextItems = bucket.items.map((item) => (item.id === id ? { ...item, ...updates } : item));
    const nextSum = nextItems.reduce((acc, it) => {
      const val = parseFloat(it.amount);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const shouldSyncTotal = !hasInitialGuess || nextSum > (initialEstimate ?? 0);

    onChange({
      items: nextItems,
      ...(shouldSyncTotal
        ? { totalSpent: nextSum > 0 ? nextSum.toFixed(2).replace(/\.00$/, '') : '' }
        : {}),
    });
  };

  const addItem = () => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newItem: LineItemDraft = {
      id,
      name: '',
      amount: '',
      unitsCovered: bucket.unitsCovered || monthlyUnits || defaultUnitsCovered || '',
      purchaseQuantity: '1',
      purchaseUnit: '',
      details: {},
    };
    const nextItems = [...bucket.items, newItem];
    const nextSum = nextItems.reduce((acc, it) => {
      const val = parseFloat(it.amount);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const shouldSyncTotal = !hasInitialGuess || nextSum > (initialEstimate ?? 0);

    onChange({
      items: nextItems,
      ...(shouldSyncTotal
        ? { totalSpent: nextSum > 0 ? nextSum.toFixed(2).replace(/\.00$/, '') : '' }
        : {}),
    });
    setExpanded(true);
  };

  const removeItem = (id: string) => {
    const nextItems = bucket.items.filter((item) => item.id !== id);
    const nextSum = nextItems.reduce((acc, it) => {
      const val = parseFloat(it.amount);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const shouldSyncTotal = !hasInitialGuess || nextSum > (initialEstimate ?? 0);

    onChange({
      items: nextItems,
      ...(shouldSyncTotal
        ? { totalSpent: nextSum > 0 ? nextSum.toFixed(2).replace(/\.00$/, '') : '' }
        : {}),
    });
  };

  const handleConvertUnallocatedToItem = () => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const unallocatedItem: LineItemDraft = {
      id,
      name: '',
      amount: unallocatedCost.toFixed(2).replace(/\.00$/, ''),
      unitsCovered: bucket.unitsCovered || monthlyUnits || defaultUnitsCovered || '',
      purchaseQuantity: '1',
      purchaseUnit: '',
      details: {},
    };
    const nextItems = [...bucket.items, unallocatedItem];
    onChange({
      items: nextItems,
      totalSpent: initialEstimate ? initialEstimate.toString() : bucket.totalSpent,
    });
  };

  const handleDiscardUnallocated = () => {
    onChange({ totalSpent: itemSum > 0 ? itemSum.toFixed(2).replace(/\.00$/, '') : '' });
    setInitialEstimate(null);
  };

  const handleAcknowledgeExceeded = () => {
    setInitialEstimate(null);
  };

  const handleToggleBreakdown = () => {
    if (!expanded) {
      const val = parseFloat(bucket.totalSpent);
      const hasPriorCost = !isNaN(val) && val > 0;

      if (bucket.items.length === 0) {
        const id =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        if (hasPriorCost) {
          // User entered data in Level 1 -> Keep initial estimate, but start with a clean blank item so unallocated balance is visible
          setInitialEstimate(val);
          const blankItem: LineItemDraft = {
            id,
            name: '',
            amount: '',
            unitsCovered: bucket.unitsCovered.trim() || monthlyUnits || defaultUnitsCovered || '',
            purchaseQuantity: '1',
            purchaseUnit: '',
            details: {},
          };
          onChange({
            items: [blankItem],
            totalSpent: bucket.totalSpent.trim(),
          });
        } else {
          // Direct dedicated user -> Start with clean blank item
          setInitialEstimate(null);
          const blankItem: LineItemDraft = {
            id,
            name: '',
            amount: '',
            unitsCovered: bucket.unitsCovered.trim() || monthlyUnits || defaultUnitsCovered || '',
            purchaseQuantity: '1',
            purchaseUnit: '',
            details: {},
          };
          onChange({
            items: [blankItem],
          });
        }
        setExpanded(true);
      } else {
        if (hasPriorCost) {
          setInitialEstimate(val);
        }
        setExpanded(true);
      }
    } else {
      setExpanded(false);
    }
  };

  return (
    <article
      className={cn(
        "rounded-2xl border bg-card p-4 sm:p-5 transition-all shadow-2xs hover:shadow-xs",
        bucket.isNone ? "border-border/60 bg-muted/15" : "border-border"
      )}
    >
      {/* Category Header with Icon, Name, and Visible No-Cost Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl border shadow-2xs",
              theme.bg,
              theme.border,
              theme.color
            )}
          >
            <CategoryIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
              {hasItems && !bucket.isNone && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {bucket.items.length} {bucket.items.length === 1 ? 'item' : 'items'}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate max-w-sm sm:max-w-md">{question}</p>
          </div>
        </div>

        {/* Clear, High-Contrast "No costs" Toggle in Header */}
        {!bucket.isNone && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-lg border-border/80 bg-background px-3 text-xs font-semibold text-foreground shadow-2xs hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive transition-all"
            onClick={() => onChange({ isNone: true, totalSpent: '0', items: [] })}
            title={t('skipCategory')}
          >
            <Ban className="size-3.5 mr-1.5 text-muted-foreground" />
            <span>{t('skipCategory')}</span>
          </Button>
        )}
      </div>

      {bucket.isNone ? (
        /* Marked as None: High-Contrast, Clear State with Restore Button */
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-dashed border-border/80 bg-muted/30 p-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Ban className="size-4" />
            </span>
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">
              {t('markedAsNoCost')}
            </span>
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-8 text-xs font-semibold shadow-2xs"
            onClick={() => onChange({ isNone: false, totalSpent: '', items: [] })}
          >
            <Plus className="size-3.5 mr-1" />
            {t('addCosts')}
          </Button>
        </div>
      ) : (
        <>
          {/* Level 1 View when Collapsed (Standard Inputs) */}
          {!expanded ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {/* Amount Spent Input */}
              <div className="space-y-1">
                <label htmlFor={`${prefix}-amount`} className="text-xs font-semibold text-foreground">
                  {t('amountSpent')}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-medium text-muted-foreground">
                    {currencyCode}
                  </span>
                  <Input
                    id={`${prefix}-amount`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={bucket.totalSpent}
                    onChange={(event) => onChange({ totalSpent: event.target.value })}
                    placeholder={t('amountPlaceholder')}
                    className="h-10 pl-14 text-sm font-medium"
                  />
                </div>
              </div>

              {/* Units Produced Input with Quick-Pick Button */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                  <label htmlFor={`${prefix}-coverage`} className="text-xs font-semibold text-foreground">
                    {t('unitsCovered')} {unitsCoveredRequired && <span className="text-destructive">*</span>}
                  </label>

                  {/* Quick-Pick 1-Click Monthly Production Units Button */}
                  {monthlyUnits && Number(monthlyUnits) > 0 && (
                    <button
                      type="button"
                      onClick={() => onChange({ unitsCovered: monthlyUnits })}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors shrink-0",
                        bucket.unitsCovered === monthlyUnits
                          ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/60"
                      )}
                      title={t('useMonthlyOutputHint')}
                    >
                      <Zap className="size-3 text-amber-500" />
                      <span>
                        {bucket.unitsCovered === monthlyUnits ? `✓ ${monthlyUnits}` : monthlyUnits} {unitLabel || ''}
                      </span>
                    </button>
                  )}
                </div>

                <Input
                  id={`${prefix}-coverage`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={bucket.unitsCovered}
                  onChange={(event) => onChange({ unitsCovered: event.target.value })}
                  placeholder={defaultUnitsCovered || monthlyUnits || t('unitsPlaceholder')}
                  className="h-10 text-sm font-medium"
                />
              </div>
            </div>
          ) : (
            /* Level 2 View: Level 1 inputs are hidden to keep card compact */
            hasInitialGuess ? (
              /* Level 1 -> Level 2 Transition: Reality Check / Estimation Accuracy Banner */
              <div className="mt-4 rounded-xl border border-border/80 bg-gradient-to-br from-card to-muted/30 p-3 sm:p-3.5 space-y-2.5 shadow-2xs">
                {/* Top Row: Initial Guess vs Itemized Actual + Switch button */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-muted-foreground">{t('initialGuess')}:</span>
                    <span className="font-bold text-foreground bg-background px-2.5 py-1 rounded-md border border-border/70 shadow-2xs">
                      {currencyCode} {initialEstimate.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground/40">vs</span>
                    <span className="font-semibold text-muted-foreground">{t('itemizedActual')}:</span>
                    <span className="font-bold text-foreground bg-background px-2.5 py-1 rounded-md border border-border/70 shadow-2xs">
                      {currencyCode} {itemSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      ({bucket.items.length} {bucket.items.length === 1 ? 'item' : 'items'})
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs font-medium text-muted-foreground hover:text-foreground gap-1"
                    onClick={() => setExpanded(false)}
                    title={t('switchToQuickEstimate')}
                  >
                    <ChevronUp className="size-3.5" />
                    <span>{t('switchToQuickEstimate')}</span>
                  </Button>
                </div>

                {/* Batch Cost Allocation note if item coverage differs from batch coverage */}
                {Math.abs(itemSum - batchAllocatedItemSum) > 0.01 && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded-md border border-border/40">
                    <Scale className="size-3 text-primary shrink-0" />
                    <span>
                      {t('batchCostNote', {
                        batchAmount: `${currencyCode} ${batchAllocatedItemSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
                        rawAmount: `${currencyCode} ${itemSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
                      })}
                    </span>
                  </div>
                )}

                {/* Accuracy Insight Pill & Exceeded Dismissal */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs">
                  {itemSum === 0 ? (
                    <span className="text-muted-foreground text-xs">
                      {t('listItemsToCompareHint', { amount: `${currencyCode} ${initialEstimate.toLocaleString()}` })}
                    </span>
                  ) : isExceeded ? (
                    <div className="flex items-center justify-between gap-2 w-full flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                        ⚠️ {t('exceededBadge', {
                          amount: `${currencyCode} ${exceededCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
                          percent: Math.round((exceededCost / initialEstimate) * 100),
                        })}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                        onClick={handleAcknowledgeExceeded}
                        title={t('dismissComparison')}
                      >
                        {t('dismissComparison')}
                      </Button>
                    </div>
                  ) : isMatched ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      ✓ {t('perfectEstimateNotice')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                      ℹ️ {t('overestimatedNotice', {
                        amount: `${currencyCode} ${unallocatedCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
                      })}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* Dedicated User (Started in Level 2 directly): Clean, Compact Itemized Header */
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/70 bg-muted/20 px-3.5 py-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Layers className="size-4 text-primary shrink-0" />
                  <span className="text-xs font-bold text-foreground">
                    {t('itemsBreakdownHeading')}
                  </span>
                  <span className="text-muted-foreground/50">•</span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t('itemSum')}:{' '}
                    <strong className="text-foreground font-bold">
                      {currencyCode} {itemSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </strong>
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {bucket.items.length} {bucket.items.length === 1 ? 'item' : 'items'}
                  </span>
                  {Math.abs(itemSum - batchAllocatedItemSum) > 0.01 && (
                    <span
                      className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/40"
                      title={t('batchCostNote', {
                        batchAmount: `${currencyCode} ${batchAllocatedItemSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
                        rawAmount: `${currencyCode} ${itemSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
                      })}
                    >
                      ({currencyCode} {batchAllocatedItemSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} used for this production run)
                    </span>
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs font-medium text-muted-foreground hover:text-foreground gap-1"
                  onClick={() => setExpanded(false)}
                  title={t('switchToQuickEstimate')}
                >
                  <ChevronUp className="size-3.5" />
                  <span>{t('switchToQuickEstimate')}</span>
                </Button>
              </div>
            )
          )}

          {/* Level 2: Expanded One-by-One Itemized Section */}
          {expanded && (
            <div className="mt-5 space-y-3.5 border-t border-border pt-4">
              {/* UX Guidance Tip showing what to enter by realistic example */}
              <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/15 px-3 py-2 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 text-primary shrink-0" />
                <span>{t('lineItemExampleTip')}</span>
              </div>

              {/* Guided Item Cards (Clean & Self-Explanatory) */}
              <div className="space-y-3">
                {bucket.items.map((item, index) => {
                  const activeLevel3Count = getActiveLevel3Count(item, bucketKey);

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-border/80 bg-card p-3 sm:p-3.5 transition-all hover:border-primary/40 hover:shadow-2xs space-y-3"
                    >
                      {/* Top Line: Item Name & Remove Button */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <label
                              htmlFor={`${prefix}-item-${index}-name`}
                              className="text-[11px] font-semibold text-foreground/80 block"
                            >
                              {t('colItemName')}
                            </label>
                            <span className="text-[10px] font-medium text-muted-foreground/70">
                              #{index + 1}
                            </span>
                          </div>
                          <Input
                            id={`${prefix}-item-${index}-name`}
                            value={item.name}
                            onChange={(e) => updateItem(item.id, { name: e.target.value })}
                            placeholder={
                              bucketKey === 'material' || bucketKey === 'materials'
                                ? 'e.g. Flour, Sugar, Packaging...'
                                : bucketKey === 'labor'
                                ? 'e.g. Chef, Baker, Delivery staff...'
                                : title
                            }
                            className="h-9.5 text-xs sm:text-sm font-medium"
                          />
                        </div>

                        {/* Remove Item Button */}
                        <div className="pt-5 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="size-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeItem(item.id)}
                            title={t('removeLine')}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Middle Line: Purchased Qty/Unit, Total Cost, Units Covered / Usage per Item */}
                      {(() => {
                        const isRecipe = item.details?.method === 'recipe';
                        const itemAmt = parseFloat(item.amount) || 0;
                        const itemCov = parseFloat(item.unitsCovered) || 0;
                        const costPerUnit = itemCov > 0 ? (itemAmt / itemCov) : 0;
                        const pUnit = item.purchaseUnit?.trim();
                        const uUnit = item.details?.usage_unit?.trim();
                        const areIncompatible = isRecipe && pUnit && uUnit && !areUnitsCompatible(pUnit, uUnit);

                        return (
                          <div className="space-y-2 pt-1 border-t border-border/50">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                              {/* 1. Purchased Quantity & Unit */}
                              <div className="space-y-1">
                                <label
                                  htmlFor={`${prefix}-item-${index}-qty`}
                                  className="text-[11px] font-semibold text-muted-foreground block"
                                >
                                  {t('colPurchased')}
                                </label>
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    id={`${prefix}-item-${index}-qty`}
                                    type="text"
                                    inputMode="decimal"
                                    value={item.purchaseQuantity ?? ''}
                                    onChange={(e) => {
                                      const newQty = e.target.value;
                                      if (isRecipe) {
                                        const res = getRecipeCoverage(newQty, item.purchaseUnit, item.details?.usage_quantity, item.details?.usage_unit);
                                        updateItem(item.id, {
                                          purchaseQuantity: newQty,
                                          details: { ...(item.details || {}), method: 'recipe', purchase_quantity: newQty },
                                          ...(res.unitsCovered ? { unitsCovered: res.unitsCovered.toFixed(2).replace(/\.00$/, '') } : {}),
                                        });
                                      } else {
                                        updateItem(item.id, { purchaseQuantity: newQty });
                                      }
                                    }}
                                    placeholder="1"
                                    className="h-9 w-20 text-center text-xs font-medium"
                                    title={t('linePurchaseQuantity')}
                                  />
                                  <Input
                                    value={item.purchaseUnit ?? ''}
                                    onChange={(e) => {
                                      const newUnit = e.target.value;
                                      if (isRecipe) {
                                        const res = getRecipeCoverage(item.purchaseQuantity, newUnit, item.details?.usage_quantity, item.details?.usage_unit);
                                        updateItem(item.id, {
                                          purchaseUnit: newUnit,
                                          details: { ...(item.details || {}), method: 'recipe', purchase_unit: newUnit },
                                          ...(res.unitsCovered ? { unitsCovered: res.unitsCovered.toFixed(2).replace(/\.00$/, '') } : {}),
                                        });
                                      } else {
                                        updateItem(item.id, { purchaseUnit: newUnit });
                                      }
                                    }}
                                    list="common-units"
                                    placeholder={t('linePurchaseUnitPlaceholder')}
                                    className="h-9 flex-1 text-xs"
                                    title={t('linePurchaseUnit')}
                                  />
                                </div>
                              </div>

                              {/* 2. Total Cost */}
                              <div className="space-y-1">
                                <label
                                  htmlFor={`${prefix}-item-${index}-amount`}
                                  className="text-[11px] font-semibold text-muted-foreground block"
                                >
                                  {t('colTotalCost')}
                                </label>
                                <div className="relative">
                                  <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-[11px] font-semibold text-muted-foreground">
                                    {currencyCode}
                                  </span>
                                  <Input
                                    id={`${prefix}-item-${index}-amount`}
                                    type="text"
                                    inputMode="decimal"
                                    value={item.amount}
                                    onChange={(e) => updateItem(item.id, { amount: e.target.value })}
                                    placeholder="0.00"
                                    className="h-9 pl-11 text-xs font-semibold"
                                  />
                                </div>
                              </div>

                              {/* 3. Costing Method & Calculation: Total Made vs Per Item Usage */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-1">
                                  <label
                                    className="text-[11px] font-semibold text-muted-foreground block truncate"
                                    title={isRecipe ? t('usedPerItem') : t('colUnitsCovered')}
                                  >
                                    {isRecipe ? t('usedPerItem') : t('colUnitsCovered')}
                                  </label>

                                  {/* Sleek Method Pill Switcher */}
                                  <div className="inline-flex items-center rounded-md bg-muted/80 p-0.5 border border-border/70 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newDetails = { ...(item.details || {}) };
                                        delete newDetails.method;
                                        delete newDetails.usage_quantity;
                                        delete newDetails.usage_unit;
                                        updateItem(item.id, { details: newDetails });
                                      }}
                                      className={cn(
                                        "px-1.5 py-0.5 text-[10px] rounded transition-all flex items-center gap-0.5",
                                        !isRecipe
                                          ? "bg-background text-foreground shadow-2xs font-bold"
                                          : "text-muted-foreground hover:text-foreground"
                                      )}
                                      title={t('modeTotalMade')}
                                    >
                                      <span>📦</span>
                                      <span>{t('modeTotalMadeShort')}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const currentUUnit = item.details?.usage_unit || getSuggestedUsageUnit(item.purchaseUnit);
                                        const currentUQty = item.details?.usage_quantity || '';
                                        const newDetails = {
                                          ...(item.details || {}),
                                          method: 'recipe',
                                          usage_unit: currentUUnit,
                                          ...(item.purchaseQuantity ? { purchase_quantity: item.purchaseQuantity } : {}),
                                          ...(item.purchaseUnit ? { purchase_unit: item.purchaseUnit } : {}),
                                          ...(currentUQty ? { usage_quantity: currentUQty } : {}),
                                        };
                                        const res = getRecipeCoverage(item.purchaseQuantity, item.purchaseUnit, currentUQty, currentUUnit);
                                        updateItem(item.id, {
                                          details: newDetails,
                                          ...(res.unitsCovered ? { unitsCovered: res.unitsCovered.toFixed(2).replace(/\.00$/, '') } : {}),
                                        });
                                      }}
                                      className={cn(
                                        "px-1.5 py-0.5 text-[10px] rounded transition-all flex items-center gap-0.5",
                                        isRecipe
                                          ? "bg-primary text-primary-foreground shadow-2xs font-bold"
                                          : "text-muted-foreground hover:text-foreground"
                                      )}
                                      title={t('modePerItem')}
                                    >
                                      <span>🍰</span>
                                      <span>{t('modePerItemShort')}</span>
                                    </button>
                                  </div>
                                </div>

                                {isRecipe ? (
                                  /* Recipe / Per Item Mode Inputs: [ Usage Qty ] [ Usage Unit ] */
                                  <div className="flex items-center gap-1.5">
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      value={item.details?.usage_quantity ?? ''}
                                      onChange={(e) => {
                                        const newUsageQty = e.target.value;
                                        const newDetails = {
                                          ...(item.details || {}),
                                          method: 'recipe',
                                          usage_quantity: newUsageQty,
                                          ...(item.purchaseQuantity ? { purchase_quantity: item.purchaseQuantity } : {}),
                                          ...(item.purchaseUnit ? { purchase_unit: item.purchaseUnit } : {}),
                                        };
                                        const res = getRecipeCoverage(item.purchaseQuantity, item.purchaseUnit, newUsageQty, item.details?.usage_unit);
                                        updateItem(item.id, {
                                          details: newDetails,
                                          ...(res.unitsCovered ? { unitsCovered: res.unitsCovered.toFixed(2).replace(/\.00$/, '') } : {}),
                                        });
                                      }}
                                      placeholder={t('usedPerItemPlaceholder')}
                                      className="h-9 w-20 text-center text-xs font-medium"
                                      title={t('usedPerItem')}
                                    />
                                    <Input
                                      type="text"
                                      value={item.details?.usage_unit ?? ''}
                                      onChange={(e) => {
                                        const newUsageUnit = e.target.value;
                                        const newDetails = {
                                          ...(item.details || {}),
                                          method: 'recipe',
                                          usage_unit: newUsageUnit,
                                          ...(item.purchaseQuantity ? { purchase_quantity: item.purchaseQuantity } : {}),
                                          ...(item.purchaseUnit ? { purchase_unit: item.purchaseUnit } : {}),
                                        };
                                        const res = getRecipeCoverage(item.purchaseQuantity, item.purchaseUnit, item.details?.usage_quantity, newUsageUnit);
                                        updateItem(item.id, {
                                          details: newDetails,
                                          ...(res.unitsCovered ? { unitsCovered: res.unitsCovered.toFixed(2).replace(/\.00$/, '') } : {}),
                                        });
                                      }}
                                      list="common-units"
                                      placeholder={t('usageUnitPlaceholder')}
                                      className="h-9 flex-1 text-xs"
                                      title={t('usageUnitPlaceholder')}
                                    />
                                  </div>
                                ) : (
                                  /* Total Made / Direct Mode: [ Units Covered ] + Quick-Pick Monthly */
                                  <div className="flex items-center gap-1.5">
                                    <Input
                                      id={`${prefix}-item-${index}-units`}
                                      type="text"
                                      inputMode="decimal"
                                      value={item.unitsCovered}
                                      onChange={(e) => updateItem(item.id, { unitsCovered: e.target.value })}
                                      placeholder={bucket.unitsCovered || monthlyUnits || 'Units'}
                                      className="h-9 flex-1 text-xs"
                                    />
                                    {monthlyUnits && Number(monthlyUnits) > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => updateItem(item.id, { unitsCovered: monthlyUnits })}
                                        className={cn(
                                          "h-9 px-2 rounded-md border text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-colors",
                                          item.unitsCovered === monthlyUnits
                                            ? "bg-primary/15 text-primary border-primary/30"
                                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border-border/60"
                                        )}
                                        title={t('useMonthlyOutputHint')}
                                      >
                                        <Zap className="size-3 text-amber-500" />
                                        <span>{monthlyUnits}</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Live Unit Cost & Coverage Guidance Banner */}
                            {areIncompatible ? (
                              <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/25">
                                <span>⚠️</span>
                                <span>{t('incompatibleUnitWarn', { pUnit: pUnit || '?', uUnit: uUnit || '?' })}</span>
                              </div>
                            ) : isRecipe && itemCov > 0 ? (
                              <div className="flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/25 font-medium">
                                <span>
                                  {t('calcCoversResult', {
                                    units: itemCov.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                                    cost: `${currencyCode} ${costPerUnit.toFixed(2)}`,
                                  })}
                                </span>
                              </div>
                            ) : !isRecipe && itemCov > 0 && itemAmt > 0 ? (
                              <div className="flex justify-end text-[11px] text-muted-foreground px-1 font-medium">
                                <span>{t('calcCostPerUnitResult', { cost: `${currencyCode} ${costPerUnit.toFixed(2)}` })}</span>
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}

                      {/* Bottom Line: Last Pick -> Advanced Settings Trigger */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                        <span className="text-[11px] text-muted-foreground">
                          {activeLevel3Count > 0 ? (
                            <span className="text-primary font-semibold flex items-center gap-1">
                              <CheckCircle2 className="size-3 text-primary" />
                              {t('advancedConfigured', { count: activeLevel3Count })}
                            </span>
                          ) : (
                            <span>{t('lastPickAdvancedHint')}</span>
                          )}
                        </span>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-8 px-2.5 text-xs font-medium gap-1.5 transition-all shadow-2xs",
                            activeLevel3Count > 0
                              ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:border-primary/40"
                          )}
                          onClick={() => setSelectedLevel3Item(item)}
                          title={t('level3Button')}
                        >
                          <SlidersHorizontal className="size-3.5" />
                          <span>{t('level3Button')}</span>
                          {activeLevel3Count > 0 && (
                            <span className="rounded-full bg-primary/20 px-1.5 text-[10px] font-bold text-primary">
                              {activeLevel3Count}
                            </span>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Special Interactive Unallocated Balance Row */}
              {hasInitialGuess && unallocatedCost > 0.01 && (
                <div className="rounded-xl border border-dashed border-primary/35 bg-gradient-to-r from-primary/5 via-primary/[0.08] to-transparent p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-3 transition-all hover:border-primary/50">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Scale className="size-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {t('unallocatedBalanceTitle')}
                        </span>
                        <span className="font-bold text-xs text-primary bg-background px-2 py-0.5 rounded border border-primary/25 shadow-2xs">
                          {currencyCode} {unallocatedCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t('unallocatedBalanceDesc', { initial: `${currencyCode} ${initialEstimate.toLocaleString()}` })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs font-semibold bg-background hover:bg-primary hover:text-primary-foreground border-primary/40 shadow-2xs gap-1.5"
                      onClick={handleConvertUnallocatedToItem}
                    >
                      <Plus className="size-3.5" />
                      <span>{t('convertUnallocatedAction')}</span>
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5"
                      onClick={handleDiscardUnallocated}
                      title={t('discardUnallocatedAction')}
                    >
                      <Trash2 className="size-3.5" />
                      <span>{t('discardUnallocatedAction')}</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Add Item Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-full sm:w-auto text-xs font-semibold border-dashed border-border/90 hover:border-primary/50 hover:bg-primary/5"
                onClick={addItem}
              >
                <Plus className="size-3.5 mr-1.5" />
                {t('addLine')}
              </Button>
            </div>
          )}

          {/* Bottom Card Controls: Toggle Breakdown */}
          <div className="mt-3.5 flex items-center justify-between border-t border-border/60 pt-3">
            <span className="text-xs text-muted-foreground">
              {bucket.items.length > 0 && !expanded && (
                <span>
                  {bucket.items.length} {bucket.items.length === 1 ? 'item' : 'items'} ({currencyCode} {itemSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })})
                </span>
              )}
            </span>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-medium gap-1.5"
              aria-expanded={expanded}
              onClick={handleToggleBreakdown}
            >
              {expanded ? (
                <>
                  <ChevronUp className="size-3.5" />
                  {t('hideDetails')}
                </>
              ) : (
                <>
                  <ChevronDown className="size-3.5" />
                  {t('breakDown')}
                  {bucket.items.length > 0 && (
                    <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                      {bucket.items.length}
                    </span>
                  )}
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {/* Level 3 Advanced Settings Pop-up Modal */}
      <Level3DetailsModal
        open={selectedLevel3Item !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedLevel3Item(null);
        }}
        bucketKey={bucketKey}
        categoryTitle={title}
        item={selectedLevel3Item}
        currencyCode={currencyCode}
        onSave={(updates) => {
          if (selectedLevel3Item) {
            updateItem(selectedLevel3Item.id, updates);
          }
        }}
      />

      {/* Global Datalist for Popular Measurement Units */}
      <datalist id="common-units">
        {POPULAR_UNITS.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </datalist>
    </article>
  );
}
