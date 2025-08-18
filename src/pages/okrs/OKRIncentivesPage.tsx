import React, { useState } from 'react';
import { IncentivesDashboard } from '@/components/okr/IncentivesDashboard';
import { QuarterSelector } from '@/components/okr/QuarterSelector';

export const OKRIncentivesPage = () => {
  const [selectedQuarter, setSelectedQuarter] = useState<string>();

  return (
    <div className="space-y-6">
      <QuarterSelector 
        selectedQuarter={selectedQuarter}
        onQuarterChange={setSelectedQuarter}
      />
      <IncentivesDashboard selectedQuarter={selectedQuarter} />
    </div>
  );
};