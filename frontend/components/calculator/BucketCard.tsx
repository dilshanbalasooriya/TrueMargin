import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCalculatorStore } from '@/store/useCalculatorStore';
import { useTranslations } from 'next-intl';

interface BucketCardProps {
  bucketKey: string;
  title: string;
  description: string;
}

export function BucketCard({ bucketKey, title, description }: BucketCardProps) {
  const { draft, updateBucket } = useCalculatorStore();
  const bucket = draft.buckets[bucketKey] || { totalSpent: '', isNone: false };
  const t = useTranslations('Index');

  const handleTotalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateBucket(bucketKey, { totalSpent: e.target.value, isNone: false });
  };

  const setNone = () => {
    updateBucket(bucketKey, { totalSpent: '0', isNone: true });
  };

  return (
    <Card className={`transition-all duration-300 ease-in-out border-border/50 shadow-sm hover:shadow-md ${bucket.isNone ? 'opacity-60 grayscale-[0.5]' : ''}`}>
      <CardHeader>
        <CardTitle className="text-xl text-primary">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {bucket.isNone ? (
          <div className="flex items-center gap-3 bg-muted/50 p-4 rounded-lg">
            <div className="bg-primary/20 p-1.5 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="font-medium">No costs for this bucket.</span>
            <Button variant="link" size="sm" onClick={() => updateBucket(bucketKey, { isNone: false, totalSpent: '' })} className="ml-auto text-primary">
              Change
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Total Spent</label>
              <Input 
                type="number" 
                placeholder="e.g. 1500" 
                value={bucket.totalSpent} 
                onChange={handleTotalChange}
                className="text-lg bg-background"
              />
            </div>
          </div>
        )}
      </CardContent>
      {!bucket.isNone && (
        <CardFooter className="flex justify-between border-t border-border/30 pt-4 mt-2">
          <Button variant="ghost" className="text-muted-foreground hover:text-primary transition-colors" onClick={setNone}>
            I don't have {title.toLowerCase()} costs
          </Button>
          <Button variant="outline" className="border-primary/20 hover:bg-primary/5 text-primary transition-all">
            Break this down
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
