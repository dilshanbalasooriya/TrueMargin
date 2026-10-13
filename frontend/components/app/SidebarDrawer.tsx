'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname, Link } from '@/i18n/routing';
import { useAuth } from '@/components/auth/AuthProvider';
import { LoginModal } from '@/components/auth/LoginModal';
import { UnsavedChangesModal } from '@/components/app/UnsavedChangesModal';
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
import { createClient } from '@/lib/supabase/client';
import {
  FileText,
  Loader2,
  LogOut,
  Plus,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { cn } from 'cn';

interface SidebarDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function SidebarDrawer({ open, onClose }: SidebarDrawerProps) {
  const t = useTranslations('Navigation');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { draft, isDirty, resetDraft, loadDraft } = useCalculatorStore();

  const [sheets, setSheets] = useState<CostSheet[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [loadingSheetId, setLoadingSheetId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const userId = user?.id;
  const loadingSheets = Boolean(open && userId && loadedUserId !== userId);

  // Unsaved changes confirmation modal
  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Fetch saved cost sheets when drawer opens and user is logged in
  useEffect(() => {
    if (!open || !userId) return;
    let active = true;

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

    return () => {
      active = false;
    };
  }, [open, userId]);

  // Lock body scroll and handle Escape key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

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
      if (pathname !== '/') {
        router.push('/');
      }
      onClose();
    });
  };

  const handleLoadSheet = async (sheet: CostSheet) => {
    if (sheet.id === draft.sheetId) {
      if (pathname !== '/') router.push('/');
      onClose();
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
        if (pathname !== '/') {
          router.push('/');
        }
        onClose();
      } catch {
        // Fallback or error
      } finally {
        setLoadingSheetId(null);
      }
    });
  };

  const handleDeleteSheet = async (e: React.MouseEvent, sheetId: string) => {
    e.stopPropagation();
    if (!window.confirm(t('deleteConfirm'))) return;

    setDeletingId(sheetId);
    try {
      await deleteCostSheet(sheetId);
      setSheets((prev) => prev.filter((s) => s.id !== sheetId));
      if (draft.sheetId === sheetId) {
        resetDraft();
      }
    } catch {
      alert(t('deleteError'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.replace('/');
    router.refresh();
    onClose();
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

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={t('menu')}>
        {/* Soft Backdrop */}
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-2xs transition-opacity duration-200 animate-in fade-in-0"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Minimalist Slim Drawer Aside (~272px wide) */}
        <aside className="relative z-50 flex h-full w-68 sm:w-72 flex-col border-r border-border bg-background shadow-xl transition-transform duration-200 animate-in slide-in-from-left">
          {/* Compact Top Header */}
          <div className="flex h-13 items-center justify-between border-b border-border/70 px-3.5">
            <Link
              href="/"
              onClick={onClose}
              className="flex items-center gap-2 transition-opacity hover:opacity-85"
              aria-label="TrueMargin"
            >
              <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground shadow-2xs">
                TM
              </span>
              <span className="text-sm font-semibold tracking-tight text-foreground">
                TrueMargin
              </span>
            </Link>

            <button
              type="button"
              className="size-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center transition-colors"
              onClick={onClose}
              aria-label={t('closeMenu')}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {/* Sleek Primary Action: + New Calculation */}
          <div className="p-2.5 border-b border-border/50">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2 h-9 px-2.5 rounded-lg text-xs font-semibold border-border/80 hover:bg-muted transition-colors shadow-2xs"
              onClick={handleStartNewCalculation}
            >
              <Plus className="size-3.5 text-primary" aria-hidden="true" />
              <span>{t('newCalculation')}</span>
            </Button>
          </div>

          {/* List Area */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {user ? (
              <div>
                <div className="px-2 pt-1.5 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {t('savedCalculations')}
                  </span>
                </div>

                {loadingSheets ? (
                  <div className="flex min-h-24 items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden="true" />
                    <span>Loading...</span>
                  </div>
                ) : sheets.length === 0 ? (
                  <div className="px-2.5 py-4 text-center">
                    <p className="text-[11px] text-muted-foreground">{t('noSavedCalculations')}</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
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
                            'group flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors',
                            isActive
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-foreground/90 hover:bg-muted/70',
                            (isLoadingThis || isDeletingThis) && 'opacity-50 pointer-events-none',
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span
                              className={cn(
                                'size-1.5 rounded-full shrink-0',
                                isActive ? 'bg-primary' : 'bg-muted-foreground/40',
                              )}
                              aria-hidden="true"
                            />
                            <span className="truncate text-xs font-medium">{sheet.name}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {version && (
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {formatMoney(version.unit_cost, version.currency_code)}
                              </span>
                            )}
                            <button
                              type="button"
                              className="size-5 rounded text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:text-destructive flex items-center justify-center transition-opacity"
                              onClick={(e) => void handleDeleteSheet(e, sheet.id)}
                              title={t('deleteSheet')}
                            >
                              {isDeletingThis ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <Trash2 className="size-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Minimal Guest Callout */
              <div className="m-1 rounded-lg border border-border/70 bg-muted/30 p-3 text-center">
                <p className="text-xs font-semibold text-foreground">
                  {t('guestPromptTitle')}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {t('guestPromptDesc')}
                </p>
                <div className="mt-2.5">
                  <LoginModal>
                    <Button size="sm" className="w-full h-8 text-xs font-medium">
                      {t('guestSignIn')}
                    </Button>
                  </LoginModal>
                </div>
              </div>
            )}
          </div>

          {/* Minimal Bottom Nav (2-3 items) */}
          <div className="border-t border-border/70 p-1.5 space-y-0.5">
            <Link
              href="/sheets"
              onClick={onClose}
              className="flex h-8 items-center gap-2 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <FileText className="size-3.5" aria-hidden="true" />
              <span>{t('viewAllSheets')}</span>
            </Link>

            {user && (
              <>
                <Link
                  href="/account"
                  onClick={onClose}
                  className="flex h-8 items-center gap-2 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <User className="size-3.5" aria-hidden="true" />
                  <span>{t('account')}</span>
                </Link>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors text-left"
                >
                  <LogOut className="size-3.5" aria-hidden="true" />
                  <span>{t('signOut')}</span>
                </button>
              </>
            )}
          </div>
        </aside>
      </div>

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
    </>
  );
}
