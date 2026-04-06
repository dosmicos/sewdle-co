import { useState, useEffect, useCallback } from 'react';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UgcDiscountLink {
  id: string;
  organization_id: string;
  creator_id: string;
  redirect_token: string;
  discount_value: number;
  commission_rate: number;
  total_orders: number;
  total_revenue: number;
  total_commission: number;
  total_paid_out: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // shopify_discount_code is intentionally NOT fetched — never exposed in UI
}

export interface UgcAttributedOrder {
  id: string;
  shopify_order_number: string;
  order_total: number;
  discount_amount: number;
  commission_amount: number;
  order_date: string;
}

export interface UgcCommissionPayout {
  id: string;
  amount: number;
  payout_type: string;
  notes: string | null;
  created_at: string;
}

export const useUgcDiscountLinks = (creatorId: string | undefined) => {
  const [discountLink, setDiscountLink] = useState<UgcDiscountLink | null>(null);
  const [attributedOrders, setAttributedOrders] = useState<UgcAttributedOrder[]>([]);
  const [payouts, setPayouts] = useState<UgcCommissionPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [registeringPayout, setRegisteringPayout] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!creatorId) { setLoading(false); return; }
    try {
      setLoading(true);

      // Fetch discount link (exclude shopify_discount_code from select)
      const { data: linkData, error: linkError } = await (supabase.from('ugc_discount_links' as any) as any)
        .select('id, organization_id, creator_id, redirect_token, discount_value, commission_rate, total_orders, total_revenue, total_commission, total_paid_out, is_active, created_at, updated_at')
        .eq('creator_id', creatorId)
        .eq('is_active', true)
        .maybeSingle();

      if (linkError) throw linkError;
      setDiscountLink(linkData || null);

      if (linkData) {
        const [ordersRes, payoutsRes] = await Promise.all([
          (supabase.from('ugc_attributed_orders' as any) as any)
            .select('id, shopify_order_number, order_total, discount_amount, commission_amount, order_date')
            .eq('discount_link_id', linkData.id)
            .order('order_date', { ascending: false })
            .limit(50),
          (supabase.from('ugc_commission_payouts' as any) as any)
            .select('id, amount, payout_type, notes, created_at')
            .eq('discount_link_id', linkData.id)
            .order('created_at', { ascending: false })
            .limit(20),
        ]);

        if (ordersRes.error) throw ordersRes.error;
        if (payoutsRes.error) throw payoutsRes.error;

        setAttributedOrders(ordersRes.data || []);
        setPayouts(payoutsRes.data || []);
      } else {
        setAttributedOrders([]);
        setPayouts([]);
      }
    } catch (err: any) {
      console.error('useUgcDiscountLinks error:', err);
    } finally {
      setLoading(false);
    }
  }, [creatorId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createDiscountLink = async (params: { discount_value: number; commission_rate: number }) => {
    if (!creatorId) return null;
    try {
      setCreating(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('No estás autenticado');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-ugc-discount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ creator_id: creatorId, ...params }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `Error ${response.status}`);

      if (data.already_exists) {
        toast({ title: 'Link existente', description: 'Este creator ya tiene un link activo.' });
      } else {
        toast({ title: 'Link creado', description: 'El link de descuento fue creado en Shopify exitosamente.' });
      }

      await fetchData();
      return data.redirect_url as string;
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      return null;
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (linkId: string, isActive: boolean) => {
    const { error } = await (supabase.from('ugc_discount_links' as any) as any)
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', linkId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: isActive ? 'Link activado' : 'Link desactivado',
      description: isActive ? 'El link vuelve a funcionar.' : 'El link ya no redirige.',
    });
    await fetchData();
  };

  const registerPayout = async (params: {
    amount: number;
    payout_type: 'nequi' | 'discount' | 'other';
    notes?: string;
  }) => {
    if (!discountLink) return;
    try {
      setRegisteringPayout(true);

      const { error } = await (supabase.rpc('register_ugc_commission_payout' as any, {
        p_link_id: discountLink.id,
        p_amount: params.amount,
        p_type: params.payout_type,
        p_notes: params.notes || null,
        p_creator_id: discountLink.creator_id,
        p_org_id: discountLink.organization_id,
      }) as any);

      if (error) throw error;

      const typeLabel = params.payout_type === 'nequi' ? 'Nequi'
        : params.payout_type === 'discount' ? 'descuento en tienda'
        : 'otro';
      toast({ title: 'Pago registrado', description: `Se descontaron las comisiones por ${typeLabel}.` });
      await fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setRegisteringPayout(false);
    }
  };

  return {
    discountLink,
    attributedOrders,
    payouts,
    loading,
    creating,
    registeringPayout,
    createDiscountLink,
    toggleActive,
    registerPayout,
    refetch: fetchData,
  };
};
