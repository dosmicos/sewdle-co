
import { useAuth } from '@/contexts/AuthContext';

export const useUserContext = () => {
  const { user, isAdmin, isDesigner, hasPermission } = useAuth();
  
  const getWorkshopFilter = () => {
    // Solo los usuarios con rol "Taller" (no admin ni diseñador) tienen filtro
    if (isAdmin() || isDesigner()) {
      return null; // Admins y diseñadores ven todos los datos
    }
    return user?.workshopId; // Solo talleres ven sus datos filtrados
  };
  
  const getUserFilter = () => {
    // Solo los usuarios con rol "Taller" (no admin ni diseñador) tienen filtro
    if (isAdmin() || isDesigner()) {
      return null; // Admins y diseñadores ven todos los datos
    }
    return user?.id; // Solo talleres ven sus datos filtrados
  };
  
  const isWorkshopUser = () => !isAdmin() && !isDesigner();
  
  // Helper para verificar permisos específicos de órdenes
  const canCreateOrders = () => hasPermission('orders', 'create');
  const canEditOrders = () => hasPermission('orders', 'edit');
  const canDeleteOrders = () => hasPermission('orders', 'delete');
  const canViewOrders = () => hasPermission('orders', 'view');
  
  // Helper para verificar permisos específicos de entregas
  const canCreateDeliveries = () => hasPermission('deliveries', 'create');
  const canEditDeliveries = () => hasPermission('deliveries', 'edit');
  const canDeleteDeliveries = () => hasPermission('deliveries', 'delete');
  const canViewDeliveries = () => hasPermission('deliveries', 'view');
  
  return {
    workshopFilter: getWorkshopFilter(),
    userFilter: getUserFilter(),
    isWorkshopUser: isWorkshopUser(),
    isAdmin: isAdmin(),
    isDesigner: isDesigner(),
    currentUser: user,
    // Helpers de permisos de órdenes
    canCreateOrders: canCreateOrders(),
    canEditOrders: canEditOrders(),
    canDeleteOrders: canDeleteOrders(),
    canViewOrders: canViewOrders(),
    // Helpers de permisos de entregas
    canCreateDeliveries: canCreateDeliveries(),
    canEditDeliveries: canEditDeliveries(),
    canDeleteDeliveries: canDeleteDeliveries(),
    canViewDeliveries: canViewDeliveries()
  };
};
