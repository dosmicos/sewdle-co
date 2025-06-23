
import { useAuth } from '@/contexts/AuthContext';

export const useUserContext = () => {
  const { user, isAdmin } = useAuth();
  
  const getWorkshopFilter = () => {
    if (isAdmin()) {
      return null; // Admins ven todos los datos
    }
    return user?.workshopId; // Talleres solo ven sus datos
  };
  
  const getUserFilter = () => {
    if (isAdmin()) {
      return null; // Admins ven todos los datos
    }
    return user?.id; // Talleres solo ven sus datos
  };
  
  const isWorkshopUser = () => !isAdmin();
  
  return {
    workshopFilter: getWorkshopFilter(),
    userFilter: getUserFilter(),
    isWorkshopUser: isWorkshopUser(),
    isAdmin: isAdmin(),
    currentUser: user
  };
};
