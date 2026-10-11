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
  goodUnits?: string;
  onChange: (updates: Partial<BucketDraft>) => void;
}

export function BucketCard({
  bucketKey,
  title,
  question,
  bucket,
  currencyCode,
  goodUnits,
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

  const addItem = () => {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    onChange({
      items: [...bucket.items, { id, name: '', amount: '', unitsCovered: '' }],
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
              <label htmlFor={`${prefix}-coverage`} className="text-sm font-medium">{t('unitsCovered')}</label>
              <Input
                id={`${prefix}-coverage`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={bucket.unitsCovered}
                onChange={(event) => onChange({ unitsCovered: event.target.value })}
                placeholder={goodUnits || t('unitsPlaceholder')}
                className="min-h-11"
                aria-describedby={`${prefix}-coverage-hint`}
              />
              <p id={`${prefix}-coverage-hint`} className="text-xs text-muted-foreground">
                {goodUnits ? `${t('unitsCoveredHint')} (${goodUnits})` : t('unitsCoveredHint')}
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
                        placeholder={goodUnits || t('unitsPlaceholder')}
                        className="min-h-11"
                      />
                    </div>
                  </div>
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
