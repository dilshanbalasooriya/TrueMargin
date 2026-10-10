import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCalculatorStore } from '@/store/useCalculatorStore';
import { useAuth } from '@/components/auth/AuthProvider';
import { LoginModal } from '@/components/auth/LoginModal';

export function DashboardPanel() {
  const { draft } = useCalculatorStore();
  const { user } = useAuth();

  const totalCost = Object.values(draft.buckets).reduce((acc, curr) => {
    const val = parseFloat(curr.totalSpent);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  return (
    <div className="sticky top-8 space-y-6">
      <Card className="border-primary/20 shadow-lg shadow-primary/5">
        <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
          <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground font-semibold">Total Unit Cost</CardTitle>
          <div className="text-4xl font-bold text-foreground mt-2">
            Rs. {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Volume</span>
              <span className="font-medium">{draft.unitsProduced || '0'} units</span>
            </div>
            {/* Break-even, chart placeholders here */}
            <div className="h-32 mt-6 rounded-lg bg-muted/30 border border-border/50 flex items-center justify-center text-muted-foreground/60">
              Chart Area
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/30 pt-4 rounded-b-lg border-t border-border/50">
          {!user ? (
            <LoginModal>
              <Button className="w-full font-bold shadow-md h-12 text-md transition-all hover:-translate-y-0.5">
                Save & Continue
              </Button>
            </LoginModal>
          ) : (
            <Button className="w-full font-bold shadow-md h-12 text-md transition-all hover:-translate-y-0.5">
              Save Changes
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
