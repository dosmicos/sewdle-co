
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from '@/components/AppSidebar';
import { Outlet } from 'react-router-dom';

const MainLayout = () => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1">
          <div className="p-4 border-b border-border bg-card/50 backdrop-blur-sm">
            <SidebarTrigger />
          </div>
          <div className="flex-1">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default MainLayout;
