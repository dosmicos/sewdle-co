
import React from 'react';
import Dashboard from '@/components/Dashboard';
import { useUserContext } from '@/hooks/useUserContext';

const DashboardPage = () => {
  const { isAdmin } = useUserContext();
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          {isAdmin ? 'Dashboard General' : 'Mi Dashboard'}
        </h1>
        <p className="text-muted-foreground">
          {isAdmin 
            ? 'Vista general del sistema TextilFlow'
            : 'Vista general de mi taller'
          }
        </p>
      </div>
      <Dashboard />
    </div>
  );
};

export default DashboardPage;
