'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { Input } from '@/components/ui/input';
import { getCurrencyLabel, getSupportedCurrencies } from '@/lib/currencies';
import type { GuestDraft } from '@/store/useCalculatorStore';

interface CostSheetSetupProps {
  draft: GuestDraft;
  onChange: (updates: Partial<GuestDraft>) => void;
}

export function CostSheetSetup({ draft, onChange }: CostSheetSetupProps) {
  const t = useTranslations('Calculator');
  const locale = useLocale();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const currencies = getSupportedCurrencies();

  return (
    <section className="space-y-4" aria-labelledby="setup-heading">
      <div>
        <h2 id="setup-heading" className="text-lg font-semibold tracking-tight">{t('setupTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('setupDescription')}</p>
      </div>

      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 sm:p-5">
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="cost-sheet-name" className="text-sm font-medium">{t('name')}</label>
          <Input
            id="cost-sheet-name"
            value={draft.productName}
            onChange={(event) => onChange({ productName: event.target.value })}
            placeholder={t('namePlaceholder')}
            autoComplete="off"
            className="min-h-11"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="cost-sheet-kind" className="text-sm font-medium">{t('kind')}</label>
          <select
            id="cost-sheet-kind"
            value={draft.kind}
            onChange={(event) => onChange({ kind: event.target.value as GuestDraft['kind'] })}
            className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="product">{t('product')}</option>
            <option value="service">{t('service')}</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="unit-label" className="text-sm font-medium">{t('unitLabel')}</label>
          <Input
            id="unit-label"
            value={draft.unitLabel}
            onChange={(event) => onChange({ unitLabel: event.target.value })}
            placeholder={t('unitPlaceholder')}
            autoComplete="off"
            className="min-h-11"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="units-produced" className="text-sm font-medium">{t('unitsProduced')}</label>
          <Input
            id="units-produced"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={draft.unitsProduced}
            onChange={(event) => onChange({ unitsProduced: event.target.value })}
            placeholder={t('unitsPlaceholder')}
            className="min-h-11"
            aria-describedby="units-help"
          />
          <p id="units-help" className="text-xs text-muted-foreground">{t('unitsProducedHint')}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="defective-units" className="flex items-center gap-2 text-sm font-medium">
            {t('defects')} <span className="font-normal text-muted-foreground">({t('optional')})</span>
          </label>
          <Input
            id="defective-units"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={draft.defectiveUnits}
            onChange={(event) => onChange({ defectiveUnits: event.target.value })}
            placeholder="0"
            className="min-h-11"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="currency-code" className="text-sm font-medium">{t('currency')}</label>
          <select
            id="currency-code"
            value={draft.currencyCode}
            onChange={(event) => onChange({ currencyCode: event.target.value, currencyOverridden: true })}
            className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value={draft.currencyCode}>
              {hydrated ? getCurrencyLabel(draft.currencyCode, locale) : draft.currencyCode}
            </option>
            {hydrated &&
              currencies
                .filter((currency) => currency !== draft.currencyCode)
                .map((currency) => (
                  <option key={currency} value={currency}>
                    {getCurrencyLabel(currency, locale)}
                  </option>
                ))}
          </select>
          <p className="text-xs text-muted-foreground">{t('currencyHint')}</p>
        </div>
      </div>
    </section>
  );
}
