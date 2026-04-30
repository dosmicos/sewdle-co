import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface CartRecoveryAttempt {
  id: string;
  cart_id: string | null;
  step: number | null;
  template_name: string | null;
  whatsapp_message_id: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error: string | null;
}

export interface CartRecoveryAttemptStats {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  deliveryRate: number;
  readRate: number;
  errorCount: number;
}

export function useCartRecoveryAttempts(daysWindow = 30) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: ['cart-recovery-attempts', orgId, daysWindow],
    enabled: !!orgId,
    refetchInterval: 60_000,
    queryFn: async () => {
      if (!orgId) return { attempts: [] as CartRecoveryAttempt[], stats: emptyStats() };

      const since = new Date(Date.now() - daysWindow * 86_400_000).toISOString();

      const { data, error } = await supabase
        .from('cart_recovery_attempts')
        .select('id, cart_id, step, template_name, whatsapp_message_id, sent_at, delivered_at, read_at, error')
        .eq('organization_id', orgId)
        .gte('sent_at', since)
        .order('sent_at', { ascending: false });

      if (error) throw error;

      const attempts = (data || []) as CartRecoveryAttempt[];

      const totalSent = attempts.filter(a => a.sent_at && !a.error).length;
      const totalDelivered = attempts.filter(a => !!a.delivered_at).length;
      const totalRead = attempts.filter(a => !!a.read_at).length;
      const errorCount = attempts.filter(a => !!a.error).length;
      const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
      const readRate = totalSent > 0 ? (totalRead / totalSent) * 100 : 0;

      const stats: CartRecoveryAttemptStats = {
        totalSent,
        totalDelivered,
        totalRead,
        deliveryRate,
        readRate,
        errorCount,
      };

      return { attempts, stats };
    },
  });
}

function emptyStats(): CartRecoveryAttemptStats {
  return {
    totalSent: 0,
    totalDelivered: 0,
    totalRead: 0,
    deliveryRate: 0,
    readRate: 0,
    errorCount: 0,
  };
}
