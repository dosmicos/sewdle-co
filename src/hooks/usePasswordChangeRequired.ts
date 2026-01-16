import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que determina si el usuario actual debe cambiar su contraseña.
 * Fuentes de verdad (en orden de prioridad):
 * 1. session.user.user_metadata.requires_password_change (señal inmediata del JWT)
 * 2. RPC get_password_change_required() (fuente definitiva en BD)
 */
export const usePasswordChangeRequired = () => {
  const { session } = useAuth();
  
  // Señal inmediata del JWT/metadata
  const metadataFlag = session?.user?.user_metadata?.requires_password_change === true;
  
  // Query a la función RPC para obtener el estado definitivo
  const { data: rpcFlag, isLoading, error } = useQuery({
    queryKey: ['password-change-required', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return false;
      
      const { data, error } = await supabase.rpc('get_password_change_required');
      
      if (error) {
        console.error('[usePasswordChangeRequired] RPC error:', error);
        // En caso de error, confiar en metadata
        return metadataFlag;
      }
      
      return data === true;
    },
    enabled: !!session?.user?.id,
    staleTime: 30000, // 30 segundos
    refetchOnWindowFocus: false,
  });
  
  // Si no hay sesión, no requiere cambio
  if (!session?.user?.id) {
    return {
      mustChangePassword: false,
      isLoading: false,
    };
  }
  
  // Mientras carga el RPC, usar metadata como indicador inicial
  if (isLoading) {
    return {
      mustChangePassword: metadataFlag,
      isLoading: true,
    };
  }
  
  // Resultado final: true si cualquiera de las fuentes dice true
  const mustChangePassword = metadataFlag || rpcFlag === true;
  
  return {
    mustChangePassword,
    isLoading: false,
    error,
  };
};
