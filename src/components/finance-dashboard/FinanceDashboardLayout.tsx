import React, { useState } from 'react';
import FinanceSidebar from './FinanceSidebar';

interface FinanceDashboardLayoutProps {
  children: React.ReactNode;
  activeSection?: string;
  onOpenSettings?: () => void;
}

const FinanceDashboardLayout: React.FC<FinanceDashboardLayoutProps> = ({ children, activeSection, onOpenSettings }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-[#fafbfc]">
      <FinanceSidebar
        activeSection={activeSection}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenSettings={onOpenSettings}
      />
      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export default FinanceDashboardLayout;
