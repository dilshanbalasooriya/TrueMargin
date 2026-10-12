'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import type { BucketDraft, LineItemDraft } from '@/store/useCalculatorStore';

interface BucketCardProps {
  bucketKey: string;
  title: string;
  question: string;
  bucket: BucketDraft;
  currencyCode: string;
  unitsCoveredRequired: boolean;
  defaultUnitsCovered?: string;
  onChange: (updates: Partial<BucketDraft>) => void;
}

export function BucketCard({
  bucketKey,
  title,
  question,
  bucket,
  currencyCode,
  unitsCoveredRequired,
  defaultUnitsCovered,
  onChange,
}: BucketCardProps) {
  const t = useTranslations('Calculator');
  const [expanded, setExpanded] = useState(bucket.items.length > 0);
  const prefix = `bucket-${bucketKey}`;

  const updateItem = (id: string, updates: Partial<LineItemDraft>) => {
    onChange({
      items: bucket.items.map((item) => item.id === id ? { ...item, ...updates } : item),
    });
  };

  const updateItemDetail = (item: LineItemDraft, key: string, value: string) => {
    updateItem(item.id, {
      details: { ...item.details, [key]: value },
    });
  };

  const addItem = () => {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    onChange({
      items: [...bucket.items, { id, name: '', amount: '', unitsCovered: '', details: {} }],
    });
    setExpanded(true);
  };

  const removeItem = (id: string) => {
    onChange({ items: bucket.items.filter((item) => item.id !== id) });
  };

  return (
    <article className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{question}</p>
        </div>
        {bucket.isNone && (
          <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
            {t('none')}
          </span>
        )}
      </div>

      {bucket.isNone ? (
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => onChange({ isNone: false, totalSpent: '', items: [] })}
          >
            {t('change')}
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor={`${prefix}-amount`} className="text-sm font-medium">{t('amountSpent')}</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
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
                  className="min-h-11 pl-14"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor={`${prefix}-coverage`} className="text-sm font-medium">
                {t('unitsCovered')} {unitsCoveredRequired && <span className="text-destructive">*</span>}
              </label>
              <Input
                id={`${prefix}-coverage`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={bucket.unitsCovered}
                onChange={(event) => onChange({ unitsCovered: event.target.value })}
                placeholder={defaultUnitsCovered || t('unitsPlaceholder')}
                className="min-h-11"
                aria-describedby={`${prefix}-coverage-hint`}
              />
              <p id={`${prefix}-coverage-hint`} className="text-xs text-muted-foreground">
                {unitsCoveredRequired
                  ? t('unitsCoveredRequiredHint')
                  : defaultUnitsCovered
                    ? `${t('unitsCoveredHint')} (${defaultUnitsCovered})`
                    : t('unitsCoveredHint')}
              </p>
            </div>
          </div>

          {expanded && (
            <div className="mt-5 space-y-3 border-t border-border pt-4">
              <div>
                <h4 className="text-sm font-semibold">{t('lineItems')}</h4>
                <p className="mt-1 text-xs text-muted-foreground">{t('lineItemsHint')}</p>
              </div>
              {bucket.items.map((item, index) => (
                <div key={item.id} className="rounded-lg border border-border/80 bg-muted/20 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <label htmlFor={`${prefix}-item-${index}-name`} className="text-sm font-medium">{t('lineName')}</label>
                      <Input
                        id={`${prefix}-item-${index}-name`}
                        value={item.name}
                        onChange={(event) => updateItem(item.id, { name: event.target.value })}
                        placeholder={title}
                        className="min-h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor={`${prefix}-item-${index}-purchase-quantity`} className="text-sm font-medium">{t('linePurchaseQuantity')}</label>
                      <Input
                        id={`${prefix}-item-${index}-purchase-quantity`}
                        type="text"
                        inputMode="decimal"
                        value={item.purchaseQuantity ?? ''}
                        onChange={(event) => updateItem(item.id, { purchaseQuantity: event.target.value })}
                        placeholder="1"
                        className="min-h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor={`${prefix}-item-${index}-purchase-unit`} className="text-sm font-medium">{t('linePurchaseUnit')}</label>
                      <Input
                        id={`${prefix}-item-${index}-purchase-unit`}
                        value={item.purchaseUnit ?? ''}
                        onChange={(event) => updateItem(item.id, { purchaseUnit: event.target.value })}
                        placeholder={t('linePurchaseUnitPlaceholder')}
                        className="min-h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor={`${prefix}-item-${index}-amount`} className="text-sm font-medium">{t('lineAmount')}</label>
                      <Input
                        id={`${prefix}-item-${index}-amount`}
                        type="text"
                        inputMode="decimal"
                        value={item.amount}
                        onChange={(event) => updateItem(item.id, { amount: event.target.value })}
                        placeholder={t('amountPlaceholder')}
                        className="min-h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor={`${prefix}-item-${index}-units`} className="text-sm font-medium">{t('lineUnits')}</label>
                      <Input
                        id={`${prefix}-item-${index}-units`}
                        type="text"
                        inputMode="decimal"
                        value={item.unitsCovered}
                        onChange={(event) => updateItem(item.id, { unitsCovered: event.target.value })}
                        placeholder={bucket.unitsCovered || defaultUnitsCovered || t('unitsPlaceholder')}
                        className="min-h-11"
                      />
                    </div>
                  </div>
                  <details className="mt-3 rounded-md border border-border/70 bg-background p-3">
                    <summary className="cursor-pointer text-sm font-medium">{t('level3CostDetails')}</summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <DetailNumberInput
                          id={`${prefix}-item-${index}-variable-share`}
                          label={t('detailLabels.variable_percentage')}
                          value={item.details?.variable_percentage ?? ''}
                          onChange={(value) => updateItemDetail(item, 'variable_percentage', value)}
                          suffix="%"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">{t('variablePercentageHint')}</p>
                      </div>
                      {bucketKey === 'material' && (
                        <>
                          <DetailNumberInput
                            id={`${prefix}-item-${index}-wastage`}
                            label={t('detailLabels.wastage_percentage')}
                            value={item.details?.wastage_percentage ?? ''}
                            onChange={(value) => updateItemDetail(item, 'wastage_percentage', value)}
                            suffix="%"
                          />
                          <DetailNumberInput
                            id={`${prefix}-item-${index}-scrap`}
                            label={t('detailLabels.scrap_recovery_amount')}
                            value={item.details?.scrap_recovery_amount ?? ''}
                            onChange={(value) => updateItemDetail(item, 'scrap_recovery_amount', value)}
                            prefix={currencyCode}
                          />
                        </>
                      )}
                      {bucketKey === 'labor' && (
                        <>
                          <DetailNumberInput
                            id={`${prefix}-item-${index}-statutory`}
                            label={t('detailLabels.statutory_percentage')}
                            value={item.details?.statutory_percentage ?? ''}
                            onChange={(value) => updateItemDetail(item, 'statutory_percentage', value)}
                            suffix="%"
                          />
                          <DetailNumberInput
                            id={`${prefix}-item-${index}-bonus`}
                            label={t('detailLabels.bonus_percentage')}
                            value={item.details?.bonus_percentage ?? ''}
                            onChange={(value) => updateItemDetail(item, 'bonus_percentage', value)}
                            suffix="%"
                          />
                          <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
                            <input
                              type="checkbox"
                              checked={item.isImputed ?? false}
                              onChange={(event) => updateItem(item.id, { isImputed: event.target.checked })}
                              className="size-4 accent-primary"
                            />
                            {t('imputedLabor')}
                          </label>
                        </>
                      )}
                      {bucketKey === 'transport' && (
                        <>
                          <DetailSelect
                            id={`${prefix}-item-${index}-direction`}
                            label={t('detailLabels.direction')}
                            value={item.details?.direction ?? 'shared'}
                            options={['inbound', 'outbound', 'shared']}
                            optionLabel={(value) => t(`detailOptions.${value}`)}
                            onChange={(value) => updateItemDetail(item, 'direction', value)}
                          />
                          <DetailSelect
                            id={`${prefix}-item-${index}-allocation-basis`}
                            label={t('detailLabels.allocation_basis')}
                            value={item.details?.allocation_basis ?? 'quantity'}
                            options={['quantity', 'weight', 'volume']}
                            optionLabel={(value) => t(`detailOptions.${value}`)}
                            onChange={(value) => updateItemDetail(item, 'allocation_basis', value)}
                          />
                          <DetailNumberInput
                            id={`${prefix}-item-${index}-allocation-measure`}
                            label={t('detailLabels.allocation_measure')}
                            value={item.details?.allocation_measure ?? ''}
                            onChange={(value) => updateItemDetail(item, 'allocation_measure', value)}
                          />
                          <DetailNumberInput
                            id={`${prefix}-item-${index}-allocation-total`}
                            label={t('detailLabels.allocation_total_measure')}
                            value={item.details?.allocation_total_measure ?? ''}
                            onChange={(value) => updateItemDetail(item, 'allocation_total_measure', value)}
                          />
                        </>
                      )}
                      {bucketKey === 'overhead' && (
                        <DetailNumberInput
                          id={`${prefix}-item-${index}-business-use`}
                          label={t('detailLabels.allocation_percentage')}
                          value={item.details?.allocation_percentage ?? ''}
                          onChange={(value) => updateItemDetail(item, 'allocation_percentage', value)}
                          suffix="%"
                        />
                      )}
                      {bucketKey === 'machinery' && (
                        <>
                          <DetailSelect
                            id={`${prefix}-item-${index}-depreciation`}
                            label={t('depreciationMethod')}
                            value={item.details?.depreciation_method ?? 'none'}
                            options={['none', 'units', 'periods']}
                            optionLabel={(value) => t(`detailOptions.${value}`)}
                            onChange={(value) => updateItemDetail(item, 'depreciation_method', value)}
                          />
                          {item.details?.depreciation_method !== undefined
                            && item.details.depreciation_method !== 'none' && (
                              <>
                                <DetailNumberInput
                                  id={`${prefix}-item-${index}-purchase-price`}
                                  label={t('detailLabels.purchase_price')}
                                  value={item.details?.purchase_price ?? ''}
                                  onChange={(value) => updateItemDetail(item, 'purchase_price', value)}
                                  prefix={currencyCode}
                                />
                                <DetailNumberInput
                                  id={`${prefix}-item-${index}-salvage-value`}
                                  label={t('detailLabels.salvage_value')}
                                  value={item.details?.salvage_value ?? ''}
                                  onChange={(value) => updateItemDetail(item, 'salvage_value', value)}
                                  prefix={currencyCode}
                                />
                                {item.details.depreciation_method === 'units' ? (
                                  <DetailNumberInput
                                    id={`${prefix}-item-${index}-lifetime-units`}
                                    label={t('detailLabels.lifetime_units')}
                                    value={item.details?.lifetime_units ?? ''}
                                    onChange={(value) => updateItemDetail(item, 'lifetime_units', value)}
                                  />
                                ) : (
                                  <DetailNumberInput
                                    id={`${prefix}-item-${index}-useful-life`}
                                    label={t('detailLabels.useful_life_periods')}
                                    value={item.details?.useful_life_periods ?? ''}
                                    onChange={(value) => updateItemDetail(item, 'useful_life_periods', value)}
                                  />
                                )}
                              </>
                            )}
                        </>
                      )}
                      {bucketKey === 'custom_fees' && (
                        <>
                          <DetailSelect
                            id={`${prefix}-item-${index}-amortization`}
                            label={t('amortizationMethod')}
                            value={item.details?.amortization_method ?? 'none'}
                            options={['none', 'units', 'periods']}
                            optionLabel={(value) => t(`detailOptions.${value}`)}
                            onChange={(value) => updateItemDetail(item, 'amortization_method', value)}
                          />
                          {item.details?.amortization_method !== undefined
                            && item.details.amortization_method !== 'none' && (
                              <DetailNumberInput
                                id={`${prefix}-item-${index}-amortization-units`}
                                label={t('detailLabels.amortization_units')}
                                value={item.details?.amortization_units ?? ''}
                                onChange={(value) => updateItemDetail(item, 'amortization_units', value)}
                              />
                            )}
                        </>
                      )}
                    </div>
                  </details>
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-2 min-h-10 px-2 text-muted-foreground"
                    onClick={() => removeItem(item.id)}
                    aria-label={t('removeLine')}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    {t('removeLine')}
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" onClick={addItem}>
                <Plus className="size-4" aria-hidden="true" />
                {t('addLine')}
              </Button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
            <Button
              type="button"
              variant="ghost"
              className="min-h-10 px-2 text-sm text-muted-foreground"
              onClick={() => onChange({ isNone: true, totalSpent: '0', items: [] })}
            >
              {t('none')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? t('hideDetails') : t('breakDown')}
            </Button>
          </div>
        </>
      )}
    </article>
  );
}

function DetailNumberInput({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">{prefix}</span>}
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`min-h-11 ${prefix ? 'pl-14' : ''} ${suffix ? 'pr-9' : ''}`}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{suffix}</span>}
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
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((option) => <option key={option} value={option}>{optionLabel(option)}</option>)}
      </select>
    </div>
  );
}
