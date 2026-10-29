'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import type { GuestDraft } from '@/store/useCalculatorStore';

interface PricingControlsProps {
  pricingType: GuestDraft['pricingType'];
  percentage: string;
  onChange: (updates: Partial<GuestDraft>) => void;
}

export function PricingControls({ pricingType, percentage, onChange }: PricingControlsProps) {
  const t = useTranslations('Calculator');

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5" aria-labelledby="pricing-heading">
      <div>
        <h2 id="pricing-heading" className="text-lg font-semibold tracking-tight">{t('pricingTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('pricingDescription')}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{t('pricingDeliveryHint')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_12rem] sm:items-end">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('percentage')}</legend>
          <div className="grid grid-cols-2 rounded-lg border border-border bg-muted/40 p-1">
            <button
              type="button"
              aria-pressed={pricingType === 'markup'}
              onClick={() => onChange({ pricingType: 'markup' })}
              className={`min-h-10 rounded-md px-3 text-sm font-medium transition-colors ${pricingType === 'markup' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('markup')}
            </button>
            <button
              type="button"
              aria-pressed={pricingType === 'margin'}
              onClick={() => onChange({ pricingType: 'margin' })}
              className={`min-h-10 rounded-md px-3 text-sm font-medium transition-colors ${pricingType === 'margin' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('margin')}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {pricingType === 'markup' ? t('markupHelp') : t('marginHelp')}
          </p>
        </fieldset>

        <div className="space-y-2">
          <label htmlFor="pricing-percentage" className="text-sm font-medium">{t('percentage')}</label>
          <div className="relative">
            <Input
              id="pricing-percentage"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={percentage}
              onChange={(event) => onChange({ pricingPercentage: event.target.value })}
              className="min-h-11 pr-9"
              aria-describedby="pricing-percentage-suffix"
            />
            <span id="pricing-percentage-suffix" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">%</span>
          </div>
        </div>
      </div>
    </section>
  );
}
