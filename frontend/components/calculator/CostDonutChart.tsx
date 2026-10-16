'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

export interface DonutSegment {
  type: string;
  label: string;
  costPerUnit: number;
  percentage: number;
  formattedAmount: string;
  color: string;
}

interface CostDonutChartProps {
  segments: DonutSegment[];
  totalCostFormatted: string;
  unitLabel: string;
  currencyCode: string;
}

export const BUCKET_COLORS: Record<string, string> = {
  material: '#f59e0b', // Amber
  labor: '#3b82f6',    // Blue
  machinery: '#8b5cf6',// Violet
  overhead: '#f43f5e', // Rose
  transport: '#10b981',// Emerald
  custom_fees: '#06b6d4', // Cyan
};

export function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(num);
}

export function CostDonutChart({
  segments,
  totalCostFormatted,
  unitLabel,
}: CostDonutChartProps) {
  const t = useTranslations('Calculator');
  const [hoveredType, setHoveredType] = useState<string | null>(null);

  // Filter out zero percentage slices for SVG rendering
  const activeSegments = useMemo(
    () => segments.filter((s) => s.percentage > 0),
    [segments],
  );

  const radius = 46;
  const strokeWidth = 13;
  const center = 58;
  const circumference = 2 * Math.PI * radius;

  // Compute dash arrays and offsets
  const arcs = useMemo(() => {
    let accumulatedPercent = 0;
    return activeSegments.map((segment) => {
      const strokeDasharray = `${(segment.percentage / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
      accumulatedPercent += segment.percentage;
      return {
        ...segment,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [activeSegments, circumference]);

  const activeHovered = useMemo(
    () => segments.find((s) => s.type === hoveredType),
    [segments, hoveredType],
  );

  return (
    <div className="flex items-center gap-3.5">
      {/* Donut graphic (compact side-by-side) */}
      <div className="relative shrink-0 flex size-28 items-center justify-center">
        <svg
          viewBox="0 0 116 116"
          className="size-full -rotate-90 transform"
          role="img"
          aria-label={t('costBreakdown')}
        >
          {/* Background circle track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/20"
          />
          {/* Slices */}
          {arcs.map((arc) => {
            const isHovered = hoveredType === arc.type;
            return (
              <circle
                key={arc.type}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={arc.color}
                strokeWidth={isHovered ? strokeWidth + 2.5 : strokeWidth}
                strokeDasharray={arc.strokeDasharray}
                strokeDashoffset={arc.strokeDashoffset}
                strokeLinecap="round"
                className="cursor-pointer transition-all duration-200"
                onMouseEnter={() => setHoveredType(arc.type)}
                onMouseLeave={() => setHoveredType(null)}
                style={{
                  opacity: hoveredType && !isHovered ? 0.35 : 1,
                  transformOrigin: `${center}px ${center}px`,
                }}
              />
            );
          })}
        </svg>

        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-1">
          {activeHovered ? (
            <>
              <span className="text-[10px] font-semibold text-muted-foreground truncate max-w-[76px] leading-tight">
                {activeHovered.label}
              </span>
              <span className="text-xs font-bold tracking-tight tabular-nums text-foreground leading-tight">
                {activeHovered.formattedAmount}
              </span>
              <span className="text-[10px] font-bold text-primary tabular-nums leading-tight">
                {formatPercent(activeHovered.percentage)}%
              </span>
            </>
          ) : (
            <>
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground leading-tight">
                Cost / unit
              </span>
              <span className="text-xs font-black tracking-tight tabular-nums text-foreground leading-tight">
                {totalCostFormatted}
              </span>
              <span className="text-[9px] text-muted-foreground truncate max-w-[70px] leading-tight">
                / {unitLabel}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Slices breakdown legend list */}
      <div className="flex-1 min-w-0 flex flex-col gap-1 text-xs">
        {segments.map((segment) => {
          const isHovered = hoveredType === segment.type;
          return (
            <button
              key={segment.type}
              type="button"
              onMouseEnter={() => setHoveredType(segment.type)}
              onMouseLeave={() => setHoveredType(null)}
              className={`flex items-center justify-between rounded-md px-2 py-0.5 text-left transition-colors ${
                isHovered
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'hover:bg-muted/40 text-foreground'
              }`}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="truncate text-xs font-medium">
                  {segment.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 tabular-nums text-xs">
                <span className="font-semibold text-foreground">
                  {segment.formattedAmount}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  ({formatPercent(segment.percentage)}%)
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
