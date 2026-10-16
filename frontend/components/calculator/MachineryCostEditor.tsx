'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2, SlidersHorizontal, Cog, Sparkles, Pencil, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { LineItemDraft } from '@/store/useCalculatorStore';

export interface MachineryPreset {
  id: string;
  nameKey: string;
  icon: string;
  defaultMethod: 'units' | 'periods' | 'none';
}

export const MACHINERY_PRESETS: readonly MachineryPreset[] = [
  {
    id: 'computer',
    nameKey: 'machineryPresetComputer',
    icon: '💻',
    defaultMethod: 'periods',
  },
  {
    id: 'printer',
    nameKey: 'machineryPresetPrinter',
    icon: '🖨️',
    defaultMethod: 'units',
  },
  {
    id: 'cutter',
    nameKey: 'machineryPresetCutter',
    icon: '✂️',
    defaultMethod: 'units',
  },
  {
    id: 'primary_tool',
    nameKey: 'machineryPresetPrimaryTool',
    icon: '⚙️',
    defaultMethod: 'units',
  },
  {
    id: 'packaging_sealer',
    nameKey: 'machineryPresetPackaging',
    icon: '📦',
    defaultMethod: 'units',
  },
  {
    id: 'rental',
    nameKey: 'machineryPresetRental',
    icon: '🏢',
    defaultMethod: 'none',
  },
] as const;

interface MachineryCostEditorProps {
  items: LineItemDraft[];
  currencyCode: string;
  batchUnits: number;
  monthlyUnits: number;
  unallocatedCost?: number;
  activeItemId?: string | null;
  onSetActiveItem?: (id: string | null) => void;
  onAllocateUnallocated?: () => void;
  onAddPreset: (preset: MachineryPreset) => void;
  onAddItem: (method?: 'units' | 'periods' | 'none') => void;
  onUpdate: (id: string, updates: Partial<LineItemDraft>) => void;
  onRemove: (id: string) => void;
  onOpenLevel3: (item: LineItemDraft) => void;
}

