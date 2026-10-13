'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';

interface UnsavedChangesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName?: string;
  onSaveAndContinue?: () => Promise<void>;
  onDiscardAndContinue: () => void;
}

export function UnsavedChangesModal({
  open,
  onOpenChange,
  productName,
  onSaveAndContinue,
  onDiscardAndContinue,
}: UnsavedChangesModalProps) {
  const t = useTranslations('Navigation');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onSaveAndContinue) return;
    setSaving(true);
    try {
      await onSaveAndContinue();
      onOpenChange(false);
    } catch {
      // Keep modal open if save fails
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    onOpenChange(false);
    onDiscardAndContinue();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertCircle className="size-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-lg font-semibold">
              {t('unsavedChangesTitle')}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              {productName?.trim()
                ? `${t('unsavedChangesMessage')} (${productName.trim()})`
                : t('unsavedChangesMessage')}
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogFooter className="mt-4 flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-10"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>

          <Button
            type="button"
            variant="destructive"
            className="min-h-10"
            disabled={saving}
            onClick={handleDiscard}
          >
            {t('discardAndContinue')}
          </Button>

          {onSaveAndContinue && (
            <Button
              type="button"
              className="min-h-10"
              disabled={saving}
              onClick={handleSave}
            >
              {saving && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
              {t('saveAndContinue')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
