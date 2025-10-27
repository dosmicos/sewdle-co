import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useOrganization } from '@/contexts/OrganizationContext';
import { OrganizationSelector } from './OrganizationSelector';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';
import { LayoutDashboard, FileText, Building2, Package, Truck, LogOut, User, Users, Package2, Palette, Shield, DollarSign, Brain, TrendingUp, ShoppingCart, Settings, ChevronDown, Target, UserPlus, Calculator, PackageSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useNavigate, useLocation } from 'react-router-dom';

import { useIsDosmicos } from '@/hooks/useIsDosmicos';

const AppSidebar = () => {
  const { user, logout, isAdmin, isDesigner, isQCLeader } = useAuth();
  const { hasPermission } = usePermissions();
  const { canAccessFeature } = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Verificar si es organización Dosmicos para mostrar OKRs
  const { isDosmicos } = useIsDosmicos();
  
  const adminMenuItems = [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
    ...(isDosmicos ? [{ title: 'OKRs', url: '/okrs', icon: Target }] : []),
    { title: 'Órdenes', url: '/orders', icon: FileText },
    { title: 'Insumos', url: '/supplies', icon: Package2 },
    { title: 'Talleres', url: '/workshops', icon: Building2 },
    { title: 'Productos', url: '/products', icon: Package },
    { title: 'Entregas', url: '/deliveries', icon: Truck },
    
    { title: 'Shopify', url: '/shopify', icon: ShoppingCart },
    { title: 'Reposición IA', url: '/replenishment', icon: Brain },
    { title: 'Reclutamiento', url: '/prospects', icon: UserPlus },
    { title: 'Finanzas', url: '/financial', icon: DollarSign },
    { title: 'Usuarios & Roles', url: '/users-roles', icon: Users }
  ];
  
  const workshopMenuItems = [
    { title: 'Mi Dashboard', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Mis Órdenes', url: '/orders', icon: FileText },
    { title: 'Mis Insumos', url: '/supplies', icon: Package2 },
    { title: 'Mis Entregas', url: '/deliveries', icon: Truck }
  ];

  const designerMenuItems = [
    { title: 'Mi Dashboard', url: '/dashboard', icon: LayoutDashboard },
    ...(isDosmicos ? [{ title: 'OKRs', url: '/okrs', icon: Target }] : []),
    { title: 'Órdenes', url: '/orders', icon: FileText },
    { title: 'Insumos', url: '/supplies', icon: Package2 },
    { title: 'Productos', url: '/products', icon: Package },
    { title: 'Talleres', url: '/workshops', icon: Building2 },
    { title: 'Entregas', url: '/deliveries', icon: Truck },
    { title: 'Reposición IA', url: '/replenishment', icon: Brain },
    { title: 'Reclutamiento', url: '/prospects', icon: UserPlus },
    { title: 'Finanzas', url: '/financial', icon: DollarSign },
    { title: 'Shopify', url: '/shopify', icon: ShoppingCart }
  ];

  const qcLeaderMenuItems = [
    { title: 'Mi Dashboard', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Órdenes', url: '/orders', icon: FileText },
    { title: 'Talleres', url: '/workshops', icon: Building2 },
    { title: 'Entregas', url: '/deliveries', icon: Truck },
    { title: 'Picking & Packing', url: '/picking-packing', icon: PackageSearch }
  ];
  
  // Determinar qué menú mostrar según el rol
  let menuItems = [];
  let userTypeLabel = '';
  let userIcon = Building2;
  
  if (isAdmin()) {
    menuItems = adminMenuItems;
    userTypeLabel = 'Administrador';
    userIcon = Building2;
  } else if (isDesigner()) {
    menuItems = designerMenuItems.filter(item => {
      // Filtrar elementos del menú según permisos específicos
      switch (item.url) {
        case '/orders':
          return hasPermission('orders', 'view');
        case '/supplies':
          return hasPermission('insumos', 'view') && canAccessFeature('orders');
        case '/products':
          return hasPermission('products', 'view') && canAccessFeature('orders');
        case '/workshops':
          return hasPermission('workshops', 'view') && canAccessFeature('workshops');
        case '/deliveries':
          return hasPermission('deliveries', 'view') && canAccessFeature('orders');
        case '/replenishment':
          return hasPermission('replenishment', 'view') && canAccessFeature('advanced_analytics');
        case '/financial':
          return hasPermission('finances', 'view') && canAccessFeature('financial_reports');
        case '/shopify':
          return hasPermission('shopify', 'view') && canAccessFeature('shopify_integration');
        default:
          return true;
      }
    });
    userTypeLabel = 'Diseñador';
    userIcon = Palette;
  } else if (isQCLeader()) {
    menuItems = qcLeaderMenuItems;
    userTypeLabel = 'Líder QC';
    userIcon = Shield;
  } else {
    // Usuario tipo Taller
    menuItems = workshopMenuItems;
    userTypeLabel = 'Taller';
    userIcon = Building2;
  }
  
  const handleNavigation = (url: string) => {
    navigate(url);
  };
  
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Sidebar 
      className="border-r" 
      style={{ 
        backgroundColor: '#ffffff', 
        borderColor: '#e5e7eb',
        color: '#374151'
      }}
    >
      <SidebarHeader className="p-4" style={{ backgroundColor: '#ffffff' }}>
        <div className="flex flex-col items-start space-y-3">
          <div className="w-26 h-auto flex items-center justify-center">
            <img 
              src="/lovable-uploads/d2dedee3-0aae-4a76-a4e5-67f498c643ba.png" 
              alt="Sewdle Logo" 
              className="w-24 h-auto object-contain"
              onError={(e) => {
                // Fallback to user icon if logo fails to load
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="w-14 h-14 rounded-lg hidden items-center justify-center" style={{ backgroundColor: '#3B82F6' }}>
              {React.createElement(userIcon, { className: "w-8 h-8", style: { color: '#ffffff' } })}
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium" style={{ color: '#6b7280' }}>
              {userTypeLabel}
            </p>
          </div>
          <div className="w-full">
            <OrganizationSelector />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent style={{ backgroundColor: '#ffffff' }}>
        <SidebarGroup>
          <SidebarGroupLabel style={{ color: '#374151' }}>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => handleNavigation(item.url)}
                    isActive={location.pathname === item.url}
                    className="w-full justify-start"
                    style={{ 
                      backgroundColor: location.pathname === item.url ? '#f3f4f6' : '#ffffff',
                      color: '#374151',
                      borderColor: 'transparent'
                    }}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4" style={{ backgroundColor: '#ffffff' }}>
        <div className="space-y-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-between p-3 h-auto"
                style={{ backgroundColor: '#f9fafb' }}
              >
                <div className="flex items-center space-x-3">
                  <User className="w-8 h-8" style={{ color: '#6b7280' }} />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate" style={{ color: '#1f2937' }}>{user?.name || user?.email}</p>
                    <p className="text-xs truncate" style={{ color: '#6b7280' }}>{user?.email}</p>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4" style={{ color: '#6b7280' }} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => handleNavigation('/settings/billing')}>
                <Settings className="w-4 h-4 mr-2" />
                Plan & Facturación
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