export function MachineryCostEditor({
  items,
  currencyCode,
  batchUnits,
  monthlyUnits,
  unallocatedCost = 0,
  activeItemId,
  onSetActiveItem,
  onAllocateUnallocated,
  onAddPreset,
  onAddItem,
  onUpdate,
  onRemove,
  onOpenLevel3,
}: MachineryCostEditorProps) {
  const t = useTranslations('Calculator');

  // Internal active item fallback if uncontrolled
  const [internalActiveId, setInternalActiveId] = useState<string | null>(() => {
    if (items.length > 0) {
      const incomplete = items.find((it) => !it.name.trim() || !it.amount.trim());
      return incomplete?.id ?? items[items.length - 1]?.id ?? null;
    }
    return null;
  });

  const prevItemsLengthRef = useRef(items.length);
  useEffect(() => {
    if (items.length > prevItemsLengthRef.current) {
      const newestItem = items[items.length - 1];
      if (newestItem) {
        setInternalActiveId(newestItem.id);
        onSetActiveItem?.(newestItem.id);
      }
    }
    prevItemsLengthRef.current = items.length;
  }, [items.length, onSetActiveItem]);

  const activeId = activeItemId !== undefined ? activeItemId : internalActiveId;
  const setActiveId = (id: string | null) => {
    setInternalActiveId(id);
    onSetActiveItem?.(id);
  };

  // Horizontal scroll controls for suggestions bar
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    }
  };

  const scrollByAmount = (offset: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Compute calculated wear for a machinery line item
  const calculateWear = (item: LineItemDraft) => {
    const method = item.details?.depreciation_method ?? 'units';
    const purchase = parseFloat(item.details?.purchase_price ?? item.amount ?? '0') || 0;
    const salvage = parseFloat(item.details?.salvage_value ?? '0') || 0;
    const netBase = Math.max(0, purchase - salvage);

    if (method === 'units') {
      const lifetime = parseFloat(item.details?.lifetime_units ?? '0') || 0;
      const unitCost = lifetime > 0 ? netBase / lifetime : 0;
      const batchWear = unitCost * batchUnits;
      return {
        unitCost,
        batchWear,
        monthlyWear: unitCost * monthlyUnits,
      };
    }

    if (method === 'periods') {
      const periods = parseFloat(item.details?.useful_life_periods ?? '0') || 0;
      const monthlyWear = periods > 0 ? netBase / periods : 0;
      const effectiveMonthlyUnits = monthlyUnits > 0 ? monthlyUnits : batchUnits;
      const unitCost = effectiveMonthlyUnits > 0 ? monthlyWear / effectiveMonthlyUnits : 0;
      const batchWear = unitCost * batchUnits;
      return {
        unitCost,
        batchWear,
        monthlyWear,
      };
    }

    // Direct / Rental / Fee
    const basis = (item.details?.rental_basis as 'batch' | 'unit' | 'month') || 'batch';
    if (basis === 'unit') {
      const rate = parseFloat(item.details?.rental_rate ?? (parseFloat(item.amount || '0') > 0 ? (parseFloat(item.amount) / Math.max(1, batchUnits)).toString() : '0')) || 0;
      const batchWear = rate * batchUnits;
      return {
        unitCost: rate,
        batchWear,
        monthlyWear: rate * monthlyUnits,
      };
    }
    if (basis === 'month') {
      const monthlyRent = parseFloat(item.details?.rental_rate ?? '0') || 0;
      const effectiveMonthlyUnits = monthlyUnits > 0 ? monthlyUnits : batchUnits;
      const unitCost = effectiveMonthlyUnits > 0 ? monthlyRent / effectiveMonthlyUnits : 0;
      const batchWear = unitCost * batchUnits;
      return {
        unitCost,
        batchWear,
        monthlyWear: monthlyRent,
      };
    }

    // Default 'batch'
    const directAmount = parseFloat(item.amount || '0') || 0;
    return {
      unitCost: batchUnits > 0 ? directAmount / batchUnits : 0,
      batchWear: directAmount,
      monthlyWear: directAmount,
    };
  };

  const handleMethodChange = (item: LineItemDraft, nextMethod: 'units' | 'periods' | 'none') => {
    const prevMethod = item.details?.depreciation_method ?? 'units';
    if (prevMethod === nextMethod) return;

    const purchase = item.details?.purchase_price || item.amount || '';
    const updates: Partial<LineItemDraft> = {
      details: {
        ...item.details,
        depreciation_method: nextMethod,
        purchase_price: purchase,
        cost_behavior: nextMethod === 'units' ? 'variable' : 'fixed',
      },
    };

    // Calculate new amount for this batch
    const tempItem = { ...item, ...updates };
    const wear = calculateWear(tempItem);
    updates.amount = wear.batchWear > 0 ? wear.batchWear.toFixed(2).replace(/\.00$/, '') : '';

    onUpdate(item.id, updates);
  };

  const handlePurchasePriceChange = (item: LineItemDraft, val: string) => {
    const method = item.details?.depreciation_method ?? 'units';
    const updates: Partial<LineItemDraft> = {
      details: {
        ...item.details,
        purchase_price: val,
      },
    };

    if (method === 'none') {
      updates.amount = val;
    } else {
      const tempItem = {
        ...item,
        details: { ...item.details, purchase_price: val },
      };
      const wear = calculateWear(tempItem);
      updates.amount = wear.batchWear > 0 ? wear.batchWear.toFixed(2).replace(/\.00$/, '') : '';
    }

    onUpdate(item.id, updates);
  };

  const handleLifetimeUnitsChange = (item: LineItemDraft, val: string) => {
    const updates: Partial<LineItemDraft> = {
      details: {
        ...item.details,
        lifetime_units: val,
      },
    };
    const tempItem = {
      ...item,
      details: { ...item.details, lifetime_units: val },
    };
    const wear = calculateWear(tempItem);
    updates.amount = wear.batchWear > 0 ? wear.batchWear.toFixed(2).replace(/\.00$/, '') : '';
    onUpdate(item.id, updates);
  };

  const handleUsefulPeriodsChange = (item: LineItemDraft, val: string) => {
    const updates: Partial<LineItemDraft> = {
      details: {
        ...item.details,
        useful_life_periods: val,
      },
    };
    const tempItem = {
      ...item,
      details: { ...item.details, useful_life_periods: val },
    };
    const wear = calculateWear(tempItem);
    updates.amount = wear.batchWear > 0 ? wear.batchWear.toFixed(2).replace(/\.00$/, '') : '';
    onUpdate(item.id, updates);
  };

  const handleDirectAmountChange = (item: LineItemDraft, val: string) => {
    onUpdate(item.id, {
      amount: val,
      details: {
        ...item.details,
        purchase_price: val,
      },
    });
  };

  const handleRentalBasisChange = (item: LineItemDraft, newBasis: 'batch' | 'unit' | 'month') => {
    const currentWear = calculateWear(item);
    const updates: Partial<LineItemDraft> = {
      details: {
        ...item.details,
        rental_basis: newBasis,
        cost_behavior: newBasis === 'month' ? 'fixed' : 'variable',
      },
    };

    if (newBasis === 'batch') {
      updates.amount = currentWear.batchWear > 0 ? currentWear.batchWear.toFixed(2).replace(/\.00$/, '') : item.amount;
    } else if (newBasis === 'unit') {
      const rate = currentWear.unitCost > 0 ? currentWear.unitCost.toFixed(2).replace(/\.00$/, '') : '';
      updates.details!.rental_rate = rate;
      updates.amount = currentWear.batchWear > 0 ? currentWear.batchWear.toFixed(2).replace(/\.00$/, '') : '';
    } else if (newBasis === 'month') {
      const effectiveCap = monthlyUnits > 0 ? monthlyUnits : batchUnits;
      const monthlyRent = currentWear.unitCost > 0 ? (currentWear.unitCost * effectiveCap).toFixed(2).replace(/\.00$/, '') : '';
      updates.details!.rental_rate = monthlyRent;
      updates.amount = currentWear.batchWear > 0 ? currentWear.batchWear.toFixed(2).replace(/\.00$/, '') : '';
    }

    onUpdate(item.id, updates);
  };

  const handleRentalRateChange = (item: LineItemDraft, val: string) => {
    const basis = (item.details?.rental_basis as 'batch' | 'unit' | 'month') || 'batch';
    const rateNum = parseFloat(val) || 0;
    const updates: Partial<LineItemDraft> = {
      details: {
        ...item.details,
        rental_rate: val,
      },
    };

    if (basis === 'unit') {
      const total = rateNum * batchUnits;
      updates.amount = total > 0 ? total.toFixed(2).replace(/\.00$/, '') : '';
    } else if (basis === 'month') {
      const effectiveCap = monthlyUnits > 0 ? monthlyUnits : batchUnits;
      const unitCost = effectiveCap > 0 ? rateNum / effectiveCap : 0;
      const total = unitCost * batchUnits;
      updates.amount = total > 0 ? total.toFixed(2).replace(/\.00$/, '') : '';
    } else {
      updates.amount = val;
    }

    onUpdate(item.id, updates);
  };

  const availablePresets = MACHINERY_PRESETS.filter(
    (preset) => !items.some(
      (it) => it.details?.machinery_preset_id === preset.id || it.name.trim() === t(preset.nameKey)
    )
  );

  useEffect(() => {
    checkScroll();
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [availablePresets.length]);

  const getMachineIcon = (item: LineItemDraft) => {
    const presetId = item.details?.machinery_preset_id;
    if (presetId) {
      const match = MACHINERY_PRESETS.find((p) => p.id === presetId);
      if (match) return match.icon;
    }
    const nameLower = (item.name || '').toLowerCase();
    if (nameLower.includes('print') || nameLower.includes('මුද්‍රණ')) return '🖨️';
    if (nameLower.includes('cut') || nameLower.includes('කැපුම්')) return '✂️';
    if (nameLower.includes('computer') || nameLower.includes('laptop') || nameLower.includes('pos') || nameLower.includes('පරිගණක')) return '💻';
    if (nameLower.includes('seal') || nameLower.includes('pack') || nameLower.includes('ඇසුරුම්')) return '📦';
    if (nameLower.includes('rent') || nameLower.includes('කුලී') || nameLower.includes('contract') || nameLower.includes('සේවා')) return '🏢';
    if (nameLower.includes('service') || nameLower.includes('maintain') || nameLower.includes('repair') || nameLower.includes('නඩත්තු')) return '🔧';

    const method = item.details?.depreciation_method;
    if (method === 'periods') return '💻';
    if (method === 'none') return '🏢';
    return '⚙️';
  };

  return (
    <div className="space-y-4">
      {/* Top Header / Presets Bar with smooth mouse-wheel and arrow navigation (no scrollbar) */}
      {items.length > 0 && availablePresets.length > 0 && (
        <div className="relative flex items-center">
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollByAmount(-140)}
              className="absolute left-0 z-10 size-7 -ml-1 rounded-full bg-background/95 border border-border/80 shadow-xs flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer hover:scale-105 transition-all"
              title="Scroll left"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}

          <div
            ref={scrollContainerRef}
            onWheel={(e) => {
              if (e.deltaY !== 0 && scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft += e.deltaY;
              }
            }}
            className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full touch-pan-x overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <span className="text-[11px] font-bold text-muted-foreground shrink-0 uppercase tracking-wider">
              {t('machineryAddMachine')}:
            </span>
            {availablePresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onAddPreset(preset)}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-xs font-semibold text-rose-700 dark:text-rose-300 transition-all cursor-pointer shadow-2xs hover:scale-102 active:scale-98 shrink-0 whitespace-nowrap"
              >
                <span>{preset.icon}</span>
                <span>{t(preset.nameKey)}</span>
                <Plus className="size-2.5 text-rose-500/70 ml-0.5" />
              </button>
            ))}
          </div>

          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollByAmount(140)}
              className="absolute right-0 z-10 size-7 -mr-1 rounded-full bg-background/95 border border-border/80 shadow-xs flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer hover:scale-105 transition-all"
              title="Scroll right"
            >
              <ChevronRight className="size-4" />
            </button>
          )}
        </div>
      )}

      {/* Empty State with Guidance Cards */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-rose-500/30 bg-gradient-to-b from-rose-500/5 via-background to-background p-4 sm:p-5 text-center space-y-4">
          <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 shadow-2xs">
            <Cog className="size-6 animate-[spin_12s_linear_infinite]" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-sm font-bold text-foreground">{t('machineryEmptyTitle')}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">{t('machineryEmptyDesc')}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 max-w-xl mx-auto">
            {MACHINERY_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs font-semibold border-rose-500/30 hover:border-rose-500/60 hover:bg-rose-500/10 text-foreground cursor-pointer transition-all shadow-2xs hover:scale-102"
                onClick={() => onAddPreset(preset)}
              >
                <span>{preset.icon}</span>
                <span>{t(preset.nameKey)}</span>
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-dashed text-xs font-semibold cursor-pointer hover:border-primary/50 hover:bg-primary/5"
              onClick={() => onAddItem('units')}
            >
              <Plus className="size-3.5" />
              <span>{t('machineryAddMachine')}</span>
            </Button>
          </div>
        </div>
      ) : (
        /* Machinery Line Items List */
        <div className="space-y-3">
          {items.map((item, index) => {
            const method = (item.details?.depreciation_method as 'units' | 'periods' | 'none') ?? 'units';
            const wear = calculateWear(item);
            const activeLevel3Count = (item.details?.salvage_value && item.details.salvage_value !== '0' ? 1 : 0) +
              (item.details?.variable_percentage && item.details.variable_percentage !== '100' ? 1 : 0);
            const isItemExpanded = activeId === item.id;

            if (!isItemExpanded) {
              return (
                <div
                  key={item.id}
                  onClick={() => setActiveId(item.id)}
                  className="group flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-card p-2.5 sm:px-3.5 sm:py-2.5 transition-all hover:border-rose-500/50 hover:bg-muted/15 hover:shadow-2xs cursor-pointer select-none"
                  title={t('editItem')}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground text-[11px] font-bold">
                      #{index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm select-none">
                          {getMachineIcon(item)}
                        </span>
                        <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                          {item.name.trim() || <span className="italic text-muted-foreground font-normal">{t('machineryAddMachine')}</span>}
                        </span>
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                          {method === 'units' && `📦 ${t('machineryModeUnits')}`}
                          {method === 'periods' && `📅 ${t('machineryModePeriods')}`}
                          {method === 'none' && `💵 ${t('machineryModeDirect')}`}
                        </span>
                        {activeLevel3Count > 0 && (
                          <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-medium text-secondary-foreground">
                            ⚡ {activeLevel3Count}
                          </span>
                        )}
                      </div>

                      {/* Subtitle metrics line */}
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                        {method === 'units' && wear.unitCost > 0 && (
                          <>
                            <span className="font-semibold font-mono text-foreground">
                              {currencyCode} {wear.unitCost.toFixed(2)} / unit
                            </span>
                            <span className="text-muted-foreground/40">•</span>
                            <span>
                              Batch ({batchUnits.toLocaleString()} units): {currencyCode} {wear.batchWear.toFixed(2)}
                            </span>
                          </>
                        )}
                        {method === 'periods' && wear.monthlyWear > 0 && (
                          <>
                            <span className="font-semibold font-mono text-foreground">
                              {currencyCode} {wear.monthlyWear.toFixed(2)} / mo
                            </span>
                            <span className="text-muted-foreground/40">•</span>
                            <span>
                              Batch: {currencyCode} {wear.batchWear.toFixed(2)}
                            </span>
                          </>
                        )}
                        {method === 'none' && parseFloat(item.amount || '0') > 0 && (
                          <>
                            <span className="font-semibold font-mono text-foreground">
                              {currencyCode} {(parseFloat(item.amount || '0') / Math.max(1, batchUnits)).toFixed(2)} / unit
                            </span>
                            <span className="text-muted-foreground/40">•</span>
                            <span>
                              Rental/Fee: {currencyCode} {parseFloat(item.amount || '0').toFixed(2)}
                            </span>
                          </>
                        )}
                        {wear.unitCost === 0 && wear.monthlyWear === 0 && !parseFloat(item.amount || '0') && (
                          <span className="text-muted-foreground/70 italic text-[10px]">
                            {t('machineryConfigurePrompt')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Total Batch Wear + Edit & Delete Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="font-bold font-mono text-xs sm:text-sm text-foreground mr-1.5">
                      {currencyCode} {wear.batchWear.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={() => setActiveId(item.id)}
                      title={t('editItem')}
                    >
                      <Pencil className="size-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onRemove(item.id)}
                      title={t('removeLine')}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                className="rounded-xl border border-rose-500/40 bg-background/95 p-3.5 sm:p-4 space-y-3.5 shadow-xs ring-1 ring-rose-500/20 transition-all"
              >
                {/* Row 1: Name + Mode Pill Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex-1 min-w-[180px]">
                    <Input
                      value={item.name}
                      onChange={(e) => onUpdate(item.id, { name: e.target.value })}
                      placeholder={t('machineryAddMachine')}
                      className="h-9 font-semibold text-xs rounded-lg"
                    />
                  </div>

                  {/* Mode Pill Switcher */}
                  <div className="flex h-9 items-center rounded-lg border border-input bg-muted/40 p-0.5 text-xs shadow-2xs shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMethodChange(item, 'units')}
                      className={cn(
                        "h-full px-2.5 rounded-md font-semibold text-[11px] transition-all cursor-pointer whitespace-nowrap",
                        method === 'units'
                          ? "bg-background text-rose-600 dark:text-rose-400 shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title={t('machineryModeUnits')}
                    >
                      📦 {t('machineryModeUnits')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMethodChange(item, 'periods')}
                      className={cn(
                        "h-full px-2.5 rounded-md font-semibold text-[11px] transition-all cursor-pointer whitespace-nowrap",
                        method === 'periods'
                          ? "bg-background text-rose-600 dark:text-rose-400 shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title={t('machineryModePeriods')}
                    >
                      📅 {t('machineryModePeriods')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMethodChange(item, 'none')}
                      className={cn(
                        "h-full px-2.5 rounded-md font-semibold text-[11px] transition-all cursor-pointer whitespace-nowrap",
                        method === 'none'
                          ? "bg-background text-rose-600 dark:text-rose-400 shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title={t('machineryModeDirect')}
                    >
                      🏢 {t('machineryModeDirect')}
                    </button>
                  </div>
                </div>

                {/* Row 2: Contextual Calculation Inputs based on Method */}
                <div className="pt-2 border-t border-border/50">
                  {method === 'units' && (
                    <div className="space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {/* Purchase Price */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            {t('machineryPurchasePriceLabel')}
                          </label>
                          <div className="flex h-9 items-center rounded-lg border border-input bg-background shadow-2xs focus-within:ring-1 focus-within:ring-rose-500">
                            <span className="shrink-0 border-r border-input/80 px-2.5 text-xs font-semibold text-muted-foreground select-none">
                              {currencyCode}
                            </span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={item.details?.purchase_price ?? ''}
                              onChange={(e) => handlePurchasePriceChange(item, e.target.value)}
                              placeholder="0.00"
                              className="h-full border-0 bg-transparent px-2.5 text-xs font-semibold shadow-none focus-visible:ring-0"
                            />
                          </div>
                        </div>

                        {/* Lifetime Units */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            {t('machineryLifetimeUnitsLabel')}
                          </label>
                          <div className="flex h-9 items-center rounded-lg border border-input bg-background shadow-2xs focus-within:ring-1 focus-within:ring-rose-500">
                            <Input
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              value={item.details?.lifetime_units ?? ''}
                              onChange={(e) => handleLifetimeUnitsChange(item, e.target.value)}
                              placeholder="e.g. 50000"
                              className="h-full border-0 bg-transparent px-2.5 text-xs font-semibold shadow-none focus-visible:ring-0"
                            />
                            <span className="shrink-0 border-l border-input/80 px-2.5 text-[11px] font-medium text-muted-foreground select-none">
                              units
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Live Calculation Pill */}
                      {wear.unitCost > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/5 px-2.5 py-1.5 text-[11px] font-medium text-rose-800 dark:text-rose-200">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="size-3 text-rose-500 shrink-0" />
                            <span>
                              {t('machineryCostPerUnitPill', {
                                unitCost: `${currencyCode} ${wear.unitCost.toFixed(2)}`,
                                batchUnits: batchUnits.toLocaleString(),
                                batchCost: `${currencyCode} ${wear.batchWear.toFixed(2)}`,
                              })}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            ({currencyCode} {parseFloat(item.details?.purchase_price || '0').toLocaleString()} ÷ {parseFloat(item.details?.lifetime_units || '1').toLocaleString()} units)
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {method === 'periods' && (
                    <div className="space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {/* Purchase Price */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            {t('machineryPurchasePriceLabel')}
                          </label>
                          <div className="flex h-9 items-center rounded-lg border border-input bg-background shadow-2xs focus-within:ring-1 focus-within:ring-rose-500">
                            <span className="shrink-0 border-r border-input/80 px-2.5 text-xs font-semibold text-muted-foreground select-none">
                              {currencyCode}
                            </span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              autoComplete="off"
                              value={item.details?.purchase_price ?? ''}
                              onChange={(e) => handlePurchasePriceChange(item, e.target.value)}
                              placeholder="0.00"
                              className="h-full border-0 bg-transparent px-2.5 text-xs font-semibold shadow-none focus-visible:ring-0"
                            />
                          </div>
                        </div>

                        {/* Useful Life (Months) */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground">
                            {t('machineryUsefulMonthsLabel')}
                          </label>
                          <div className="flex h-9 items-center rounded-lg border border-input bg-background shadow-2xs focus-within:ring-1 focus-within:ring-rose-500">
                            <Input
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              value={item.details?.useful_life_periods ?? ''}
                              onChange={(e) => handleUsefulPeriodsChange(item, e.target.value)}
                              placeholder="e.g. 36 (3 yrs)"
                              className="h-full border-0 bg-transparent px-2.5 text-xs font-semibold shadow-none focus-visible:ring-0"
                            />
                            <span className="shrink-0 border-l border-input/80 px-2.5 text-[11px] font-medium text-muted-foreground select-none">
                              mo
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Live Calculation Pill */}
                      {wear.monthlyWear > 0 && (
                        <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/5 px-2.5 py-1.5 text-[11px] font-medium text-rose-800 dark:text-rose-200">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Sparkles className="size-3 text-rose-500 shrink-0" />
                            <span>
                              Wear: <strong className="font-mono">{currencyCode} {wear.unitCost.toFixed(2)}</strong> / unit • Batch ({batchUnits.toLocaleString()} units): <strong className="font-mono">{currencyCode} {wear.batchWear.toFixed(2)}</strong>
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            ({currencyCode} {parseFloat(item.details?.purchase_price || '0').toLocaleString()} ÷ {parseFloat(item.details?.useful_life_periods || '1').toLocaleString()} mo = {currencyCode} {wear.monthlyWear.toFixed(2)}/mo ÷ {Math.max(1, monthlyUnits).toLocaleString()} units/mo)
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {method === 'none' && (() => {
                    const basis = (item.details?.rental_basis as 'batch' | 'unit' | 'day' | 'month') || 'batch';
                    return (
                      <div className="space-y-3">
                        {/* Basis Selector Pill */}
                        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg border border-border/70 bg-muted/30">
                          <span className="text-[11px] font-bold text-muted-foreground px-1.5 select-none shrink-0">
                            {t('machineryRentalBasisTitle')}:
                          </span>
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleRentalBasisChange(item, 'batch')}
                              className={cn(
                                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap",
                                basis === 'batch'
                                  ? "bg-background text-rose-600 dark:text-rose-400 shadow-2xs border border-border/80"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              )}
                            >
                              📋 {t('machineryRentalBasisBatch')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRentalBasisChange(item, 'unit')}
                              className={cn(
                                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap",
                                basis === 'unit'
                                  ? "bg-background text-rose-600 dark:text-rose-400 shadow-2xs border border-border/80"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              )}
                            >
                              📦 {t('machineryRentalBasisUnit')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRentalBasisChange(item, 'month')}
                              className={cn(
                                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap",
                                basis === 'month'
                                  ? "bg-background text-rose-600 dark:text-rose-400 shadow-2xs border border-border/80"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              )}
                            >
                              📅 {t('machineryRentalBasisMonth')}
                            </button>
                          </div>
                        </div>

                        {/* Dynamic Inputs based on selected basis */}
                        <div className="grid gap-2 sm:grid-cols-2">
                          {basis === 'batch' && (
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-muted-foreground">
                                {t('machineryRentalRateBatchLabel')}
                              </label>
                              <div className="flex h-9 items-center rounded-lg border border-input bg-background shadow-2xs focus-within:ring-1 focus-within:ring-rose-500">
                                <span className="shrink-0 border-r border-input/80 px-2.5 text-xs font-semibold text-muted-foreground select-none">
                                  {currencyCode}
                                </span>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  value={item.amount}
                                  onChange={(e) => handleDirectAmountChange(item, e.target.value)}
                                  placeholder="0.00"
                                  className="h-full border-0 bg-transparent px-2.5 text-xs font-semibold shadow-none focus-visible:ring-0"
                                />
                              </div>
                            </div>
                          )}

                          {basis === 'unit' && (
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-muted-foreground">
                                {t('machineryRentalRateUnitLabel')}
                              </label>
                              <div className="flex h-9 items-center rounded-lg border border-input bg-background shadow-2xs focus-within:ring-1 focus-within:ring-rose-500">
                                <span className="shrink-0 border-r border-input/80 px-2.5 text-xs font-semibold text-muted-foreground select-none">
                                  {currencyCode}
                                </span>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  value={item.details?.rental_rate ?? (parseFloat(item.amount || '0') > 0 ? (parseFloat(item.amount) / Math.max(1, batchUnits)).toFixed(2).replace(/\.00$/, '') : '')}
                                  onChange={(e) => handleRentalRateChange(item, e.target.value)}
                                  placeholder="0.00"
                                  className="h-full border-0 bg-transparent px-2.5 text-xs font-semibold shadow-none focus-visible:ring-0"
                                />
                                <span className="shrink-0 border-l border-input/80 px-2.5 text-[11px] font-medium text-muted-foreground select-none">
                                  / unit
                                </span>
                              </div>
                            </div>
                          )}

                          {basis === 'month' && (
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-muted-foreground">
                                {t('machineryRentalRateMonthLabel')}
                              </label>
                              <div className="flex h-9 items-center rounded-lg border border-input bg-background shadow-2xs focus-within:ring-1 focus-within:ring-rose-500">
                                <span className="shrink-0 border-r border-input/80 px-2.5 text-xs font-semibold text-muted-foreground select-none">
                                  {currencyCode}
                                </span>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  value={item.details?.rental_rate ?? ''}
                                  onChange={(e) => handleRentalRateChange(item, e.target.value)}
                                  placeholder="0.00"
                                  className="h-full border-0 bg-transparent px-2.5 text-xs font-semibold shadow-none focus-visible:ring-0"
                                />
                                <span className="shrink-0 border-l border-input/80 px-2 text-[11px] font-medium text-muted-foreground select-none">
                                  / mo
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Live Calculation Pill for Rental/Fee */}
                        {wear.batchWear > 0 && (
                          <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-rose-500/25 bg-rose-500/5 px-2.5 py-1.5 text-[11px] font-medium text-rose-800 dark:text-rose-200">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Sparkles className="size-3 text-rose-500 shrink-0" />
                              <span>
                                🏢 <strong className="font-mono">{currencyCode} {wear.unitCost.toFixed(2)}</strong> / unit • Batch ({batchUnits.toLocaleString()} units): <strong className="font-mono">{currencyCode} {wear.batchWear.toFixed(2)}</strong>
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {basis === 'batch' && `(${currencyCode} ${wear.batchWear.toFixed(2)} total ÷ ${batchUnits.toLocaleString()} units)`}
                              {basis === 'unit' && `(${currencyCode} ${wear.unitCost.toFixed(2)} / unit × ${batchUnits.toLocaleString()} units)`}
                              {basis === 'month' && `(${currencyCode} ${parseFloat(item.details?.rental_rate || '0').toFixed(2)} / mo ÷ ${Math.max(1, monthlyUnits).toLocaleString()} monthly capacity)`}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Row 3: Actions Bar below the input fields */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 px-2.5 text-[11px] font-semibold gap-1.5 rounded-lg cursor-pointer transition-colors",
                      activeLevel3Count > 0
                        ? "text-rose-600 dark:text-rose-400 bg-rose-500/10 font-bold hover:bg-rose-500/15"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                    onClick={() => onOpenLevel3(item)}
                    title={t('level3Button')}
                  >
                    <SlidersHorizontal className="size-3.5" />
                    <span>{t('level3Button')}</span>
                    {activeLevel3Count > 0 && (
                      <span className="rounded-full bg-rose-500/25 px-1.5 py-0.2 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                        {activeLevel3Count}
                      </span>
                    )}
                  </Button>

                  <div className="flex items-center gap-1.5">
                    {/* Done / Collapse Button */}
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="h-8 px-3 text-[11px] font-bold gap-1 rounded-lg cursor-pointer shadow-2xs"
                      onClick={() => setActiveId(null)}
                      title={t('doneEditing')}
                    >
                      <Check className="size-3.5" />
                      <span>{t('doneEditing')}</span>
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-[11px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer transition-colors gap-1.5"
                      onClick={() => onRemove(item.id)}
                      aria-label={t('removeLine')}
                    >
                      <Trash2 className="size-3.5" />
                      <span>{t('removeLine')}</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add Another Machine Button */}
          <div className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 border-dashed text-xs font-semibold cursor-pointer hover:border-rose-500/50 hover:bg-rose-500/5"
              onClick={() => onAddItem('units')}
            >
              <Plus className="size-3.5" />
              <span>{t('machineryAddMachine')}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
