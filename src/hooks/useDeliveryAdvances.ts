import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DeliveryAdvanceSummary {
  delivery_id: string;
  total_amount: number;
  count: number;
}

/**
 * Resume los anticipos (order_advances) por delivery_id para que la lista de
 * entregas pueda mostrar un badge "Anticipo" en cada entrega que ya tiene un
 * pago anticipado registrado.
 */
export const useDeliveryAdvances = () => {
  const [advances, setAdvances] = useState<{ delivery_id: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchAdvances = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('order_advances')
          .select('delivery_id, amount')
          .not('delivery_id', 'is', null);

        if (error) throw error;
        if (!cancelled) {
          setAdvances(
            (data || [])
              .filter((row): row is { delivery_id: string; amount: number } => !!row.delivery_id)
              .map((row) => ({ delivery_id: row.delivery_id as string, amount: Number(row.amount) || 0 }))
          );
        }
      } catch (err) {
        console.error('Error fetching delivery advances:', err);
        if (!cancelled) setAdvances([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAdvances();
    return () => {
      cancelled = true;
    };
  }, []);

  const byDeliveryId = useMemo(() => {
    const map = new Map<string, DeliveryAdvanceSummary>();
    for (const advance of advances) {
      const existing = map.get(advance.delivery_id);
      if (existing) {
        existing.total_amount += advance.amount;
        existing.count += 1;
      } else {
        map.set(advance.delivery_id, {
          delivery_id: advance.delivery_id,
          total_amount: advance.amount,
          count: 1,
        });
      }
    }
    return map;
  }, [advances]);

  return { advances, byDeliveryId, loading };
};
