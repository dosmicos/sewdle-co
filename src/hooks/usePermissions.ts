import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Permission {
  module: string;
  actions: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
}

export const usePermissions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: permissions, isLoading, refetch } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return {};

      const { data, error } = await supabase.rpc('get_user_role_info', {
        user_uuid: user.id
      });

      if (error) {
        console.error('Error fetching user permissions:', error);
        return {};
      }

      return data?.[0]?.permissions || {};
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutos
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  const hasPermission = (module: string, action: string): boolean => {
    if (!permissions || !module || !action) return false;
    return permissions[module]?.[action] === true;
  };

  const reloadPermissions = async () => {
    await queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
    await refetch();
  };

  return {
    permissions: permissions || {},
    hasPermission,
    isLoading,
    reloadPermissions
  };
};
