'use client';

import { useLocale } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut } from 'lucide-react';

interface SignOutConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  signingOut: boolean;
}

export function SignOutConfirmModal({
  open,
  onOpenChange,
  onConfirm,
  signingOut,
}: SignOutConfirmModalProps) {
  const locale = useLocale();
  const isSi = locale === 'si';

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !signingOut && onOpenChange(v)}>
      <DialogContent className="max-w-md p-6 rounded-2xl border-border bg-card shadow-2xl">
        <div className="flex flex-col items-center text-center">
          {/* Warning Icon Badge */}
          <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-4 ring-8 ring-amber-500/5">
            <LogOut className="size-6" />
          </div>

          <DialogTitle className="text-lg font-bold text-foreground">
            {isSi ? 'ගිණුමෙන් ඉවත් වන්නද?' : 'Sign out of TrueMargin?'}
          </DialogTitle>

          <DialogDescription className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {isSi
              ? 'ඔබ මෙම උපාංගයේ සක්‍රිය සැසියෙන් ඉවත් වීමට සූදානම් වේ. ඔබගේ සුරැකි පිරිවැය පත්‍ර සහ දත්ත ආරක්ෂිතව පවතිනු ඇති අතර, ඕනෑම වේලාවක නැවත පිවිසිය හැක.'
              : 'You are about to sign out of your active session on this device. Your saved cost sheets and calculation history will remain safe.'}
          </DialogDescription>

          {/* Action Buttons */}
          <div className="mt-6 flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={signingOut}
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto rounded-xl"
            >
              {isSi ? 'අවලංගු කරන්න' : 'Cancel'}
            </Button>

            <Button
              type="button"
              variant="destructive"
              disabled={signingOut}
              onClick={handleConfirm}
              className="w-full sm:w-auto gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold rounded-xl shadow-xs"
            >
              {signingOut ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogOut className="size-4" />
              )}
              {signingOut
                ? isSi
                  ? 'ඉවත් වෙමින්…'
                  : 'Signing out…'
                : isSi
                ? 'ඔව්, ඉවත් වන්න'
                : 'Yes, Sign Out'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
