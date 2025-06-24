
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useUserTracking = () => {
  // Función para registrar el último acceso del usuario actual
  const trackUserLogin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Actualizar el último acceso en el perfil del usuario
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            email: user.email,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          });
      }
    } catch (error) {
      console.error('Error tracking user login:', error);
    }
  };

  // Función para obtener el último acceso de un usuario específico
  const getLastAccess = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('updated_at')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      return data?.updated_at ? new Date(data.updated_at).toLocaleDateString() : 'Nunca';
    } catch (error) {
      console.error('Error getting last access:', error);
      return 'Error';
    }
  };

  return {
    trackUserLogin,
    getLastAccess
  };
};
