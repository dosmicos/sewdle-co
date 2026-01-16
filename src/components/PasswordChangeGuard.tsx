import { useAuth } from '@/contexts/AuthContext';
import PasswordChangeModal from './PasswordChangeModal';

const PasswordChangeGuard = () => {
  const { user, markPasswordChanged } = useAuth();
  
  // Mostrar modal solo si hay usuario autenticado que requiere cambio
  const showModal = user?.requiresPasswordChange === true;
  
  // Debug log para verificar el estado
  if (import.meta.env.DEV && user) {
    console.log('[PasswordChangeGuard] User:', user.email, 'requiresPasswordChange:', user.requiresPasswordChange);
  }
  
  const handleClose = async () => {
    await markPasswordChanged();
  };
  
  return (
    <PasswordChangeModal
      isOpen={showModal}
      onClose={handleClose}
    />
  );
};

export default PasswordChangeGuard;
