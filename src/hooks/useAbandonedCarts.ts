import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface AbandonedCart {
  id: string;
  shopify_cart_token: string;
  email: string | null;
  phone: string | null;
  customer_first_name: string | null;
  total_price: number | null;
  currency: string | null;
  recovery_url: string | null;
  shopify_created_at: string | null;
  is_abandoned: boolean;
  abandoned_at: string | null;
  recovered_at: string | null;
  recovery_order_id: string | null;
  last_message_step: number | null;
  last_message_sent_at: string | null;
  opted_out: boolean;
  line_items: any;
}

export interface CartRecoveryStats {
  totalCarts: number;
  abandonedCarts: number;
  messagesSent: number;
  recoveredCarts: number;
  optedOutCarts: number;
  recoveryRate: number;
  recoveredGmv: number;
  abandonedGmv: number;
}

const DAYS_WINDOW = 30;

export function useAbandonedCarts() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: ['abandoned-carts', orgId],
    enabled: !!orgId,
    refetchInterval: 60 * 1000,
    queryFn: async () => {
      if (!orgId) return { carts: [] as AbandonedCart[], stats: emptyStats() };

      const since = new Date(Date.now() - DAYS_WINDOW * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('shopify_carts')
        .select('id, shopify_cart_token, email, phone, customer_first_name, total_price, currency, recovery_url, shopify_created_at, is_abandoned, abandoned_at, recovered_at, recovery_order_id, last_message_step, last_message_sent_at, opted_out, line_items')
        .eq('organization_id', orgId)
        .gte('shopify_created_at', since)
        .order('shopify_created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const carts = (data || []) as AbandonedCart[];

      const stats: CartRecoveryStats = {
        totalCarts: carts.length,
        abandonedCarts: carts.filter(c => c.is_abandoned).length,
        messagesSent: carts.filter(c => (c.last_message_step ?? 0) >= 1).length,
        recoveredCarts: carts.filter(c => !!c.recovered_at).length,
        optedOutCarts: carts.filter(c => c.opted_out).length,
        recoveryRate: 0,
        recoveredGmv: carts
          .filter(c => !!c.recovered_at)
          .reduce((sum, c) => sum + (Number(c.total_price) || 0), 0),
        abandonedGmv: carts
          .filter(c => c.is_abandoned && !c.recovered_at)
          .reduce((sum, c) => sum + (Number(c.total_price) || 0), 0),
      };

      const sentBase = stats.messagesSent;
      stats.recoveryRate = sentBase > 0 ? (stats.recoveredCarts / sentBase) * 100 : 0;

      return { carts, stats };
    },
  });
}

function emptyStats(): CartRecoveryStats {
  return {
    totalCarts: 0,
    abandonedCarts: 0,
    messagesSent: 0,
    recoveredCarts: 0,
    optedOutCarts: 0,
    recoveryRate: 0,
    recoveredGmv: 0,
    abandonedGmv: 0,
  };
}
