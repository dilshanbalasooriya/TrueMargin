'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoginModal } from '@/components/auth/LoginModal';
import { useAuth } from '@/components/auth/AuthProvider';
import { ArrowDownToLine, LoaderCircle, Printer } from 'lucide-react';
import type { CalculationResult } from '@/lib/api-client';

export interface ResultsPanelProps {
  result: CalculationResult | null;
  currencyCode: string;
  partial: boolean;
  unansweredCount: number;
  loading: boolean;
  error: 'offline' | 'stale' | 'invalid' | 'failed' | null;
  saving: boolean;
  saved: boolean;
  versionId?: string;
  onSave: () => void;
  onDownloadCsv: () => void;
  onPrint: () => void;
}

function formatCurrency(value: string, currencyCode: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `${currencyCode} ${value}`;
  }
}

function ResultDetails({
  result,
  currencyCode,
  partial,
  unansweredCount,
  loading,
  error,
}: Pick<ResultsPanelProps, 'result' | 'currencyCode' | 'partial' | 'unansweredCount' | 'loading' | 'error'>) {
  const t = useTranslations('Calculator');
  const locale = useLocale();

  if (!result) {
    return (
      <div className="space-y-3">
        {error && (
          <p role="status" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error === 'offline' ? t('offline') : error === 'invalid' ? t('invalidInputs') : error === 'stale' ? t('outOfDate') : t('calculationError')}
          </p>
        )}
        <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
          {t('resultAwaiting')}
        </div>
      </div>
    );
  }

  const equivalentKey = result.pricing_type === 'markup' ? 'equivalentMargin' : 'equivalentMarkup';
  const bucketLabels: Record<string, string> = {
    material: t('bucketLabels.material'),
    labor: t('bucketLabels.labor'),
    transport: t('bucketLabels.transport'),
    overhead: t('bucketLabels.overhead'),
    machinery: t('bucketLabels.machinery'),
    custom_fees: t('bucketLabels.custom_fees'),
  };

  return (
    <div className={loading ? 'space-y-5 opacity-70' : 'space-y-5'}>
      <div className="flex flex-wrap items-center gap-2">
        {partial ? (
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
            {t('partial')}
          </span>
        ) : (
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
            {t('allBucketsAnswered')}
          </span>
        )}
        {partial && (
          <span className="text-xs text-muted-foreground">
            {t('bucketsRemaining', { count: unansweredCount })}
          </span>
        )}
        {loading && <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label={t('loading')} />}
      </div>

      {error && (
        <p role="status" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error === 'offline' ? t('offline') : error === 'invalid' ? t('invalidInputs') : error === 'stale' ? t('outOfDate') : t('calculationError')}
        </p>
      )}

      {result.is_loss_making && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {t('lossWarning')}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-xl bg-primary p-4 text-primary-foreground">
          <p className="text-sm text-primary-foreground/80">{t('productionUnitCost')}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
            {formatCurrency(result.unit_cost, currencyCode, locale)}
          </p>
          <p className="mt-1 text-xs text-primary-foreground/80">/ {result.unit_label}</p>
        </div>
        <Metric label={t('cashUnitCost')} value={formatCurrency(result.cash_unit_cost, currencyCode, locale)} />
        <Metric label={t('economicUnitCost')} value={formatCurrency(result.economic_unit_cost, currencyCode, locale)} />
        {Number(result.seller_paid_delivery_per_unit) > 0 && (
          <Metric
            label={t('sellerPaidDeliveryCost')}
            value={formatCurrency(result.seller_paid_delivery_per_unit, currencyCode, locale)}
          />
        )}
        {Number(result.customer_paid_delivery_per_unit) > 0 && (
          <Metric
            label={t('customerPaidDeliveryCost')}
            value={formatCurrency(result.customer_paid_delivery_per_unit, currencyCode, locale)}
          />
        )}
        <Metric
          label={t('suggestedProductPrice')}
          value={formatCurrency(result.suggested_product_price, currencyCode, locale)}
        />
        <Metric
          label={t('suggestedDeliveredPrice')}
          value={formatCurrency(result.suggested_delivered_price, currencyCode, locale)}
        />
        <Metric label={t('profitPerUnit')} value={formatCurrency(result.profit_per_unit, currencyCode, locale)} />
        <Metric label={t('totalProfit')} value={formatCurrency(result.total_expected_profit, currencyCode, locale)} />
        <Metric label={t(equivalentKey)} value={`${result.equivalent_markup_or_margin}%`} />
        {!partial && result.break_even_ready && (
          <Metric
            label={t('breakEvenUnits')}
            value={result.break_even_units === null ? t('breakEvenUnavailable') : `${result.break_even_units} ${result.unit_label}`}
          />
        )}
      </div>

      {!partial
        && !result.break_even_ready
        && result.bucket_breakdown.some((bucket) => Number(bucket.effective_total) > 0)
        && (
          <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
            {t('breakEvenNeedsLevel3')}
          </p>
        )}

      <div>
        <h3 className="mb-3 text-sm font-semibold">{t('costBreakdown')}</h3>
        <ul className="space-y-3">
          {result.bucket_breakdown.map((bucket) => (
            <li key={bucket.type}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{bucketLabels[bucket.type] ?? bucket.type}</span>
                <span className="shrink-0 tabular-nums">
                  {formatCurrency(bucket.cost_per_unit, currencyCode, locale)}
                </span>
              </div>
              {bucket.reconciliation_status === 'unallocated_added' && (
                <p className="mb-2 text-xs leading-5 text-muted-foreground">
                  {t('reconciliation.unallocated', {
                    amount: formatCurrency(
                      String(Math.max(
                        0,
                        Number(bucket.effective_total)
                          - Number(result.cost_view === 'cash'
                            ? bucket.itemized_total
                            : bucket.economic_itemized_total),
                      )),
                      currencyCode,
                      locale,
                    ),
                  })}
                </p>
              )}
              {bucket.reconciliation_status === 'exceeded' && (
                <p className="mb-2 text-xs leading-5 text-muted-foreground">
                  {t('reconciliation.exceeded')}
                </p>
              )}
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${bucket.percentage_of_total}%`}
              >
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${bucket.percentage_of_total}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border p-3">
      <p className="text-xs leading-4 text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums" title={value}>{value}</p>
    </div>
  );
}

export function ResultsPanel(props: ResultsPanelProps) {
  const t = useTranslations('Calculator');
  const { user } = useAuth();

  return (
    <Card className="gap-0 overflow-visible p-0">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <h2 className="text-lg font-semibold tracking-tight">{t('resultsTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('resultsDescription')}</p>
      </div>
      <div className="space-y-5 p-4 sm:p-5">
        <ResultDetails {...props} />

        <div className="space-y-2 border-t border-border pt-4">
          {user ? (
            <Button
              type="button"
              className="min-h-11 w-full"
              onClick={props.onSave}
              disabled={props.saving || !props.result || props.loading || Boolean(props.error)}
            >
              {props.saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
              {props.saving ? t('saving') : props.saved ? t('saved') : t('save')}
            </Button>
          ) : (
            <LoginModal>
              <Button type="button" className="min-h-11 w-full">
                {t('save')}
              </Button>
            </LoginModal>
          )}

          {props.versionId ? (
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={props.onDownloadCsv}>
                <ArrowDownToLine className="size-4" aria-hidden="true" />
                <span className="truncate">{t('reportCsv')}</span>
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={props.onPrint}>
                <Printer className="size-4" aria-hidden="true" />
                <span className="truncate">{t('reportPrint')}</span>
              </Button>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">{t('reportRequiresSave')}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

export { ResultDetails };
