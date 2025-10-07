
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from './usePermissions';

export const useUserContext = () => {
  const { user, isAdmin, isDesigner, isQCLeader } = useAuth();
  const { hasPermission } = usePermissions();
  
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
  
  return {
    workshopFilter: getWorkshopFilter(),
    userFilter: getUserFilter(),
    isWorkshopUser: isWorkshopUser(),
    isAdmin: isAdmin(),
    isDesigner: isDesigner(),
    isQCLeader: isQCLeader(),
    currentUser: user,
    // Helpers de permisos de órdenes
    canCreateOrders: hasPermission('orders', 'create'),
    canEditOrders: hasPermission('orders', 'edit'),
    canDeleteOrders: hasPermission('orders', 'delete'),
    canViewOrders: hasPermission('orders', 'view'),
    // Helpers de permisos de entregas
    canCreateDeliveries: hasPermission('deliveries', 'create'),
    canEditDeliveries: hasPermission('deliveries', 'edit'),
    canDeleteDeliveries: hasPermission('deliveries', 'delete'),
    canViewDeliveries: hasPermission('deliveries', 'view')
  };
};
