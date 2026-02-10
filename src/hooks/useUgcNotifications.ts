import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface UgcNotification {
  id: string;
  organization_id: string;
  campaign_id: string;
  creator_id: string;
  type: 'producto_entregado' | 'contactar_creador';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export const useUgcNotifications = () => {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['ugc-notifications', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('ugc_notifications')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as UgcNotification[];
    },
    enabled: !!orgId,
    refetchInterval: 60000,
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ugc_notifications')
        .update({ read: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-notifications'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!orgId) return;
      const { error } = await supabase
        .from('ugc_notifications')
        .update({ read: true })
        .eq('organization_id', orgId)
        .eq('read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ugc-notifications'] });
    },
  });

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead };
};
