'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname, Link } from '@/i18n/routing';
import { useAuth } from '@/components/auth/AuthProvider';
import { LoginModal } from '@/components/auth/LoginModal';
import { UnsavedChangesModal } from '@/components/app/UnsavedChangesModal';
import { DeleteConfirmModal } from '@/components/sheets/DeleteConfirmModal';
import { Button } from '@/components/ui/button';
import {
  deleteCostSheet,
  getVersionDetail,
  listCostSheets,
  loadSheetVersionIntoDraft,
  syncUserProfile,
  type CostSheet,
} from '@/lib/api-client';
import { useCalculatorStore } from '@/store/useCalculatorStore';
import { useSidebarStore } from '@/store/useSidebarStore';
import { BUSINESS_TEMPLATES, getTemplateDraft, type BusinessTemplate } from '@/lib/templates';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/store/useToast';
import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Lightbulb,
  Loader2,
  LogOut,
  Package,
  Plus,
  Scissors,
  Sparkles,
  Trash2,
  User,
  Utensils,
  X,
  Zap,
} from 'lucide-react';
import { cn } from 'cn';

export function AppSidebar() {
  const t = useTranslations('Navigation');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { draft, isDirty, resetDraft, loadDraft } = useCalculatorStore();
  const {
    isExpanded: rawExpanded,
    mobileOpen,
    toggleExpanded,
    setExpanded,
    setMobileOpen,
  } = useSidebarStore();

  // SSR hydration-safe expanded check
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const isExpanded = mounted ? rawExpanded : false;

  const [sheets, setSheets] = useState<CostSheet[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [loadingSheetId, setLoadingSheetId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sheetToDelete, setSheetToDelete] = useState<CostSheet | null>(null);

  const userId = user?.id;
  const loadingSheets = Boolean(userId && loadedUserId !== userId);

  // Unsaved changes confirmation modal
  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Template preview modal (inspect details before applying on mobile & desktop)
  const [previewTemplate, setPreviewTemplate] = useState<BusinessTemplate | null>(null);

  // Fetch saved cost sheets when user is logged in
  useEffect(() => {
    if (!userId) return;
    let active = true;

    const fetchSheets = () => {
      void syncUserProfile()
        .then((profile) => {
          const workspaceId = profile.workspaces[0]?.id;
          if (!workspaceId) throw new Error('No workspace found');
          return listCostSheets(workspaceId);
        })
        .then((data) => {
          if (active) setSheets(data);
        })
        .catch(() => {
          if (active) setSheets([]);
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

  // Check if current draft has unsaved progress
  const hasUnsavedWork = () => {
    const hasBucketCost = Object.values(draft.buckets).some(
      (b) => b.totalSpent.trim() !== '' || b.items.length > 0,
    );
    const hasMeaningfulContent = Boolean(
      draft.productName.trim() ||
        draft.unitLabel.trim() ||
        draft.unitsProduced.trim() ||
        hasBucketCost,
    );
    return isDirty && hasMeaningfulContent;
  };

  const executeOrConfirm = (action: () => void) => {
    if (hasUnsavedWork()) {
      setPendingAction(() => action);
      setUnsavedModalOpen(true);
    } else {
      action();
    }
  };

  const handleStartNewCalculation = () => {
    executeOrConfirm(() => {
      resetDraft();
      if (pathname !== '/') router.push('/');
      setMobileOpen(false);
    });
  };

  const handleLoadSheet = async (sheet: CostSheet) => {
    if (sheet.id === draft.sheetId) {
      if (pathname !== '/') router.push('/');
      setMobileOpen(false);
      return;
    }

    executeOrConfirm(async () => {
      const versionId = sheet.current_version?.id || sheet.current_version_id;
      if (!versionId) return;

      try {
        setLoadingSheetId(sheet.id);
        const detail = await getVersionDetail(versionId);
        const newDraft = loadSheetVersionIntoDraft(sheet, detail);
        loadDraft(newDraft);
        if (pathname !== '/') router.push('/');
        setMobileOpen(false);
      } catch {
        // error handled gracefully
      } finally {
        setLoadingSheetId(null);
      }
    });
  };

  const handleApplyTemplate = (tmpl: BusinessTemplate) => {
    executeOrConfirm(() => {
      const localizedDraft = getTemplateDraft(tmpl, locale);
      loadDraft(localizedDraft);
      if (pathname !== '/') router.push('/');
      setMobileOpen(false);
      setPreviewTemplate(null);
    });
  };

  const handleDeleteSheet = async (e: React.MouseEvent, sheet: CostSheet) => {
    e.stopPropagation();
    setSheetToDelete(sheet);
  };

  const handleConfirmDeleteSheet = async () => {
    if (!sheetToDelete) return;
    const sheetId = sheetToDelete.id;
    setDeletingId(sheetId);
    try {
      await deleteCostSheet(sheetId);
      setSheets((prev) => prev.filter((s) => s.id !== sheetId));
      if (draft.sheetId === sheetId) {
        resetDraft();
      }
      toast.success(t('deleteSuccess'));
      window.dispatchEvent(new CustomEvent('truemargin-sheets-updated', { detail: { action: 'delete', sheetId } }));
      setSheetToDelete(null);
    } catch {
      toast.error(t('deleteError'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    toast.persist('success', t('signOutSuccess'));
    toast.success(t('signOutSuccess'));
    router.replace('/');
    router.refresh();
    setMobileOpen(false);
  };

  const formatMoney = (value: string, currencyCode: string) => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: 0,
      }).format(Number(value));
    } catch {
      return `${currencyCode} ${value}`;
    }
  };

  const renderTemplateIcon = (name: string) => {
    switch (name) {
      case 'Utensils':
        return <Utensils className="size-4 text-amber-500 shrink-0" />;
      case 'Scissors':
        return <Scissors className="size-4 text-indigo-500 shrink-0" />;
      case 'Sparkles':
        return <Sparkles className="size-4 text-pink-500 shrink-0" />;
      default:
        return <Package className="size-4 text-emerald-500 shrink-0" />;
    }
  };

  // Reusable Sidebar Content for Expanded View (Desktop & Mobile)
  const renderExpandedContent = (isMobile = false) => (
    <div className="flex h-full flex-col bg-card/95 text-card-foreground">
      {/* Top Header: Matched with AppHeader height h-16 and bottom border */}
      <div className="flex h-16 items-center justify-between border-b border-border/80 bg-muted/15 px-4 shrink-0">
        <button
          type="button"
          onClick={toggleExpanded}
          className="flex items-center gap-3 transition-opacity hover:opacity-85 text-left group"
          title={t('collapse')}
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-xs group-hover:scale-105 transition-transform">
            TM
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight text-foreground leading-tight">
              TrueMargin
            </span>
            <span className="text-[10px] text-muted-foreground font-medium">
              Costing Studio
            </span>
          </div>
        </button>

        {isMobile ? (
          <button
            type="button"
            className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center transition-colors"
            onClick={() => setMobileOpen(false)}
            aria-label={t('closeMenu')}
          >
            <X className="size-4.5" />
          </button>
        ) : (
          <button
            type="button"
            className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center transition-colors"
            onClick={toggleExpanded}
            title={t('collapse')}
            aria-label={t('collapse')}
          >
            <ChevronLeft className="size-4.5" />
          </button>
        )}
      </div>

      {/* Primary Action Button (Y-Aligned with Page Heading pt-6 sm:pt-8) */}
      <div className="pt-6 sm:pt-8 px-3.5 pb-1">
        <Button
          type="button"
          className="w-full justify-start gap-2.5 h-10 px-3.5 rounded-xl text-xs font-semibold shadow-xs transition-all bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={handleStartNewCalculation}
        >
          <Plus className="size-4 shrink-0" />
          <span>{t('newCalculation')}</span>
        </Button>
      </div>

      {/* Separation Divider: separates primary action (+) from navigation items */}
      <div className="mx-3.5 my-3 h-px bg-border/80" role="separator" />

      {/* Core Navigation Links: Calculator & Cost Sheets */}
      <div className="px-3.5 space-y-1">
        <Link
          href="/"
          onClick={() => isMobile && setMobileOpen(false)}
          className={cn(
            'flex h-9 items-center gap-2.5 rounded-lg px-3 text-xs font-semibold transition-colors',
            pathname === '/'
              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/25'
              : 'text-foreground/80 hover:bg-muted hover:text-foreground',
          )}
        >
          <Calculator className="size-4 shrink-0" />
          <span>{t('calculator')}</span>
        </Link>

        <Link
          href="/sheets"
          onClick={() => isMobile && setMobileOpen(false)}
          className={cn(
            'flex h-9 items-center gap-2.5 rounded-lg px-3 text-xs font-semibold transition-colors',
            pathname === '/sheets'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/25'
              : 'text-foreground/80 hover:bg-muted hover:text-foreground',
          )}
        >
          <FileText className="size-4 shrink-0" />
          <span>{t('sheets')}</span>
        </Link>
      </div>

      {/* Separation Divider: separates navigation from scrollable content */}
      <div className="mx-3.5 my-3 h-px bg-border/60" role="separator" />

      {/* Scrollable Middle Body */}
      <div className="flex-1 overflow-y-auto px-3.5 pb-3 space-y-5">
        {/* Section 1: Saved Calculations */}
        <div>
          <div className="flex items-center justify-between px-1 pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {t('savedCalculations')}
            </span>
            {user && (
              <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border/50">
                {sheets.length}
              </span>
            )}
          </div>

          {user ? (
            loadingSheets ? (
              <div className="space-y-1.5 mt-1 px-0.5" aria-label="Loading saved calculations">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border/40 bg-muted/20 animate-pulse"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="size-2 rounded-full bg-muted-foreground/30 shrink-0" />
                      <div
                        className="h-3 rounded-md bg-muted-foreground/20"
                        style={{ width: i === 1 ? '60%' : i === 2 ? '75%' : '50%' }}
                      />
                    </div>
                    <div className="h-3 w-14 rounded-md bg-muted-foreground/20 shrink-0" />
                  </div>
                ))}
              </div>
            ) : sheets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 p-3.5 text-center my-1 bg-muted/10">
                <p className="text-xs font-medium text-foreground/80">{t('noSavedCalculations')}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Save your draft or click a template below.
                </p>
              </div>
            ) : (
              <div className="space-y-1 mt-1">
                {sheets.map((sheet) => {
                  const isActive = sheet.id === draft.sheetId;
                  const isLoadingThis = loadingSheetId === sheet.id;
                  const isDeletingThis = deletingId === sheet.id;
                  const version = sheet.current_version;

                  return (
                    <div
                      key={sheet.id}
                      onClick={() => void handleLoadSheet(sheet)}
                      className={cn(
                        'group flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-all border',
                        isActive
                          ? 'bg-primary/10 border-primary/20 text-primary font-semibold shadow-2xs'
                          : 'border-transparent text-foreground/90 hover:bg-muted/70 hover:border-border/60',
                        (isLoadingThis || isDeletingThis) && 'opacity-50 pointer-events-none',
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span
                          className={cn(
                            'size-2 rounded-full shrink-0 transition-colors',
                            isActive ? 'bg-primary ring-2 ring-primary/20' : 'bg-muted-foreground/40',
                          )}
                        />
                        <span className="truncate text-xs">{sheet.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {version && (
                          <span className="text-[11px] text-muted-foreground font-mono font-medium">
                            {formatMoney(version.unit_cost, version.currency_code)}
                          </span>
                        )}
                        <button
                          type="button"
                          className="size-7 rounded-lg text-muted-foreground/40 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 hover:text-destructive hover:bg-destructive/10 active:scale-95 flex items-center justify-center transition-all cursor-pointer shrink-0"
                          onClick={(e) => void handleDeleteSheet(e, sheet)}
                          title={t('deleteSheet')}
                          aria-label={t('deleteSheet')}
                        >
                          {isDeletingThis ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="my-1 rounded-xl border border-border/80 bg-muted/40 p-3.5 text-left space-y-2">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px]">
                  🔒
                </span>
                <span>{t('guestPromptTitle')}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {t('guestPromptDesc')}
              </p>
              <LoginModal>
                <Button size="sm" className="w-full h-8 text-xs font-semibold shadow-2xs">
                  {t('guestSignIn')}
                </Button>
              </LoginModal>
            </div>
          )}
        </div>

        {/* Section 2: Business Starter Templates (Never Empty!) */}
        <div>
          <div className="flex items-center justify-between px-1 pb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {t('businessTemplates')}
            </span>
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Sparkles className="size-3" />
              Presets
            </span>
          </div>

          <div className="space-y-2 mt-1">
            {BUSINESS_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => setPreviewTemplate(tmpl)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-card/60 hover:bg-muted/80 hover:border-primary/40 text-left transition-all duration-200 group shadow-2xs hover:shadow-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border/50 group-hover:scale-105 group-hover:border-primary/30 group-hover:bg-primary/10 transition-all duration-200">
                    {renderTemplateIcon(tmpl.iconName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      {locale === 'si' ? tmpl.siName : tmpl.enName}
                    </p>
                    <p className="truncate text-[10.5px] text-muted-foreground mt-0.5">
                      {locale === 'si' ? tmpl.siDetails : tmpl.enDetails}
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-primary bg-primary/10 group-hover:bg-primary group-hover:text-primary-foreground px-2 py-1 rounded-md transition-all duration-200 shrink-0 ml-2">
                  <Eye className="size-3" />
                  <span>{t('viewDetails')}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 3: Costing Pro Tip Card */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-1 text-left">
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold text-xs">
            <Lightbulb className="size-3.5" />
            <span>{t('quickTipTitle')}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t('quickTipText')}
          </p>
        </div>
      </div>

      {/* Bottom Footer Section */}
      <div className="border-t border-border/80 p-3 space-y-1 bg-muted/15">
        <Link
          href="/sheets"
          onClick={() => isMobile && setMobileOpen(false)}
          className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-xs font-semibold text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
        >
          <Package className="size-4 text-muted-foreground" />
          <span>{t('viewAllSheets')}</span>
        </Link>

        {user && (
          <>
            <Link
              href="/account"
              onClick={() => isMobile && setMobileOpen(false)}
              className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-xs font-semibold text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
            >
              <User className="size-4 text-muted-foreground" />
              <span>{t('account')}</span>
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-xs font-semibold text-destructive/90 hover:bg-destructive/10 hover:text-destructive transition-colors text-left"
            >
              <LogOut className="size-4" />
              <span>{t('signOut')}</span>
            </button>
          </>
        )}

        {!isMobile && (
          <button
            type="button"
            onClick={toggleExpanded}
            className="flex h-8 w-full items-center justify-between gap-2 rounded-lg px-3 text-[11px] font-semibold text-muted-foreground/80 hover:bg-muted hover:text-foreground transition-colors pt-1 border-t border-border/40 mt-1"
          >
            <span>{t('collapse')}</span>
            <ChevronLeft className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ------------------------------------------------------------- */}
      {/* 1. DESKTOP PERMANENT SIDEBAR: Icon Rail OR Expanded Panel    */}
      {/* ------------------------------------------------------------- */}
      <aside
        className={cn(
          'hidden md:flex fixed inset-y-0 left-0 z-30 flex-col border-r border-border/80 bg-card/95 backdrop-blur-md transition-all duration-300 ease-in-out select-none',
          isExpanded ? 'w-72' : 'w-14 items-center',
        )}
      >
        {isExpanded ? (
          renderExpandedContent(false)
        ) : (
          /* COLLAPSED ICON RAIL (w-14 / 56px) - Structurally Aligned with Header & Page Heading */
          <div className="flex h-full w-full flex-col justify-between">
            <div className="flex flex-col items-center w-full">
              {/* Header Zone (h-16): Aligned with AppHeader & TrueMargin, separated by border-b */}
              <div className="flex h-16 w-full items-center justify-center border-b border-border/80 bg-muted/15 shrink-0">
                <div className="group relative flex items-center justify-center">
                  <button
                    type="button"
                    onClick={toggleExpanded}
                    className="flex size-9 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-xs transition-all duration-200 hover:scale-110 active:scale-95 hover:shadow-md hover:ring-2 hover:ring-primary/30"
                    aria-label={t('expand')}
                  >
                    TM
                  </button>
                  <div className="pointer-events-none absolute left-full ml-2.5 z-50 hidden rounded-md bg-popover px-2.5 py-1 text-xs font-semibold text-popover-foreground shadow-md border border-border group-hover:flex items-center whitespace-nowrap animate-in fade-in-0 zoom-in-95">
                    TrueMargin ({t('expand')})
                  </div>
                </div>
              </div>

              {/* Action Zone: + Button aligned horizontally with the "Unit Calculator" heading */}
              <div className="flex flex-col items-center w-full pt-6 sm:pt-8">
                {/* + New Calculation Icon Button (Y-aligned with Unit Cost Calculator Title) */}
                <div className="group relative flex items-center justify-center">
                  <button
                    type="button"
                    onClick={handleStartNewCalculation}
                    className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/25 shadow-2xs transition-all duration-200 hover:scale-110 active:scale-95 hover:bg-primary hover:text-primary-foreground hover:shadow-xs"
                    aria-label={t('newCalculation')}
                  >
                    <Plus className="size-4.5" />
                  </button>
                  <div className="pointer-events-none absolute left-full ml-2.5 z-50 hidden rounded-md bg-popover px-2.5 py-1 text-xs font-semibold text-popover-foreground shadow-md border border-border group-hover:flex items-center whitespace-nowrap animate-in fade-in-0 zoom-in-95">
                    {t('newCalculation')}
                  </div>
                </div>

                {/* Separation Divider: separates primary action (+) from navigation items */}
                <div className="my-4 h-px w-7 bg-border/80" role="separator" />

                {/* Navigation Stack */}
                <div className="flex flex-col items-center gap-3.5 w-full">
                  {/* Calculator Navigation Link */}
                  <div className="group relative flex items-center justify-center">
                    <Link
                      href="/"
                      className={cn(
                        'flex size-9 items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 hover:-translate-y-0.5 active:scale-95',
                        pathname === '/'
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 shadow-2xs'
                          : 'text-muted-foreground hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-xs',
                      )}
                      aria-label={t('calculator')}
                    >
                      <Calculator className="size-4.5" />
                    </Link>
                    <div className="pointer-events-none absolute left-full ml-2.5 z-50 hidden rounded-md bg-popover px-2.5 py-1 text-xs font-semibold text-popover-foreground shadow-md border border-border group-hover:flex items-center whitespace-nowrap animate-in fade-in-0 zoom-in-95">
                      {t('calculator')}
                    </div>
                  </div>

                  {/* Cost Sheets Navigation Link */}
                  <div className="group relative flex items-center justify-center">
                    <Link
                      href="/sheets"
                      className={cn(
                        'flex size-9 items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 hover:-translate-y-0.5 active:scale-95',
                        pathname === '/sheets'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-2xs'
                          : 'text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 hover:shadow-xs',
                      )}
                      aria-label={t('sheets')}
                    >
                      <FileText className="size-4.5" />
                    </Link>
                    <div className="pointer-events-none absolute left-full ml-2.5 z-50 hidden rounded-md bg-popover px-2.5 py-1 text-xs font-semibold text-popover-foreground shadow-md border border-border group-hover:flex items-center whitespace-nowrap animate-in fade-in-0 zoom-in-95">
                      {t('sheets')}
                    </div>
                  </div>

                  {/* Business Templates Icon Button */}
                  <div className="group relative flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setExpanded(true)}
                      className="flex size-9 items-center justify-center rounded-xl text-amber-500 transition-all duration-200 hover:scale-110 hover:-translate-y-0.5 active:scale-95 hover:bg-amber-500/15 hover:text-amber-600 dark:hover:text-amber-400 hover:shadow-xs"
                      aria-label={t('businessTemplates')}
                    >
                      <Zap className="size-4.5" />
                    </button>
                    <div className="pointer-events-none absolute left-full ml-2.5 z-50 hidden rounded-md bg-popover px-2.5 py-1 text-xs font-semibold text-popover-foreground shadow-md border border-border group-hover:flex items-center whitespace-nowrap animate-in fade-in-0 zoom-in-95">
                      {t('businessTemplates')} (Presets)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Icons Stack */}
            <div className="flex flex-col items-center gap-3.5 w-full pb-4">
              {user ? (
                <div className="group relative flex items-center justify-center">
                  <Link
                    href="/account"
                    className={cn(
                      'flex size-9 items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 hover:-translate-y-0.5 active:scale-95',
                      pathname === '/account'
                        ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30 shadow-2xs'
                        : 'text-muted-foreground hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 hover:shadow-xs',
                    )}
                    aria-label={t('account')}
                  >
                    <User className="size-4.5" />
                  </Link>
                  <div className="pointer-events-none absolute left-full ml-2.5 z-50 hidden rounded-md bg-popover px-2.5 py-1 text-xs font-semibold text-popover-foreground shadow-md border border-border group-hover:flex items-center whitespace-nowrap animate-in fade-in-0 zoom-in-95">
                    {t('account')}
                  </div>
                </div>
              ) : (
                <div className="group relative flex items-center justify-center">
                  <LoginModal>
                    <button
                      type="button"
                      className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:scale-110 hover:-translate-y-0.5 active:scale-95 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400 hover:shadow-xs"
                      aria-label={t('signIn')}
                    >
                      <User className="size-4.5" />
                    </button>
                  </LoginModal>
                  <div className="pointer-events-none absolute left-full ml-2.5 z-50 hidden rounded-md bg-popover px-2.5 py-1 text-xs font-semibold text-popover-foreground shadow-md border border-border group-hover:flex items-center whitespace-nowrap animate-in fade-in-0 zoom-in-95">
                    {t('signIn')}
                  </div>
                </div>
              )}

              {/* Expand Toggle Chevron */}
              <div className="group relative flex items-center justify-center">
                <button
                  type="button"
                  onClick={toggleExpanded}
                  className="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:scale-110 hover:translate-x-0.5 active:scale-95 hover:bg-primary/10 hover:text-primary hover:shadow-xs"
                  aria-label={t('expand')}
                >
                  <ChevronRight className="size-4.5" />
                </button>
                <div className="pointer-events-none absolute left-full ml-2.5 z-50 hidden rounded-md bg-popover px-2.5 py-1 text-xs font-semibold text-popover-foreground shadow-md border border-border group-hover:flex items-center whitespace-nowrap animate-in fade-in-0 zoom-in-95">
                  {t('expand')}
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* 2. MOBILE DRAWER (< md screens)                              */}
      {/* ------------------------------------------------------------- */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-2xs transition-opacity animate-in fade-in-0 duration-200"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 flex h-full w-76 flex-col border-r border-border bg-background shadow-2xl animate-in slide-in-from-left duration-200">
            {renderExpandedContent(true)}
          </aside>
        </div>
      )}

      {/* Unsaved Changes Confirmation Modal */}
      <UnsavedChangesModal
        open={unsavedModalOpen}
        onOpenChange={setUnsavedModalOpen}
        productName={draft.productName}
        onDiscardAndContinue={() => {
          if (pendingAction) {
            pendingAction();
            setPendingAction(null);
          }
        }}
      />

      {/* Template Preview Modal (Inspect details before applying on Mobile & Desktop) */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-2xs transition-opacity animate-in fade-in-0 duration-200"
            onClick={() => setPreviewTemplate(null)}
          />
          <div className="relative z-50 w-full max-w-md rounded-2xl border border-border bg-card p-5 sm:p-6 text-card-foreground shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            {/* Header: Icon + Localized Name + Close button */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                  {renderTemplateIcon(previewTemplate.iconName)}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    {t('templates')}
                  </span>
                  <h3 className="text-base font-bold text-foreground truncate">
                    {locale === 'si' ? previewTemplate.siName : previewTemplate.enName}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="size-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center transition-colors"
                aria-label={t('cancel')}
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Description & Specs */}
            <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 space-y-2.5 text-xs">
              <p className="text-foreground/90 leading-relaxed font-medium">
                {locale === 'si' ? previewTemplate.siDetails : previewTemplate.enDetails}
              </p>

              {/* Quick Specs pills */}
              <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-md bg-background px-2.5 py-1 font-mono text-foreground border border-border/60">
                  📦 {previewTemplate.draft.unitsProduced} {locale === 'si' ? (previewTemplate.siDraft.unitLabel || 'ඒකක') : (previewTemplate.enDraft.unitLabel || 'units')}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 font-semibold border border-emerald-500/20">
                  📈 {previewTemplate.draft.pricingPercentage}% {t('targetMargin')}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 font-semibold border border-blue-500/20">
                  💰 LKR
                </span>
              </div>
            </div>

            {/* Included Items preview */}
            <div className="space-y-1.5 text-xs">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {t('includedBuckets')}
              </p>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/40 bg-background/50">
                {(locale === 'si' ? previewTemplate.siDraft : previewTemplate.enDraft).buckets.material.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-1.5 text-[11px]">
                    <span className="text-foreground/90 font-medium truncate">{item.name}</span>
                    <span className="text-muted-foreground font-mono ml-2 shrink-0">
                      {item.amount ? formatMoney(item.amount, 'LKR') : ''}
                    </span>
                  </div>
                ))}
                {(locale === 'si' ? previewTemplate.siDraft : previewTemplate.enDraft).buckets.labor.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-1.5 text-[11px]">
                    <span className="text-foreground/90 font-medium truncate">{item.name}</span>
                    <span className="text-muted-foreground font-mono ml-2 shrink-0">
                      {item.amount ? formatMoney(item.amount, 'LKR') : ''}
                    </span>
                  </div>
                ))}
                {(locale === 'si' ? previewTemplate.siDraft : previewTemplate.enDraft).buckets.overhead.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-1.5 text-[11px]">
                    <span className="text-foreground/90 font-medium truncate">{item.name}</span>
                    <span className="text-muted-foreground font-mono ml-2 shrink-0">
                      {item.amount ? formatMoney(item.amount, 'LKR') : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/70">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPreviewTemplate(null)}
                className="h-9 px-3.5 text-xs font-semibold"
              >
                {t('cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleApplyTemplate(previewTemplate)}
                className="h-9 px-4 text-xs font-semibold gap-1.5 shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Sparkles className="size-3.5" />
                <span>{t('useThisTemplate')}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Custom Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={Boolean(sheetToDelete)}
        onOpenChange={(isOpen) => !isOpen && setSheetToDelete(null)}
        sheetName={sheetToDelete?.name || ''}
        deleting={Boolean(sheetToDelete && deletingId === sheetToDelete.id)}
        onConfirm={handleConfirmDeleteSheet}
      />
    </>
  );
}
