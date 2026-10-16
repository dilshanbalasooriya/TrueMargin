'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SlidersHorizontal, Sparkles, RotateCcw, Check, HelpCircle } from 'lucide-react';
import type { LineItemDraft } from '@/store/useCalculatorStore';

interface Level3DetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bucketKey: string;
  categoryTitle: string;
  item: LineItemDraft | null;
  currencyCode: string;
  onSave: (updates: { details: Record<string, string>; isImputed?: boolean }) => void;
}

export function getActiveLevel3Count(item: LineItemDraft, bucketKey: string): number {
  let count = 0;
  if (item.isImputed) count++;
  if (item.details) {
    if (item.details.variable_percentage?.trim()) count++;
    if (bucketKey === 'material') {
      if (item.details.wastage_percentage?.trim()) count++;
      if (item.details.scrap_recovery_amount?.trim()) count++;
    } else if (bucketKey === 'labor') {
      if (item.details.statutory_percentage?.trim()) count++;
      if (item.details.bonus_percentage?.trim()) count++;
      if (item.details.allocation_percentage?.trim() && item.details.allocation_percentage.trim() !== '100') count++;
    } else if (bucketKey === 'overhead') {
      if (item.details.allocation_percentage?.trim()) count++;
    } else if (bucketKey === 'machinery') {
      if (item.details.depreciation_method && item.details.depreciation_method !== 'none') count++;
      if (item.details.purchase_price?.trim()) count++;
      if (item.details.salvage_value?.trim()) count++;
      if (item.details.maintenance_cost_annual?.trim()) count++;
      if (item.details.lifetime_units?.trim() || item.details.useful_life_periods?.trim()) count++;
    } else if (bucketKey === 'custom_fees') {
      if (item.details.amortization_method && item.details.amortization_method !== 'none') count++;
      if (item.details.amortization_units?.trim()) count++;
    }
  }
  return count;
}

