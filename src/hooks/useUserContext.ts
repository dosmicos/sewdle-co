
import { useAuth } from '@/contexts/AuthContext';

export const useUserContext = () => {
  const { user, isAdmin, isDesigner, isQCLeader, hasPermission } = useAuth();
  
  // Determinar tipo de usuario basado en rol
  const getUserType = () => {
    if (!user) return 'guest';
    
    // Roles que ven toda la organización (acceso completo)
    const fullAccessRoles = ['Administrador', 'Diseñador', 'Líder QC'];
    if (fullAccessRoles.includes(user.role)) {
      return 'full_access';
    }
    
    // Usuarios de taller (acceso limitado a su taller)
    return 'workshop';
  };
  
  const getWorkshopFilter = () => {
    // Solo usuarios de taller tienen filtro
    const userType = getUserType();
    if (userType === 'full_access') {
      return null; // Sin filtro - ven toda la organización
    }
    return user?.workshopId; // Filtrado por taller asignado
  };
  
  const getUserFilter = () => {
    // Solo usuarios de taller tienen filtro
    const userType = getUserType();
    if (userType === 'full_access') {
      return null; // Sin filtro - ven todos los usuarios
    }
    return user?.id; // Filtrado por usuario específico
  };
  
  const isWorkshopUser = () => getUserType() === 'workshop';
  
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
    isQCLeader: isQCLeader(),
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
