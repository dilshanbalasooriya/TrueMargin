'use client';

import { useSyncExternalStore } from 'react';
import { useSidebarStore } from '@/store/useSidebarStore';
import { AppSidebar } from '@/components/app/AppSidebar';
import { AppHeader } from '@/components/app/AppHeader';
import { Toaster } from '@/components/ui/Toaster';
import { cn } from 'cn';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const rawExpanded = useSidebarStore((s) => s.isExpanded);

  // SSR hydration-safe mounted check
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const isExpanded = mounted ? rawExpanded : false;

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Permanent Sidebar (Never hidden on md+: 56px collapsed icon rail or 288px expanded panel) */}
      <AppSidebar />

      {/* Main Content & Header container dynamically padded for the sidebar */}
      <div
        className={cn(
          'flex min-h-dvh flex-col transition-[padding] duration-300 ease-in-out',
          isExpanded ? 'md:pl-72' : 'md:pl-14',
        )}
      >
        <AppHeader />
        <div className="flex-1 flex flex-col">
          {children}
        </div>
      </div>
      <Toaster />
    </div>
  );
}
