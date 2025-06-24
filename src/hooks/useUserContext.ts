
import { useAuth } from '@/contexts/AuthContext';

export const useUserContext = () => {
  const { user, isAdmin, isDesigner, hasPermission } = useAuth();
  
  // Logging detallado para debugging
  console.log('useUserContext - Current user:', {
    id: user?.id,
    email: user?.email,
    role: user?.role,
    isAdminResult: isAdmin(),
    isDesignerResult: isDesigner(),
    workshopId: user?.workshopId,
    permissions: user?.permissions
  });
  
  const getWorkshopFilter = () => {
    const adminCheck = isAdmin();
    const designerCheck = isDesigner();
    
    console.log('useUserContext - getWorkshopFilter:', {
      isAdmin: adminCheck,
      isDesigner: designerCheck,
      shouldFilterByWorkshop: !adminCheck && !designerCheck
    });
    
    if (adminCheck || designerCheck) {
      return null; // Admins y diseñadores ven todos los datos
    }
    return user?.workshopId; // Talleres solo ven sus datos
  };
  
  const getUserFilter = () => {
    if (isAdmin() || isDesigner()) {
      return null; // Admins y diseñadores ven todos los datos
    }
    return user?.id; // Talleres solo ven sus datos
  };
  
  const isWorkshopUser = () => !isAdmin() && !isDesigner();
  
  // Helper para verificar permisos específicos
  const canCreateOrders = () => hasPermission('orders', 'create');
  const canEditOrders = () => hasPermission('orders', 'edit');
  const canDeleteOrders = () => hasPermission('orders', 'delete');
  const canViewOrders = () => hasPermission('orders', 'view');
  
  const contextResult = {
    workshopFilter: getWorkshopFilter(),
    userFilter: getUserFilter(),
    isWorkshopUser: isWorkshopUser(),
    isAdmin: isAdmin(),
    isDesigner: isDesigner(),
    currentUser: user,
    // Helpers de permisos
    canCreateOrders: canCreateOrders(),
    canEditOrders: canEditOrders(),
    canDeleteOrders: canDeleteOrders(),
    canViewOrders: canViewOrders()
  };
  
  console.log('useUserContext - Final context result:', contextResult);
  
  return contextResult;
};
