
import React from 'react';
import AdminDashboard from '@/components/AdminDashboard';
import WorkshopDashboard from '@/components/WorkshopDashboard';
import { useAuth } from '@/contexts/AuthContext';

const DashboardPage = () => {
  const { isAdmin } = useAuth();
  
  return (
    <div className="p-6">
      {isAdmin() ? <AdminDashboard /> : <WorkshopDashboard />}
    </div>
  );
};

export default DashboardPage;
