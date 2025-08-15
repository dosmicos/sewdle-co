import React from 'react';
import { OKRStatsCards } from '@/components/okr/OKRStatsCards';
import { OKRAlignmentTree } from '@/components/okr/OKRAlignmentTree';
import { QuarterSelector } from '@/components/okr/QuarterSelector';
import { OKRProgressChart } from '@/components/okr/OKRProgressChart';

export const OKROverviewPage = () => {
  return (
    <div className="space-y-6">
      {/* Quarter Selector */}
      <QuarterSelector showNavigation />
      
      {/* Overview Stats */}
      <OKRStatsCards variant="overview" />
      
      {/* Progress Chart */}
      <OKRProgressChart 
        variant="bar" 
        dataType="areas" 
        title="Progreso por Área" 
      />
      
      {/* Alignment Tree */}
      <OKRAlignmentTree showActions />
    </div>
  );
};