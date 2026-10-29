'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheetName: string;
  onConfirm: () => Promise<void>;
  deleting: boolean;
}

export function DeleteConfirmModal({
  open,
  onOpenChange,
  sheetName,
  onConfirm,
  deleting,
}: DeleteConfirmModalProps) {
  const locale = useLocale();
  const t = useTranslations('Sheets');
  const isSi = locale === 'si';

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !deleting && onOpenChange(v)}>
      <DialogContent className="max-w-md p-6 rounded-2xl border-border bg-card">
        <div className="flex flex-col items-center text-center">
          {/* Warning Icon Badge */}
          <div className="flex size-13 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4 ring-8 ring-destructive/5">
            <Trash2 className="size-6" />
          </div>

          <DialogTitle className="text-lg font-bold text-foreground">
            {isSi ? 'පිරිවැය පත්‍රය මකන්නද?' : 'Delete Cost Sheet?'}
          </DialogTitle>

          <DialogDescription className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {isSi ? (
              <>
                ඔබට <strong className="text-foreground font-semibold">"{sheetName}"</strong> පත්‍රය සහ එහි සියලුම සංශෝධන ඉතිහාසය ස්ථිරවම මකා දැමීමට අවශ්‍ය බව තහවුරු කරන්න. මෙම ක්‍රියාව නැවත හැරවිය නොහැක.
              </>
            ) : (
              <>
                Are you sure you want to delete <strong className="text-foreground font-semibold">"{sheetName}"</strong>? All saved versions and historical calculations will be permanently removed. This action cannot be undone.
              </>
            )}
          </DialogDescription>

          {/* Action Buttons */}
          <div className="mt-6 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              {isSi ? 'අවලංගු කරන්න' : 'Cancel'}
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={handleConfirm}
              className="w-full sm:w-auto gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {deleting ? (isSi ? 'මකමින්…' : 'Deleting…') : (isSi ? 'ඔව්, මකන්න' : 'Yes, Delete Sheet')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
