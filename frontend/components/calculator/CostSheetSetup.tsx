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
          <label htmlFor="cost-sheet-name" className="text-sm font-medium">{t('name')} <span className="text-destructive">*</span></label>
          <Input
            id="cost-sheet-name"
            required
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
          <label htmlFor="unit-label" className="text-sm font-medium">{t('unitLabel')} <span className="text-destructive">*</span></label>
          <Input
            id="unit-label"
            required
            value={draft.unitLabel}
            onChange={(event) => onChange({ unitLabel: event.target.value })}
            placeholder={t('unitPlaceholder')}
            autoComplete="off"
            className="min-h-11"
            aria-describedby="unit-label-help"
          />
          <p id="unit-label-help" className="text-xs leading-5 text-muted-foreground">{t('unitLabelHint')}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="production-basis" className="text-sm font-medium">{t('productionBasis')} <span className="text-destructive">*</span></label>
          <select
            id="production-basis"
            required
            value={draft.productionBasis}
            onChange={(event) => onChange({ productionBasis: event.target.value as GuestDraft['productionBasis'] })}
            className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="" disabled>{t('chooseBasis')}</option>
            <option value="monthly">{t('monthly')}</option>
            <option value="batch">{t('batch')}</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="units-produced" className="text-sm font-medium">{t('unitsProduced')} <span className="text-destructive">*</span></label>
          <Input
            id="units-produced"
            required
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

        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="text-sm font-medium">{t('coverageScope')} <span className="text-destructive">*</span></legend>
          <p className="text-xs leading-5 text-muted-foreground">{t('coverageScopeHint')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['all', 'overhead_only'] as const).map((scope) => (
              <label
                key={scope}
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                  draft.defaultUnitsCoveredScope === scope
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <input
                  type="radio"
                  name="coverage-scope"
                  value={scope}
                  checked={draft.defaultUnitsCoveredScope === scope}
                  onChange={() => onChange({ defaultUnitsCoveredScope: scope })}
                  className="mt-1 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{t(`coverageScopeOptions.${scope}.title`)}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {t(`coverageScopeOptions.${scope}.description`)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

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
