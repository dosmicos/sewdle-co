
import React from 'react';
import AdminDashboard from '@/components/AdminDashboard';
import WorkshopDashboard from '@/components/WorkshopDashboard';
import DesignerDashboard from '@/components/DesignerDashboard';
import { OrganizationGuard } from '@/components/OrganizationGuard';
import { useAuth } from '@/contexts/AuthContext';

const DashboardPage = () => {
  const { isAdmin, isDesigner, isQCLeader } = useAuth();
  
  return (
    <OrganizationGuard>
      <div className="p-6 space-y-6" style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
        {isAdmin() || isDesigner() || isQCLeader() ? (
          <AdminDashboard />
        ) : (
          <WorkshopDashboard />
        )}
      </div>
    </OrganizationGuard>
  );
};

export default DashboardPage;
