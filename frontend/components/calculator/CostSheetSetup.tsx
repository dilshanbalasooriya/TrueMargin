'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AlertCircle, ArrowRight, Briefcase, Package, Pencil, Sliders, Sparkles, Tag, TrendingUp } from 'lucide-react';
import { getCurrencyLabel, getSupportedCurrencies } from '@/lib/currencies';
import { toast } from '@/store/useToast';
import type { GuestDraft } from '@/store/useCalculatorStore';

interface CostSheetSetupProps {
  draft: GuestDraft;
  onChange: (updates: Partial<GuestDraft>) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: (collapsed: boolean) => void;
}

export function CostSheetSetup({
  draft,
  onChange,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
}: CostSheetSetupProps) {
  const t = useTranslations('Calculator');
  const locale = useLocale();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const currencies = getSupportedCurrencies();

  // Validation states
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({ name: false, unit: false, volume: false });

  const isNameValid = Boolean(draft.productName.trim());
  const isUnitValid = Boolean(draft.unitLabel.trim());
  const parsedVolume = Number(draft.unitsProduced.trim());
  const isVolumeValid = Boolean(draft.unitsProduced.trim() && !isNaN(parsedVolume) && parsedVolume > 0);
  const isAllValid = isNameValid && isUnitValid && isVolumeValid;

  // Internal collapse state if not controlled externally (only collapsed if all mandatory fields are valid)
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    const vol = Number(draft.unitsProduced.trim());
    return Boolean(draft.productName.trim() && draft.unitLabel.trim() && !isNaN(vol) && vol > 0);
  });

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const setCollapsed = (collapsed: boolean) => {
    if (onToggleCollapse) {
      onToggleCollapse(collapsed);
    } else {
      setInternalCollapsed(collapsed);
    }
  };

  // Ensure productionBasis and defaultUnitsCoveredScope are always set in the background
  useEffect(() => {
    if (!draft.productionBasis || !draft.defaultUnitsCoveredScope) {
      onChange({
        productionBasis: draft.productionBasis || 'monthly',
        defaultUnitsCoveredScope: draft.defaultUnitsCoveredScope || 'all',
      });
    }
  }, [draft.productionBasis, draft.defaultUnitsCoveredScope, onChange]);

  const handleContinue = () => {
    setSubmitted(true);

    if (!isNameValid) {
      toast.error(t('nameRequired'));
      document.getElementById('cost-sheet-name')?.focus();
      return;
    }

    if (!isUnitValid) {
      toast.error(t('unitRequired'));
      document.getElementById('unit-label')?.focus();
      return;
    }

    if (!isVolumeValid) {
      toast.error(t('volumeRequired'));
      document.getElementById('units-produced')?.focus();
      return;
    }

    onChange({
      productionBasis: draft.productionBasis || 'monthly',
      defaultUnitsCoveredScope: draft.defaultUnitsCoveredScope || 'all',
    });
    setCollapsed(true);
    const costsHeading = document.getElementById('costs-heading');
    if (costsHeading) {
      costsHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // -------------------------------------------------------------
  // STATE B: COLLAPSED STATUS BANNER (~42px, max-w-xl sm:max-w-2xl)
  // -------------------------------------------------------------
  if (isCollapsed) {
    return (
      <section aria-labelledby="collapsed-setup-heading" className="max-w-xl sm:max-w-2xl animate-in fade-in-50 duration-200">
        <h2 id="collapsed-setup-heading" className="sr-only">
          {t('setupTitle')}
        </h2>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/95 px-4 py-2.5 sm:px-5 sm:py-3 shadow-2xs backdrop-blur-xs transition-all duration-200">
          <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
            {/* Kind Pill */}
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {draft.kind === 'service' ? (
                <>
                  <Briefcase className="size-3.5" />
                  <span>{t('service')}</span>
                </>
              ) : (
                <>
                  <Package className="size-3.5" />
                  <span>{t('product')}</span>
                </>
              )}
            </span>

            {/* Product / Service Name */}
            <span className="truncate text-sm font-semibold tracking-tight text-foreground">
              {draft.productName.trim() || (draft.kind === 'service' ? t('service') : t('product'))}
            </span>

            <span className="text-muted-foreground/30">•</span>

            {/* Monthly Volume & Unit */}
            <span className="shrink-0 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{draft.unitsProduced.trim() || '0'}</span>{' '}
              <span>{draft.unitLabel.trim() || (locale === 'si' ? 'ඒකක' : 'units')}</span>{' '}
              <span className="text-muted-foreground/70">{t('perMonthSuffix')}</span>
            </span>

            <span className="hidden text-muted-foreground/30 sm:inline">•</span>

            {/* Currency Pill */}
            <span className="hidden rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground sm:inline">
              {draft.currencyCode}
            </span>
          </div>

          {/* Edit Button */}
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-2xs transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            aria-label={t('editBasics')}
          >
            <Pencil className="size-3.5 text-muted-foreground" />
            <span>{t('editBasics')}</span>
          </button>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------
  // STATE A: BALANCED, COMFORTABLE SETUP CARD (max-w-xl sm:max-w-2xl)
  // -------------------------------------------------------------
  const showNameError = (submitted || touched.name) && !isNameValid;
  const showUnitError = (submitted || touched.unit) && !isUnitValid;
  const showVolumeError = (submitted || touched.volume) && !isVolumeValid;

  return (
    <section className="max-w-xl sm:max-w-2xl animate-in fade-in-50 duration-200" aria-labelledby="setup-heading">
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-card to-card/95 shadow-xs transition-all">
        {/* Header with Caption & Kind Switch */}
        <div className="border-b border-border/60 bg-primary/5 px-5 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Sliders className="size-4" />
              </span>
              <h2 id="setup-heading" className="text-sm font-bold tracking-tight text-foreground sm:text-base">
                {t('setupTitle')}
              </h2>
            </div>

            {/* Compact Product vs Service Switch */}
            <div className="inline-flex rounded-lg border border-border/60 bg-background/90 p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => onChange({ kind: 'product', productionBasis: 'monthly', defaultUnitsCoveredScope: 'all' })}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                  draft.kind === 'product'
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Package className="size-3.5" />
                <span>{t('product')}</span>
              </button>
              <button
                type="button"
                onClick={() => onChange({ kind: 'service', productionBasis: 'monthly', defaultUnitsCoveredScope: 'all' })}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                  draft.kind === 'service'
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Briefcase className="size-3.5" />
                <span>{t('service')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Inputs Section: Generous, Well-Proportioned Fields */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Field 1: Product / Service Name (Mandatory) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="cost-sheet-name" className="text-xs sm:text-[13px] font-semibold text-foreground flex items-center gap-1">
                <span>{draft.kind === 'service' ? t('serviceName') : t('productName')}</span>
                <span className="text-destructive font-bold">*</span>
              </label>
              {showNameError && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-destructive animate-in fade-in-50">
                  <AlertCircle className="size-3 shrink-0" />
                  <span>{t('nameRequired')}</span>
                </span>
              )}
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground/70">
                <Tag className={`size-4 ${showNameError ? 'text-destructive' : 'text-primary'}`} />
              </span>
              <input
                id="cost-sheet-name"
                type="text"
                required
                value={draft.productName}
                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                onChange={(event) =>
                  onChange({
                    productName: event.target.value,
                    productionBasis: draft.productionBasis || 'monthly',
                    defaultUnitsCoveredScope: draft.defaultUnitsCoveredScope || 'all',
                  })
                }
                placeholder={
                  draft.kind === 'service'
                    ? locale === 'si'
                      ? 'උදා: මංගල ඡායාරූපකරණය'
                      : 'e.g. Photography session'
                    : t('namePlaceholder')
                }
                autoComplete="off"
                className={`h-10 w-full rounded-lg border bg-background/60 pl-9 pr-3 text-sm font-medium outline-none transition-all placeholder:text-muted-foreground/50 ${
                  showNameError
                    ? 'border-destructive bg-destructive/5 text-foreground placeholder:text-destructive/40 focus:border-destructive focus:ring-2 focus:ring-destructive/20'
                    : 'border-input focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20'
                }`}
              />
            </div>
          </div>

          {/* Row 2: 2 Side-by-Side Fields (Both Mandatory) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Unit Name (What is a single unit - Mandatory) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="unit-label" className="text-xs sm:text-[13px] font-semibold text-foreground flex items-center gap-1">
                  <span>{t('unitName')}</span>
                  <span className="text-destructive font-bold">*</span>
                </label>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground/70">
                  <Package className={`size-4 ${showUnitError ? 'text-destructive' : 'text-primary'}`} />
                </span>
                <input
                  id="unit-label"
                  type="text"
                  required
                  value={draft.unitLabel}
                  onBlur={() => setTouched((prev) => ({ ...prev, unit: true }))}
                  onChange={(event) =>
                    onChange({
                      unitLabel: event.target.value,
                      productionBasis: draft.productionBasis || 'monthly',
                      defaultUnitsCoveredScope: draft.defaultUnitsCoveredScope || 'all',
                    })
                  }
                  placeholder={t('unitNamePlaceholder')}
                  autoComplete="off"
                  className={`h-10 w-full rounded-lg border bg-background/60 pl-9 pr-3 text-sm font-medium outline-none transition-all placeholder:text-muted-foreground/50 ${
                    showUnitError
                      ? 'border-destructive bg-destructive/5 text-foreground placeholder:text-destructive/40 focus:border-destructive focus:ring-2 focus:ring-destructive/20'
                      : 'border-input focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20'
                  }`}
                />
              </div>
              {showUnitError && (
                <p className="flex items-center gap-1 text-[11px] font-medium text-destructive animate-in fade-in-50">
                  <AlertCircle className="size-3 shrink-0" />
                  <span>{t('unitRequired')}</span>
                </p>
              )}
            </div>

            {/* Monthly Volume (Mandatory) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="units-produced" className="text-xs sm:text-[13px] font-semibold text-foreground flex items-center gap-1">
                  <span>{t('monthlyVolume')}</span>
                  <span className="text-destructive font-bold">*</span>
                </label>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground/70">
                  <TrendingUp className={`size-4 ${showVolumeError ? 'text-destructive' : 'text-primary'}`} />
                </span>
                <input
                  id="units-produced"
                  type="text"
                  inputMode="decimal"
                  required
                  value={draft.unitsProduced}
                  onBlur={() => setTouched((prev) => ({ ...prev, volume: true }))}
                  onChange={(event) =>
                    onChange({
                      unitsProduced: event.target.value,
                      productionBasis: 'monthly',
                      defaultUnitsCoveredScope: 'all',
                    })
                  }
                  placeholder={t('monthlyVolumePlaceholder')}
                  autoComplete="off"
                  className={`h-10 w-full rounded-lg border bg-background/60 pl-9 pr-14 text-sm font-medium outline-none transition-all placeholder:text-muted-foreground/50 ${
                    showVolumeError
                      ? 'border-destructive bg-destructive/5 text-foreground placeholder:text-destructive/40 focus:border-destructive focus:ring-2 focus:ring-destructive/20'
                      : 'border-input focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20'
                  }`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs font-semibold text-muted-foreground/70">
                  {t('perMonthSuffix')}
                </span>
              </div>
              {showVolumeError && (
                <p className="flex items-center gap-1 text-[11px] font-medium text-destructive animate-in fade-in-50">
                  <AlertCircle className="size-3 shrink-0" />
                  <span>{t('volumeRequired')}</span>
                </p>
              )}
            </div>
          </div>

          {/* Live Feedback Pill */}
          {isAllValid && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary transition-all">
              <Sparkles className="size-3.5 shrink-0" />
              <span className="truncate">
                {locale === 'si' ? 'ගණනය කරන්නේ: ' : 'Costing: '}
                <strong className="font-bold text-foreground">
                  {draft.productName.trim() || (draft.kind === 'service' ? t('service') : t('product'))}
                </strong>
                {' • '}
                <span>1 {draft.unitLabel.trim() || (locale === 'si' ? 'ඒකකයක්' : 'unit')}</span>
                {draft.unitsProduced.trim() && (
                  <span> ({draft.unitsProduced.trim()} {t('perMonthSuffix')})</span>
                )}
              </span>
            </div>
          )}

          {/* Footer: Currency + Primary Next Action */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/40">
            {/* Currency */}
            <div className="flex items-center gap-2 min-w-0">
              <label htmlFor="currency-code" className="shrink-0 text-xs font-medium text-muted-foreground">
                {t('currency')}:
              </label>
              <select
                id="currency-code"
                value={draft.currencyCode}
                onChange={(event) =>
                  onChange({ currencyCode: event.target.value, currencyOverridden: true })
                }
                className="h-8 max-w-[140px] sm:max-w-[220px] truncate rounded-md border border-input bg-background px-2.5 text-xs font-semibold outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 cursor-pointer"
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
            </div>

            {/* Next Action Button (Validated) */}
            <button
              type="button"
              onClick={handleContinue}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold shadow-xs transition-all cursor-pointer ${
                isAllValid
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring'
                  : 'bg-primary/80 text-primary-foreground hover:bg-primary focus-visible:ring-2 focus-visible:ring-ring'
              }`}
              aria-label={t('continueToCosts')}
            >
              <span>{t('continueToCosts')}</span>
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
