'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  downloadVersionReport,
  getVersionDetail,
  listSheetVersions,
  loadSheetVersionIntoDraft,
  type CostSheet,
  type SheetVersionDetail,
  type SheetVersionSummary,
} from '@/lib/api-client';
import { useCalculatorStore } from '@/store/useCalculatorStore';
import { useRouter } from '@/i18n/routing';
import { toast } from '@/store/useToast';
import { DeleteConfirmModal } from '@/components/sheets/DeleteConfirmModal';
import {
  ArrowDownToLine,
  Calculator,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileSpreadsheet,
  GitCommitVertical,
  History,
  Layers,
  Loader2,
  Package,
  Percent,
  PieChart,
  Printer,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { cn } from 'cn';

interface CostSheetDetailModalProps {
  sheet: CostSheet | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteSheet?: (sheetId: string) => Promise<void>;
}

export function CostSheetDetailModal({
  sheet,
  open,
  onOpenChange,
  onDeleteSheet,
}: CostSheetDetailModalProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('Sheets');
  const loadDraft = useCalculatorStore((s) => s.loadDraft);

  const [versions, setVersions] = useState<SheetVersionSummary[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [versionDetail, setVersionDetail] = useState<SheetVersionDetail | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<'csv' | 'pdf' | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isSi = locale === 'si';

  // Fetch version list when sheet changes or modal opens
  useEffect(() => {
    if (!open || !sheet) {
      setVersions([]);
      setSelectedVersionId(null);
      setVersionDetail(null);
      return;
    }

    let active = true;
    setLoadingVersions(true);

    listSheetVersions(sheet.id)
      .then((verList) => {
        if (!active) return;
        setVersions(verList);
        const targetId =
          sheet.current_version_id ||
          (verList.length > 0 ? verList[0].id : null);
        setSelectedVersionId(targetId);
      })
      .catch((err) => {
        console.error('Failed to load sheet versions:', err);
        toast.error(t('loadError'));
      })
      .finally(() => {
        if (active) setLoadingVersions(false);
      });

    return () => {
      active = false;
    };
  }, [open, sheet, t]);

  // Fetch version detail when selectedVersionId changes
  useEffect(() => {
    if (!selectedVersionId) {
      setVersionDetail(null);
      return;
    }

    let active = true;
    setLoadingDetail(true);

    getVersionDetail(selectedVersionId)
      .then((detail) => {
        if (active) setVersionDetail(detail);
      })
      .catch((err) => {
        console.error('Failed to load version details:', err);
        toast.error(t('loadError'));
      })
      .finally(() => {
        if (active) setLoadingDetail(false);
      });

    return () => {
      active = false;
    };
  }, [selectedVersionId, t]);

  if (!sheet) return null;

  const defaultCurrency =
    versionDetail?.currency_code || sheet.current_version?.currency_code || 'LKR';

  // Format monetary amounts with 2 decimals
  const formatMoney = (val?: string | number, curr = defaultCurrency) => {
    if (val === undefined || val === null || val === '') return '—';
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return '—';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: curr,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    } catch {
      return `${curr} ${num.toFixed(2)}`;
    }
  };

  // Format quantities cleanly without trailing zeros (e.g. 800 instead of 800.0000)
  const formatQty = (val?: string | number) => {
    if (val === undefined || val === null || val === '') return '0';
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return String(val);
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Format percentage cleanly (e.g. 35% instead of 35.0000%)
  const formatPct = (val?: string | number) => {
    if (val === undefined || val === null || val === '') return '0%';
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return `${val}%`;
    return `${new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num)}%`;
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  const handleEditInCalculator = () => {
    if (!versionDetail) return;
    const draft = loadSheetVersionIntoDraft(sheet, versionDetail);
    loadDraft(draft);
    onOpenChange(false);
    router.push('/');
    toast.success(
      isSi
        ? `"${sheet.name}" (v${versionDetail.version_number}) සංස්කරණය සඳහා පටවන ලදී.`
        : `Loaded "${sheet.name}" (v${versionDetail.version_number}) into calculator for editing.`
    );
  };

  const handleDownloadReport = async (format: 'csv' | 'pdf') => {
    if (!selectedVersionId) return;
    setDownloadingFormat(format);
    try {
      const blob = await downloadVersionReport(selectedVersionId, format, locale);
      const url = URL.createObjectURL(blob);
      if (format === 'pdf') {
        const reportWindow = window.open('about:blank', '_blank');
        if (reportWindow) {
          reportWindow.location.href = url;
        } else {
          const link = document.createElement('a');
          link.href = url;
          link.download = `${sheet.name}-v${versionDetail?.version_number || 1}.pdf`;
          document.body.append(link);
          link.click();
          link.remove();
        }
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${sheet.name}-v${versionDetail?.version_number || 1}.csv`;
        document.body.append(link);
        link.click();
        link.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast.error(t('reportError'));
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleExecuteDelete = async () => {
    if (!onDeleteSheet) return;
    setDeleting(true);
    try {
      await onDeleteSheet(sheet.id);
      setDeleteConfirmOpen(false);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  const selectedSummary = versions.find((v) => v.id === selectedVersionId);
  const unitCostNum = versionDetail ? parseFloat(versionDetail.unit_cost) : 0;
  const sellingPriceNum = versionDetail?.suggested_price
    ? parseFloat(versionDetail.suggested_price)
    : versionDetail?.suggested_product_price
    ? parseFloat(versionDetail.suggested_product_price)
    : 0;
  const profitPerUnit = sellingPriceNum > 0 ? sellingPriceNum - unitCostNum : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-5xl sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border-border bg-card shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur-md px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 max-w-xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <DialogTitle className="text-xl font-bold tracking-tight text-foreground truncate">
                    {sheet.name}
                  </DialogTitle>
                  <span className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {sheet.kind === 'service'
                      ? isSi
                        ? 'සේවාව'
                        : 'Service'
                      : isSi
                      ? 'නිෂ්පාදනය'
                      : 'Product'}
                  </span>
                  <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {sheet.unit_label}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isSi ? 'පදනම:' : 'Basis:'}{' '}
                  <span className="capitalize text-foreground font-medium">
                    {sheet.basis === 'batch'
                      ? isSi
                        ? 'කාණ්ඩය'
                        : 'Batch'
                      : isSi
                      ? 'මාසික'
                      : 'Monthly'}
                  </span>
                  {' · '}
                  {isSi ? 'මුදල් වර්ගය:' : 'Currency:'}{' '}
                  <span className="font-semibold text-foreground">{defaultCurrency}</span>
                </p>
              </div>

              {/* Close Button in Header */}
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  className="size-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
                  aria-label={isSi ? 'වසන්න' : 'Close'}
                  title={isSi ? 'වසන්න' : 'Close'}
                >
                  <X className="size-5" />
                  <span className="sr-only">{isSi ? 'වසන්න' : 'Close'}</span>
                </Button>
              </div>
            </div>

            {/* Version Selector Tabs */}
            {versions.length > 1 && (
              <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground mr-1 shrink-0">
                  <History className="size-3.5" />
                  {t('versionHistory')}:
                </span>
                {versions.map((ver) => {
                  const isSelected = ver.id === selectedVersionId;
                  const isLatest = ver.version_number === versions[0]?.version_number;
                  return (
                    <button
                      key={ver.id}
                      type="button"
                      onClick={() => setSelectedVersionId(ver.id)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all shrink-0',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary shadow-2xs font-semibold'
                          : 'border-border/70 bg-card text-muted-foreground hover:border-border hover:bg-muted/40'
                      )}
                    >
                      <GitCommitVertical className="size-3.5" />
                      <span>v{ver.version_number}</span>
                      {isLatest && (
                        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {isSi ? 'නවතම' : 'Latest'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-6">
            {loadingDetail || loadingVersions ? (
              <div className="space-y-6 animate-pulse" aria-label={isSi ? 'විස්තර ලබාගනිමින්…' : 'Loading version details…'}>
                {/* Skeleton Banner */}
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-24 rounded-md bg-muted-foreground/20" />
                      <div className="h-4 w-32 rounded-md bg-muted-foreground/15" />
                    </div>
                    <div className="h-4 w-36 rounded-md bg-muted-foreground/15" />
                  </div>
                </div>

                {/* Skeleton 4 KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs space-y-2.5"
                    >
                      <div className="h-3.5 w-20 rounded bg-muted-foreground/20" />
                      <div className="h-6 w-28 rounded bg-muted-foreground/25" />
                      <div className="h-2.5 w-16 rounded bg-muted-foreground/15" />
                    </div>
                  ))}
                </div>

                {/* Skeleton Breakdown & Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 rounded-xl border border-border/70 bg-card p-5 space-y-4">
                    <div className="h-4 w-36 rounded bg-muted-foreground/20" />
                    <div className="h-3 w-full rounded-full bg-muted-foreground/15" />
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      {[1, 2, 3].map((b) => (
                        <div key={b} className="space-y-1.5">
                          <div className="h-2.5 w-16 rounded bg-muted-foreground/15" />
                          <div className="h-4 w-20 rounded bg-muted-foreground/20" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3">
                    <div className="h-4 w-28 rounded bg-muted-foreground/20" />
                    <div className="space-y-2.5 pt-1">
                      <div className="flex justify-between">
                        <div className="h-3 w-20 rounded bg-muted-foreground/15" />
                        <div className="h-3 w-16 rounded bg-muted-foreground/15" />
                      </div>
                      <div className="flex justify-between">
                        <div className="h-3 w-24 rounded bg-muted-foreground/15" />
                        <div className="h-3 w-16 rounded bg-muted-foreground/15" />
                      </div>
                      <div className="flex justify-between pt-2 border-t border-border/60">
                        <div className="h-4 w-20 rounded bg-muted-foreground/25" />
                        <div className="h-4 w-20 rounded bg-muted-foreground/25" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Skeleton Table Rows */}
                <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3">
                  <div className="h-4 w-32 rounded bg-muted-foreground/20" />
                  <div className="space-y-2 pt-2">
                    {[1, 2, 3].map((r) => (
                      <div key={r} className="flex justify-between items-center py-2.5 border-b border-border/40">
                        <div className="h-3.5 w-40 rounded bg-muted-foreground/20" />
                        <div className="h-3.5 w-20 rounded bg-muted-foreground/15" />
                        <div className="h-3.5 w-16 rounded bg-muted-foreground/20" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : !versionDetail ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {t('noVersion')}
              </div>
            ) : (
              <>
                {/* Version Metadata & Change Note Banner */}
                <div className="rounded-xl border border-border/80 bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2.5 py-1 font-bold text-primary">
                        <GitCommitVertical className="size-3.5" />
                        {t('version', { number: versionDetail.version_number })}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {formatDate(versionDetail.created_at)}
                      </span>
                    </div>

                    {versionDetail.units_produced && (
                      <span className="text-muted-foreground">
                        {isSi ? 'නිෂ්පාදනය:' : 'Production Output:'}{' '}
                        <strong className="text-foreground">
                          {formatQty(versionDetail.units_produced)} {sheet.unit_label}
                        </strong>
                        {versionDetail.defective_units &&
                          Number(versionDetail.defective_units) > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 ml-1">
                              ({formatQty(versionDetail.defective_units)}{' '}
                              {isSi ? 'දෝෂ සහිත' : 'defects'})
                            </span>
                          )}
                      </span>
                    )}
                  </div>

                  {selectedSummary?.change_note && (
                    <div className="mt-3 border-t border-border/60 pt-3 flex items-start gap-2">
                      <Tag className="size-3.5 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground/90">
                        <strong className="font-semibold text-foreground">
                          {t('versionNotes')}:
                        </strong>{' '}
                        {selectedSummary.change_note}
                      </p>
                    </div>
                  )}
                </div>

                {/* Executive KPI Cards Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {/* Unit Cost Card */}
                  <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs min-w-0 flex flex-col justify-between">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 truncate">
                      <Coins className="size-3.5 text-blue-500 shrink-0" />
                      {t('unitCost')}
                    </span>
                    <p
                      className="mt-2 text-base sm:text-lg lg:text-xl font-bold tracking-tight text-foreground truncate"
                      title={formatMoney(versionDetail.unit_cost, defaultCurrency)}
                    >
                      {formatMoney(versionDetail.unit_cost, defaultCurrency)}
                    </p>
                    <span className="text-[11px] text-muted-foreground truncate mt-1">
                      per {sheet.unit_label}
                    </span>
                  </div>

                  {/* Selling Price Card */}
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 shadow-2xs min-w-0 flex flex-col justify-between">
                    <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 truncate">
                      <TrendingUp className="size-3.5 text-emerald-600 shrink-0" />
                      {isSi ? 'විකුණුම් මිල' : 'Selling Price'}
                    </span>
                    <p
                      className="mt-2 text-base sm:text-lg lg:text-xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400 truncate"
                      title={formatMoney(
                        versionDetail.suggested_price || versionDetail.suggested_product_price,
                        defaultCurrency
                      )}
                    >
                      {formatMoney(
                        versionDetail.suggested_price || versionDetail.suggested_product_price,
                        defaultCurrency
                      )}
                    </p>
                    <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 truncate mt-1">
                      {formatPct(versionDetail.pricing_percentage)} {versionDetail.pricing_type}
                    </span>
                  </div>

                  {/* Profit per Unit Card */}
                  <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs min-w-0 flex flex-col justify-between">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 truncate">
                      <Sparkles className="size-3.5 text-amber-500 shrink-0" />
                      {isSi ? 'ඒකකයක ලාභය' : 'Profit / Unit'}
                    </span>
                    <p
                      className="mt-2 text-base sm:text-lg lg:text-xl font-bold tracking-tight text-foreground truncate"
                      title={formatMoney(profitPerUnit > 0 ? profitPerUnit : '0', defaultCurrency)}
                    >
                      {formatMoney(profitPerUnit > 0 ? profitPerUnit : '0', defaultCurrency)}
                    </p>
                    <span className="text-[11px] text-muted-foreground truncate mt-1">
                      {profitPerUnit > 0 && unitCostNum > 0
                        ? `${((profitPerUnit / unitCostNum) * 100).toFixed(1)}% on cost`
                        : '—'}
                    </span>
                  </div>

                  {/* Pricing Strategy Card */}
                  <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs min-w-0 flex flex-col justify-between">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 truncate">
                      <Percent className="size-3.5 text-indigo-500 shrink-0" />
                      {isSi ? 'මිලකරණ ප්‍රතිශතය' : 'Pricing Margin'}
                    </span>
                    <p
                      className="mt-2 text-base sm:text-lg lg:text-xl font-bold tracking-tight text-foreground truncate"
                      title={formatPct(versionDetail.pricing_percentage)}
                    >
                      {formatPct(versionDetail.pricing_percentage)}
                    </p>
                    <span className="text-[11px] text-muted-foreground capitalize truncate mt-1">
                      {versionDetail.pricing_type} method
                    </span>
                  </div>
                </div>

                {/* Bucket Breakdown Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <PieChart className="size-4 text-primary" />
                      {isSi ? 'පිරිවැය කාණ්ඩ විස්තරය' : 'Cost Breakdown by Category'}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {versionDetail.bucket_breakdown?.length || 0} {isSi ? 'කාණ්ඩ' : 'categories'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {versionDetail.bucket_breakdown?.map((bucket) => {
                      const itemsSum =
                        bucket.items?.reduce(
                          (acc, curr) => acc + (parseFloat(curr.amount) || 0),
                          0
                        ) || 0;
                      const rawEffective = parseFloat(bucket.effective_total || '0') || 0;
                      const categoryTotal = Math.max(rawEffective, itemsSum);
                      const unitsCount = versionDetail.units_produced
                        ? parseFloat(versionDetail.units_produced) || 1
                        : 1;
                      const rawCostPerUnit = parseFloat(bucket.cost_per_unit || '0');
                      const bucketCost =
                        rawCostPerUnit > 0
                          ? rawCostPerUnit
                          : categoryTotal > 0 && unitsCount > 0
                          ? categoryTotal / unitsCount
                          : 0;

                      const pctOfUnitCost =
                        unitCostNum > 0 && bucketCost > 0
                          ? Math.round((bucketCost / unitCostNum) * 100)
                          : 0;

                      return (
                        <div
                          key={bucket.type}
                          className="rounded-xl border border-border/70 bg-card p-4 transition-all hover:border-border"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="size-2 rounded-full bg-primary" />
                              <h4 className="text-sm font-semibold text-foreground">
                                {bucket.label}
                              </h4>
                              {pctOfUnitCost > 0 && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                  {pctOfUnitCost}% of total
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-foreground">
                                {formatMoney(bucketCost, defaultCurrency)}
                                <span className="text-xs font-normal text-muted-foreground ml-1">
                                  / {sheet.unit_label}
                                </span>
                              </p>
                              {categoryTotal > 0 && (
                                <p className="text-[11px] text-muted-foreground">
                                  {isSi ? 'මුළු වියදම:' : 'Total:'}{' '}
                                  {formatMoney(categoryTotal, defaultCurrency)}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Line items if present */}
                          {bucket.items && bucket.items.length > 0 && (
                            <div className="mt-3 border-t border-border/50 pt-2.5">
                              <div className="space-y-1.5">
                                {bucket.items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between text-xs text-muted-foreground hover:text-foreground py-0.5"
                                  >
                                    <span className="truncate pr-2">
                                      • {item.name}
                                      {item.quantity && (
                                        <span className="text-muted-foreground/75 ml-1">
                                          ({formatQty(item.quantity)} {item.unit || ''})
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-medium text-foreground shrink-0">
                                      {formatMoney(item.amount, defaultCurrency)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Modal Footer with Actions */}
          <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card/95 backdrop-blur-md px-6 py-4">
            <div>
              {onDeleteSheet && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deleting}
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="gap-2 border-destructive/25 text-destructive bg-destructive/5 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive rounded-xl px-3.5 h-9 font-semibold text-xs sm:text-sm shadow-2xs transition-all active:scale-95 cursor-pointer"
                >
                  <Trash2 className="size-4" />
                  {t('deleteSheet')}
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!selectedVersionId || downloadingFormat !== null}
                onClick={() => handleDownloadReport('csv')}
                className="gap-1.5"
              >
                {downloadingFormat === 'csv' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowDownToLine className="size-4" />
                )}
                {t('downloadCsv')}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!selectedVersionId || downloadingFormat !== null}
                onClick={() => handleDownloadReport('pdf')}
                className="gap-1.5"
              >
                {downloadingFormat === 'pdf' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Printer className="size-4" />
                )}
                {t('printReport')}
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={!versionDetail || loadingDetail}
                onClick={handleEditInCalculator}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs"
              >
                <Calculator className="size-4" />
                {t('editInCalculator')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modern Custom Delete Confirmation Dialog */}
      <DeleteConfirmModal
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        sheetName={sheet.name}
        onConfirm={handleExecuteDelete}
        deleting={deleting}
      />
    </>
  );
}
