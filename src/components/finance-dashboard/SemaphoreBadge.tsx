import React from 'react';
import { cn } from '@/lib/utils';
import type { Semaphore } from '@/hooks/useContributionMargin';

interface SemaphoreBadgeProps {
  status: Semaphore;
  size?: 'sm' | 'md';
  label?: string;
}

const COLOR_MAP: Record<Semaphore, { bg: string; ring: string; text: string }> = {
  green: { bg: 'bg-emerald-500', ring: 'ring-emerald-200', text: 'text-emerald-700' },
  yellow: { bg: 'bg-amber-400', ring: 'ring-amber-200', text: 'text-amber-700' },
  red: { bg: 'bg-red-500', ring: 'ring-red-200', text: 'text-red-700' },
};

const LABEL_MAP: Record<Semaphore, string> = {
  green: 'On Track',
  yellow: 'Near Target',
  red: 'Below Target',
};

export const SemaphoreBadge: React.FC<SemaphoreBadgeProps> = ({ status, size = 'md', label }) => {
  const colors = COLOR_MAP[status];
  const displayLabel = label ?? LABEL_MAP[status];

  if (size === 'sm') {
    return (
      <span
        className={cn('inline-block rounded-full ring-2', colors.bg, colors.ring)}
        style={{ width: 8, height: 8 }}
        title={displayLabel}
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn('inline-block rounded-full ring-2', colors.bg, colors.ring)}
        style={{ width: 10, height: 10 }}
      />
      <span className={cn('text-xs font-medium', colors.text)}>{displayLabel}</span>
    </span>
  );
};

export default SemaphoreBadge;
