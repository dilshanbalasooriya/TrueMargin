'use client';

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useToastStore } from '@/store/useToast';

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 w-[calc(100%-2rem)] max-w-sm sm:w-96"
    >
      {toasts.map((item) => {
        const isError = item.type === 'error';
        const isSuccess = item.type === 'success';

        return (
          <div
            key={item.id}
            role={isError ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-lg backdrop-blur-md transition-all duration-200 animate-in slide-in-from-bottom-3 fade-in-50 ${
              isError
                ? 'border-destructive/30 bg-card/95 text-foreground ring-1 ring-destructive/15'
                : isSuccess
                  ? 'border-emerald-500/30 bg-card/95 text-foreground ring-1 ring-emerald-500/15'
                  : 'border-border/80 bg-card/95 text-foreground'
            }`}
          >
            {/* Type Icon */}
            <div className="shrink-0 mt-0.5">
              {isError && (
                <div className="flex size-6 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertCircle className="size-3.5" />
                </div>
              )}
              {isSuccess && (
                <div className="flex size-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="size-3.5" />
                </div>
              )}
              {!isError && !isSuccess && (
                <div className="flex size-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
                  <Info className="size-3.5" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-1">
              {item.title && (
                <h4 className="text-xs font-bold tracking-tight text-foreground mb-0.5">
                  {item.title}
                </h4>
              )}
              <p className="text-xs font-medium text-foreground/90 leading-snug">
                {item.message}
              </p>
            </div>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={() => dismissToast(item.id)}
              className="shrink-0 rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
