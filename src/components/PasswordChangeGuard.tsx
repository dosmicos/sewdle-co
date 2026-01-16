import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PasswordChangeModal from './PasswordChangeModal';

const PasswordChangeGuard = () => {
  const { user, session, markPasswordChanged } = useAuth();
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  
  useEffect(() => {
    const checkPasswordChangeRequired = async () => {
      // Si no hay sesión, no hay nada que verificar
      if (!session?.user?.id) {
        setMustChangePassword(false);
        setIsChecking(false);
        return;
      }
      
      // Fuente 1: user_metadata del JWT (señal más inmediata)
      const metadataFlag = session.user.user_metadata?.requires_password_change === true;
      
      // Fuente 2: AuthContext user (ya procesado)
      const contextFlag = user?.requiresPasswordChange === true;
      
      // Si cualquiera de las dos fuentes dice true, mostrar modal
      if (metadataFlag || contextFlag) {
        setMustChangePassword(true);
        setIsChecking(false);
        return;
      }
      
      // Fuente 3: Fallback - consultar directamente a profiles (más confiable pero async)
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('requires_password_change')
          .eq('id', session.user.id)
          .single();
        
        if (!error && profile?.requires_password_change === true) {
          setMustChangePassword(true);
        } else {
          setMustChangePassword(false);
        }
      } catch (err) {
        // En caso de error, usar las fuentes anteriores
        setMustChangePassword(metadataFlag || contextFlag);
      }
      
      setIsChecking(false);
    };
    
    checkPasswordChangeRequired();
  }, [session?.user?.id, session?.user?.user_metadata?.requires_password_change, user?.requiresPasswordChange]);
  
  const handleClose = async () => {
    // Actualización optimista: cerrar modal inmediatamente
    setMustChangePassword(false);
    // Luego marcar en BD
    await markPasswordChanged();
  };
  
  // No mostrar nada mientras verificamos
  if (isChecking) {
    return null;
  }
  
  return (
    <PasswordChangeModal
      isOpen={mustChangePassword}
      onClose={handleClose}
    />
  );
};

export default PasswordChangeGuard;
