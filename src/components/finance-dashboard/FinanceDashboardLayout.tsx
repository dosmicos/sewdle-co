import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import FinanceSidebar from './FinanceSidebar';

interface FinanceDashboardLayoutProps {
  children: React.ReactNode;
  activeSection?: string;
  onOpenSettings?: () => void;
}

const FinanceDashboardLayout: React.FC<FinanceDashboardLayoutProps> = ({ children, activeSection, onOpenSettings }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-[#fafbfc]">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <FinanceSidebar
          activeSection={activeSection}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onOpenSettings={onOpenSettings}
        />
      </div>
      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <button
            className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white shadow-md border border-gray-200"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5 text-gray-600" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-[220px]">
          <FinanceSidebar
            activeSection={activeSection}
            onOpenSettings={() => { onOpenSettings?.(); setMobileOpen(false); }}
          />
        </SheetContent>
      </Sheet>
      <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export default FinanceDashboardLayout;
