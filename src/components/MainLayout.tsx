
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from '@/components/AppSidebar';
import { Outlet } from 'react-router-dom';
import SewdleCopilot from '@/components/copilot/SewdleCopilot';

const MainLayout = () => {
  const { user } = useAuth();
  const { isLoading } = useOrganization();
  
  if (!user) {
    return null;
  }

  // Show loading state while organization context is initializing
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full" style={{ backgroundColor: '#ffffff' }}>
        <AppSidebar />
        <main className="flex-1" style={{ backgroundColor: '#ffffff' }}>
          <div className="p-4 border-b" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
            <SidebarTrigger />
          </div>
          <div className="flex-1" style={{ backgroundColor: '#ffffff' }}>
            <Outlet />
          </div>
        </main>
        <SewdleCopilot />
      </div>
    </SidebarProvider>
  );
};

export default MainLayout;
