import React from 'react';
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import AuthPage from "@/pages/AuthPage";
import LandingPage from "@/pages/LandingPage";
import SignupPage from "@/pages/SignupPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import MainLayout from "@/components/MainLayout";
import DashboardPage from "@/pages/DashboardPage";
import OrdersPage from "@/pages/OrdersPage";
import SuppliesPage from "@/pages/SuppliesPage";
import WorkshopsPage from "@/pages/WorkshopsPage";
import ProductsPage from "@/pages/ProductsPage";
import DeliveriesPage from "@/pages/DeliveriesPage";
import FinancialPage from "@/pages/FinancialPage";
import { ReplenishmentPage } from "@/pages/ReplenishmentPage";
import BillingPage from "@/pages/BillingPage";

import { ShopifyDashboardPage } from "@/pages/ShopifyDashboardPage";
import UsersRolesPage from "@/pages/UsersRolesPage";
import OrderDetailsPage from "@/pages/OrderDetailsPage";
import NotFound from "@/pages/NotFound";

// Create QueryClient instance outside of component to prevent recreation
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

// Componente para rutas que requieren rol de administrador
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  if (user?.role !== 'Administrador') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// Componente para rutas según permisos específicos
const PermissionRoute = ({ 
  children, 
  module, 
  action 
}: { 
  children: React.ReactNode;
  module: string;
  action: string;
}) => {
  const { user, loading, hasPermission } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  if (!hasPermission(module, action)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="/signup" element={!user ? <SignupPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route path="/" element={!user ? <LandingPage /> : <Navigate to="/dashboard" replace />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route path="dashboard" element={<DashboardPage />} />
        
        <Route path="orders" element={
          <PermissionRoute module="orders" action="view">
            <OrdersPage />
          </PermissionRoute>
        } />
        
        <Route path="orders/:orderId" element={
          <ProtectedRoute>
            <OrderDetailsPage />
          </ProtectedRoute>
        } />
        
        <Route path="supplies" element={
          <PermissionRoute module="insumos" action="view">
            <SuppliesPage />
          </PermissionRoute>
        } />
        
        <Route path="workshops" element={
          <PermissionRoute module="workshops" action="view">
            <WorkshopsPage />
          </PermissionRoute>
        } />
        
        <Route path="products" element={
          <PermissionRoute module="products" action="view">
            <ProductsPage />
          </PermissionRoute>
        } />
        
        <Route path="deliveries" element={
          <PermissionRoute module="deliveries" action="view">
            <DeliveriesPage />
          </PermissionRoute>
        } />
        
        <Route path="financial" element={
          <PermissionRoute module="finances" action="view">
            <FinancialPage />
          </PermissionRoute>
        } />
        
        <Route path="replenishment" element={
          <PermissionRoute module="replenishment" action="view">
            <ReplenishmentPage />
          </PermissionRoute>
        } />
        
        
        <Route path="shopify" element={
          <PermissionRoute module="shopify" action="view">
            <ShopifyDashboardPage />
          </PermissionRoute>
        } />
        
        <Route path="users-roles" element={
          <PermissionRoute module="users" action="view">
            <UsersRolesPage />
          </PermissionRoute>
        } />
        
        <Route path="settings/billing" element={<BillingPage />} />
      </Route>
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <AuthProvider>
            <OrganizationProvider>
            <Toaster 
              position="top-right"
              expand={true}
              richColors={true}
              closeButton={true}
              toastOptions={{
                style: {
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  padding: '16px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  zIndex: 999999
                },
                className: 'toast-custom'
              }}
            />
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
            </OrganizationProvider>
          </AuthProvider>
        </LanguageProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
