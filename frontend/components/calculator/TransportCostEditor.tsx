'use client';

import { useTranslations } from 'next-intl';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { LineItemDraft } from '@/store/useCalculatorStore';

const OUTGOING_SUGGESTIONS = [
  { id: 'courier', label: 'transportPresetCourier', icon: '📮' },
  { id: 'own_delivery', label: 'transportPresetOwnDelivery', icon: '🛵' },
  { id: 'other_delivery', label: 'transportPresetOther', icon: '🧾' },
] as const;

interface MaterialOption {
  id: string;
  name: string;
}

interface TransportCostEditorProps {
  items: LineItemDraft[];
  materials: MaterialOption[];
  currencyCode: string;
  batchUnits?: number;
  unitLabel?: string;
  unallocatedCost?: number;
  onAllocateUnallocated?: (direction: 'inbound' | 'outbound') => void;
  onAddIncoming: (material?: MaterialOption) => void;
  onAddOutgoing: (name?: string, presetId?: string) => void;
  onUpdate: (id: string, updates: Partial<LineItemDraft>) => void;
  onRemove: (id: string) => void;
}

export function TransportCostEditor({
  items,
  materials,
  currencyCode,
  batchUnits = 1,
  unitLabel,
  unallocatedCost = 0,
  onAllocateUnallocated,
  onAddIncoming,
  onAddOutgoing,
  onUpdate,
  onRemove,
}: TransportCostEditorProps) {
  const t = useTranslations('Calculator');
  const incomingItems = items.filter((item) => item.details?.direction !== 'outbound');
  const outgoingItems = items.filter((item) => item.details?.direction === 'outbound');
  const effectiveBatchUnits = Math.max(1, batchUnits);
  const formattedUnit = unitLabel?.trim() || t('transportUnitProducedFallback');

  const materialCharges = new Map<string, LineItemDraft[]>();
  const unassignedIncoming: LineItemDraft[] = [];
  for (const item of incomingItems) {
    const ids = (item.details?.allocated_material_ids ?? '').split(',').filter(Boolean);
    if (ids.length === 1 && materials.some((material) => material.id === ids[0])) {
      const charges = materialCharges.get(ids[0]) ?? [];
      charges.push(item);
      materialCharges.set(ids[0], charges);
    } else {
      unassignedIncoming.push(item);
    }
  }

  const renderInboundCharge = (item: LineItemDraft) => {
    const amountNum = parseFloat(item.amount || '0');
    const cpuNum = amountNum > 0 ? amountNum / effectiveBatchUnits : 0;

    return (
      <div
        key={item.id}
        className="rounded-xl border border-emerald-500/25 bg-background/90 p-3 sm:p-3.5 space-y-2.5 transition-all shadow-2xs hover:border-emerald-500/40"
      >
        {/* Row 1: Name + Batch Scope Pill + Amount + Delete */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Name input */}
          <div className="flex-1 min-w-[150px]">
            <Input
              value={item.name}
              onChange={(event) => onUpdate(item.id, { name: event.target.value })}
              aria-label={t('transportChargeNameLabel')}
              placeholder={t('transportIncomingChargePlaceholder')}
              className="h-9 min-w-0 rounded-lg text-xs font-semibold"
            />
          </div>

          {/* Scope indicator: Batch Total */}
          <div
            className="flex h-9 items-center rounded-lg border border-input bg-muted/40 px-2.5 text-[11px] font-semibold text-muted-foreground shadow-2xs shrink-0 select-none"
            title={`${t('transportBatchScopeBadge')}: ${effectiveBatchUnits} ${formattedUnit}`}
          >
            <span>📋 {t('transportBatchScopeBadge')} ({effectiveBatchUnits} {formattedUnit})</span>
          </div>

          {/* Amount input */}
          <div className="w-28 sm:w-32 shrink-0">
            <span className="flex h-9 min-w-0 items-center rounded-lg border border-input bg-background shadow-2xs focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
              <span className="shrink-0 border-r border-input/80 px-2 text-[11px] font-semibold text-muted-foreground select-none">
                {currencyCode}
              </span>
              <Input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={item.amount}
                onChange={(event) => onUpdate(item.id, { amount: event.target.value })}
                aria-label={t('transportChargeAmountLabel')}
                placeholder="0.00"
                className="h-full min-w-0 border-0 bg-transparent px-2 text-xs font-semibold shadow-none focus-visible:ring-0"
              />
            </span>
          </div>

          {/* Remove button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer rounded-lg transition-colors"
            onClick={() => onRemove(item.id)}
            aria-label={t('removeLine')}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        {/* Row 2: Live Calculation Formula Pill */}
        {amountNum > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2.5 py-1.5 text-[11px] font-medium text-emerald-900 dark:text-emerald-200">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>
                🚚 <strong className="font-mono">{currencyCode} {amountNum.toFixed(2)}</strong> {t('transportBatchTotalSuffix')} ÷ {effectiveBatchUnits} {formattedUnit} = <strong className="font-mono">{currencyCode} {cpuNum.toFixed(2)}</strong> / {formattedUnit}
              </span>
            </div>

            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              ✓ {t('transportIncludedInProductionCost')}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderOutboundCharge = (item: LineItemDraft) => {
    const treatment = item.details?.delivery_treatment ?? 'seller_paid';
    const scope = (item.details?.delivery_scope as 'unit' | 'batch') ?? (item.details?.unit_rate ? 'unit' : 'unit');

    const displayValue = scope === 'unit'
      ? (item.details?.unit_rate ?? (parseFloat(item.amount || '0') > 0 ? (parseFloat(item.amount) / effectiveBatchUnits).toFixed(2).replace(/\.00$/, '') : ''))
      : (item.amount ?? '');

    const currentRateNum = scope === 'unit'
      ? parseFloat(displayValue || '0')
      : (parseFloat(item.amount || '0') > 0 ? parseFloat(item.amount) / effectiveBatchUnits : 0);
    const currentTotalNum = scope === 'unit'
      ? (currentRateNum * effectiveBatchUnits)
      : (parseFloat(item.amount || '0') || 0);

    const handleScopeToggle = (newScope: 'unit' | 'batch') => {
      if (scope === newScope) return;
      if (newScope === 'batch') {
        const batchTotal = currentRateNum > 0 ? (currentRateNum * effectiveBatchUnits).toFixed(2).replace(/\.00$/, '') : item.amount;
        onUpdate(item.id, {
          amount: batchTotal,
          details: {
            ...item.details,
            delivery_scope: 'batch',
            unit_rate: currentRateNum > 0 ? currentRateNum.toString() : '',
          },
        });
      } else {
        const rate = currentTotalNum > 0 ? (currentTotalNum / effectiveBatchUnits).toFixed(2).replace(/\.00$/, '') : '';
        onUpdate(item.id, {
          amount: currentTotalNum > 0 ? currentTotalNum.toFixed(2).replace(/\.00$/, '') : '',
          details: {
            ...item.details,
            delivery_scope: 'unit',
            unit_rate: rate,
          },
        });
      }
    };

    const handleAmountChange = (val: string) => {
      const num = parseFloat(val);
      if (scope === 'unit') {
        const total = !isNaN(num) && num > 0 ? (num * effectiveBatchUnits).toFixed(2).replace(/\.00$/, '') : '';
        onUpdate(item.id, {
          amount: total,
          details: {
            ...item.details,
            delivery_scope: 'unit',
            unit_rate: val,
          },
        });
      } else {
        const rate = !isNaN(num) && num > 0 ? (num / effectiveBatchUnits).toFixed(2).replace(/\.00$/, '') : '';
        onUpdate(item.id, {
          amount: val,
          details: {
            ...item.details,
            delivery_scope: 'batch',
            unit_rate: rate,
          },
        });
      }
    };

    return (
      <div
        key={item.id}
        className="rounded-xl border border-sky-500/30 bg-background/90 p-3 sm:p-3.5 space-y-2.5 transition-all shadow-2xs hover:border-sky-500/50"
      >
        {/* Row 1: Name + Scope Pill + Amount + Payer + Delete */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Name Input */}
          <div className="flex-1 min-w-[150px]">
            <Input
              value={item.name}
              onChange={(event) => onUpdate(item.id, { name: event.target.value })}
              aria-label={t('transportChargeNameLabel')}
              placeholder={t('transportOutgoingChargeName')}
              className="h-9 min-w-0 rounded-lg text-xs font-semibold"
            />
          </div>

          {/* Scope Toggle: Per Pkg vs Batch Total */}
          <div className="flex h-9 items-center rounded-lg border border-input bg-muted/40 p-0.5 text-xs shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => handleScopeToggle('unit')}
              className={cn(
                "h-full px-2 rounded-md font-semibold text-[11px] transition-all cursor-pointer whitespace-nowrap",
                scope === 'unit'
                  ? "bg-background text-sky-600 dark:text-sky-400 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={t('deliveryScopePerPackage')}
            >
              📦 {t('deliveryScopePerPackage')}
            </button>
            <button
              type="button"
              onClick={() => handleScopeToggle('batch')}
              className={cn(
                "h-full px-2 rounded-md font-semibold text-[11px] transition-all cursor-pointer whitespace-nowrap",
                scope === 'batch'
                  ? "bg-background text-sky-600 dark:text-sky-400 shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={t('deliveryScopeBatchTotal')}
            >
              📋 {t('deliveryScopeBatchTotal')}
            </button>
          </div>

          {/* Amount Input */}
          <div className="w-28 sm:w-32 shrink-0">
            <span className="flex h-9 min-w-0 items-center rounded-lg border border-input bg-background shadow-2xs focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
              <span className="shrink-0 border-r border-input/80 px-2 text-[11px] font-semibold text-muted-foreground select-none">
                {currencyCode}
              </span>
              <Input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={displayValue}
                onChange={(event) => handleAmountChange(event.target.value)}
                aria-label={scope === 'unit' ? t('deliveryRateLabel') : t('deliveryTotalLabel')}
                placeholder="0.00"
                className="h-full min-w-0 border-0 bg-transparent px-2 text-xs font-semibold shadow-none focus-visible:ring-0"
              />
            </span>
          </div>

          {/* Delivery Treatment (Payer) */}
          <div className="w-28 sm:w-32 shrink-0 relative">
            <select
              value={treatment}
              onChange={(event) =>
                onUpdate(item.id, {
                  details: { ...item.details, delivery_treatment: event.target.value },
                })
              }
              aria-label={t('detailLabels.delivery_treatment')}
              title={treatment === 'customer_paid' ? t('detailOptions.customer_paid') : t('detailOptions.seller_paid')}
              className={cn(
                "h-9 w-full appearance-none rounded-lg border pl-2.5 pr-7 text-xs font-semibold cursor-pointer transition-all shadow-2xs focus:outline-none focus:ring-1 focus:ring-primary truncate",
                treatment === 'seller_paid'
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/15"
                  : "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200 hover:bg-sky-500/15"
              )}
            >
              <option value="seller_paid" className="bg-background text-foreground py-1">
                {t('deliveryPayerSellerShort')}
              </option>
              <option value="customer_paid" className="bg-background text-foreground py-1">
                {t('deliveryPayerCustomerShort')}
              </option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          </div>

          {/* Remove button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer rounded-lg transition-colors"
            onClick={() => onRemove(item.id)}
            aria-label={t('removeLine')}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        {/* Row 2: Live Breakdown Calculation Pill */}
        {(currentRateNum > 0 || currentTotalNum > 0) && (
          <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-lg border border-sky-500/25 bg-sky-500/5 px-2.5 py-1.5 text-[11px] font-medium text-sky-900 dark:text-sky-200">
            <div className="flex items-center gap-1.5 flex-wrap">
              {scope === 'unit' ? (
                <span>
                  📦 <strong className="font-mono">{currencyCode} {currentRateNum.toFixed(2)}</strong> / pkg × {effectiveBatchUnits} pkgs = <strong className="font-mono">{currencyCode} {currentTotalNum.toFixed(2)}</strong> total for batch
                </span>
              ) : (
                <span>
                  📋 <strong className="font-mono">{currencyCode} {currentTotalNum.toFixed(2)}</strong> total for batch ÷ {effectiveBatchUnits} pkgs = <strong className="font-mono">{currencyCode} {currentRateNum.toFixed(2)}</strong> / pkg
                </span>
              )}
            </div>

            <span className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold",
              treatment === 'seller_paid'
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                : "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20"
            )}>
              {treatment === 'seller_paid' ? `💼 ${t('deliveryPayerSellerShort')}` : `👤 ${t('deliveryPayerCustomerShort')}`}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-foreground">{t('transportIncomingTitle')}</h4>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('transportIncomingHint')}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {unallocatedCost > 0.01 && onAllocateUnallocated && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 shadow-2xs transition-all cursor-pointer"
                onClick={() => onAllocateUnallocated('inbound')}
              >
                <Plus className="size-3.5" />
                <span>📥 {t('convertUnallocatedToIncoming')} ({currencyCode} {unallocatedCost.toFixed(2)})</span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs border-dashed text-foreground hover:bg-emerald-500/10 cursor-pointer"
              onClick={() => onAddIncoming()}
            >
              <Plus className="size-3.5" />
              <span>{t('transportAddIncomingCharge')}</span>
            </Button>
          </div>
        </div>
        {materials.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/80 bg-background/70 p-3 text-xs text-muted-foreground flex items-center justify-between gap-2">
            <span>{t('transportNoMaterials')}</span>
          </div>
        ) : (
          <div className="space-y-2">
            {materials.map((material) => {
              const charges = materialCharges.get(material.id) ?? [];
              return (
                <div key={material.id} className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="truncate text-sm font-semibold text-foreground block">
                        📦 {material.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        {t('transportMaterialIncomingBatchHint', { count: effectiveBatchUnits, unit: formattedUnit })}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 text-xs cursor-pointer"
                      onClick={() => onAddIncoming(material)}
                    >
                      <Plus className="size-3.5" />
                      {t('transportAddIncomingCharge')}
                    </Button>
                  </div>
                  {charges.map((item) => renderInboundCharge(item))}
                </div>
              );
            })}
          </div>
        )}
        {unassignedIncoming.length > 0 && (
          <div className="space-y-2 border-t border-border/60 pt-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">{t('transportOtherIncoming')}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t('transportMaterialIncomingBatchHint', { count: effectiveBatchUnits, unit: formattedUnit })}
              </p>
            </div>
            {unassignedIncoming.map((item) => renderInboundCharge(item))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-foreground">{t('transportOutgoingTitle')}</h4>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('transportOutgoingHint')}</p>
          </div>
          {unallocatedCost > 0.01 && onAllocateUnallocated && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold border-sky-500/40 text-sky-700 dark:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 shadow-2xs transition-all cursor-pointer"
              onClick={() => onAllocateUnallocated('outbound')}
            >
              <Plus className="size-3.5" />
              <span>📤 {t('convertUnallocatedToOutgoing')} ({currencyCode} {unallocatedCost.toFixed(2)})</span>
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {OUTGOING_SUGGESTIONS.map((suggestion) => (
            <Button
              key={suggestion.id}
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs cursor-pointer shadow-2xs hover:scale-102 transition-transform"
              onClick={() => onAddOutgoing(t(suggestion.label), suggestion.id)}
            >
              <span aria-hidden="true">{suggestion.icon}</span>
              {t(suggestion.label)}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 border-dashed text-xs cursor-pointer"
            onClick={() => onAddOutgoing()}
          >
            <Plus className="size-3.5" />
            {t('transportAddOutgoing')}
          </Button>
        </div>
        {outgoingItems.map((item) => renderOutboundCharge(item))}
      </section>
    </div>
  );
}