export function Level3DetailsModal({
  open,
  onOpenChange,
  bucketKey,
  categoryTitle,
  item,
  currencyCode,
  onSave,
}: Level3DetailsModalProps) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg max-h-[88vh] overflow-y-auto sm:max-w-xl p-5 sm:p-6 rounded-2xl">
        <Level3Form
          key={item.id}
          bucketKey={bucketKey}
          categoryTitle={categoryTitle}
          item={item}
          currencyCode={currencyCode}
          onSave={onSave}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function Level3Form({
  bucketKey,
  categoryTitle,
  item,
  currencyCode,
  onSave,
  onClose,
}: {
  bucketKey: string;
  categoryTitle: string;
  item: LineItemDraft;
  currencyCode: string;
  onSave: (updates: { details: Record<string, string>; isImputed?: boolean }) => void;
  onClose: () => void;
}) {
  const t = useTranslations('Calculator');
  const [details, setDetails] = useState<Record<string, string>>(() => ({ ...(item.details ?? {}) }));
  const [isImputed, setIsImputed] = useState<boolean>(() => item.isImputed ?? false);

  const updateDetail = (key: string, value: string) => {
    setDetails((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setDetails({});
    setIsImputed(false);
  };

  const handleSave = () => {
    onSave({ details, isImputed });
    onClose();
  };

  const prefix = `level3-modal-${item.id}`;
  const itemName = item.name.trim() || categoryTitle;

  return (
    <>
      <DialogHeader className="gap-1.5 pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <SlidersHorizontal className="size-3.5" />
            Level 3
          </span>
          <span className="text-xs text-muted-foreground font-medium truncate">
            {categoryTitle}
          </span>
        </div>
        <DialogTitle className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
          {itemName}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
          {t('level3ModalDescription')}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5 py-2">
        {/* Universal Level 3 Setting: Variable Cost Share for Break-Even */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="size-4 text-primary shrink-0" />
              <h4 className="text-sm font-semibold text-foreground">
                {t('breakEvenSectionTitle')}
              </h4>
            </div>
          </div>
          
          <DetailNumberInput
            id={`${prefix}-variable-share`}
            label={t('detailLabels.variable_percentage')}
            value={details.variable_percentage ?? ''}
            onChange={(value) => updateDetail('variable_percentage', value)}
            suffix="%"
            placeholder="e.g. 100"
          />
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <HelpCircle className="size-3.5 shrink-0 mt-0.5 text-muted-foreground/70" />
            <span>{t('variablePercentageHint')}</span>
          </p>
        </div>

        {/* Category-Specific Rules */}
        {bucketKey === 'material' && (
          <div className="space-y-3.5 rounded-xl border border-border/80 bg-muted/20 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('categorySpecificSectionTitle')}
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailNumberInput
                id={`${prefix}-wastage`}
                label={t('detailLabels.wastage_percentage')}
                value={details.wastage_percentage ?? ''}
                onChange={(value) => updateDetail('wastage_percentage', value)}
                suffix="%"
                placeholder="e.g. 5"
              />
              <DetailNumberInput
                id={`${prefix}-scrap`}
                label={t('detailLabels.scrap_recovery_amount')}
                value={details.scrap_recovery_amount ?? ''}
                onChange={(value) => updateDetail('scrap_recovery_amount', value)}
                prefix={currencyCode}
                placeholder="0.00"
              />
            </div>
          </div>
        )}

        {bucketKey === 'labor' && (
          <div className="space-y-3.5 rounded-xl border border-border/80 bg-muted/20 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('categorySpecificSectionTitle')}
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailNumberInput
                id={`${prefix}-statutory`}
                label={t('detailLabels.statutory_percentage')}
                value={details.statutory_percentage ?? ''}
                onChange={(value) => updateDetail('statutory_percentage', value)}
                suffix="%"
                placeholder="e.g. 15 (EPF/ETF)"
              />
              <DetailNumberInput
                id={`${prefix}-bonus`}
                label={t('detailLabels.bonus_percentage')}
                value={details.bonus_percentage ?? ''}
                onChange={(value) => updateDetail('bonus_percentage', value)}
                suffix="%"
                placeholder="e.g. 10"
              />
              <div className="sm:col-span-2">
                <DetailNumberInput
                  id={`${prefix}-allocation`}
                  label={t('allocationPercentageLabel')}
                  value={details.allocation_percentage ?? ''}
                  onChange={(value) => updateDetail('allocation_percentage', value)}
                  suffix="%"
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('allocationPercentageHint')}
                </p>
              </div>
              <div className="sm:col-span-2 pt-1">
                <label className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-background cursor-pointer hover:bg-muted/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={isImputed}
                    onChange={(event) => setIsImputed(event.target.checked)}
                    className="size-4 rounded accent-primary text-primary"
                  />
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-foreground block">
                      {t('imputedLabor')}
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {bucketKey === 'overhead' && (
          <div className="space-y-3.5 rounded-xl border border-border/80 bg-muted/20 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('categorySpecificSectionTitle')}
            </h4>
            <DetailNumberInput
              id={`${prefix}-business-use`}
              label={t('detailLabels.allocation_percentage')}
              value={details.allocation_percentage ?? ''}
              onChange={(value) => updateDetail('allocation_percentage', value)}
              suffix="%"
              placeholder="e.g. 40"
            />
          </div>
        )}

        {bucketKey === 'machinery' && (
          <div className="space-y-3.5 rounded-xl border border-border/80 bg-muted/20 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('categorySpecificSectionTitle')}
            </h4>
            <DetailSelect
              id={`${prefix}-depreciation`}
              label={t('depreciationMethod')}
              value={details.depreciation_method ?? 'none'}
              options={['none', 'units', 'periods']}
              optionLabel={(value) => t(`detailOptions.${value}`)}
              onChange={(value) => updateDetail('depreciation_method', value)}
            />
            {details.depreciation_method !== undefined &&
              details.depreciation_method !== 'none' && (
                <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t border-border/60">
                  <DetailNumberInput
                    id={`${prefix}-purchase-price`}
                    label={t('detailLabels.purchase_price')}
                    value={details.purchase_price ?? ''}
                    onChange={(value) => updateDetail('purchase_price', value)}
                    prefix={currencyCode}
                    placeholder="0.00"
                  />
                  <DetailNumberInput
                    id={`${prefix}-salvage-value`}
                    label={t('detailLabels.salvage_value')}
                    value={details.salvage_value ?? ''}
                    onChange={(value) => updateDetail('salvage_value', value)}
                    prefix={currencyCode}
                    placeholder="0.00"
                  />
                  <div className="sm:col-span-2">
                    <DetailNumberInput
                      id={`${prefix}-maintenance-cost`}
                      label={t('detailLabels.maintenance_cost_annual')}
                      value={details.maintenance_cost_annual ?? ''}
                      onChange={(value) => updateDetail('maintenance_cost_annual', value)}
                      prefix={currencyCode}
                      placeholder="0.00"
                    />
                  </div>
                  {details.depreciation_method === 'units' ? (
                    <div className="sm:col-span-2">
                      <DetailNumberInput
                        id={`${prefix}-lifetime-units`}
                        label={t('detailLabels.lifetime_units')}
                        value={details.lifetime_units ?? ''}
                        onChange={(value) => updateDetail('lifetime_units', value)}
                        placeholder="e.g. 50000"
                      />
                    </div>
                  ) : (
                    <div className="sm:col-span-2">
                      <DetailNumberInput
                        id={`${prefix}-useful-life`}
                        label={t('detailLabels.useful_life_periods')}
                        value={details.useful_life_periods ?? ''}
                        onChange={(value) => updateDetail('useful_life_periods', value)}
                        placeholder="e.g. 36 (months)"
                      />
                    </div>
                  )}
                </div>
              )}
          </div>
        )}

        {bucketKey === 'custom_fees' && (
          <div className="space-y-3.5 rounded-xl border border-border/80 bg-muted/20 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('categorySpecificSectionTitle')}
            </h4>
            <DetailSelect
              id={`${prefix}-amortization`}
              label={t('amortizationMethod')}
              value={details.amortization_method ?? 'none'}
              options={['none', 'units', 'periods']}
              optionLabel={(value) => t(`detailOptions.${value}`)}
              onChange={(value) => updateDetail('amortization_method', value)}
            />
            {details.amortization_method !== undefined &&
              details.amortization_method !== 'none' && (
                <div className="pt-1 border-t border-border/60">
                  <DetailNumberInput
                    id={`${prefix}-amortization-units`}
                    label={t('detailLabels.amortization_units')}
                    value={details.amortization_units ?? ''}
                    onChange={(value) => updateDetail('amortization_units', value)}
                    placeholder="e.g. 1000"
                  />
                </div>
              )}
          </div>
        )}
      </div>

      <DialogFooter className="mt-4 flex flex-row items-center justify-between gap-2 border-t border-border/60 pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="mr-1.5 size-3.5" />
          {t('resetDetails')}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            className="font-medium"
          >
            <Check className="mr-1.5 size-4" />
            {t('saveAndClose')}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

function DetailNumberInput({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`h-9 text-sm ${prefix ? 'pl-12' : ''} ${suffix ? 'pr-9' : ''}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function DetailSelect({
  id,
  label,
  value,
  options,
  optionLabel,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  optionLabel: (value: string) => string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabel(option)}
          </option>
        ))}
      </select>
    </div>
  );
}
