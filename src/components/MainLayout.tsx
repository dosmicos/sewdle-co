
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
      </div>
    </SidebarProvider>
  );
};

export default MainLayout;
