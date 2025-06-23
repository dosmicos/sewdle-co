import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter } from '@/components/ui/sidebar';
import { LayoutDashboard, FileText, Building2, Package, Truck, LogOut, User, Users, Package2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';

const AppSidebar = () => {
  const { user, logout, isAdmin, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const adminMenuItems = [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Órdenes', url: '/orders', icon: FileText },
    { title: 'Insumos', url: '/supplies', icon: Package2 },
    { title: 'Talleres', url: '/workshops', icon: Building2 },
    { title: 'Productos', url: '/products', icon: Package },
    { title: 'Entregas', url: '/deliveries', icon: Truck },
    { title: 'Usuarios & Roles', url: '/users-roles', icon: Users }
  ];
  
  const workshopMenuItems = [
    { title: 'Mi Dashboard', url: '/dashboard', icon: LayoutDashboard },
    { title: 'Mis Órdenes', url: '/orders', icon: FileText },
    { title: 'Mis Insumos', url: '/supplies', icon: Package2 },
    { title: 'Mis Entregas', url: '/deliveries', icon: Truck }
  ];
  
  // Use isAdmin() function instead of direct role comparison
  const menuItems = isAdmin() ? adminMenuItems : workshopMenuItems;
  
  const handleNavigation = (url: string) => {
    navigate(url);
  };
  
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">TextilFlow</h2>
            <p className="text-xs text-muted-foreground">
              {isAdmin() ? 'Administrador' : 'Taller'}
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => handleNavigation(item.url)}
                    isActive={location.pathname === item.url}
                    className="w-full justify-start"
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

      <SidebarFooter className="p-4">
        <div className="space-y-3">
          <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-xl">
            <User className="w-8 h-8 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || user?.email}</p>
              <p className="text-xs truncate text-gray-800">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout} className="w-full justify-start">
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
