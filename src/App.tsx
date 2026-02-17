import React, { Suspense, lazy } from 'react';
import { Toaster } from "sonner";
import { Toaster as ShadcnToaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { LanguageProvider } from "@/contexts/LanguageContext";

const AuthPage = lazy(() => import("@/pages/AuthPage"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const SignupPage = lazy(() => import("@/pages/SignupPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const PasswordChangePage = lazy(() => import("@/pages/PasswordChangePage"));
const PasswordChangeRouteGuard = lazy(() => import("@/components/PasswordChangeRouteGuard"));
const MainLayout = lazy(() => import("@/components/MainLayout"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const OrdersPage = lazy(() => import("@/pages/OrdersPage"));
const SuppliesPage = lazy(() => import("@/pages/SuppliesPage"));
const WorkshopsPage = lazy(() => import("@/pages/WorkshopsPage"));
const ProductsPage = lazy(() => import("@/pages/ProductsPage"));
const DeliveriesPage = lazy(() => import("@/pages/DeliveriesPage"));
const DeliveryDetailsPage = lazy(() => import("@/pages/DeliveryDetailsPage"));
const FinancialPage = lazy(() => import("@/pages/FinancialPage"));
const ReplenishmentPage = lazy(() =>
  import("@/pages/ReplenishmentPage").then((module) => ({
    default: module.ReplenishmentPage,
  }))
);
const BillingPage = lazy(() => import("@/pages/BillingPage"));
const OKRsPage = lazy(() => import("@/pages/OKRsPage"));
const AlegraPage = lazy(() => import("@/pages/AlegraPage"));
const MessagingAIPage = lazy(() => import("@/pages/MessagingAIPage"));
const ApisStatusPage = lazy(() => import("@/pages/ApisStatusPage"));
const ShopifyDashboardPage = lazy(() =>
  import("@/pages/ShopifyDashboardPage").then((module) => ({
    default: module.ShopifyDashboardPage,
  }))
);
const UsersRolesPage = lazy(() => import("@/pages/UsersRolesPage"));
const OrderDetailsPage = lazy(() => import("@/pages/OrderDetailsPage"));
const ProspectsPage = lazy(() => import("@/pages/ProspectsPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const PickingPackingPage = lazy(() => import("@/pages/PickingPackingPage"));
const PrintableOrderView = lazy(() => import("@/pages/PrintableOrderView"));
const UgcCreatorsPage = lazy(() => import("@/pages/UgcCreatorsPage"));
const UgcUploadPage = lazy(() => import("@/pages/UgcUploadPage"));

// Create QueryClient instance outside of component to prevent recreation
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
    },
  },
});

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
  const { user, loading: authLoading } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  
  if (authLoading || permissionsLoading) {
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
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }
    >
      <Routes>
        {/* Rutas públicas */}
        <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/dashboard" replace />} />
        <Route path="/signup" element={!user ? <SignupPage /> : <Navigate to="/dashboard" replace />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<Navigate to="/auth" replace />} />
        <Route path="/" element={!user ? <LandingPage /> : <Navigate to="/dashboard" replace />} />
        <Route path="/upload/:token" element={<UgcUploadPage />} />
        
        {/* Ruta de cambio de contraseña obligatorio - NO protegida por PasswordChangeRouteGuard */}
        <Route path="/password-change" element={
          user ? <PasswordChangePage /> : <Navigate to="/auth" replace />
        } />
        
        {/* Rutas protegidas con enforcement de cambio de contraseña */}
        <Route path="/" element={
          <PasswordChangeRouteGuard>
            <MainLayout />
          </PasswordChangeRouteGuard>
        }>
          <Route path="dashboard" element={<DashboardPage />} />
          
          <Route path="orders" element={
            <PermissionRoute module="orders" action="view">
              <OrdersPage />
            </PermissionRoute>
          } />
          
          <Route path="orders/:orderId" element={<OrderDetailsPage />} />
          
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
          
          <Route path="deliveries/:deliveryId" element={
            <PermissionRoute module="deliveries" action="view">
              <DeliveryDetailsPage />
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
          
          <Route path="prospects" element={
            <PermissionRoute module="prospects" action="view">
              <ProspectsPage />
            </PermissionRoute>
          } />
          
          <Route path="okrs/*" element={<OKRsPage />} />
          
          <Route path="ugc-creators" element={
            <PermissionRoute module="ugc" action="view">
              <UgcCreatorsPage />
            </PermissionRoute>
          } />
          
          <Route path="alegra" element={
            <AdminRoute>
              <AlegraPage />
            </AdminRoute>
          } />
          
          <Route path="apis" element={
            <AdminRoute>
              <ApisStatusPage />
            </AdminRoute>
          } />
        </Route>
        
        {/* Mensajería IA - Layout independiente con guard de permisos */}
        <Route path="whatsapp-ai" element={
          <PasswordChangeRouteGuard>
            <PermissionRoute module="messaging" action="view">
              <MessagingAIPage />
            </PermissionRoute>
          </PasswordChangeRouteGuard>
        } />
        
        {/* Picking & Packing - Layout independiente con guard */}
        <Route path="picking-packing" element={
          <PasswordChangeRouteGuard>
            <PermissionRoute module="picking y packing" action="view">
              <PickingPackingPage />
            </PermissionRoute>
          </PasswordChangeRouteGuard>
        } />
        
        <Route path="picking-packing/print/:orderId" element={
          <PasswordChangeRouteGuard>
            <PermissionRoute module="picking y packing" action="view">
              <PrintableOrderView />
            </PermissionRoute>
          </PasswordChangeRouteGuard>
        } />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
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
            <ShadcnToaster />
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
