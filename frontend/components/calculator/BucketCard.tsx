'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Trash2,
  SlidersHorizontal,
  Zap,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Layers,
  Users,
  Truck,
  Building2,
  Cog,
  Receipt,
  HelpCircle,
  Ban,
  Sparkles,
  Scale,
  Pencil,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { cn } from 'cn';
import type { BucketDraft, LineItemDraft } from '@/store/useCalculatorStore';
import { Level3DetailsModal, getActiveLevel3Count } from './Level3DetailsModal';
import { TransportCostEditor } from './TransportCostEditor';
import {
  calculateRecipeCoverageClient,
  areUnitsCompatible,
  POPULAR_UNITS,
} from '@/lib/unitConverter';

interface BucketCardProps {
  bucketKey: string;
  title: string;
  question: string;
  bucket: BucketDraft;
  currencyCode: string;
  unitsCoveredRequired: boolean;
  defaultUnitsCovered?: string;
  monthlyUnits?: string;
  unitLabel?: string;
  relatedMaterials?: Array<Pick<LineItemDraft, 'id' | 'name'>>;
  onChange: (updates: Partial<BucketDraft>) => void;
  isExpanded?: boolean;
  onToggleExpand?: (expand: boolean) => void;
}

// Category Theme Mapping with Distinct Icons & Accent Colors
const CATEGORY_THEMES: Record<
  string,
  {
    icon: typeof Layers;
    color: string;
    bg: string;
    border: string;
  }
