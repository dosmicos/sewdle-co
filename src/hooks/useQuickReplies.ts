import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface QuickReply {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
}

// Default quick replies when none are configured
const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  {
    id: 'default-1',
    title: '👋 Saludo',
    content: '¡Hola! Gracias por contactarnos. ¿En qué puedo ayudarte hoy?'
  },
  {
    id: 'default-2',
    title: '📦 Envíos',
    content: 'Realizamos envíos a todo el país. El tiempo de entrega es de 3-5 días hábiles.'
  },
  {
    id: 'default-3',
    title: '💳 Pagos',
    content: 'Aceptamos pagos con tarjeta de crédito, débito, transferencia bancaria y efectivo.'
  }
];

export const useQuickReplies = (organizationId: string | undefined) => {
  const { data: quickReplies, isLoading } = useQuery({
    queryKey: ['quick-replies', organizationId],
    queryFn: async () => {
      if (!organizationId) return DEFAULT_QUICK_REPLIES;
      
      const { data: channel, error } = await supabase
        .from('messaging_channels')
        .select('ai_config')
        .eq('organization_id', organizationId)
        .eq('channel_type', 'whatsapp')
        .order('is_active', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      
      const aiConfig = channel?.ai_config as Record<string, unknown>;
      const dbReplies = (aiConfig?.quickReplies as QuickReply[]) || [];
      
      // Return DB replies if they exist, otherwise return defaults
      return dbReplies.length > 0 ? dbReplies : DEFAULT_QUICK_REPLIES;
    },
    enabled: !!organizationId,
  });

  return {
    quickReplies: quickReplies || DEFAULT_QUICK_REPLIES,
    isLoading,
  };
};
