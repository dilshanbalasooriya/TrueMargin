'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { GitCommitVertical, Loader2, Sparkles } from 'lucide-react';

interface SaveVersionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheetName: string;
  onSave: (changeNote: string) => Promise<void>;
  saving: boolean;
  currentVersionNumber?: number;
}

export function SaveVersionModal({
  open,
  onOpenChange,
  sheetName,
  onSave,
  saving,
  currentVersionNumber,
}: SaveVersionModalProps) {
  const t = useTranslations('Sheets');
  const [changeNote, setChangeNote] = useState('');

  const nextVersion = (currentVersionNumber || 1) + 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(changeNote);
    setChangeNote('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GitCommitVertical className="size-4" />
            </span>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Version {nextVersion}
            </span>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            {t('saveNewVersionTitle')}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {t('nextVersionNotice', { next: nextVersion, name: sheetName || 'Cost Sheet' })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label htmlFor="change-note" className="text-xs font-semibold text-muted-foreground">
              {t('changeNoteOptional')}
            </label>
            <Input
              id="change-note"
              type="text"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              placeholder={t('versionNotePlaceholder')}
              autoFocus
              className="min-h-11"
            />
            <p className="text-xs text-muted-foreground">
              Briefly describe what changed (e.g. updated material supplier costs, adjusted batch size).
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
              className="min-h-10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="min-h-10 gap-1.5 font-medium px-5"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="size-4" />
                  {t('saveVersionAction', { next: nextVersion })}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