> = {
  material: {
    icon: Layers,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  materials: {
    icon: Layers,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  labor: {
    icon: Users,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  transport: {
    icon: Truck,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  overhead: {
    icon: Building2,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  machinery: {
    icon: Cog,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
  },
  custom_fees: {
    icon: Receipt,
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
  },
};

// Preset Quick Unit Chips for effortless selection without ugly native datalists
const COMMON_PURCHASE_UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'm', 'pack'];
const COMMON_USAGE_UNITS = ['g', 'kg', 'ml', 'L', 'pcs', 'cm'];

// Preset Quick Overhead items for Sri Lankan SMEs and craft businesses
const OVERHEAD_PRESETS = [
  { id: 'rent', nameKey: 'overheadPresetRent', icon: '🏢' },
  { id: 'electricity', nameKey: 'overheadPresetElectricity', icon: '⚡' },
  { id: 'water', nameKey: 'overheadPresetWater', icon: '💧' },
  { id: 'internet', nameKey: 'overheadPresetInternet', icon: '🌐' },
  { id: 'gas', nameKey: 'overheadPresetGas', icon: '🔥' },
  { id: 'cleaning', nameKey: 'overheadPresetCleaning', icon: '🧼' },
  { id: 'marketing', nameKey: 'overheadPresetMarketing', icon: '📢' },
] as const;

export function getItemEffectiveAmount(it: LineItemDraft): number {
  const base = parseFloat(it.amount) || 0;
  if (base <= 0) return 0;
  const allocStr = it.details?.allocation_percentage;
  if (allocStr !== undefined && allocStr !== null && typeof allocStr === 'string' && allocStr.trim() !== '') {
    const allocNum = parseFloat(allocStr);
    if (!isNaN(allocNum) && allocNum >= 0 && allocNum <= 100) {
      return (base * allocNum) / 100;
    }
  }
  return base;
}

function getRecipeCoverage(
  purchaseQtyStr?: string,
  purchaseUnitStr?: string,
  usageQtyStr?: string,
  usageUnitStr?: string
): { unitsCovered?: number; error?: string } {
  const pQty = parseFloat(purchaseQtyStr ?? '');
  const uQty = parseFloat(usageQtyStr ?? '');
  const pUnit = purchaseUnitStr?.trim() || '';
  const uUnit = usageUnitStr?.trim() || '';

  if (isNaN(pQty) || pQty <= 0 || isNaN(uQty) || uQty <= 0) {
    return { error: 'incomplete' };
  }

  // If neither has a unit, calculate direct ratio
  if (!pUnit && !uUnit) {
    return { unitsCovered: pQty / uQty };
  }

  return calculateRecipeCoverageClient(pQty, pUnit || 'pcs', uQty, uUnit || 'pcs');
}

function getSuggestedUsageUnit(purchaseUnit?: string): string {
  if (!purchaseUnit) return 'g';
  const norm = purchaseUnit.trim().toLowerCase();
  if (norm === 'kg' || norm === 'kilogram' || norm === 'kilo' || norm === 'kgs') return 'g';
  if (norm === 'l' || norm === 'liter' || norm === 'litre' || norm === 'ltr') return 'ml';
  if (norm === 'm' || norm === 'meter' || norm === 'metre' || norm === 'mtr') return 'cm';
  if (norm === 'dz' || norm === 'dozen') return 'pcs';
  return norm;
}

export function BucketCard({
  bucketKey,
  title,
  question,
  bucket,
  currencyCode,
  unitsCoveredRequired,
  defaultUnitsCovered,
  monthlyUnits,
  unitLabel,
  relatedMaterials = [],
  onChange,
  isExpanded: isExpandedProp,
  onToggleExpand,
}: BucketCardProps) {
  const t = useTranslations('Calculator');

  // Accordion state: Controls whether the ENTIRE bucket is expanded or collapsed
  const isCardControlled = isExpandedProp !== undefined;
  const [internalCardExpanded, setInternalCardExpanded] = useState(false);
  const isCardExpanded = isCardControlled ? isExpandedProp : internalCardExpanded;
  const setCardExpanded = (next: boolean) => {
    if (next) {
      if (bucket.items.length === 0) {
        setIsLevel2(false);
        setActiveItemId(null);
      } else if (bucket.items.length > 0) {
        setIsLevel2(true);
      }
    }
    if (isCardControlled && onToggleExpand) {
      onToggleExpand(next);
    } else {
      setInternalCardExpanded(next);
    }
  };

  // Level state: Remembers whether this bucket is in Level 1 (quick total) or Level 2 (breakdown).
  // When collapsed and re-expanded, it returns to whichever level the user was in!
  const [isLevel2, setIsLevel2] = useState<boolean>(() => bucket.items.length > 0);

  const isLabor = bucketKey === 'labor';
  const isOverhead = bucketKey === 'overhead';
  const isTransport = bucketKey === 'transport';
  const availableOverheadPresets = OVERHEAD_PRESETS.filter(
    (preset) => !bucket.items.some(
      (item) =>
        item.details?.overhead_preset_id === preset.id
        || item.name.trim() === t(preset.nameKey),
    ),
  );

  // Category Default Method (Recipe vs Total Items Made for materials/other)
  const [categoryDefaultMethod, setCategoryDefaultMethod] = useState<'recipe' | 'total'>(() => {
    if (bucket.items.some((it) => it.details?.method === 'recipe')) return 'recipe';
    if (bucketKey === 'material' || bucketKey === 'materials') return 'recipe';
    return 'total';
  });

  // Labor Default Payment Method (Monthly Salary vs Hourly/Daily vs Piece-Rate)
  const [laborDefaultMethod, setLaborDefaultMethod] = useState<'monthly_salary' | 'time_based' | 'piece_rate'>(() => {
    const firstWithMethod = bucket.items.find((it) => it.details?.labor_method);
    if (firstWithMethod?.details?.labor_method) {
      return firstWithMethod.details.labor_method as 'monthly_salary' | 'time_based' | 'piece_rate';
    }
    return 'monthly_salary';
  });

  // Which line item is actively being edited (accordion inside Level 2).
  const [activeItemId, setActiveItemId] = useState<string | null>(() => {
    if (bucket.items.length > 0) {
      const first = bucket.items[0];
      if (!first.name.trim() || !first.amount.trim()) return first.id;
    }
    return null;
  });

  const [selectedLevel3Item, setSelectedLevel3Item] = useState<LineItemDraft | null>(null);
  const prefix = `bucket-${bucketKey}`;

  // Track previous items length to reactively auto-collapse when items are cleared/reset
  const prevItemsLength = useRef(bucket.items.length);
  useEffect(() => {
    if (prevItemsLength.current > 0 && bucket.items.length === 0) {
      setIsLevel2(false);
      setActiveItemId(null);
      setInitialEstimate(null);
    }
    prevItemsLength.current = bucket.items.length;
  }, [bucket.items.length, bucketKey]);

  // Clean up activeItemId if the active item was removed
  useEffect(() => {
    if (activeItemId && !bucket.items.some((it) => it.id === activeItemId)) {
      setActiveItemId(null);
    }
  }, [bucket.items, activeItemId]);

  // Track whether the user entered a Level 1 quick estimate before expanding into Level 2
  const [initialEstimate, setInitialEstimate] = useState<number | null>(() => {
    const val = parseFloat(bucket.totalSpent);
    if (bucket.items.length > 0) {
      const sum = bucket.items.reduce((acc, it) => acc + getItemEffectiveAmount(it), 0);
      return !isNaN(val) && val > 0 && Math.abs(val - sum) > 0.01 ? val : null;
    }
    return !isNaN(val) && val > 0 ? val : null;
  });

  const theme = CATEGORY_THEMES[bucketKey] ?? CATEGORY_THEMES.material ?? {
    icon: HelpCircle,
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
  };
  const CategoryIcon = theme.icon;

  // Direct itemized cost sum (accounting for percentage allocation)
  const itemSum = bucket.items.reduce((acc, it) => {
    return acc + getItemEffectiveAmount(it);
  }, 0);

  // Level 1 batch coverage units
  const batchCoverageUnits =
    parseFloat(bucket.unitsCovered || monthlyUnits || defaultUnitsCovered || '1') || 1;

  // Batch-allocated cost for all items
  const batchAllocatedItemSum = bucket.items.reduce((acc, it) => {
    const val = getItemEffectiveAmount(it);
    if (val <= 0) return acc;
    const itCoverage = parseFloat(it.unitsCovered) || batchCoverageUnits;
    return acc + ((val / itCoverage) * batchCoverageUnits);
  }, 0);

  const hasInitialGuess = initialEstimate !== null && initialEstimate > 0;
  const hasItems = bucket.items.length > 0;

  const unallocatedCost = hasInitialGuess ? Math.max(0, initialEstimate - itemSum) : 0;
  const exceededCost = hasInitialGuess ? Math.max(0, itemSum - initialEstimate) : 0;
  const isExceeded = exceededCost > 0.01;

  // Metric helpers for visual summary
  const effectiveSpent = hasItems
    ? itemSum
    : (parseFloat(bucket.totalSpent) || 0);
  const effectiveCoverage = parseFloat(bucket.unitsCovered || monthlyUnits || defaultUnitsCovered || '0') || 0;
  const effectiveUnitCost = effectiveCoverage > 0 && effectiveSpent > 0
    ? (effectiveSpent / effectiveCoverage)
    : 0;
  const updateItem = (id: string, updates: Partial<LineItemDraft>) => {
    const nextItems = bucket.items.map((item) => (item.id === id ? { ...item, ...updates } : item));
    const nextSum = nextItems.reduce((acc, it) => {
      return acc + getItemEffectiveAmount(it);
    }, 0);

    const shouldSyncTotal = !hasInitialGuess || nextSum > (initialEstimate ?? 0);

    onChange({
      items: nextItems,
      ...(shouldSyncTotal
        ? { totalSpent: nextSum > 0 ? nextSum.toFixed(2).replace(/\.00$/, '') : '' }
        : {}),
    });
  };

  const handleAddOverheadPreset = (preset: typeof OVERHEAD_PRESETS[number]) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const batchUnits = bucket.unitsCovered.trim() || monthlyUnits || defaultUnitsCovered || '';
    const newItem: LineItemDraft = {
      id,
      name: t(preset.nameKey),
      amount: '',
      unitsCovered: batchUnits,
      purchaseQuantity: '1',
      purchaseUnit: 'mo',
      isImputed: false,
      details: {
        overhead_preset_id: preset.id,
        overhead_mode: 'business',
        monthly_bill: '',
        allocation_percentage: '100',
        cost_behavior: 'fixed',
      },
    };
    const nextItems = [...bucket.items, newItem];
    const nextSum = nextItems.reduce((acc, it) => acc + getItemEffectiveAmount(it), 0);
    const shouldSyncTotal = !hasInitialGuess || nextSum > (initialEstimate ?? 0);

    onChange({
      items: nextItems,
      ...(shouldSyncTotal
        ? { totalSpent: nextSum > 0 ? nextSum.toFixed(2).replace(/\.00$/, '') : '' }
        : {}),
    });
    setCardExpanded(true);
    setIsLevel2(true);
    setActiveItemId(id);
  };

  const handleAddIncomingTransportItem = (material: Pick<LineItemDraft, 'id' | 'name'>) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const batchUnits = bucket.unitsCovered.trim() || monthlyUnits || defaultUnitsCovered || '';
    const item: LineItemDraft = {
      id,
      name: t('transportIncomingChargeName', { material: material.name }),
      amount: '',
      unitsCovered: batchUnits,
      isImputed: false,
      details: {
        direction: 'inbound',
        allocated_material_ids: material.id,
        cost_behavior: 'variable',
        variable_percentage: '100',
      },
    };
    const nextItems = [...bucket.items, item];
    const nextSum = nextItems.reduce((acc, current) => acc + getItemEffectiveAmount(current), 0);
    const shouldSyncTotal = !hasInitialGuess || nextSum > (initialEstimate ?? 0);

    onChange({
      items: nextItems,
      ...(shouldSyncTotal
        ? { totalSpent: nextSum > 0 ? nextSum.toFixed(2).replace(/\.00$/, '') : '' }
        : {}),
    });
    setCardExpanded(true);
    setIsLevel2(true);
  };

  const handleAddOutgoingTransportItem = (name = '', presetId?: string) => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const batchUnits = bucket.unitsCovered.trim() || monthlyUnits || defaultUnitsCovered || '';
    const item: LineItemDraft = {
      id,
      name,
      amount: '',
      unitsCovered: batchUnits,
      isImputed: false,
      details: {
        direction: 'outbound',
        delivery_treatment: 'seller_paid',
        ...(presetId ? { transport_preset_id: presetId } : {}),
        cost_behavior: 'variable',
        variable_percentage: '100',
      },
    };
    const nextItems = [...bucket.items, item];
    const nextSum = nextItems.reduce((acc, current) => acc + getItemEffectiveAmount(current), 0);
    const shouldSyncTotal = !hasInitialGuess || nextSum > (initialEstimate ?? 0);

    onChange({
      items: nextItems,
      ...(shouldSyncTotal
        ? { totalSpent: nextSum > 0 ? nextSum.toFixed(2).replace(/\.00$/, '') : '' }
        : {}),
    });
    setCardExpanded(true);
    setIsLevel2(true);
  };

  const handleAddNewOverheadItem = () => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const batchUnits = bucket.unitsCovered.trim() || monthlyUnits || defaultUnitsCovered || '';
    const newItem: LineItemDraft = {
      id,
      name: '',
      amount: '',
      unitsCovered: batchUnits,
      purchaseQuantity: '1',
      purchaseUnit: 'mo',
      isImputed: false,
      details: {
        overhead_mode: 'business',
        monthly_bill: '',
        allocation_percentage: '100',
        cost_behavior: 'fixed',
      },
    };
    const nextItems = [...bucket.items, newItem];
    const nextSum = nextItems.reduce((acc, it) => acc + getItemEffectiveAmount(it), 0);
    const shouldSyncTotal = !hasInitialGuess || nextSum > (initialEstimate ?? 0);

    onChange({
      items: nextItems,
      ...(shouldSyncTotal
        ? { totalSpent: nextSum > 0 ? nextSum.toFixed(2).replace(/\.00$/, '') : '' }
        : {}),
    });
    setCardExpanded(true);
    setIsLevel2(true);
    setActiveItemId(id);
  };

  const addItem = () => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    let newItem: LineItemDraft;
    if (isLabor) {
      const batchUnits = bucket.unitsCovered.trim() || monthlyUnits || defaultUnitsCovered || '';
      if (laborDefaultMethod === 'monthly_salary') {
        newItem = {
          id,
          name: '',
          amount: '',
          unitsCovered: batchUnits,
          purchaseQuantity: '1',
          purchaseUnit: 'month',
          isImputed: false,
          details: {
            labor_method: 'monthly_salary',
            cost_behavior: 'fixed',
          },
        };
      } else if (laborDefaultMethod === 'time_based') {
        newItem = {
          id,
          name: '',
          amount: '',
          unitsCovered: batchUnits,
          purchaseQuantity: '',
          purchaseUnit: 'hour',
          isImputed: false,
          details: {
            labor_method: 'time_based',
            time_unit: 'hour',
            time_rate: '',
            time_spent: '',
            coverage_scope: 'batch',
            cost_behavior: 'variable',
          },
        };
      } else {
        newItem = {
          id,
          name: '',
          amount: '',
          unitsCovered: batchUnits,
          purchaseQuantity: batchUnits,
          purchaseUnit: 'unit',
          isImputed: false,
          details: {
            labor_method: 'piece_rate',
            piece_rate: '',
            cost_behavior: 'variable',
          },
        };
      }
    } else if (isOverhead) {
      const batchUnits = bucket.unitsCovered.trim() || monthlyUnits || defaultUnitsCovered || '';
      newItem = {
        id,
        name: '',
        amount: '',
        unitsCovered: batchUnits,
        purchaseQuantity: '1',
        purchaseUnit: 'mo',
        isImputed: false,
        details: {
          overhead_mode: 'business',
          monthly_bill: '',
          allocation_percentage: '100',
          cost_behavior: 'fixed',
        },
      };
    } else {
      const isDefaultRecipe = categoryDefaultMethod === 'recipe';
      newItem = {
        id,
        name: '',
        amount: '',
        unitsCovered: isDefaultRecipe ? '' : (bucket.unitsCovered || monthlyUnits || defaultUnitsCovered || ''),
        purchaseQuantity: isDefaultRecipe ? '1' : '',
        purchaseUnit: isDefaultRecipe ? 'kg' : '',
        details: isDefaultRecipe
          ? { method: 'recipe', usage_quantity: '', usage_unit: 'g' }
          : {},
      };
    }
    const nextItems = [...bucket.items, newItem];
    const nextSum = nextItems.reduce((acc, it) => {
      return acc + getItemEffectiveAmount(it);
    }, 0);

    const shouldSyncTotal = !hasInitialGuess || nextSum > (initialEstimate ?? 0);

    onChange({
      items: nextItems,
      ...(shouldSyncTotal
        ? { totalSpent: nextSum > 0 ? nextSum.toFixed(2).replace(/\.00$/, '') : '' }
        : {}),
    });
    setCardExpanded(true);
    setIsLevel2(true);
    setActiveItemId(id); // Expand the new item for immediate typing
  };

  const removeItem = (id: string) => {
    const nextItems = bucket.items.filter((item) => item.id !== id);
    if (activeItemId === id) {
      setActiveItemId(nextItems[nextItems.length - 1]?.id ?? null);
    }
    if (nextItems.length === 0) {
      setIsLevel2(false);
      setActiveItemId(null);
    }
    const nextSum = nextItems.reduce((acc, it) => {
      return acc + getItemEffectiveAmount(it);
    }, 0);

    const shouldSyncTotal = !hasInitialGuess || nextSum > (initialEstimate ?? 0);

    onChange({
      items: nextItems,
      ...(shouldSyncTotal
        ? { totalSpent: nextSum > 0 ? nextSum.toFixed(2).replace(/\.00$/, '') : '' }
        : {}),
    });
  };

  const handleConvertUnallocatedToItem = () => {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let unallocatedItem: LineItemDraft;
    if (isLabor) {
      const batchUnits = bucket.unitsCovered || monthlyUnits || defaultUnitsCovered || '';
      unallocatedItem = {
        id,
        name: '',
        amount: unallocatedCost.toFixed(2).replace(/\.00$/, ''),
        unitsCovered: batchUnits,
        purchaseQuantity: '1',
        purchaseUnit: 'month',
        isImputed: false,
        details: {
          labor_method: laborDefaultMethod,
          cost_behavior: laborDefaultMethod === 'monthly_salary' ? 'fixed' : 'variable',
        },
      };
    } else if (isOverhead) {
      const batchUnits = bucket.unitsCovered || monthlyUnits || defaultUnitsCovered || '';
      unallocatedItem = {
        id,
        name: '',
        amount: unallocatedCost.toFixed(2).replace(/\.00$/, ''),
        unitsCovered: batchUnits,
        purchaseQuantity: '1',
        purchaseUnit: 'mo',
        isImputed: false,
        details: {
          overhead_mode: 'business',
          monthly_bill: unallocatedCost.toFixed(2).replace(/\.00$/, ''),
          allocation_percentage: '100',
          cost_behavior: 'fixed',
        },
      };
    } else {
      const isDefaultRecipe = categoryDefaultMethod === 'recipe';
      unallocatedItem = {
        id,
        name: '',
        amount: unallocatedCost.toFixed(2).replace(/\.00$/, ''),
        unitsCovered: isDefaultRecipe ? '' : (bucket.unitsCovered || monthlyUnits || defaultUnitsCovered || ''),
        purchaseQuantity: isDefaultRecipe ? '1' : '',
        purchaseUnit: isDefaultRecipe ? 'kg' : '',
        details: isDefaultRecipe
          ? { method: 'recipe', usage_quantity: '', usage_unit: 'g' }
          : {},
      };
    }
    const nextItems = [...bucket.items, unallocatedItem];
    onChange({
      items: nextItems,
      totalSpent: initialEstimate ? initialEstimate.toString() : bucket.totalSpent,
    });
    setActiveItemId(id);
  };

  const handleDiscardUnallocated = () => {
    onChange({ totalSpent: itemSum > 0 ? itemSum.toFixed(2).replace(/\.00$/, '') : '' });
    setInitialEstimate(null);
  };

  const handleAcknowledgeExceeded = () => {
    setInitialEstimate(null);
  };

  const handleSelectLaborMethodAndCreateFirstItem = (method: 'monthly_salary' | 'time_based' | 'piece_rate') => {
    setLaborDefaultMethod(method);
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const batchUnits = bucket.unitsCovered.trim() || monthlyUnits || defaultUnitsCovered || '';
    let firstItem: LineItemDraft;
    if (method === 'monthly_salary') {
      firstItem = {
        id,
        name: '',
        amount: '',
        unitsCovered: batchUnits,
        purchaseQuantity: '1',
        purchaseUnit: 'month',
        isImputed: false,
        details: {
          labor_method: 'monthly_salary',
          cost_behavior: 'fixed',
        },
      };
    } else if (method === 'time_based') {
      firstItem = {
        id,
        name: '',
        amount: '',
        unitsCovered: batchUnits,
        purchaseQuantity: '',
        purchaseUnit: 'hour',
        isImputed: false,
        details: {
          labor_method: 'time_based',
          time_unit: 'hour',
          time_rate: '',
          time_spent: '',
          coverage_scope: 'batch',
          cost_behavior: 'variable',
        },
      };
    } else {
      firstItem = {
        id,
        name: '',
        amount: '',
        unitsCovered: batchUnits,
        purchaseQuantity: batchUnits,
        purchaseUnit: 'unit',
        isImputed: false,
        details: {
          labor_method: 'piece_rate',
          piece_rate: '',
          cost_behavior: 'variable',
        },
      };
    }

    const val = parseFloat(bucket.totalSpent);
    const hasPriorCost = !isNaN(val) && val > 0;
    if (hasPriorCost) {
      setInitialEstimate(val);
      onChange({
        items: [firstItem],
        totalSpent: bucket.totalSpent.trim(),
      });
    } else {
      setInitialEstimate(null);
      onChange({
        items: [firstItem],
      });
    }
    setCardExpanded(true);
    setIsLevel2(true);
    setActiveItemId(id);
  };

  const handleSelectMethodAndCreateFirstItem = (method: 'recipe' | 'total') => {
    setCategoryDefaultMethod(method);
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const isDefaultRecipe = method === 'recipe';
    const firstItem: LineItemDraft = {
      id,
      name: '',
      amount: '',
      unitsCovered: isDefaultRecipe ? '' : (bucket.unitsCovered.trim() || monthlyUnits || defaultUnitsCovered || ''),
      purchaseQuantity: isDefaultRecipe ? '1' : '',
      purchaseUnit: isDefaultRecipe ? 'kg' : '',
      details: isDefaultRecipe
        ? { method: 'recipe', usage_quantity: '', usage_unit: 'g' }
        : {},
    };

    const val = parseFloat(bucket.totalSpent);
    const hasPriorCost = !isNaN(val) && val > 0;
    if (hasPriorCost) {
      setInitialEstimate(val);
      onChange({
        items: [firstItem],
        totalSpent: bucket.totalSpent.trim(),
      });
    } else {
      setInitialEstimate(null);
      onChange({
        items: [firstItem],
      });
    }
    setCardExpanded(true);
    setIsLevel2(true);
    setActiveItemId(id);
  };

  /* ========================================================================= */
  /* STATE 1: COLLAPSED BUCKET (Sleek Visual Summary Row)                      */
  /* ========================================================================= */
  if (!isCardExpanded) {
    return (
      <div
        onClick={() => setCardExpanded(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCardExpanded(true);
          }
        }}
        className={cn(
          "group relative flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 rounded-2xl border p-3 sm:px-4 sm:py-3.5 transition-all cursor-pointer shadow-2xs hover:shadow-xs hover:border-primary/50 select-none",
          bucket.isNone
            ? "border-border/60 bg-muted/20 hover:bg-muted/30 opacity-75"
            : "border-border/80 bg-card hover:bg-muted/10"
        )}
        title={t('expandCategoryHint')}
      >
        {/* Left Side: Icon, Title, Status Badge, Metrics */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl border shadow-2xs transition-transform group-hover:scale-105",
              theme.bg,
              theme.border,
              theme.color
            )}
          >
            <CategoryIcon className="size-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground group-hover:text-primary transition-colors truncate">
                {title}
              </h3>

              {bucket.isNone ? (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border/60">
                  🚫 {t('markedAsNoCost')}
                </span>
              ) : hasItems ? (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary border border-primary/20">
                  🍰 {bucket.items.length} {bucket.items.length === 1 ? 'item' : 'items'} ({t('itemizedLevel2')})
                </span>
              ) : effectiveSpent > 0 ? (
                <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  ⚡ {t('quickEstimate')}
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border/50">
                  {t('notEntered')}
                </span>
              )}
            </div>

            {/* Metric preview line */}
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap truncate mt-0.5">
              {bucket.isNone ? (
                <span>{question}</span>
              ) : effectiveSpent > 0 ? (
                <>
                  {effectiveCoverage > 0 && (
                    <span>
                      {t('unitsCovered')}: <strong className="text-foreground font-semibold">{effectiveCoverage.toLocaleString()} {unitLabel || ''}</strong>
                    </span>
                  )}
                  {effectiveUnitCost > 0 && (
                    <>
                      <span className="text-muted-foreground/40">•</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {currencyCode} {effectiveUnitCost.toFixed(2)} / {unitLabel || 'unit'}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground/70 italic">{t('clickToEnterCost')}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Total Cost & Expand Chevron */}
        <div className="flex items-center gap-3 shrink-0 ml-auto sm:ml-0">
          {effectiveSpent > 0 && !bucket.isNone && (
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground block font-medium uppercase tracking-wider">Total</span>
              <span className="text-sm sm:text-base font-bold font-mono text-foreground tracking-tight">
                {currencyCode} {effectiveSpent.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div className="flex size-8 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all shadow-2xs">
            <ChevronDown className="size-4" />
          </div>
        </div>
      </div>
    );
  }

  /* ========================================================================= */
  /* STATE 2: EXPANDED FULL BUCKET CARD                                        */
  /* ========================================================================= */
  return (
    <article
      className={cn(
        "rounded-2xl border bg-card p-4 sm:p-5 transition-all shadow-2xs hover:shadow-xs",
        bucket.isNone ? "border-border/60 bg-muted/15" : "border-border"
      )}
    >
      {/* Category Header: Fully Clickable to Collapse the Entire Bucket */}
      <div
        onClick={() => setCardExpanded(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCardExpanded(false);
          }
        }}
        className="group flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none rounded-xl p-1 -m-1 hover:bg-muted/15 transition-colors"
        title={t('collapseCategoryHint')}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl border shadow-2xs transition-transform group-hover:scale-105",
              theme.bg,
              theme.border,
              theme.color
            )}
          >
            <CategoryIcon className="size-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                {title}
              </h3>
              {hasItems && !bucket.isNone && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {bucket.items.length} {bucket.items.length === 1 ? 'item' : 'items'}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate max-w-sm sm:max-w-md">{question}</p>
          </div>
        </div>

        {/* Header Actions: No-Cost Button and Full Category Collapse Button */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {!bucket.isNone && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-border/80 bg-background px-3 text-xs font-semibold text-foreground shadow-2xs hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive transition-all"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ isNone: true, totalSpent: '0', items: [] });
              }}
              title={t('skipCategory')}
            >
              <Ban className="size-3.5 mr-1.5 text-muted-foreground" />
              <span>{t('skipCategory')}</span>
            </Button>
          )}

          {/* Explicit Full Category Collapse Button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5"
            onClick={(e) => {
              e.stopPropagation();
              setCardExpanded(false);
            }}
            title={t('collapseCategory')}
          >
            <ChevronUp className="size-3.5" />
            <span>{t('collapseCategory')}</span>
          </Button>
        </div>
      </div>

      {bucket.isNone ? (
        /* Marked as None */
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-dashed border-border/80 bg-muted/30 p-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Ban className="size-4" />
            </span>
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">
              {t('markedAsNoCost')}
            </span>
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-8 text-xs font-semibold shadow-2xs"
            onClick={() => onChange({ isNone: false, totalSpent: '', items: [] })}
          >
            <Plus className="size-3.5 mr-1" />
            {t('addCosts')}
          </Button>
        </div>
      ) : (
        <>
          {/* LEVEL 1 VIEW: Streamlined, Orderly Input Grid */}
          {!isLevel2 ? (
            <div className="mt-4 space-y-4 pt-2 border-t border-border/60">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* 1. Category Total Amount */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between min-h-6">
                    <label htmlFor={`${prefix}-amount`} className="text-xs font-bold text-foreground">
                      {t('categoryTotalCostLabel')}
                    </label>
                  </div>

                  {/* Connected Currency Prefix + Input */}
                  <div className="flex items-stretch rounded-xl border border-border/80 bg-background shadow-2xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 overflow-hidden transition-all">
                    <span className="flex items-center justify-center px-3.5 bg-muted/60 text-xs font-bold font-mono text-muted-foreground border-r border-border/70 select-none">
                      {currencyCode}
                    </span>
                    <input
                      id={`${prefix}-amount`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={bucket.totalSpent}
                      onChange={(event) => onChange({ totalSpent: event.target.value })}
                      placeholder="0.00"
                      className="h-11 flex-1 px-3.5 text-base font-semibold font-mono bg-transparent outline-none text-foreground placeholder:text-muted-foreground/30"
                    />
                  </div>
                </div>

                {/* 2. Units Produced / Covered with Quick Target Fill */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between min-h-6 gap-1">
                    <label htmlFor={`${prefix}-coverage`} className="text-xs font-bold text-foreground">
                      {t('unitsProducedLabel')} {unitsCoveredRequired && <span className="text-destructive">*</span>}
                    </label>
                    {monthlyUnits && Number(monthlyUnits) > 0 && (
                      <button
                        type="button"
                        onClick={() => onChange({ unitsCovered: monthlyUnits })}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors shrink-0 cursor-pointer",
                          bucket.unitsCovered === monthlyUnits
                            ? "bg-primary/15 text-primary border border-primary/30"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/60"
                        )}
                        title={t('useMonthlyOutputHint')}
                      >
                        <Zap className="size-3 text-amber-500" />
                        <span>⚡ {monthlyUnits} {unitLabel || ''}</span>
                      </button>
                    )}
                  </div>

                  {/* Connected Input + Unit Suffix */}
                  <div className="flex items-stretch rounded-xl border border-border/80 bg-background shadow-2xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 overflow-hidden transition-all">
                    <input
                      id={`${prefix}-coverage`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={bucket.unitsCovered}
                      onChange={(event) => onChange({ unitsCovered: event.target.value })}
                      placeholder="0"
                      className="h-11 flex-1 px-3.5 text-base font-semibold font-mono bg-transparent outline-none text-foreground placeholder:text-muted-foreground/30"
                    />
                    <span className="flex items-center justify-center px-3.5 bg-muted/60 text-xs font-semibold text-muted-foreground border-l border-border/70 select-none">
                      {unitLabel || 'units'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Unit Cost Calculation Banner */}
              {effectiveSpent > 0 && effectiveCoverage > 0 && (
                <div className="flex items-center justify-between text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 px-3.5 py-2.5 rounded-xl border border-emerald-500/20">
                  <span className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{t('calcCostPerUnitResult', { cost: `${currencyCode} ${effectiveUnitCost.toFixed(2)}` })} / {unitLabel || 'unit'}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    ({currencyCode} {effectiveSpent.toLocaleString()} ÷ {effectiveCoverage.toLocaleString()} {unitLabel || 'units'})
                  </span>
                </div>
              )}

              {/* Bottom Trigger: Switch to Level 2 Breakdown */}
              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <span className="text-xs text-muted-foreground">
                  {hasItems && (
                    <span>
                      {bucket.items.length} {bucket.items.length === 1 ? 'item' : 'items'} ({currencyCode} {itemSum.toLocaleString()}) in breakdown
                    </span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8.5 px-3.5 text-xs font-semibold gap-1.5 shadow-2xs border-primary/40 hover:border-primary hover:bg-primary/5 text-primary"
                  onClick={() => {
                    setIsLevel2(true);
                    if (bucket.items.length > 0) {
                      const incomplete = bucket.items.find((it) => !it.name.trim() || !it.amount.trim());
                      setActiveItemId(incomplete?.id ?? null);
                    }
                  }}
                >
                  <ChevronDown className="size-3.5" />
                  <span>{t('breakDown')}</span>
                  {bucket.items.length > 0 && (
                    <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-[10px] font-bold">
                      {bucket.items.length}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* LEVEL 2 VIEW: Redesigned, Orderly Itemized Section */
            <div className="mt-4 space-y-4 pt-2 border-t border-border/60">
              {/* Estimation Reality Check Banner (Level 1 vs Level 2) */}
              {hasInitialGuess && !isTransport && (
                <div className="rounded-xl border border-border/80 bg-gradient-to-br from-card to-muted/30 p-3 sm:p-3.5 space-y-2.5 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-muted-foreground">{t('initialGuess')}:</span>
                      <span className="font-bold font-mono text-foreground bg-background px-2.5 py-1 rounded-md border border-border/70 shadow-2xs">
                        {currencyCode} {initialEstimate.toLocaleString()}
                      </span>
                      <span className="text-muted-foreground/40">vs</span>
                      <span className="font-semibold text-muted-foreground">{t('itemizedActual')}:</span>
                      <span className="font-bold font-mono text-foreground bg-background px-2.5 py-1 rounded-md border border-border/70 shadow-2xs">
                        {currencyCode} {itemSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        ({bucket.items.length} {bucket.items.length === 1 ? 'item' : 'items'})
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1"
                      onClick={() => setIsLevel2(false)}
                      title={t('switchToQuickEstimate')}
                    >
                      <ChevronUp className="size-3.5" />
                      <span>{t('switchToQuickEstimate')}</span>
                    </Button>
                  </div>

                  {/* Batch Cost Allocation note */}
                  {Math.abs(itemSum - batchAllocatedItemSum) > 0.01 && (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded-md border border-border/40">
                      <Scale className="size-3 text-primary shrink-0" />
                      <span>
                        {t('batchCostNote', {
                          batchAmount: `${currencyCode} ${batchAllocatedItemSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
                          rawAmount: `${currencyCode} ${itemSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
                        })}
                      </span>
                    </div>
                  )}

                  {/* Exceeded Banner */}
                  {isExceeded && (
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
                        ⚠️ {t('exceededBadge', {
                          amount: `${currencyCode} ${exceededCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
                          percent: Math.round((exceededCost / initialEstimate) * 100),
                        })}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                        onClick={handleAcknowledgeExceeded}
                      >
                        {t('dismissComparison')}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* First-Time Category Method Question Prompt (Dismissed once answered) */}
              {bucket.items.length === 0 && !isTransport && (
                isOverhead ? (
                  <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/5 via-card to-background p-4 sm:p-5 space-y-3.5 shadow-2xs animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        <Sparkles className="size-4" />
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          {t('overheadQuickAddTitle')}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {t('overheadQuickAddHint')}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
                      {availableOverheadPresets.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleAddOverheadPreset(preset)}
                          className="group flex items-center gap-2 rounded-xl border border-border/80 bg-card p-2.5 sm:p-3 text-left transition-all hover:border-purple-500 hover:bg-purple-500/5 hover:shadow-xs active:scale-[0.99] cursor-pointer"
                        >
                          <span className="text-lg shrink-0 group-hover:scale-110 transition-transform">{preset.icon}</span>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-foreground block group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors truncate">
                              {t(preset.nameKey)}
                            </span>
                          </div>
                          <Plus className="size-3.5 text-muted-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 shrink-0" />
                        </button>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        {t('clickToEnterCost')}
                      </span>
                      <button
                        type="button"
                        onClick={handleAddNewOverheadItem}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 transition-all cursor-pointer"
                      >
                        <Plus className="size-3.5" />
                        <span>{t('addLine')}</span>
                      </button>
                    </div>
                  </div>
                ) : isLabor ? (
                  <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/5 via-card to-background p-4 sm:p-5 space-y-3 shadow-2xs animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Sparkles className="size-4" />
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          {t('laborDefaultMethodTitle')}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {t('laborDefaultMethodHint')}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      {/* Option 1: Monthly Fixed Salary */}
                      <button
                        type="button"
                        onClick={() => handleSelectLaborMethodAndCreateFirstItem('monthly_salary')}
                        className="group flex flex-col items-start gap-2.5 rounded-xl border border-border/80 bg-card p-3.5 text-left transition-all hover:border-blue-500 hover:bg-blue-500/5 hover:shadow-xs active:scale-[0.99] cursor-pointer"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-xl group-hover:scale-110 transition-transform">
                          📅
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-foreground block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {t('monthlySalaryOption')}
                          </span>
                          <span className="text-[11px] text-muted-foreground leading-normal mt-0.5 block">
                            {t('monthlySalaryOptionDesc')}
                          </span>
                        </div>
                      </button>

                      {/* Option 2: Hourly / Daily Wage */}
                      <button
                        type="button"
                        onClick={() => handleSelectLaborMethodAndCreateFirstItem('time_based')}
                        className="group flex flex-col items-start gap-2.5 rounded-xl border border-border/80 bg-card p-3.5 text-left transition-all hover:border-blue-500 hover:bg-blue-500/5 hover:shadow-xs active:scale-[0.99] cursor-pointer"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-xl group-hover:scale-110 transition-transform">
                          ⏱️
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-foreground block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {t('hourlyDailyOption')}
                          </span>
                          <span className="text-[11px] text-muted-foreground leading-normal mt-0.5 block">
                            {t('hourlyDailyOptionDesc')}
                          </span>
                        </div>
                      </button>

                      {/* Option 3: Piece-Rate */}
                      <button
                        type="button"
                        onClick={() => handleSelectLaborMethodAndCreateFirstItem('piece_rate')}
                        className="group flex flex-col items-start gap-2.5 rounded-xl border border-border/80 bg-card p-3.5 text-left transition-all hover:border-blue-500 hover:bg-blue-500/5 hover:shadow-xs active:scale-[0.99] cursor-pointer"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-xl group-hover:scale-110 transition-transform">
                          🏷️
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-foreground block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {t('pieceRateOption')}
                          </span>
                          <span className="text-[11px] text-muted-foreground leading-normal mt-0.5 block">
                            {t('pieceRateOptionDesc')}
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/5 via-card to-background p-4 sm:p-5 space-y-3 shadow-2xs animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Sparkles className="size-4" />
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          {t('categoryDefaultMethodTitle')}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {t('categoryDefaultMethodHint')}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Option A: Recipe / Per Unit */}
                      <button
                        type="button"
                        onClick={() => handleSelectMethodAndCreateFirstItem('recipe')}
                        className="group flex items-start gap-3 rounded-xl border border-border/80 bg-card p-3.5 text-left transition-all hover:border-primary hover:bg-primary/5 hover:shadow-xs active:scale-[0.99] cursor-pointer"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl group-hover:scale-110 transition-transform">
                          🍰
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-foreground block group-hover:text-primary transition-colors">
                            {t('modePerItem')}
                          </span>
                          <span className="text-[11px] text-muted-foreground leading-normal mt-0.5 block">
                            {t('recipeMethodOption')}
                          </span>
                        </div>
                      </button>

                      {/* Option B: Total Items Made / Batch */}
                      <button
                        type="button"
                        onClick={() => handleSelectMethodAndCreateFirstItem('total')}
                        className="group flex items-start gap-3 rounded-xl border border-border/80 bg-card p-3.5 text-left transition-all hover:border-primary hover:bg-primary/5 hover:shadow-xs active:scale-[0.99] cursor-pointer"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-xl group-hover:scale-110 transition-transform">
                          📦
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-foreground block group-hover:text-primary transition-colors">
                            {t('modeTotalMade')}
                          </span>
                          <span className="text-[11px] text-muted-foreground leading-normal mt-0.5 block">
                            {t('batchMethodOption')}
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>
                )
              )}

              {isTransport && (
                <TransportCostEditor
                  items={bucket.items}
                  materials={relatedMaterials}
                  currencyCode={currencyCode}
                  onAddIncoming={handleAddIncomingTransportItem}
                  onAddOutgoing={handleAddOutgoingTransportItem}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                />
              )}

              {/* Quick Preset Chips for Overhead when items already exist */}
              {isOverhead && bucket.items.length > 0 && availableOverheadPresets.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <span className="text-[11px] font-bold text-muted-foreground shrink-0 uppercase tracking-wider">
                    {t('overheadQuickAddTitle')}:
                  </span>
                  {availableOverheadPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleAddOverheadPreset(preset)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border/70 bg-card hover:border-purple-500/50 hover:bg-purple-500/10 text-[11px] font-semibold text-foreground hover:text-purple-600 dark:hover:text-purple-400 transition-all shrink-0 cursor-pointer shadow-2xs"
                    >
                      <span>{preset.icon}</span>
                      <span>{t(preset.nameKey)}</span>
                      <Plus className="size-2.5 text-muted-foreground ml-0.5" />
                    </button>
                  ))}
                </div>
              )}

              {/* Guided Item Cards with Accordion/Compact Behavior */}
              <div className="space-y-3">
                {(isTransport ? [] : bucket.items).map((item) => {
                  const index = bucket.items.indexOf(item);
                  const activeLevel3Count = getActiveLevel3Count(item, bucketKey);
                  const isItemExpanded = activeItemId === item.id;
                  const isRecipe = item.details?.method === 'recipe';
                  const itemAmt = parseFloat(item.amount) || 0;
                  const itemCov = parseFloat(item.unitsCovered) || 0;
                  const costPerUnit = itemCov > 0 ? (itemAmt / itemCov) : 0;
                  const pUnit = item.purchaseUnit?.trim();
                  const uUnit = item.details?.usage_unit?.trim();
                  const areIncompatible = isRecipe && pUnit && uUnit && !areUnitsCompatible(pUnit, uUnit);

                  if (!isItemExpanded) {
                    if (isLabor) {
                      const laborMethod = (item.details?.labor_method as 'monthly_salary' | 'time_based' | 'piece_rate') || laborDefaultMethod || 'monthly_salary';
                      const isImputed = item.isImputed ?? false;
                      let methodBadge = '';
                      if (laborMethod === 'monthly_salary') {
                        methodBadge = `📅 ${t('laborMethodMonthlyShort')}${itemAmt > 0 ? `: ${currencyCode} ${itemAmt.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : ''}`;
                      } else if (laborMethod === 'time_based') {
                        const timeUnit = item.details?.time_unit === 'day' ? t('timeUnitDays') : t('timeUnitHours');
                        const rate = item.details?.time_rate || '';
                        const spent = item.details?.time_spent || '';
                        methodBadge = `⏱️ ${spent ? `${spent} ${timeUnit}` : timeUnit}${rate ? ` @ ${currencyCode} ${rate}` : ''}`;
                      } else {
                        const rate = item.details?.piece_rate || '';
                        methodBadge = `🏷️ ${t('laborMethodPieceShort')}${rate ? `: ${currencyCode} ${rate}` : ''}`;
                      }

                      return (
                        <div
                          key={item.id}
                          onClick={() => setActiveItemId(item.id)}
                          className={cn(
                            "group flex flex-wrap items-center justify-between gap-2.5 rounded-xl border p-2.5 sm:px-3.5 sm:py-2.5 transition-all hover:shadow-2xs cursor-pointer select-none",
                            isImputed
                              ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 hover:bg-amber-500/10"
                              : "border-border/80 bg-card hover:border-blue-500/50 hover:bg-muted/15"
                          )}
                          title={t('editItem')}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
                              isImputed ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"
                            )}>
                              #{index + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm select-none" title={isImputed ? t('ownerLaborLabel') : t('employeeLabel')}>
                                  {isImputed ? '⭐' : '👤'}
                                </span>
                                <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                                  {item.name.trim() || <span className="italic text-muted-foreground font-normal">{t('unnamedWorker')}</span>}
                                </span>
                                <span className={cn(
                                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                  isImputed
                                    ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                )}>
                                  {methodBadge}
                                </span>
                                {isImputed && (
                                  <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-300">
                                    ⭐ {t('economicCostBadge')}
                                  </span>
                                )}
                                {activeLevel3Count > 0 && (
                                  <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-medium text-secondary-foreground">
                                    ⚡ {activeLevel3Count}
                                  </span>
                                )}
                              </div>

                              {/* Subtitle metrics line */}
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                                {itemCov > 0 && (
                                  <span>Covers {itemCov.toLocaleString()} {unitLabel || 'units'}</span>
                                )}
                                {costPerUnit > 0 && (
                                  <>
                                    <span className="text-muted-foreground/40">•</span>
                                    <span className="font-semibold font-mono text-foreground">
                                      {currencyCode} {costPerUnit.toFixed(2)} / {unitLabel || 'unit'}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Side: Total Amount + Edit & Delete Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <span className="font-bold font-mono text-xs sm:text-sm text-foreground mr-1.5">
                              {currencyCode} {itemAmt.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            </span>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                              onClick={() => setActiveItemId(item.id)}
                              title={t('editItem')}
                            >
                              <Pencil className="size-3.5" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => removeItem(item.id)}
                              title={t('removeLine')}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    if (isOverhead) {
                      const isShared = item.details?.overhead_mode === 'shared';
                      const allocPct = item.details?.allocation_percentage || '100';
                      const isImputed = item.isImputed ?? false;
                      const rawBill = parseFloat(item.amount) || 0;
                      const effectiveBill = getItemEffectiveAmount(item);
                      const costPerUnit = itemCov > 0 ? (effectiveBill / itemCov) : 0;

                      return (
                        <div
                          key={item.id}
                          onClick={() => setActiveItemId(item.id)}
                          className={cn(
                            "group flex flex-wrap items-center justify-between gap-2.5 rounded-xl border p-2.5 sm:px-3.5 sm:py-2.5 transition-all hover:shadow-2xs cursor-pointer select-none",
                            isImputed
                              ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 hover:bg-amber-500/10"
                              : "border-border/80 bg-card hover:border-purple-500/50 hover:bg-muted/15"
                          )}
                          title={t('editItem')}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
                              isImputed ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-purple-500/10 text-purple-700 dark:text-purple-300"
                            )}>
                              #{index + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm select-none">
                                  {isImputed ? '💭' : isShared ? '🏠' : '🏢'}
                                </span>
                                <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                                  {item.name.trim() || <span className="italic text-muted-foreground font-normal">{t('unnamedItem')}</span>}
                                </span>
                                <span className={cn(
                                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                  isShared
                                    ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/25"
                                    : "bg-muted text-muted-foreground border border-border/60"
                                )}>
                                  {isShared ? `🏠 ${t('overheadBadgeShared', { percent: allocPct })}` : `🏢 ${t('overheadBadgeBusiness')}`}
                                </span>
                                {isImputed && (
                                  <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:text-amber-300">
                                    💭 {t('overheadBadgeImputed')}
                                  </span>
                                )}
                                {activeLevel3Count > 0 && (
                                  <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-medium text-secondary-foreground">
                                    ⚡ {activeLevel3Count}
                                  </span>
                                )}
                              </div>

                              {/* Subtitle metrics line */}
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                                {isShared && rawBill > 0 && (
                                  <span>Bill: {currencyCode} {rawBill.toLocaleString()} @ {allocPct}%</span>
                                )}
                                {itemCov > 0 && (
                                  <>
                                    {isShared && rawBill > 0 && <span className="text-muted-foreground/40">•</span>}
                                    <span>Covers {itemCov.toLocaleString()} {unitLabel || 'units'}</span>
                                  </>
                                )}
                                {costPerUnit > 0 && (
                                  <>
                                    <span className="text-muted-foreground/40">•</span>
                                    <span className="font-semibold font-mono text-purple-600 dark:text-purple-400">
                                      {currencyCode} {costPerUnit.toFixed(2)} / {unitLabel || 'unit'}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Side: Total Amount + Edit & Delete Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <span className="font-bold font-mono text-xs sm:text-sm text-foreground mr-1.5">
                              {currencyCode} {effectiveBill.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                              <span className="text-[10px] font-normal text-muted-foreground ml-1">/mo</span>
                            </span>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                              onClick={() => setActiveItemId(item.id)}
                              title={t('editItem')}
                            >
                              <Pencil className="size-3.5" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => removeItem(item.id)}
                              title={t('removeLine')}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    /* ============================================================ */
                    /* STATE A: Compact, Tidy Single-Line Summary Row               */
                    /* ============================================================ */
                    return (
                      <div
                        key={item.id}
                        onClick={() => setActiveItemId(item.id)}
                        className="group flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-card p-2.5 sm:px-3.5 sm:py-2.5 transition-all hover:border-primary/50 hover:bg-muted/15 hover:shadow-2xs cursor-pointer select-none"
                        title={t('editItem')}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-bold text-muted-foreground">
                            #{index + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                                {item.name.trim() || <span className="italic text-muted-foreground font-normal">{t('unnamedItem')}</span>}
                              </span>
                              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.2 text-[10px] font-semibold text-primary">
                                {isRecipe ? `🍰 ${t('modePerItemShort')}` : `📦 ${t('modeTotalMadeShort')}`}
                              </span>
                              {activeLevel3Count > 0 && (
                                <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.2 text-[10px] font-medium text-secondary-foreground">
                                  ⚡ {activeLevel3Count}
                                </span>
                              )}
                            </div>

                            {/* Subtitle metrics line */}
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                              {isRecipe ? (
                                <>
                                  {item.purchaseQuantity && item.purchaseUnit && (
                                    <span>{item.purchaseQuantity} {item.purchaseUnit}</span>
                                  )}
                                  {item.details?.usage_quantity && item.details?.usage_unit && (
                                    <>
                                      <span className="text-muted-foreground/40">•</span>
                                      <span>{item.details.usage_quantity} {item.details.usage_unit} / unit</span>
                                    </>
                                  )}
                                  {itemCov > 0 && (
                                    <>
                                      <span className="text-muted-foreground/40">•</span>
                                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Covers {itemCov.toLocaleString()} units</span>
                                    </>
                                  )}
                                </>
                              ) : (
                                <>
                                  {itemCov > 0 && (
                                    <span>Covers {itemCov.toLocaleString()} units</span>
                                  )}
                                </>
                              )}
                              {costPerUnit > 0 && (
                                <>
                                  <span className="text-muted-foreground/40">•</span>
                                  <span className="font-semibold font-mono text-foreground">{currencyCode} {costPerUnit.toFixed(2)} / unit</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Side: Total Amount + Edit & Delete Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <span className="font-bold font-mono text-xs sm:text-sm text-foreground mr-1.5">
                            {currencyCode} {itemAmt.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </span>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                            onClick={() => setActiveItemId(item.id)}
                            title={t('editItem')}
                          >
                            <Pencil className="size-3.5" />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeItem(item.id)}
                            title={t('removeLine')}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  /* ============================================================ */
                  /* STATE B: Expanded, Full Input Form (Orderly & Ergonomic)     */
                  /* ============================================================ */
                  if (isLabor) {
                    const laborMethod = (item.details?.labor_method as 'monthly_salary' | 'time_based' | 'piece_rate') || laborDefaultMethod || 'monthly_salary';
                    const isImputed = item.isImputed ?? false;
                    const batchUnitsStr = bucket.unitsCovered.trim() || monthlyUnits || defaultUnitsCovered || '1';
                    const batchUnitsNum = parseFloat(batchUnitsStr) || 1;

                    // Method 1: Monthly Salary calculations
                    const monthlySalaryVal = item.amount || (item.details?.monthly_salary as string) || '';
                    const monthlySalaryNum = parseFloat(monthlySalaryVal) || 0;
                    const monthlyCoveredUnits = parseFloat(item.unitsCovered) || batchUnitsNum;
                    const monthlyCostPerUnit = monthlyCoveredUnits > 0 ? (monthlySalaryNum / monthlyCoveredUnits) : 0;

                    // Method 2: Hourly/Daily Wage calculations
                    const timeUnit = (item.details?.time_unit as 'hour' | 'day') || 'hour';
                    const timeRateVal = (item.details?.time_rate as string) || '';
                    const timeSpentVal = (item.details?.time_spent as string) || '';
                    const timeScope = (item.details?.coverage_scope as 'batch' | 'item') || 'batch';
                    const timeRateNum = parseFloat(timeRateVal) || 0;
                    const timeSpentNum = parseFloat(timeSpentVal) || 0;
                    const hourlyBatchUnits = parseFloat(item.unitsCovered) || batchUnitsNum;

                    let timeTotalAmount = 0;
                    let timeCostPerUnit = 0;
                    if (timeScope === 'batch') {
                      timeTotalAmount = timeRateNum * timeSpentNum;
                      timeCostPerUnit = hourlyBatchUnits > 0 ? (timeTotalAmount / hourlyBatchUnits) : 0;
                    } else {
                      timeCostPerUnit = timeRateNum * timeSpentNum;
                      timeTotalAmount = timeCostPerUnit * hourlyBatchUnits;
                    }

                    // Method 3: Piece-Rate calculations
                    const pieceRateVal = (item.details?.piece_rate as string) || '';
                    const pieceRateNum = parseFloat(pieceRateVal) || 0;
                    const pieceBatchUnits = parseFloat(item.unitsCovered) || batchUnitsNum;
                    const pieceTotalAmount = pieceRateNum * pieceBatchUnits;
                    const pieceCostPerUnit = pieceRateNum;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "rounded-2xl border-2 p-4 sm:p-5 shadow-xs space-y-4 transition-all",
                          isImputed
                            ? "border-amber-500/50 bg-card ring-2 ring-amber-500/15"
                            : "border-primary/40 bg-card ring-2 ring-primary/10"
                        )}
                      >
                        {/* Top Bar: Index Badge, Worker/Role Input, Owner Toggle, Delete */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                          <span className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ring-1",
                            isImputed
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-amber-500/30"
                              : "bg-primary/15 text-primary ring-primary/30"
                          )}>
                            #{index + 1}
                          </span>

                          {/* Worker / Role Name */}
                          <div className="flex-1 min-w-[170px]">
                            <input
                              id={`${prefix}-labor-${index}-name`}
                              type="text"
                              value={item.name}
                              onChange={(e) => updateItem(item.id, { name: e.target.value })}
                              placeholder={t('workerRolePlaceholder')}
                              className="h-10 w-full px-3.5 rounded-xl border border-border/80 bg-background text-sm font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/45"
                            />
                          </div>

                          {/* Owner vs Employee Pill Toggle */}
                          <div className="inline-flex items-center rounded-xl border border-border/80 bg-muted/40 p-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => updateItem(item.id, { isImputed: false })}
                              className={cn(
                                "px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                                !isImputed
                                  ? "bg-card text-foreground shadow-2xs border border-border/60 font-bold"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                              title={t('employeeLabel')}
                            >
                              <span>👤</span>
                              <span>{t('employeeLabel')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItem(item.id, { isImputed: true })}
                              className={cn(
                                "px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                                isImputed
                                  ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 shadow-2xs border border-amber-500/30 font-bold"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                              title={t('ownerLaborLabel')}
                            >
                              <span>⭐</span>
                              <span>{t('ownerLaborLabel')}</span>
                            </button>
                          </div>

                          {/* Delete Item Button */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="size-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-xl"
                            onClick={() => removeItem(item.id)}
                            title={t('removeLine')}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>

                        {/* Dedicated Payment Method Tab Bar (Full Width, Zero Overflow) */}
                        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/70">
                          <button
                            type="button"
                            onClick={() => {
                              updateItem(item.id, {
                                purchaseQuantity: '1',
                                purchaseUnit: 'month',
                                unitsCovered: item.unitsCovered || batchUnitsStr,
                                amount: item.details?.monthly_salary || item.amount || '',
                                details: {
                                  ...(item.details || {}),
                                  labor_method: 'monthly_salary',
                                  cost_behavior: 'fixed',
                                },
                              });
                            }}
                            className={cn(
                              "flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs transition-all cursor-pointer",
                              laborMethod === 'monthly_salary'
                                ? "bg-card text-foreground font-bold shadow-2xs border border-border/70"
                                : "text-muted-foreground hover:text-foreground font-medium hover:bg-muted/30"
                            )}
                            title={t('monthlySalaryOption')}
                          >
                            <span className="text-sm">📅</span>
                            <span className="truncate">{t('monthlySalaryOption')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const currentSpent = parseFloat(item.details?.time_spent as string) || 0;
                              const currentRate = parseFloat(item.details?.time_rate as string) || 0;
                              const currentScope = (item.details?.coverage_scope as 'batch' | 'item') || 'batch';
                              const unitsNum = parseFloat(item.unitsCovered) || batchUnitsNum;
                              let amt = 0;
                              if (currentScope === 'batch') {
                                amt = currentSpent * currentRate;
                              } else {
                                amt = (currentSpent * currentRate) * unitsNum;
                              }
                              updateItem(item.id, {
                                purchaseQuantity: currentSpent > 0 ? currentSpent.toString() : '',
                                purchaseUnit: item.details?.time_unit || 'hour',
                                unitsCovered: item.unitsCovered || batchUnitsStr,
                                amount: amt > 0 ? amt.toFixed(2).replace(/\.00$/, '') : item.amount,
                                details: {
                                  ...(item.details || {}),
                                  labor_method: 'time_based',
                                  time_unit: item.details?.time_unit || 'hour',
                                  time_rate: item.details?.time_rate || '',
                                  time_spent: item.details?.time_spent || '',
                                  coverage_scope: currentScope,
                                  cost_behavior: 'variable',
                                },
                              });
                            }}
                            className={cn(
                              "flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs transition-all cursor-pointer",
                              laborMethod === 'time_based'
                                ? "bg-card text-foreground font-bold shadow-2xs border border-border/70"
                                : "text-muted-foreground hover:text-foreground font-medium hover:bg-muted/30"
                            )}
                            title={t('hourlyDailyOption')}
                          >
                            <span className="text-sm">⏱️</span>
                            <span className="truncate">{t('hourlyDailyOption')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const rateNum = parseFloat(item.details?.piece_rate as string) || 0;
                              const unitsNum = parseFloat(item.unitsCovered) || batchUnitsNum;
                              const amt = rateNum * unitsNum;
                              updateItem(item.id, {
                                purchaseQuantity: unitsNum.toString(),
                                purchaseUnit: unitLabel || 'unit',
                                unitsCovered: item.unitsCovered || batchUnitsStr,
                                amount: amt > 0 ? amt.toFixed(2).replace(/\.00$/, '') : item.amount,
                                details: {
                                  ...(item.details || {}),
                                  labor_method: 'piece_rate',
                                  piece_rate: item.details?.piece_rate || '',
                                  cost_behavior: 'variable',
                                },
                              });
                            }}
                            className={cn(
                              "flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs transition-all cursor-pointer",
                              laborMethod === 'piece_rate'
                                ? "bg-card text-foreground font-bold shadow-2xs border border-border/70"
                                : "text-muted-foreground hover:text-foreground font-medium hover:bg-muted/30"
                            )}
                            title={t('pieceRateOption')}
                          >
                            <span className="text-sm">🏷️</span>
                            <span className="truncate">{t('pieceRateOption')}</span>
                          </button>
                        </div>

                        {/* Owner's Labor Micro-Tip Banner */}
                        {isImputed && (
                          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 text-xs text-amber-900 dark:text-amber-200">
                            <span className="text-base leading-none">⭐</span>
                            <span className="font-medium">{t('ownerLaborTip')}</span>
                          </div>
                        )}

                        {/* ============================================================ */}
                        {/* METHOD 1: Monthly Fixed Salary Form                          */}
                        {/* ============================================================ */}
                        {laborMethod === 'monthly_salary' && (
                          <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 sm:p-4 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              {/* Salary Input */}
                              <div>
                                <label className="block text-xs font-bold text-foreground mb-1.5">
                                  {t('monthlySalaryLabel')} <span className="text-destructive">*</span>
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground select-none">
                                    {currencyCode}
                                  </span>
                                  <input
                                    id={`${prefix}-labor-${index}-salary`}
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={monthlySalaryVal}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      updateItem(item.id, {
                                        amount: val,
                                        purchaseQuantity: '1',
                                        purchaseUnit: 'month',
                                        unitsCovered: item.unitsCovered || batchUnitsStr,
                                        details: {
                                          ...(item.details || {}),
                                          labor_method: 'monthly_salary',
                                          monthly_salary: val,
                                          cost_behavior: 'fixed',
                                        },
                                      });
                                    }}
                                    placeholder="45000"
                                    className="h-10 w-full pl-12 pr-3.5 rounded-xl border border-border/80 bg-background text-sm font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/45"
                                  />
                                </div>
                              </div>

                              {/* Target Production Units Covered */}
                              <div>
                                <label className="block text-xs font-bold text-foreground mb-1.5">
                                  {t('unitsCovered')}
                                </label>
                                <div className="relative">
                                  <input
                                    id={`${prefix}-labor-${index}-units-covered`}
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={item.unitsCovered || batchUnitsStr}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      updateItem(item.id, {
                                        unitsCovered: val,
                                        details: {
                                          ...(item.details || {}),
                                          labor_method: 'monthly_salary',
                                          cost_behavior: 'fixed',
                                        },
                                      });
                                    }}
                                    placeholder={batchUnitsStr}
                                    className="h-10 w-full px-3.5 pr-14 rounded-xl border border-border/80 bg-background text-sm font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground select-none">
                                    {unitLabel || 'units'}
                                  </span>
                                </div>
                                <span className="block text-[11px] text-muted-foreground mt-1">
                                  {t('monthlySalaryCoversHint', { units: item.unitsCovered || batchUnitsStr, unit: unitLabel || 'units' })}
                                </span>
                              </div>
                            </div>

                            {/* Reactive Feedback Banner */}
                            {monthlySalaryNum > 0 && monthlyCoveredUnits > 0 ? (
                              <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2.5 text-xs font-semibold text-primary">
                                <span>{t('calcMonthlyLaborResult', {
                                  cost: `${currencyCode} ${monthlyCostPerUnit.toFixed(2)}`,
                                  salary: `${currencyCode} ${monthlySalaryNum.toLocaleString()}`,
                                  units: monthlyCoveredUnits.toLocaleString(),
                                  unit: unitLabel || 'units'
                                })}</span>
                              </div>
                            ) : monthlySalaryNum > 0 && monthlyCoveredUnits <= 0 ? (
                              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 text-xs text-amber-800 dark:text-amber-300">
                                {t('enterUnitsInSetupPrompt')}
                              </div>
                            ) : null}
                          </div>
                        )}

                        {/* ============================================================ */}
                        {/* METHOD 2: Hourly / Daily Wage Form                           */}
                        {/* ============================================================ */}
                        {laborMethod === 'time_based' && (
                          <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 sm:p-4 space-y-4">
                            {/* Wage Rate & Time Spent (2 Columns) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              {/* Time Rate Input + Unit Switcher */}
                              <div>
                                <div className="flex items-center justify-between mb-1.5 sm:min-h-7">
                                  <label className="text-xs font-bold text-foreground">
                                    {t('timeRateLabel')} <span className="text-destructive">*</span>
                                  </label>
                                  {/* Hours vs Days Switcher */}
                                  <div className="inline-flex items-center rounded-lg border border-border/70 bg-muted/50 p-0.5 text-[11px]">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateItem(item.id, {
                                          purchaseUnit: 'hour',
                                          details: {
                                            ...(item.details || {}),
                                            labor_method: 'time_based',
                                            time_unit: 'hour',
                                            cost_behavior: 'variable',
                                          },
                                        });
                                      }}
                                      className={cn(
                                        "px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer",
                                        timeUnit === 'hour'
                                          ? "bg-card text-foreground shadow-2xs border border-border/60 font-bold"
                                          : "text-muted-foreground hover:text-foreground"
                                      )}
                                    >
                                      {t('timeUnitHours')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        updateItem(item.id, {
                                          purchaseUnit: 'day',
                                          details: {
                                            ...(item.details || {}),
                                            labor_method: 'time_based',
                                            time_unit: 'day',
                                            cost_behavior: 'variable',
                                          },
                                        });
                                      }}
                                      className={cn(
                                        "px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer",
                                        timeUnit === 'day'
                                          ? "bg-card text-foreground shadow-2xs border border-border/60 font-bold"
                                          : "text-muted-foreground hover:text-foreground"
                                      )}
                                    >
                                      {t('timeUnitDays')}
                                    </button>
                                  </div>
                                </div>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground select-none">
                                    {currencyCode}
                                  </span>
                                  <input
                                    id={`${prefix}-labor-${index}-timerate`}
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={timeRateVal}
                                    onChange={(e) => {
                                      const nextRate = e.target.value;
                                      const rNum = parseFloat(nextRate) || 0;
                                      const sNum = parseFloat(timeSpentVal) || 0;
                                      const uNum = parseFloat(item.unitsCovered) || batchUnitsNum;
                                      let amt = 0;
                                      if (timeScope === 'batch') {
                                        amt = rNum * sNum;
                                      } else {
                                        amt = (rNum * sNum) * uNum;
                                      }
                                      updateItem(item.id, {
                                        amount: amt > 0 ? amt.toFixed(2).replace(/\.00$/, '') : '',
                                        purchaseQuantity: sNum > 0 ? sNum.toString() : '',
                                        purchaseUnit: timeUnit,
                                        unitsCovered: item.unitsCovered || batchUnitsStr,
                                        details: {
                                          ...(item.details || {}),
                                          labor_method: 'time_based',
                                          time_rate: nextRate,
                                          cost_behavior: 'variable',
                                        },
                                      });
                                    }}
                                    placeholder={timeUnit === 'hour' ? '500' : '2500'}
                                    className="h-10 w-full pl-12 pr-16 rounded-xl border border-border/80 bg-background text-sm font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/45"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground select-none">
                                    /{timeUnit === 'hour' ? t('timeUnitHours').toLowerCase() : t('timeUnitDays').toLowerCase()}
                                  </span>
                                </div>
                              </div>

                              {/* Time Spent Input */}
                              <div>
                                <label className="block text-xs font-bold text-foreground mb-1.5 sm:flex sm:min-h-7 sm:items-center">
                                  {t('timeSpentLabel')} <span className="text-destructive">*</span>
                                </label>
                                <div className="relative">
                                  <input
                                    id={`${prefix}-labor-${index}-timespent`}
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={timeSpentVal}
                                    onChange={(e) => {
                                      const nextSpent = e.target.value;
                                      const sNum = parseFloat(nextSpent) || 0;
                                      const rNum = parseFloat(timeRateVal) || 0;
                                      const uNum = parseFloat(item.unitsCovered) || batchUnitsNum;
                                      let amt = 0;
                                      if (timeScope === 'batch') {
                                        amt = rNum * sNum;
                                      } else {
                                        amt = (rNum * sNum) * uNum;
                                      }
                                      updateItem(item.id, {
                                        amount: amt > 0 ? amt.toFixed(2).replace(/\.00$/, '') : '',
                                        purchaseQuantity: sNum > 0 ? sNum.toString() : '',
                                        purchaseUnit: timeUnit,
                                        unitsCovered: item.unitsCovered || batchUnitsStr,
                                        details: {
                                          ...(item.details || {}),
                                          labor_method: 'time_based',
                                          time_spent: nextSpent,
                                          cost_behavior: 'variable',
                                        },
                                      });
                                    }}
                                    placeholder={timeUnit === 'hour' ? '4' : '1'}
                                    className="h-10 w-full px-3.5 pr-14 rounded-xl border border-border/80 bg-background text-sm font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/45"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground select-none">
                                    {timeUnit === 'hour' ? t('timeUnitHours').toLowerCase() : t('timeUnitDays').toLowerCase()}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Coverage Application (Full-Width Responsive Cards) */}
                            <div>
                              <label className="block text-xs font-bold text-foreground mb-1.5">
                                {t('coverageScopeLabel')}
                              </label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const rNum = parseFloat(timeRateVal) || 0;
                                    const sNum = parseFloat(timeSpentVal) || 0;
                                    const amt = rNum * sNum;
                                    updateItem(item.id, {
                                      amount: amt > 0 ? amt.toFixed(2).replace(/\.00$/, '') : '',
                                      details: {
                                        ...(item.details || {}),
                                        labor_method: 'time_based',
                                        coverage_scope: 'batch',
                                        cost_behavior: 'variable',
                                      },
                                    });
                                  }}
                                  className={cn(
                                    "flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer",
                                    timeScope === 'batch'
                                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30 shadow-2xs"
                                      : "border-border/80 bg-card hover:border-border hover:bg-muted/30 text-muted-foreground"
                                  )}
                                >
                                  <span className="text-xl shrink-0 mt-0.5">📦</span>
                                  <div className="min-w-0">
                                    <div className={cn(
                                      "text-xs font-bold",
                                      timeScope === 'batch' ? "text-primary" : "text-foreground"
                                    )}>
                                      {t('coverageBatch')}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                                      {t('coverageBatchDesc')}
                                    </div>
                                  </div>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const rNum = parseFloat(timeRateVal) || 0;
                                    const sNum = parseFloat(timeSpentVal) || 0;
                                    const uNum = parseFloat(item.unitsCovered) || batchUnitsNum;
                                    const amt = (rNum * sNum) * uNum;
                                    updateItem(item.id, {
                                      amount: amt > 0 ? amt.toFixed(2).replace(/\.00$/, '') : '',
                                      details: {
                                        ...(item.details || {}),
                                        labor_method: 'time_based',
                                        coverage_scope: 'item',
                                        cost_behavior: 'variable',
                                      },
                                    });
                                  }}
                                  className={cn(
                                    "flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer",
                                    timeScope === 'item'
                                      ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30 shadow-2xs"
                                      : "border-border/80 bg-card hover:border-border hover:bg-muted/30 text-muted-foreground"
                                  )}
                                >
                                  <span className="text-xl shrink-0 mt-0.5">🍰</span>
                                  <div className="min-w-0">
                                    <div className={cn(
                                      "text-xs font-bold",
                                      timeScope === 'item' ? "text-primary" : "text-foreground"
                                    )}>
                                      {t('coveragePerItem')}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                                      {t('coveragePerItemDesc')}
                                    </div>
                                  </div>
                                </button>
                              </div>
                            </div>

                            {/* Reactive Feedback Banner */}
                            {timeRateNum > 0 && timeSpentNum > 0 ? (
                              <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2.5 text-xs font-semibold text-primary">
                                {timeScope === 'batch' ? (
                                  <span>{t('calcHourlyBatchResult', {
                                    cost: `${currencyCode} ${timeCostPerUnit.toFixed(2)}`,
                                    spent: timeSpentVal,
                                    timeUnit: timeUnit === 'day' ? t('timeUnitDays').toLowerCase() : t('timeUnitHours').toLowerCase(),
                                    rate: `${currencyCode} ${timeRateVal}`,
                                    units: hourlyBatchUnits.toLocaleString(),
                                    unit: unitLabel || 'units'
                                  })}</span>
                                ) : (
                                  <span>{t('calcHourlyItemResult', {
                                    cost: `${currencyCode} ${timeCostPerUnit.toFixed(2)}`,
                                    spent: timeSpentVal,
                                    timeUnit: timeUnit === 'day' ? t('timeUnitDays').toLowerCase() : t('timeUnitHours').toLowerCase(),
                                    rate: `${currencyCode} ${timeRateVal}`
                                  })}</span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        )}

                        {/* ============================================================ */}
                        {/* METHOD 3: Piece-Rate / Per Unit Form                         */}
                        {/* ============================================================ */}
                        {laborMethod === 'piece_rate' && (
                          <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 sm:p-4 space-y-3.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              {/* Rate per Piece */}
                              <div>
                                <label className="block text-xs font-bold text-foreground mb-1.5">
                                  {t('pieceRateLabel')} <span className="text-destructive">*</span>
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground select-none">
                                    {currencyCode}
                                  </span>
                                  <input
                                    id={`${prefix}-labor-${index}-piecerate`}
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={pieceRateVal}
                                    onChange={(e) => {
                                      const nextRate = e.target.value;
                                      const rNum = parseFloat(nextRate) || 0;
                                      const uNum = parseFloat(item.unitsCovered) || pieceBatchUnits;
                                      const amt = rNum * uNum;
                                      updateItem(item.id, {
                                        amount: amt > 0 ? amt.toFixed(2).replace(/\.00$/, '') : '',
                                        purchaseQuantity: uNum.toString(),
                                        purchaseUnit: unitLabel || 'unit',
                                        unitsCovered: item.unitsCovered || batchUnitsStr,
                                        details: {
                                          ...(item.details || {}),
                                          labor_method: 'piece_rate',
                                          piece_rate: nextRate,
                                          cost_behavior: 'variable',
                                        },
                                      });
                                    }}
                                    placeholder="350"
                                    className="h-10 w-full pl-12 pr-20 rounded-xl border border-border/80 bg-background text-sm font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/45"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground select-none">
                                    /{unitLabel || 'unit'}
                                  </span>
                                </div>
                              </div>

                              {/* Batch Units Applied */}
                              <div>
                                <label className="block text-xs font-bold text-foreground mb-1.5">
                                  {t('unitsCovered')}
                                </label>
                                <div className="relative">
                                  <input
                                    id={`${prefix}-labor-${index}-piece-units`}
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={item.unitsCovered || batchUnitsStr}
                                    onChange={(e) => {
                                      const nextUnits = e.target.value;
                                      const uNum = parseFloat(nextUnits) || 0;
                                      const rNum = parseFloat(pieceRateVal) || 0;
                                      const amt = rNum * uNum;
                                      updateItem(item.id, {
                                        amount: amt > 0 ? amt.toFixed(2).replace(/\.00$/, '') : '',
                                        unitsCovered: nextUnits,
                                        purchaseQuantity: nextUnits,
                                        details: {
                                          ...(item.details || {}),
                                          labor_method: 'piece_rate',
                                          cost_behavior: 'variable',
                                        },
                                      });
                                    }}
                                    placeholder={batchUnitsStr}
                                    className="h-10 w-full px-3.5 pr-14 rounded-xl border border-border/80 bg-background text-sm font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground select-none">
                                    {unitLabel || 'units'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Reactive Feedback Banner */}
                            {pieceRateNum > 0 ? (
                              <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2.5 text-xs font-semibold text-primary">
                                <span>{t('calcPieceRateResult', {
                                  cost: `${currencyCode} ${pieceCostPerUnit.toFixed(2)}`,
                                  total: `${currencyCode} ${pieceTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
                                  units: pieceBatchUnits.toLocaleString(),
                                  unit: unitLabel || 'units'
                                })}</span>
                              </div>
                            ) : null}
                          </div>
                        )}

                        {/* Bottom Actions Bar: Level 3 Advanced Button & Done Editing */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-9 px-3.5 text-xs font-semibold gap-1.5 rounded-xl transition-all shadow-2xs",
                              activeLevel3Count > 0
                                ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 font-bold"
                                : "text-muted-foreground hover:text-foreground hover:border-border"
                            )}
                            onClick={() => setSelectedLevel3Item(item)}
                            title={t('level3Button')}
                          >
                            <SlidersHorizontal className="size-3.5" />
                            <span>{t('level3Button')}</span>
                            {activeLevel3Count > 0 && (
                              <span className="rounded-full bg-primary/20 px-1.5 text-[10px] font-bold text-primary">
                                {activeLevel3Count}
                              </span>
                            )}
                          </Button>

                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="h-9 px-5 text-xs font-bold gap-1.5 rounded-xl shadow-xs transition-all active:scale-98 cursor-pointer"
                            onClick={() => setActiveItemId(null)}
                            title={t('doneEditing')}
                          >
                            <Check className="size-4" />
                            <span>{t('doneEditing')}</span>
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  if (isOverhead) {
                    const isShared = item.details?.overhead_mode === 'shared';
                    const allocPctStr = item.details?.allocation_percentage || (isShared ? '50' : '100');
                    const allocPctNum = parseFloat(allocPctStr) || 100;
                    const isImputed = item.isImputed ?? false;
                    const batchUnitsStr = bucket.unitsCovered.trim() || monthlyUnits || defaultUnitsCovered || '1';
                    const batchUnitsNum = parseFloat(batchUnitsStr) || 1;
                    const coveredUnits = parseFloat(item.unitsCovered) || batchUnitsNum;

                    const rawBillVal = item.amount || (item.details?.monthly_bill as string) || '';
                    const rawBillNum = parseFloat(rawBillVal) || 0;
                    const effectiveAmount = isShared ? (rawBillNum * (allocPctNum / 100)) : rawBillNum;
                    const costPerUnit = coveredUnits > 0 ? (effectiveAmount / coveredUnits) : 0;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "rounded-2xl border-2 p-4 sm:p-5 shadow-xs space-y-4 transition-all",
                          isImputed
                            ? "border-amber-500/50 bg-card ring-2 ring-amber-500/15"
                            : "border-purple-500/40 bg-card ring-2 ring-purple-500/10"
                        )}
                      >
                        {/* Top Bar: Index Badge, Expense Name Input, Context Toggle, Delete Button */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                          <span className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ring-1",
                            isImputed
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-amber-500/30"
                              : "bg-purple-500/15 text-purple-700 dark:text-purple-300 ring-purple-500/30"
                          )}>
                            #{index + 1}
                          </span>

                          {/* Expense Name */}
                          <div className="flex-1 min-w-[170px]">
                            <input
                              id={`${prefix}-overhead-${index}-name`}
                              type="text"
                              value={item.name}
                              onChange={(e) => updateItem(item.id, { name: e.target.value })}
                              placeholder={t('overheadItemNamePlaceholder')}
                              className="h-10 w-full px-3.5 rounded-xl border border-border/80 bg-background text-sm font-semibold text-foreground focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all placeholder:text-muted-foreground/45"
                            />
                          </div>

                          {/* Business vs Home/Shared Pill Toggle */}
                          <div className="inline-flex items-center rounded-xl border border-border/80 bg-muted/40 p-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                updateItem(item.id, {
                                  details: {
                                    ...(item.details || {}),
                                    overhead_mode: 'business',
                                    allocation_percentage: '100',
                                    cost_behavior: 'fixed',
                                  },
                                });
                              }}
                              className={cn(
                                "px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                                !isShared
                                  ? "bg-card text-foreground shadow-2xs border border-border/60 font-bold"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                              title={t('overheadModeBusinessDesc')}
                            >
                              <span>🏢</span>
                              <span className="hidden xs:inline">{t('overheadModeBusiness')}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                updateItem(item.id, {
                                  details: {
                                    ...(item.details || {}),
                                    overhead_mode: 'shared',
                                    allocation_percentage: allocPctStr === '100' ? '50' : allocPctStr,
                                    cost_behavior: 'fixed',
                                  },
                                });
                              }}
                              className={cn(
                                "px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                                isShared
                                  ? "bg-purple-500/15 text-purple-800 dark:text-purple-300 shadow-2xs border border-purple-500/30 font-bold"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                              title={t('overheadModeSharedDesc')}
                            >
                              <span>🏠</span>
                              <span className="hidden xs:inline">{t('overheadModeShared')}</span>
                            </button>
                          </div>

                          {/* Delete Item Button */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="size-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-xl"
                            onClick={() => removeItem(item.id)}
                            title={t('removeLine')}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>

                        {/* Imputed Facility Notification Banner if enabled */}
                        {isImputed && (
                          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 text-xs text-amber-900 dark:text-amber-200">
                            <span className="text-base leading-none">💭</span>
                            <span className="font-medium">{t('overheadImputedTip')}</span>
                          </div>
                        )}

                        {/* Core Form: Monthly Bill & Units Covered */}
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 sm:p-4 space-y-3.5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {/* Monthly Bill Input */}
                            <div>
                              <label className="block text-xs font-bold text-foreground mb-1.5">
                                {t('overheadMonthlyBillLabel')} <span className="text-destructive">*</span>
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground select-none">
                                  {currencyCode}
                                </span>
                                <input
                                  id={`${prefix}-overhead-${index}-bill`}
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={rawBillVal}
                                  onChange={(e) => {
                                    const nextBill = e.target.value;
                                    updateItem(item.id, {
                                      amount: nextBill,
                                      purchaseQuantity: '1',
                                      purchaseUnit: 'mo',
                                      unitsCovered: item.unitsCovered || batchUnitsStr,
                                      details: {
                                        ...(item.details || {}),
                                        overhead_mode: isShared ? 'shared' : 'business',
                                        monthly_bill: nextBill,
                                        allocation_percentage: allocPctStr,
                                        cost_behavior: 'fixed',
                                      },
                                    });
                                  }}
                                  placeholder="15000"
                                  className="h-10 w-full pl-12 pr-12 rounded-xl border border-border/80 bg-background text-sm font-semibold text-foreground focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all placeholder:text-muted-foreground/45"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground select-none">
                                  /mo
                                </span>
                              </div>
                            </div>

                            {/* Monthly Production Units Covered */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-bold text-foreground">
                                  {t('unitsCovered')}
                                </label>
                              </div>
                              <div className="relative">
                                <input
                                  id={`${prefix}-overhead-${index}-units-covered`}
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={item.unitsCovered || batchUnitsStr}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateItem(item.id, {
                                      unitsCovered: val,
                                      details: {
                                        ...(item.details || {}),
                                        overhead_mode: isShared ? 'shared' : 'business',
                                        cost_behavior: 'fixed',
                                      },
                                    });
                                  }}
                                  placeholder={batchUnitsStr}
                                  className="h-10 w-full px-3.5 pr-14 rounded-xl border border-border/80 bg-background text-sm font-semibold text-foreground focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground select-none">
                                  {unitLabel || 'units'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Shared Expense Allocation Box */}
                          {isShared && (
                            <div className="rounded-xl border border-purple-500/25 bg-purple-500/5 p-3.5 space-y-3">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div>
                                  <div className="text-xs font-bold text-foreground flex items-center gap-2">
                                    <span>{t('overheadAllocationLabel')}</span>
                                    <span className="rounded-md bg-purple-500/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 text-xs font-mono font-bold">
                                      {allocPctNum}%
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground mt-0.5">
                                    {t('overheadAllocationHint')}
                                  </div>
                                </div>

                                {rawBillNum > 0 && (
                                  <div className="text-xs font-bold font-mono text-purple-700 dark:text-purple-300">
                                    {t('overheadAllocatedPortion', {
                                      portion: `${currencyCode} ${(rawBillNum * (allocPctNum / 100)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Slider */}
                              <input
                                type="range"
                                min="5"
                                max="100"
                                step="5"
                                value={allocPctNum}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updateItem(item.id, {
                                    details: {
                                      ...(item.details || {}),
                                      overhead_mode: 'shared',
                                      allocation_percentage: val,
                                      cost_behavior: 'fixed',
                                    },
                                  });
                                }}
                                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-600"
                              />

                              {/* Quick Selection Chips */}
                              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                {[
                                  { label: '20%', value: '20' },
                                  { label: '33% (1/3)', value: '33' },
                                  { label: '50% (Half)', value: '50' },
                                  { label: '75%', value: '75' },
                                  { label: '100%', value: '100' },
                                ].map((chip) => (
                                  <button
                                    key={chip.value}
                                    type="button"
                                    onClick={() => {
                                      updateItem(item.id, {
                                        details: {
                                          ...(item.details || {}),
                                          overhead_mode: chip.value === '100' ? 'business' : 'shared',
                                          allocation_percentage: chip.value,
                                          cost_behavior: 'fixed',
                                        },
                                      });
                                    }}
                                    className={cn(
                                      "px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer",
                                      allocPctNum === parseInt(chip.value)
                                        ? "bg-purple-600 text-white font-bold shadow-2xs"
                                        : "bg-background border border-border/70 text-muted-foreground hover:text-foreground hover:border-purple-500/50"
                                    )}
                                  >
                                    {chip.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Imputed Facility Checkbox */}
                          <div className="flex items-start gap-2.5 pt-1">
                            <input
                              id={`${prefix}-overhead-${index}-imputed`}
                              type="checkbox"
                              checked={isImputed}
                              onChange={(e) => {
                                updateItem(item.id, { isImputed: e.target.checked });
                              }}
                              className="size-4 mt-0.5 rounded border-border text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                            <label
                              htmlFor={`${prefix}-overhead-${index}-imputed`}
                              className="text-xs cursor-pointer select-none"
                            >
                              <span className="font-semibold text-foreground block">
                                {t('overheadImputedCheckbox')}
                              </span>
                              <span className="text-[11px] text-muted-foreground block mt-0.5">
                                {t('overheadImputedTip')}
                              </span>
                            </label>
                          </div>

                          {/* Reactive Calculation Banner */}
                          {rawBillNum > 0 && (
                            <div className="flex items-center gap-2 rounded-xl bg-purple-500/10 border border-purple-500/20 px-3.5 py-2.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
                              <span>
                                {t('overheadCalcResult', {
                                  cost: `${currencyCode} ${costPerUnit.toFixed(2)}`,
                                  allocated: `${currencyCode} ${effectiveAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
                                  units: coveredUnits.toLocaleString(),
                                  unit: unitLabel || 'units',
                                })}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Bottom Actions Bar: Level 3 Advanced Button & Done Editing */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-9 px-3.5 text-xs font-semibold gap-1.5 rounded-xl transition-all shadow-2xs",
                              activeLevel3Count > 0
                                ? "border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 font-bold"
                                : "text-muted-foreground hover:text-foreground hover:border-border"
                            )}
                            onClick={() => setSelectedLevel3Item(item)}
                            title={t('level3Button')}
                          >
                            <SlidersHorizontal className="size-3.5" />
                            <span>{t('level3Button')}</span>
                            {activeLevel3Count > 0 && (
                              <span className="rounded-full bg-purple-500/20 px-1.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                                {activeLevel3Count}
                              </span>
                            )}
                          </Button>

                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="h-9 px-5 text-xs font-bold gap-1.5 rounded-xl shadow-xs transition-all active:scale-98 cursor-pointer bg-purple-600 hover:bg-purple-700 text-white"
                            onClick={() => setActiveItemId(null)}
                            title={t('doneEditing')}
                          >
                            <Check className="size-4" />
                            <span>{t('doneEditing')}</span>
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border-2 border-primary/40 bg-card p-4 sm:p-5 shadow-xs space-y-4 ring-2 ring-primary/10 transition-all"
                    >
                      {/* Top Bar: Index Badge, Item Name Input, Compact Mode Segment, Delete Button */}
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary text-xs font-bold ring-1 ring-primary/30">
                          #{index + 1}
                        </span>

                        <div className="flex-1 min-w-[200px]">
                          <input
                            id={`${prefix}-item-${index}-name`}
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItem(item.id, { name: e.target.value })}
                            placeholder={
                              bucketKey === 'material' || bucketKey === 'materials'
                                ? 'e.g. Wheat Flour, Cocoa Powder, White Sugar...'
                                : bucketKey === 'labor'
                                ? 'e.g. Master Chef, Assistant Baker, Delivery Staff...'
                                : title
                            }
                            className="h-10 w-full px-3.5 rounded-xl border border-border/80 bg-background text-sm font-semibold text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/45"
                          />
                        </div>

                        {/* Compact Segmented Control for Costing Mode */}
                        <div className="inline-flex items-center rounded-xl border border-border/80 bg-muted/40 p-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const currentUUnit = item.details?.usage_unit || getSuggestedUsageUnit(item.purchaseUnit);
                              const currentUQty = item.details?.usage_quantity || '';
                              const newDetails = {
                                ...(item.details || {}),
                                method: 'recipe',
                                usage_unit: currentUUnit,
                                ...(item.purchaseQuantity ? { purchase_quantity: item.purchaseQuantity } : {}),
                                ...(item.purchaseUnit ? { purchase_unit: item.purchaseUnit } : {}),
                                ...(currentUQty ? { usage_quantity: currentUQty } : {}),
                              };
                              const res = getRecipeCoverage(item.purchaseQuantity, item.purchaseUnit, currentUQty, currentUUnit);
                              updateItem(item.id, {
                                details: newDetails,
                                ...(res.unitsCovered ? { unitsCovered: res.unitsCovered.toFixed(2).replace(/\.00$/, '') } : {}),
                              });
                            }}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                              isRecipe
                                ? "bg-card text-foreground shadow-2xs border border-border/60"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                            title={t('recipeSubtitle')}
                          >
                            <span>🍰</span>
                            <span>{t('modePerItemShort')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const newDetails = { ...(item.details || {}) };
                              delete newDetails.method;
                              delete newDetails.usage_quantity;
                              delete newDetails.usage_unit;
                              updateItem(item.id, {
                                unitsCovered: item.unitsCovered || bucket.unitsCovered || monthlyUnits || defaultUnitsCovered || '',
                                details: newDetails,
                              });
                            }}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                              !isRecipe
                                ? "bg-card text-foreground shadow-2xs border border-border/60"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                            title={t('batchSubtitle')}
                          >
                            <span>📦</span>
                            <span>{t('modeTotalMadeShort')}</span>
                          </button>
                        </div>

                        {/* Delete Button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="size-9 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={() => removeItem(item.id)}
                          title={t('removeLine')}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      {/* MODE A: RECIPE / PER UNIT FORM */}
                      {isRecipe ? (
                        <div className="space-y-3 pt-1">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {/* Step 1: Purchase Details */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between min-h-6">
                                <label className="text-xs font-bold text-foreground">
                                  {t('purchaseDetailsTitle')}
                                </label>
                              </div>

                              {/* Connected Quantity & Unit Group */}
                              <div className="flex items-stretch rounded-xl border border-border/80 bg-background shadow-2xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 overflow-hidden">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={item.purchaseQuantity ?? ''}
                                  onChange={(e) => {
                                    const newQty = e.target.value;
                                    const res = getRecipeCoverage(newQty, item.purchaseUnit, item.details?.usage_quantity, item.details?.usage_unit);
                                    updateItem(item.id, {
                                      purchaseQuantity: newQty,
                                      details: { ...(item.details || {}), method: 'recipe', purchase_quantity: newQty },
                                      ...(res.unitsCovered ? { unitsCovered: res.unitsCovered.toFixed(2).replace(/\.00$/, '') } : {}),
                                    });
                                  }}
                                  placeholder="1"
                                  className="h-10 w-20 text-center text-sm font-semibold font-mono bg-transparent border-r border-border/70 outline-none text-foreground"
                                />
                                <input
                                  type="text"
                                  value={item.purchaseUnit ?? ''}
                                  onChange={(e) => {
                                    const newUnit = e.target.value;
                                    const res = getRecipeCoverage(item.purchaseQuantity, newUnit, item.details?.usage_quantity, item.details?.usage_unit);
                                    updateItem(item.id, {
                                      purchaseUnit: newUnit,
                                      details: { ...(item.details || {}), method: 'recipe', purchase_unit: newUnit },
                                      ...(res.unitsCovered ? { unitsCovered: res.unitsCovered.toFixed(2).replace(/\.00$/, '') } : {}),
                                    });
                                  }}
                                  placeholder={t('linePurchaseUnitPlaceholder')}
                                  className="h-10 flex-1 px-3 text-xs font-semibold bg-transparent outline-none text-foreground"
                                />
                              </div>

                              {/* Quick Unit Presets for Purchase */}
                              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                {COMMON_PURCHASE_UNITS.map((u) => (
                                  <button
                                    key={u}
                                    type="button"
                                    onClick={() => {
                                      const res = getRecipeCoverage(item.purchaseQuantity, u, item.details?.usage_quantity, item.details?.usage_unit);
                                      updateItem(item.id, {
                                        purchaseUnit: u,
                                        details: { ...(item.details || {}), method: 'recipe', purchase_unit: u },
                                        ...(res.unitsCovered ? { unitsCovered: res.unitsCovered.toFixed(2).replace(/\.00$/, '') } : {}),
                                      });
                                    }}
                                    className={cn(
                                      "px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all border",
                                      item.purchaseUnit?.toLowerCase() === u.toLowerCase()
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-muted/50 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted"
                                    )}
                                  >
                                    {u}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Step 2: Total Cost Paid */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between min-h-6">
                                <label className="text-xs font-bold text-foreground block">
                                  {t('totalPaidLabel')}
                                </label>
                              </div>

                              <div className="flex items-stretch rounded-xl border border-border/80 bg-background shadow-2xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 overflow-hidden">
                                <span className="flex items-center justify-center px-3 bg-muted/60 text-xs font-bold font-mono text-muted-foreground border-r border-border/70 select-none">
                                  {currencyCode}
                                </span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={item.amount}
                                  onChange={(e) => updateItem(item.id, { amount: e.target.value })}
                                  placeholder="0.00"
                                  className="h-10 flex-1 px-3 text-sm font-semibold font-mono bg-transparent outline-none text-foreground"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Step 3: Usage per finished unit */}
                          <div className="space-y-2 pt-1 border-t border-border/50">
                            <label className="text-xs font-bold text-foreground flex items-center justify-between">
                              <span>
                                {t('usageQtyLabel')} ({unitLabel || 'finished unit'})
                              </span>
                              <span className="text-[11px] font-normal text-muted-foreground">
                                e.g. 250 g per {unitLabel || 'cake'}
                              </span>
                            </label>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              {/* Connected Usage Quantity & Unit */}
                              <div>
                                <div className="flex items-stretch rounded-xl border border-border/80 bg-background shadow-2xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 overflow-hidden">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={item.details?.usage_quantity ?? ''}
                                    onChange={(e) => {
                                      const newUsageQty = e.target.value;
                                      const res = getRecipeCoverage(item.purchaseQuantity, item.purchaseUnit, newUsageQty, item.details?.usage_unit);
                                      updateItem(item.id, {
                                        details: { ...(item.details || {}), method: 'recipe', usage_quantity: newUsageQty },
                                        ...(res.unitsCovered ? { unitsCovered: res.unitsCovered.toFixed(2).replace(/\.00$/, '') } : {}),
                                      });
                                    }}
                                    placeholder={t('usedPerItemPlaceholder')}
                                    className="h-10 w-20 text-center text-sm font-semibold font-mono bg-transparent border-r border-border/70 outline-none text-foreground"
                                  />
                                  <input
                                    type="text"
                                    value={item.details?.usage_unit ?? ''}
                                    onChange={(e) => {
                                      const newUsageUnit = e.target.value;
                                      const res = getRecipeCoverage(item.purchaseQuantity, item.purchaseUnit, item.details?.usage_quantity, newUsageUnit);
                                      updateItem(item.id, {
                                        details: { ...(item.details || {}), method: 'recipe', usage_unit: newUsageUnit },
                                        ...(res.unitsCovered ? { unitsCovered: res.unitsCovered.toFixed(2).replace(/\.00$/, '') } : {}),
                                      });
                                    }}
                                    placeholder={t('usageUnitPlaceholder')}
                                    className="h-10 flex-1 px-3 text-xs font-semibold bg-transparent outline-none text-foreground"
                                  />
                                </div>

                                {/* Quick Unit Presets for Usage */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                                  {COMMON_USAGE_UNITS.map((u) => (
                                    <button
                                      key={u}
                                      type="button"
                                      onClick={() => {
                                        const res = getRecipeCoverage(item.purchaseQuantity, item.purchaseUnit, item.details?.usage_quantity, u);
                                        updateItem(item.id, {
                                          details: { ...(item.details || {}), method: 'recipe', usage_unit: u },
                                          ...(res.unitsCovered ? { unitsCovered: res.unitsCovered.toFixed(2).replace(/\.00$/, '') } : {}),
                                        });
                                      }}
                                      className={cn(
                                        "px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all border",
                                        item.details?.usage_unit?.toLowerCase() === u.toLowerCase()
                                          ? "bg-primary text-primary-foreground border-primary"
                                          : "bg-muted/50 text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted"
                                      )}
                                    >
                                      {u}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Recipe Live Calculation Feedback */}
                              <div className="flex items-center">
                                {areIncompatible ? (
                                  <div className="w-full flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/25">
                                    <AlertTriangle className="size-4 shrink-0" />
                                    <span>{t('incompatibleUnitWarn', { pUnit: pUnit || '?', uUnit: uUnit || '?' })}</span>
                                  </div>
                                ) : itemCov > 0 ? (
                                  <div className="w-full text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/25 space-y-0.5">
                                    <div className="flex items-center justify-between font-bold">
                                      <span>{t('calcCoversResult', {
                                        units: itemCov.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                                        cost: `${currencyCode} ${costPerUnit.toFixed(2)}`,
                                      })}</span>
                                    </div>
                                    <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                                      ({item.purchaseQuantity} {item.purchaseUnit} ÷ {item.details?.usage_quantity} {item.details?.usage_unit})
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* MODE B: BATCH / TOTAL MADE FORM */
                        <div className="space-y-3 pt-1">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {/* Total Cost */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between min-h-6">
                                <label className="text-xs font-bold text-foreground block">
                                  {t('colTotalCost')}
                                </label>
                              </div>
                              <div className="flex items-stretch rounded-xl border border-border/80 bg-background shadow-2xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 overflow-hidden">
                                <span className="flex items-center justify-center px-3 bg-muted/60 text-xs font-bold font-mono text-muted-foreground border-r border-border/70 select-none">
                                  {currencyCode}
                                </span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={item.amount}
                                  onChange={(e) => updateItem(item.id, { amount: e.target.value })}
                                  placeholder="0.00"
                                  className="h-10 flex-1 px-3 text-sm font-semibold font-mono bg-transparent outline-none text-foreground placeholder:text-muted-foreground/30"
                                />
                              </div>
                            </div>

                            {/* Units Covered */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between min-h-6 gap-1">
                                <label className="text-xs font-bold text-foreground block">
                                  {t('colUnitsCovered')}
                                </label>
                                {monthlyUnits && Number(monthlyUnits) > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => updateItem(item.id, { unitsCovered: monthlyUnits })}
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-colors shrink-0 cursor-pointer",
                                      item.unitsCovered === monthlyUnits
                                        ? "bg-primary/15 text-primary border border-primary/30"
                                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/60"
                                    )}
                                  >
                                    <Zap className="size-2.5 text-amber-500" />
                                    <span>⚡ {monthlyUnits}</span>
                                  </button>
                                )}
                              </div>
                              <div className="flex items-stretch rounded-xl border border-border/80 bg-background shadow-2xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 overflow-hidden">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={item.unitsCovered}
                                  onChange={(e) => updateItem(item.id, { unitsCovered: e.target.value })}
                                  placeholder="0"
                                  className="h-10 flex-1 px-3 text-sm font-semibold font-mono bg-transparent outline-none text-foreground placeholder:text-muted-foreground/30"
                                />
                                <span className="flex items-center justify-center px-3 bg-muted/60 text-xs font-semibold text-muted-foreground border-l border-border/70 select-none">
                                  {unitLabel || 'units'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Batch Live Calculation Feedback */}
                          {itemCov > 0 && itemAmt > 0 && (
                            <div className="flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/25 font-semibold">
                              <span>{t('calcCostPerUnitResult', { cost: `${currencyCode} ${costPerUnit.toFixed(2)}` })} / {unitLabel || 'unit'}</span>
                              <span className="text-[11px] text-muted-foreground">
                                ({currencyCode} {itemAmt.toLocaleString()} ÷ {itemCov.toLocaleString()} {unitLabel || 'units'})
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Card Footer: Level 3 Advanced Settings & Done Button */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={cn(
                            "h-9 px-3 text-xs font-medium gap-1.5 rounded-xl transition-all shadow-2xs",
                            activeLevel3Count > 0
                              ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 font-bold"
                              : "text-muted-foreground hover:text-foreground hover:border-primary/40"
                          )}
                          onClick={() => setSelectedLevel3Item(item)}
                          title={t('level3Button')}
                        >
                          <SlidersHorizontal className="size-3.5" />
                          <span>{t('level3Button')}</span>
                          {activeLevel3Count > 0 && (
                            <span className="rounded-full bg-primary/20 px-1.5 text-[10px] font-bold text-primary">
                              {activeLevel3Count}
                            </span>
                          )}
                        </Button>

                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="h-9 px-4 text-xs font-bold gap-1.5 rounded-xl shadow-xs"
                            onClick={() => setActiveItemId(null)}
                            title={t('doneEditing')}
                          >
                            <Check className="size-4" />
                            <span>{t('doneEditing')}</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Unallocated Cash Balance Tools */}
              {hasInitialGuess && !isTransport && unallocatedCost > 0.01 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3 sm:p-3.5">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-foreground block">
                      {t('unallocatedBalanceTitle')}: {currencyCode} {unallocatedCost.toFixed(2)}
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      {t('unallocatedBalanceDesc', { initial: `${currencyCode} ${initialEstimate.toLocaleString()}` })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 px-2.5 text-xs font-semibold gap-1.5 shadow-2xs"
                      onClick={handleConvertUnallocatedToItem}
                      title={t('convertUnallocatedAction')}
                    >
                      <Plus className="size-3.5" />
                      <span>{t('convertUnallocatedAction')}</span>
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5"
                      onClick={handleDiscardUnallocated}
                      title={t('discardUnallocatedAction')}
                    >
                      <Trash2 className="size-3.5" />
                      <span>{t('discardUnallocatedAction')}</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Add Item Button (Shown when items exist; otherwise Question Prompt creates the first item) */}
              {bucket.items.length > 0 && !isTransport && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-full sm:w-auto text-xs font-semibold border-dashed border-border/90 hover:border-primary/50 hover:bg-primary/5"
                  onClick={isOverhead ? handleAddNewOverheadItem : addItem}
                >
                  <Plus className="size-3.5 mr-1.5" />
                  {t('addLine')}
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {/* Level 3 Advanced Settings Pop-up Modal */}
      <Level3DetailsModal
        open={selectedLevel3Item !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedLevel3Item(null);
        }}
        bucketKey={bucketKey}
        categoryTitle={title}
        item={selectedLevel3Item}
        currencyCode={currencyCode}
        onSave={(updates) => {
          if (selectedLevel3Item) {
            updateItem(selectedLevel3Item.id, updates);
          }
        }}
      />

      {/* Global Datalist for Popular Measurement Units */}
      <datalist id="common-units">
        {POPULAR_UNITS.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </datalist>
    </article>
  );
}
