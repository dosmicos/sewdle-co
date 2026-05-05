import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useQueryClient } from '@tanstack/react-query';
import type { UgcCampaign } from '@/types/ugc';

export const useUgcCampaignSync = (campaigns: UgcCampaign[]) => {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = currentOrganization?.id;
  const syncingRef = useRef(false);

  const syncCampaigns = useCallback(async () => {
    if (!orgId || syncingRef.current) return;
    syncingRef.current = true;

    try {
      let changed = false;

      // 1. aceptado -> producto_enviado
      const accepted = campaigns.filter(c => c.status === 'aceptado' && c.order_number);
      for (const campaign of accepted) {
        const orderNum = campaign.order_number!.replace('#', '');

        // Check shipping labels
        const { data: label } = await supabase
          .from('shipping_labels')
          .select('id')
          .or(`order_number.eq.${orderNum},order_number.eq.#${orderNum}`)
          .limit(1)
          .maybeSingle();

        let hasShipment = !!label;

        // Fallback: check shopify fulfillment
        if (!hasShipment) {
          const { data: shopifyOrder } = await supabase
            .from('shopify_orders')
            .select('fulfillment_status')
            .or(`order_number.eq.${orderNum},order_number.eq.#${orderNum}`)
            .maybeSingle();

          if (shopifyOrder?.fulfillment_status === 'fulfilled') {
            hasShipment = true;
          }
        }

        if (hasShipment) {
          await supabase
            .from('ugc_campaigns')
            .update({ status: 'producto_enviado' })
            .eq('id', campaign.id);
          changed = true;
        }
      }

      // 2. producto_enviado -> producto_recibido
      const shipped = campaigns.filter(c => c.status === 'producto_enviado' && c.order_number);
      for (const campaign of shipped) {
        const orderNum = campaign.order_number!.replace('#', '');

        const { data: label } = await supabase
          .from('shipping_labels')
          .select('status')
          .or(`order_number.eq.${orderNum},order_number.eq.#${orderNum}`)
          .eq('status', 'delivered')
          .limit(1)
          .maybeSingle();

        if (label) {
          await supabase
            .from('ugc_campaigns')
            .update({ status: 'producto_recibido' })
            .eq('id', campaign.id);

          // Create notification
          await supabase
            .from('ugc_notifications')
            .insert({
              organization_id: orgId,
              campaign_id: campaign.id,
              creator_id: campaign.creator_id,
              type: 'producto_entregado',
              title: 'Producto entregado',
              message: `El producto de la campaña "${campaign.name}" fue entregado al creador.`,
            });

          changed = true;
        }
      }

      // 3. Notification for 5+ days in producto_recibido
      const allReceived = campaigns.filter(c => c.status === 'producto_recibido');
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

      for (const campaign of allReceived) {
        if (campaign.updated_at && campaign.updated_at < fiveDaysAgo) {
          // Check if notification already exists
          const { data: existing } = await supabase
            .from('ugc_notifications')
            .select('id')
            .eq('campaign_id', campaign.id)
            .eq('type', 'contactar_creador')
            .limit(1)
            .maybeSingle();

          if (!existing) {
            await supabase
              .from('ugc_notifications')
              .insert({
                organization_id: orgId,
                campaign_id: campaign.id,
                creator_id: campaign.creator_id,
                type: 'contactar_creador',
                title: 'Contactar creador',
                message: `El producto de la campaña "${campaign.name}" fue entregado hace más de 5 días. Contacta al creador para dar seguimiento a la campaña.`,
              });
            changed = true;
          }
        }
      }

      if (changed) {
        queryClient.invalidateQueries({ queryKey: ['ugc-campaigns'] });
        queryClient.invalidateQueries({ queryKey: ['ugc-notifications'] });
      }
    } catch (err) {
      console.error('UGC campaign sync error:', err);
    } finally {
      syncingRef.current = false;
    }
  }, [campaigns, orgId, queryClient]);

  // Run on mount and every 60s
  useEffect(() => {
    if (campaigns.length === 0) return;
    syncCampaigns();
    const interval = setInterval(syncCampaigns, 60000);
    return () => clearInterval(interval);
  }, [syncCampaigns, campaigns.length]);
};
