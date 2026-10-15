'use client';

import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  onAddIncoming: (material: MaterialOption) => void;
  onAddOutgoing: (name?: string, presetId?: string) => void;
  onUpdate: (id: string, updates: Partial<LineItemDraft>) => void;
  onRemove: (id: string) => void;
}

export function TransportCostEditor({
  items,
  materials,
  currencyCode,
  onAddIncoming,
  onAddOutgoing,
  onUpdate,
  onRemove,
}: TransportCostEditorProps) {
  const t = useTranslations('Calculator');
  const incomingItems = items.filter((item) => item.details?.direction !== 'outbound');
  const outgoingItems = items.filter((item) => item.details?.direction === 'outbound');

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

  const renderCharge = (item: LineItemDraft, direction: 'inbound' | 'outbound') => (
    <div
      key={item.id}
      className="grid gap-2 rounded-lg border border-border/70 bg-background p-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,12rem)_minmax(8rem,auto)_auto]"
    >
      <label className="min-w-0 space-y-1">
        <span className="block text-[11px] font-medium text-muted-foreground sm:sr-only">
          {t('transportChargeNameLabel')}
        </span>
        <Input
          value={item.name}
          onChange={(event) => onUpdate(item.id, { name: event.target.value })}
          aria-label={t('transportChargeNameLabel')}
          placeholder={t(direction === 'inbound' ? 'transportIncomingChargePlaceholder' : 'transportOutgoingChargeName')}
          className="min-w-0"
        />
      </label>
      <label className="min-w-0 space-y-1">
        <span className="block text-[11px] font-medium text-muted-foreground sm:sr-only">
          {t('transportChargeAmountLabel')}
        </span>
        <span className="flex min-w-0 items-center rounded-md border border-input bg-background">
          <span className="shrink-0 border-r border-input px-2.5 text-xs font-medium text-muted-foreground">
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
            className="min-w-0 border-0 shadow-none focus-visible:ring-0"
          />
        </span>
      </label>
      {direction === 'outbound' ? (
        <label className="min-w-0 space-y-1">
          <span className="block text-[11px] font-medium text-muted-foreground sm:sr-only">
            {t('detailLabels.delivery_treatment')}
          </span>
          <select
            value={item.details?.delivery_treatment ?? 'seller_paid'}
            onChange={(event) => onUpdate(item.id, {
              details: { ...item.details, delivery_treatment: event.target.value },
            })}
            aria-label={t('detailLabels.delivery_treatment')}
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            <option value="seller_paid">{t('detailOptions.seller_paid')}</option>
            <option value="customer_paid">{t('detailOptions.customer_paid')}</option>
          </select>
        </label>
      ) : (
        <div className="hidden sm:block" aria-hidden="true" />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 justify-self-end text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(item.id)}
        aria-label={t('removeLine')}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 sm:p-4">
        <div>
          <h4 className="text-sm font-bold text-foreground">{t('transportIncomingTitle')}</h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('transportIncomingHint')}</p>
        </div>
        {materials.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-background/70 p-3 text-xs text-muted-foreground">
            {t('transportNoMaterials')}
          </p>
        ) : (
          <div className="space-y-2">
            {materials.map((material) => {
              const charges = materialCharges.get(material.id) ?? [];
              return (
                <div key={material.id} className="space-y-2 rounded-lg border border-border/60 bg-background/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                      📦 {material.name}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 text-xs"
                      onClick={() => onAddIncoming(material)}
                    >
                      <Plus className="size-3.5" />
                      {t('transportAddIncomingCharge')}
                    </Button>
                  </div>
                  {charges.map((item) => renderCharge(item, 'inbound'))}
                </div>
              );
            })}
          </div>
        )}
        {unassignedIncoming.length > 0 && (
          <div className="space-y-2 border-t border-border/60 pt-3">
            <p className="text-xs font-semibold text-muted-foreground">{t('transportOtherIncoming')}</p>
            {unassignedIncoming.map((item) => renderCharge(item, 'inbound'))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3.5 sm:p-4">
        <div>
          <h4 className="text-sm font-bold text-foreground">{t('transportOutgoingTitle')}</h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('transportOutgoingHint')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {OUTGOING_SUGGESTIONS.map((suggestion) => (
            <Button
              key={suggestion.id}
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs"
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
            className="h-9 gap-1.5 border-dashed text-xs"
            onClick={() => onAddOutgoing()}
          >
            <Plus className="size-3.5" />
            {t('transportAddOutgoing')}
          </Button>
        </div>
        {outgoingItems.map((item) => renderCharge(item, 'outbound'))}
      </section>
    </div>
  );
}
