
import React from 'react';
import AdminDashboard from '@/components/AdminDashboard';
import WorkshopDashboard from '@/components/WorkshopDashboard';
import DesignerDashboard from '@/components/DesignerDashboard';
import { OrganizationGuard } from '@/components/OrganizationGuard';
import { OrganizationStats } from '@/components/OrganizationStats';
import { useAuth } from '@/contexts/AuthContext';

const DashboardPage = () => {
  const { isAdmin, isDesigner } = useAuth();
  
  return (
    <OrganizationGuard>
      <div className="p-6 space-y-6" style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
        <OrganizationStats />
        {isAdmin() ? (
          <AdminDashboard />
        ) : isDesigner() ? (
          <DesignerDashboard />
        ) : (
          <WorkshopDashboard />
        )}
      </div>
    </OrganizationGuard>
  );
};

export default DashboardPage;
