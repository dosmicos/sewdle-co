
import React from 'react';
import AdminDashboard from '@/components/AdminDashboard';
import WorkshopDashboard from '@/components/WorkshopDashboard';
import DesignerDashboard from '@/components/DesignerDashboard';
import { useAuth } from '@/contexts/AuthContext';

const DashboardPage = () => {
  const { isAdmin, isDesigner } = useAuth();
  
  return (
    <div className="p-6" style={{ backgroundColor: '#ffffff', minHeight: '100vh' }}>
      {isAdmin() ? (
        <AdminDashboard />
      ) : isDesigner() ? (
        <DesignerDashboard />
      ) : (
        <WorkshopDashboard />
      )}
    </div>
  );
};

export default DashboardPage;
