'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDownToLine, ChevronUp, LoaderCircle, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ResultDetails } from '@/components/calculator/ResultsPanel';
import type { ResultsPanelProps } from '@/components/calculator/ResultsPanel';
import { LoginModal } from '@/components/auth/LoginModal';
import { useAuth } from '@/components/auth/AuthProvider';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

interface MobileResultBarProps extends ResultsPanelProps {
  onSave: () => void;
}

export function MobileResultBar(props: MobileResultBarProps) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations('Calculator');
  const { user } = useAuth();
  const locale = useLocale();
  const formatMoney = (value: string) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: props.currencyCode,
        maximumFractionDigits: 2,
      }).format(Number(value));
    } catch {
      return `${props.currencyCode} ${value}`;
    }
  };
  const unitCost = props.result ? formatMoney(props.result.unit_cost) : '—';
  const suggestedPrice = props.result ? formatMoney(props.result.suggested_price) : '—';

  return (
    <Dialog open={expanded} onOpenChange={(open) => setExpanded(open)}>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 shadow-[0_-8px_24px_-20px_rgba(15,23,42,0.35)] backdrop-blur md:hidden">
        <DialogTrigger
          render={
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-between gap-3 text-left"
            >
              <span className="grid min-w-0 flex-1 grid-cols-2 gap-3">
                <span className="min-w-0">
                  <span className="block text-[11px] text-muted-foreground">{t('productionUnitCost')}</span>
                  <span className="block truncate text-base font-semibold tabular-nums">{unitCost}</span>
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] text-muted-foreground">{t('suggestedDeliveredPrice')}</span>
                  <span className="block truncate text-base font-semibold tabular-nums">{suggestedPrice}</span>
                </span>
              </span>
              <ChevronUp className="size-4 shrink-0 text-primary" aria-hidden="true" />
            </button>
          }
        />
      </div>

      <DialogContent
        closeLabel={t('closeResults')}
        className="inset-x-0 bottom-0 left-0 top-auto max-h-[88dvh] max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-t-2xl rounded-b-none border border-border bg-background p-0 pb-[max(env(safe-area-inset-bottom),1rem)] sm:max-w-none md:hidden"
      >
        <div className="sticky top-0 z-10 border-b border-border bg-background px-4 py-4">
          <h2 className="pr-10 font-semibold">{t('resultsTitle')}</h2>
        </div>
        <div className="space-y-4 p-4">
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
                <Button type="button" className="min-h-11 w-full">{t('save')}</Button>
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
      </DialogContent>
    </Dialog>
  );
}
