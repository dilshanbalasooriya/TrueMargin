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
} from 'lucide-react';
import { cn } from 'cn';
import type { BucketDraft, LineItemDraft } from '@/store/useCalculatorStore';
import { Level3DetailsModal, getActiveLevel3Count } from './Level3DetailsModal';

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

  // Running sum of itemized costs in Level 2
  const itemSum = bucket.items.reduce((acc, it) => {
    const val = parseFloat(it.amount);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const hasInitialGuess = initialEstimate !== null && initialEstimate > 0;
  const hasItems = bucket.items.length > 0;

  const updateItem = (id: string, updates: Partial<LineItemDraft>) => {
    const nextItems = bucket.items.map((item) => (item.id === id ? { ...item, ...updates } : item));
    const nextSum = nextItems.reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0);
    onChange({
      items: nextItems,
      ...(!hasInitialGuess ? { totalSpent: nextSum > 0 ? nextSum.toString() : '' } : {}),
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
      details: {},
    };
    const nextItems = [...bucket.items, newItem];
    const nextSum = nextItems.reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0);
    onChange({
      items: nextItems,
      ...(!hasInitialGuess ? { totalSpent: nextSum > 0 ? nextSum.toString() : '' } : {}),
    });
    setExpanded(true);
  };

  const removeItem = (id: string) => {
    const nextItems = bucket.items.filter((item) => item.id !== id);
    const nextSum = nextItems.reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0);
    onChange({
      items: nextItems,
      ...(!hasInitialGuess ? { totalSpent: nextSum > 0 ? nextSum.toString() : '' } : {}),
    });
  };

  const handleAdoptActualTotal = () => {
    onChange({ totalSpent: itemSum > 0 ? itemSum.toString() : '' });
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
          // User entered data in Level 1 -> Auto-populate Item #1!
          setInitialEstimate(val);
          const populatedItem: LineItemDraft = {
            id,
            name: title,
            amount: bucket.totalSpent.trim(),
            unitsCovered: bucket.unitsCovered.trim() || monthlyUnits || defaultUnitsCovered || '',
            purchaseQuantity: '1',
            purchaseUnit: '',
            details: {},
          };
          onChange({
            items: [populatedItem],
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

                {/* Accuracy Insight Pill & Adopt Action */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs">
                  {itemSum === 0 ? (
                    <span className="text-muted-foreground text-xs">
                      {t('listItemsToCompareHint', { amount: `${currencyCode} ${initialEstimate.toLocaleString()}` })}
                    </span>
                  ) : itemSum > initialEstimate ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                        ⚠️ {t('underestimatedNotice', {
                          amount: `${currencyCode} ${(itemSum - initialEstimate).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
                          percent: Math.round(((itemSum - initialEstimate) / initialEstimate) * 100),
                        })}
                      </span>
                      <span className="text-[11px] text-muted-foreground hidden sm:inline">
                        {t('actualHigherMessage')}
                      </span>
                    </div>
                  ) : itemSum < initialEstimate ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                      ℹ️ {t('overestimatedNotice', {
                        amount: `${currencyCode} ${(initialEstimate - itemSum).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
                      })}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      ✓ {t('perfectEstimateNotice')}
                    </span>
                  )}

                  {/* 1-Click Adopt Actual Total */}
                  {itemSum > 0 && Math.abs(itemSum - initialEstimate) > 0.01 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs font-medium border-primary/30 hover:bg-primary/10 hover:text-primary transition-all shadow-2xs"
                      onClick={handleAdoptActualTotal}
                      title={t('adoptActualTotal', { amount: `${currencyCode} ${itemSum.toLocaleString()}` })}
                    >
                      <RefreshCw className="mr-1.5 size-3 text-primary" />
                      <span>{t('adoptActualTotal', { amount: `${currencyCode} ${itemSum.toLocaleString()}` })}</span>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              /* Dedicated User (Started in Level 2 directly): Clean, Compact Itemized Header */
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/70 bg-muted/20 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
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

                      {/* Middle Line: Purchased Qty/Unit, Total Cost, Units Covered */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-border/50">
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
                              onChange={(e) => updateItem(item.id, { purchaseQuantity: e.target.value })}
                              placeholder="1"
                              className="h-9 w-20 text-center text-xs font-medium"
                              title={t('linePurchaseQuantity')}
                            />
                            <Input
                              value={item.purchaseUnit ?? ''}
                              onChange={(e) => updateItem(item.id, { purchaseUnit: e.target.value })}
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

                        {/* 3. Units Covered */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label
                              htmlFor={`${prefix}-item-${index}-units`}
                              className="text-[11px] font-semibold text-muted-foreground block"
                            >
                              {t('colUnitsCovered')}
                            </label>
                            {monthlyUnits && Number(monthlyUnits) > 0 && (
                              <button
                                type="button"
                                onClick={() => updateItem(item.id, { unitsCovered: monthlyUnits })}
                                className="text-[10px] text-amber-500 font-semibold flex items-center gap-0.5 hover:underline"
                                title={t('useMonthlyOutputHint')}
                              >
                                <Zap className="size-2.5" /> {monthlyUnits}
                              </button>
                            )}
                          </div>
                          <Input
                            id={`${prefix}-item-${index}-units`}
                            type="text"
                            inputMode="decimal"
                            value={item.unitsCovered}
                            onChange={(e) => updateItem(item.id, { unitsCovered: e.target.value })}
                            placeholder={bucket.unitsCovered || monthlyUnits || 'Units'}
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>

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
                  {bucket.items.length} {bucket.items.length === 1 ? 'item' : 'items'} ({currencyCode} {itemSum.toLocaleString()})
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
    </article>
  );
}
