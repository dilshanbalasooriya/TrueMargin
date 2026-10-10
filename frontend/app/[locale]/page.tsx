'use client';

import { useTranslations } from 'next-intl';
import { BucketCard } from '@/components/calculator/BucketCard';
import { DashboardPanel } from '@/components/dashboard/DashboardPanel';
import { useCalculatorStore } from '@/store/useCalculatorStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { use } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { LoginModal } from '@/components/auth/LoginModal';

const BUCKETS = [
  { key: 'material', title: 'Materials', description: 'Raw materials, parts, and packaging.' },
  { key: 'labor', title: 'Labor', description: 'Wages for workers directly making the product.' },
  { key: 'transport', title: 'Transport', description: 'Fuel, delivery fees, and vehicle maintenance.' },
  { key: 'overhead', title: 'Overhead', description: 'Rent, electricity, and administrative costs.' },
  { key: 'machinery', title: 'Machinery', description: 'Equipment depreciation and maintenance.' },
  { key: 'custom_fees', title: 'Custom Fees', description: 'Any other specific costs.' }
];

export default function HomePage(props: { params: Promise<{locale: string}> }) {
  const params = use(props.params);
  const t = useTranslations('Index');
  const { draft, updateDraft } = useCalculatorStore();
  const { user } = useAuth();

  return (
    <main className="flex-1 min-h-screen bg-muted/20">
      {/* Header Bar */}
      <header className="bg-background border-b border-border sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
              T
            </div>
            <span className="font-bold text-lg tracking-tight">TrueMargin</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
              {user ? 'Editing Draft' : 'Guest Session'}
            </div>
            {!user ? (
              <LoginModal>
                <Button size="sm" className="font-medium shadow-sm">
                  Sign in to Save
                </Button>
              </LoginModal>
            ) : (
              <Button size="sm" variant="outline" className="font-medium">
                Save Draft
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Wizard Area */}
          <div className="lg:col-span-8 space-y-8">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('title')}</h1>
              <p className="text-muted-foreground text-lg">{t('description')}</p>
            </div>

            {/* Top Level Inputs */}
            <div className="grid sm:grid-cols-2 gap-6 bg-background p-6 rounded-2xl border border-border/50 shadow-sm">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Product or Service Name</label>
                <Input 
                  placeholder="e.g. Handmade Soap" 
                  value={draft.productName}
                  onChange={(e) => updateDraft({ productName: e.target.value })}
                  className="bg-muted/50 border-transparent focus-visible:bg-background transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-primary">Units Produced (Volume)</label>
                <Input 
                  type="number"
                  placeholder="e.g. 100" 
                  value={draft.unitsProduced}
                  onChange={(e) => updateDraft({ unitsProduced: e.target.value })}
                  className="bg-primary/5 border-primary/20 focus-visible:ring-primary"
                />
              </div>
            </div>

            {/* Buckets Grid */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">Cost Breakdown</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {BUCKETS.map((b) => (
                  <BucketCard key={b.key} bucketKey={b.key} title={b.title} description={b.description} />
                ))}
              </div>
            </div>
          </div>

          {/* Dashboard Sidebar */}
          <div className="lg:col-span-4">
            <DashboardPanel />
          </div>

        </div>
      </div>
    </main>
  );
}
