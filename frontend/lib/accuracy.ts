import type { BucketDraft } from '@/store/useCalculatorStore';

export interface AccuracyInfo {
  score: number; // 0 - 100
  levelKey: 'estimate' | 'detailed' | 'accountingGrade';
  answeredCount: number;
  totalBuckets: number;
}

const BUCKET_KEYS = ['material', 'labor', 'overhead', 'transport', 'machinery', 'custom_fees'];

export function computeCostingAccuracy(buckets: Record<string, BucketDraft>): AccuracyInfo {
  let totalScore = 0;
  let activeBucketsCount = 0;

  for (const key of BUCKET_KEYS) {
    const bucket = buckets[key];
    if (!bucket) continue;

    if (bucket.isNone) {
      // Explicitly confirmed zero costs for this category
      totalScore += 100;
      activeBucketsCount++;
      continue;
    }

    const hasItems = bucket.items.length > 0;
    const hasTotal = Boolean(bucket.totalSpent.trim());

    if (!hasItems && !hasTotal) {
      // Unanswered bucket
      continue;
    }

    activeBucketsCount++;

    if (hasItems) {
      // Check if any items have Level 3 advanced costing precision
      const hasLevel3 = bucket.items.some((item) => {
        const details = item.details ?? {};
        return (
          item.isImputed
          || ['units', 'periods'].includes(details.depreciation_method ?? '')
          || Boolean(details.usage_quantity)
          || Boolean(details.allocation_measure)
          || Boolean(details.statutory_percentage)
          || Boolean(details.wastage_percentage)
        );
      });

      if (hasLevel3) {
        totalScore += 100; // Level 3: Accounting Grade
      } else {
        totalScore += 85;  // Level 2: Itemized Detailed
      }
    } else if (hasTotal) {
      totalScore += 65;    // Level 1: Lump Sum Estimate
    }
  }

  if (activeBucketsCount === 0) {
    return {
      score: 50,
      levelKey: 'estimate',
      answeredCount: 0,
      totalBuckets: BUCKET_KEYS.length,
    };
  }

  const rawScore = Math.round(totalScore / activeBucketsCount);
  const score = Math.max(50, Math.min(100, rawScore));

  let levelKey: AccuracyInfo['levelKey'] = 'estimate';
  if (score >= 90) {
    levelKey = 'accountingGrade';
  } else if (score >= 75) {
    levelKey = 'detailed';
  }

  return {
    score,
    levelKey,
    answeredCount: activeBucketsCount,
    totalBuckets: BUCKET_KEYS.length,
  };
}
