import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useOrganization } from '@/contexts/OrganizationContext';
import { OrganizationSelector } from './OrganizationSelector';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';
import { LayoutDashboard, FileText, Building2, Package, Truck, LogOut, User, Users, Package2, Palette, Shield, DollarSign, Brain, TrendingUp, ShoppingCart, Settings, ChevronDown, Target, UserPlus, Calculator, PackageSearch, Receipt, MessageSquare, Wifi, Camera } from 'lucide-react';
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
  
  // Definir todos los items del menú con sus permisos requeridos
  const allMenuItems = [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, module: 'dashboard', alwaysShow: true },
    ...(isDosmicos ? [{ title: 'OKRs', url: '/okrs', icon: Target, module: 'okrs', alwaysShow: false }] : []),
    { title: 'Órdenes', url: '/orders', icon: FileText, module: 'orders', alwaysShow: false },
    { title: 'Insumos', url: '/supplies', icon: Package2, module: 'insumos', alwaysShow: false },
    { title: 'Talleres', url: '/workshops', icon: Building2, module: 'workshops', alwaysShow: false },
    { title: 'Productos', url: '/products', icon: Package, module: 'products', alwaysShow: false },
    { title: 'Entregas', url: '/deliveries', icon: Truck, module: 'deliveries', alwaysShow: false },
    { title: 'Picking & Packing', url: '/picking-packing', icon: PackageSearch, module: 'picking', alwaysShow: false },
    { title: 'Shopify', url: '/shopify', icon: ShoppingCart, module: 'shopify', alwaysShow: false },
    { title: 'Reposición IA', url: '/replenishment', icon: Brain, module: 'replenishment', alwaysShow: false },
    { title: 'Reclutamiento', url: '/prospects', icon: UserPlus, module: 'recruitment', alwaysShow: false },
    { title: 'Finanzas', url: '/financial', icon: DollarSign, module: 'finances', alwaysShow: false },
    { title: 'Alegra', url: '/alegra', icon: Receipt, module: 'alegra', alwaysShow: false },
    { title: 'Mensajería IA', url: '/whatsapp-ai', icon: MessageSquare, module: 'messaging', alwaysShow: false },
    { title: 'UGC Creators', url: '/ugc-creators', icon: Camera, module: 'ugc', alwaysShow: false },
    { title: 'APIs', url: '/apis', icon: Wifi, module: 'apis', alwaysShow: false },
    { title: 'Usuarios & Roles', url: '/users-roles', icon: Users, module: 'users', alwaysShow: false }
  ];

  // Mapeo de módulos del menú a nombres de permisos en la DB (en minúsculas, como están en la DB)
  const moduleToPermissionMap: Record<string, string> = {
    'dashboard': 'dashboard',
    'orders': 'orders',
    'insumos': 'insumos',
    'workshops': 'workshops',
    'products': 'products',
    'deliveries': 'deliveries',
    'picking': 'picking y packing',
    'shopify': 'shopify',
    'replenishment': 'replenishment',
    'recruitment': 'prospects',
    'finances': 'finances',
    'messaging': 'messaging',
    'ugc': 'ugc',
    'users': 'users',
    'alegra': 'alegra',
    'apis': 'apis'
  };

  // Función para verificar si el usuario tiene permiso para ver un módulo
  const canViewModule = (module: string): boolean => {
    // Admins ven todo
    if (isAdmin()) return true;
    
    // Buscar el nombre del permiso correspondiente
    const permissionName = moduleToPermissionMap[module];
    if (!permissionName) return false;
    
    return hasPermission(permissionName, 'view');
  };

  // Filtrar items del menú según permisos
  let menuItems = [];
  let userTypeLabel = '';
  let userIcon = Building2;

  if (isAdmin()) {
    // Administradores ven todo
    menuItems = allMenuItems;
    userTypeLabel = 'Administrador';
    userIcon = Building2;
  } else if (isDesigner() || isQCLeader()) {
    // Diseñadores y Líderes QC usan permisos pero con menú completo filtrado
    menuItems = allMenuItems.filter(item => item.alwaysShow || canViewModule(item.module));
    userTypeLabel = isDesigner() ? 'Diseñador' : 'Líder QC';
    userIcon = isDesigner() ? Palette : Shield;
  } else {
    // Otros roles (Atención al Cliente, Calidad, etc.) usan permisos dinámicos
    menuItems = allMenuItems.filter(item => item.alwaysShow || canViewModule(item.module));
    userTypeLabel = user?.role || 'Usuario';
    userIcon = Building2;
  }
  
  const handleNavigation = (url: string) => {
    // Abrir en nueva pestaña para rutas independientes
    if (url === '/whatsapp-ai' || url === '/picking-packing') {
      window.open(url, '_blank');
      return;
    }
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
