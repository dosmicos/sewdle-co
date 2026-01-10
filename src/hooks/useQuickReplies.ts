import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface QuickReply {
  id: string;
  title: string;
  content: string;
}

export const useQuickReplies = (organizationId: string | undefined) => {
  const { data: quickReplies, isLoading } = useQuery({
    queryKey: ['quick-replies', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data: channel, error } = await supabase
        .from('messaging_channels')
        .select('ai_config')
        .eq('organization_id', organizationId)
        .eq('channel_type', 'whatsapp')
        .order('is_active', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      
      const aiConfig = channel?.ai_config as any;
      return (aiConfig?.quickReplies as QuickReply[]) || [];
    },
    enabled: !!organizationId,
  });

  return {
    quickReplies: quickReplies || [],
    isLoading,
  };
};
