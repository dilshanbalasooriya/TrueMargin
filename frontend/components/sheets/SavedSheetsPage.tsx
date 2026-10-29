'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LoginModal } from '@/components/auth/LoginModal';
import { useAuth } from '@/components/auth/AuthProvider';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import {
  deleteCostSheet,
  downloadVersionReport,
  listCostSheets,
  syncUserProfile,
  type CostSheet,
} from '@/lib/api-client';
import { useCalculatorStore } from '@/store/useCalculatorStore';
import {
  ArrowDownToLine,
  Briefcase,
  Calendar,
  Eye,
  FileSpreadsheet,
  GitCommitVertical,
  Layers,
  Loader2,
  Package,
  Plus,
  Printer,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from '@/store/useToast';
import { CostSheetDetailModal } from '@/components/sheets/CostSheetDetailModal';
import { DeleteConfirmModal } from '@/components/sheets/DeleteConfirmModal';
import { cn } from 'cn';

export function SavedSheetsPage() {
  const t = useTranslations('Sheets');
  const locale = useLocale();
  const isSi = locale === 'si';
  const { user, loading: authLoading } = useAuth();
  const draftSheetId = useCalculatorStore((s) => s.draft.sheetId);
  const resetDraft = useCalculatorStore((s) => s.resetDraft);

  const [sheets, setSheets] = useState<CostSheet[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingSheetId, setDownloadingSheetId] = useState<string | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<'csv' | 'pdf' | null>(null);
  const [error, setError] = useState(false);
  const [reportError, setReportError] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<CostSheet | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [sheetToDelete, setSheetToDelete] = useState<CostSheet | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'product' | 'service'>('all');

  const userId = user?.id;
  const loadingSheets = Boolean(userId && loadedUserId !== userId);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    const fetchSheets = () => {
      void syncUserProfile()
        .then((profile) => {
          const workspaceId = profile.workspaces[0]?.id;
          if (!workspaceId) throw new Error('No workspace found.');
          return listCostSheets(workspaceId);
        })
        .then((items) => {
          if (active) {
            setSheets(items);
            setError(false);
          }
        })
        .catch(() => {
          if (active) setError(true);
        })
        .finally(() => {
          if (active) setLoadedUserId(userId);
        });
    };

    fetchSheets();

    const handleSheetsUpdated = () => {
      fetchSheets();
    };

    window.addEventListener('truemargin-sheets-updated', handleSheetsUpdated);

    return () => {
      active = false;
      window.removeEventListener('truemargin-sheets-updated', handleSheetsUpdated);
    };
  }, [userId]);

  const downloadCsv = async (sheet: CostSheet) => {
    const versionId = sheet.current_version?.id;
    if (!versionId) return;
    setReportError(false);
    setDownloadingSheetId(sheet.id);
    setDownloadingFormat('csv');
    try {
      const blob = await downloadVersionReport(versionId, 'csv', locale);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sheet.name || 'truemargin'}-v${sheet.current_version?.version_number || 1}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(isSi ? 'CSV වාර්තාව බාගත විය.' : 'CSV report downloaded successfully.');
    } catch {
      setReportError(true);
      toast.error(t('reportError'));
    } finally {
      setDownloadingSheetId(null);
      setDownloadingFormat(null);
    }
  };

  const openPrintView = async (sheet: CostSheet) => {
    const versionId = sheet.current_version?.id;
    if (!versionId) return;
    setReportError(false);
    setDownloadingSheetId(sheet.id);
    setDownloadingFormat('pdf');
    const reportWindow = window.open('about:blank', '_blank');
    try {
      const blob = await downloadVersionReport(versionId, 'pdf', locale);
      const pdfUrl = URL.createObjectURL(blob);
      if (reportWindow) {
        reportWindow.location.href = pdfUrl;
      } else {
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `${sheet.name || 'truemargin'}-v${sheet.current_version?.version_number || 1}.pdf`;
        document.body.append(link);
        link.click();
        link.remove();
      }
      toast.success(isSi ? 'PDF වාර්තාව සූදානම් කරන ලදී.' : 'PDF report generated successfully.');
    } catch {
      if (reportWindow) reportWindow.close();
      setReportError(true);
      toast.error(t('reportError'));
    } finally {
      setDownloadingSheetId(null);
      setDownloadingFormat(null);
    }
  };

  const formatMoney = (value: string | number, currencyCode: string) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: 2,
      }).format(Number(value));
    } catch {
      return `${currencyCode} ${value}`;
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  const handleDeleteSheet = async (sheetId: string) => {
    setDeletingId(sheetId);
    try {
      await deleteCostSheet(sheetId);
      setSheets((prev) => prev.filter((s) => s.id !== sheetId));
      if (draftSheetId === sheetId) {
        resetDraft();
      }
      toast.success(t('deleteSuccess'));
      window.dispatchEvent(
        new CustomEvent('truemargin-sheets-updated', { detail: { action: 'delete', sheetId } }),
      );
    } catch {
      toast.error(t('deleteError'));
    } finally {
      setDeletingId(null);
    }
  };

  // Filter and search sheets
  const filteredSheets = useMemo(() => {
    return sheets.filter((sheet) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        sheet.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (sheet.unit_label && sheet.unit_label.toLowerCase().includes(searchQuery.toLowerCase().trim()));

      const matchesType =
        typeFilter === 'all' ||
        (typeFilter === 'product' && sheet.kind !== 'service') ||
        (typeFilter === 'service' && sheet.kind === 'service');

      return matchesSearch && matchesType;
    });
  }, [sheets, searchQuery, typeFilter]);

  // Quick statistics
  const productCount = sheets.filter((s) => s.kind !== 'service').length;
  const serviceCount = sheets.filter((s) => s.kind === 'service').length;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pt-10">
      {/* Executive Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-8 shadow-xs mb-8">
        <div className="absolute -top-12 -right-12 size-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" />
              <span>{isSi ? 'පිරිවැය කළමනාකරණය' : 'Cost Sheets Intelligence'}</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              {t('title')}
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
              {t('description')}
            </p>
          </div>

          <div className="shrink-0">
            <Link
              href="/"
              onClick={() => resetDraft()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              <Plus className="size-4" />
              <span>{isSi ? 'නව ගණනයක් අරඹන්න' : 'New Calculation'}</span>
            </Link>
          </div>
        </div>

        {/* Portfolio Stats Row */}
        {user && sheets.length > 0 && (
          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border/60 pt-5">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <FileSpreadsheet className="size-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isSi ? 'මුළු පත්‍ර' : 'Total Sheets'}</p>
                <p className="text-base font-bold text-foreground">{sheets.length}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Package className="size-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isSi ? 'නිෂ්පාදන' : 'Products'}</p>
                <p className="text-base font-bold text-foreground">{productCount}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Briefcase className="size-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isSi ? 'සේවා' : 'Services'}</p>
                <p className="text-base font-bold text-foreground">{serviceCount}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {reportError && (
        <div
          role="status"
          className="mb-6 flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-sm text-destructive"
        >
          <span>{t('reportError')}</span>
          <button
            type="button"
            onClick={() => setReportError(false)}
            className="text-destructive/80 hover:text-destructive"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {authLoading || loadingSheets ? (
        /* Rich Multi-card Skeleton Loader */
        <div className="space-y-4" aria-label={t('loading')}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-xs animate-pulse space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-lg bg-muted-foreground/20" />
                    <div className="h-5 w-44 rounded-md bg-muted-foreground/20" />
                    <div className="h-4 w-16 rounded-md bg-muted-foreground/15" />
                  </div>
                  <div className="h-3.5 w-32 rounded bg-muted-foreground/15" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-9 w-24 rounded-xl bg-muted-foreground/20" />
                  <div className="h-9 w-18 rounded-xl bg-muted-foreground/15" />
                  <div className="h-9 w-18 rounded-xl bg-muted-foreground/15" />
                  <div className="size-9 rounded-xl bg-muted-foreground/15" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !user ? (
        /* Guest Sign In Callout */
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 sm:p-10 text-center shadow-xs">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 ring-8 ring-primary/5">
            <FileSpreadsheet className="size-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            {isSi ? 'පිරිවැය පත්‍ර සුරැකීමට පිවිසෙන්න' : 'Access Your Saved Cost Sheets'}
          </h2>
          <p className="mx-auto mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">
            {t('signInRequired')}
          </p>
          <div className="mt-6 flex justify-center">
            <LoginModal>
              <Button type="button" className="min-h-11 px-6 font-semibold rounded-xl shadow-md">
                {t('signIn')}
              </Button>
            </LoginModal>
          </div>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/20 bg-destructive/10 p-5 text-sm text-destructive text-center"
        >
          {t('loadError')}
        </div>
      ) : sheets.length === 0 ? (
        /* Empty State */
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-10 text-center shadow-xs">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 ring-8 ring-primary/5">
            <Layers className="size-8" />
          </div>
          <h2 className="text-lg font-bold text-foreground">{t('empty')}</h2>
          <p className="mx-auto mt-1.5 text-sm text-muted-foreground max-w-md leading-relaxed">
            {isSi
              ? 'ඔබ තවමත් කිසිදු පිරිවැය පත්‍රයක් සුරකිනු ලැබ නැත. පළමු නිෂ්පාදනය හෝ සේවාව සඳහා ගණනය කිරීමක් ආරම්භ කරන්න.'
              : 'Start by calculating your first product or service costing to track versions and margins here.'}
          </p>
          <div className="mt-6">
            <Link
              href="/"
              onClick={() => resetDraft()}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="size-4" />
              <span>{t('openCalculator')}</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isSi ? 'නමින් සොයන්න…' : 'Search by name…'}
                className="w-full h-10 rounded-xl border border-input bg-card pl-9.5 pr-8 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-xl border border-border/60 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                  typeFilter === 'all'
                    ? 'bg-card text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {isSi ? 'සියල්ල' : 'All'} ({sheets.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('product')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                  typeFilter === 'product'
                    ? 'bg-card text-primary shadow-2xs font-bold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {isSi ? 'නිෂ්පාදන' : 'Products'} ({productCount})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('service')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
                  typeFilter === 'service'
                    ? 'bg-card text-primary shadow-2xs font-bold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {isSi ? 'සේවා' : 'Services'} ({serviceCount})
              </button>
            </div>
          </div>

          {/* Sheets List */}
          {filteredSheets.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              {isSi ? 'ගැලපෙන පිරිවැය පත්‍ර හමු නොවීය.' : 'No cost sheets found matching your search.'}
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredSheets.map((sheet) => {
                const version = sheet.current_version;
                const isDeletingThis = deletingId === sheet.id;
                const isDownloadingThis = downloadingSheetId === sheet.id;
                const isService = sheet.kind === 'service';

                return (
                  <div
                    key={sheet.id}
                    className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      {/* Left: Info & Clickable Header */}
                      <div
                        className="flex items-start gap-3.5 min-w-0 flex-1 cursor-pointer"
                        onClick={() => {
                          setSelectedSheet(sheet);
                          setDetailModalOpen(true);
                        }}
                      >
                        {/* Icon badge */}
                        <div
                          className={cn(
                            'flex size-11 shrink-0 items-center justify-center rounded-xl border mt-0.5 transition-transform duration-200 group-hover:scale-105',
                            isService
                              ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                          )}
                        >
                          {isService ? (
                            <Briefcase className="size-5" />
                          ) : (
                            <Package className="size-5" />
                          )}
                        </div>

                        {/* Title & metadata */}
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-bold text-foreground group-hover:text-primary transition-colors truncate">
                              {sheet.name}
                            </h2>

                            <span
                              className={cn(
                                'rounded-md border px-2 py-0.5 text-[11px] font-semibold',
                                isService
                                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                              )}
                            >
                              {isService ? (isSi ? 'සේවාව' : 'Service') : (isSi ? 'නිෂ්පාදනය' : 'Product')}
                            </span>

                            <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              {sheet.unit_label}
                            </span>
                          </div>

                          {/* Metric line */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {version ? (
                              <>
                                <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                                  <GitCommitVertical className="size-3.5 text-primary" />
                                  v{version.version_number}
                                </span>
                                <span>·</span>
                                <span className="font-mono font-bold text-foreground text-sm">
                                  {formatMoney(version.unit_cost, version.currency_code)}
                                </span>
                                <span className="text-muted-foreground">/ {sheet.unit_label}</span>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1 text-[11px]">
                                  <Calendar className="size-3" />
                                  {formatDate(version.created_at)}
                                </span>
                              </>
                            ) : (
                              <span>{t('noVersion')}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions Bar */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50 shrink-0">
                        {/* View Details Button */}
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setSelectedSheet(sheet);
                            setDetailModalOpen(true);
                          }}
                          className="h-9 px-3.5 gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                        >
                          <Eye className="size-4" aria-hidden="true" />
                          <span>{t('viewDetails')}</span>
                        </Button>

                        {/* CSV Export */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!version || isDeletingThis || isDownloadingThis}
                          onClick={() => void downloadCsv(sheet)}
                          className="h-9 px-3 gap-1.5 rounded-xl border-border/80 text-xs font-medium hover:bg-muted transition-all active:scale-95 cursor-pointer"
                          title={t('downloadCsv')}
                        >
                          {isDownloadingThis && downloadingFormat === 'csv' ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <ArrowDownToLine className="size-3.5 text-muted-foreground" />
                          )}
                          <span className="hidden sm:inline">CSV</span>
                        </Button>

                        {/* PDF Export */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!version || isDeletingThis || isDownloadingThis}
                          onClick={() => void openPrintView(sheet)}
                          className="h-9 px-3 gap-1.5 rounded-xl border-border/80 text-xs font-medium hover:bg-muted transition-all active:scale-95 cursor-pointer"
                          title={t('printReport')}
                        >
                          {isDownloadingThis && downloadingFormat === 'pdf' ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Printer className="size-3.5 text-muted-foreground" />
                          )}
                          <span className="hidden sm:inline">PDF</span>
                        </Button>

                        {/* Dedicated Refined Delete Button */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isDeletingThis}
                          onClick={() => setSheetToDelete(sheet)}
                          className="h-9 px-3 rounded-xl border-destructive/20 text-destructive bg-destructive/5 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive shadow-2xs transition-all active:scale-95 cursor-pointer"
                          title={t('deleteSheet')}
                          aria-label={t('deleteSheet')}
                        >
                          {isDeletingThis ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          )}
                          <span className="hidden md:inline font-semibold text-xs ml-1">
                            {t('deleteSheet')}
                          </span>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sheet Detail Modal */}
      <CostSheetDetailModal
        sheet={selectedSheet}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onDeleteSheet={handleDeleteSheet}
      />

      {/* Custom Modern Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={Boolean(sheetToDelete)}
        onOpenChange={(isOpen) => !isOpen && setSheetToDelete(null)}
        sheetName={sheetToDelete?.name || ''}
        onConfirm={async () => {
          if (sheetToDelete) {
            await handleDeleteSheet(sheetToDelete.id);
            setSheetToDelete(null);
          }
        }}
        deleting={Boolean(deletingId)}
      />
    </main>
  );
}
