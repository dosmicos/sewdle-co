import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TIER_CONFIG, type CreatorTier } from '@/types/ugc';

interface TierBadgeProps {
  tier: CreatorTier | string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const TierBadge: React.FC<TierBadgeProps> = ({ tier, size = 'sm', showLabel = false }) => {
  if (!tier) return null;

  const config = TIER_CONFIG[tier as CreatorTier];
  if (!config) return null;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-3 py-1 font-semibold',
  };

  return (
    <Badge className={`${config.bgClass} ${config.textClass} ${sizeClasses[size]} border-0 font-bold`}>
      {showLabel ? config.label : tier === 'new' ? 'New' : tier}
    </Badge>
  );
};
