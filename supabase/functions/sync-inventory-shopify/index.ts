
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncInventoryRequest {
  deliveryId: string;
  approvedItems: {
    variantId: string;
    skuVariant: string;
    quantityApproved: number;
  }[];
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { deliveryId, approvedItems }: SyncInventoryRequest = await req.json();
    
    const shopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
    
    if (!shopifyDomain || !shopifyToken) {
      throw new Error('Shopify credentials not configured');
    }

    console.log(`Starting inventory sync for delivery ${deliveryId} with ${approvedItems.length} items`);

    const syncResults = [];
    
    for (const item of approvedItems) {
      try {
        // First, find the Shopify variant by SKU
        const searchResponse = await fetch(
          `https://${shopifyDomain}/admin/api/2023-10/variants.json?sku=${item.skuVariant}`,
          {
            headers: {
              'X-Shopify-Access-Token': shopifyToken,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!searchResponse.ok) {
          throw new Error(`Failed to search variant: ${searchResponse.statusText}`);
        }

        const searchData = await searchResponse.json();
        
        if (!searchData.variants || searchData.variants.length === 0) {
          console.warn(`No Shopify variant found for SKU: ${item.skuVariant}`);
          syncResults.push({
            skuVariant: item.skuVariant,
            success: false,
            error: 'Variant not found in Shopify'
          });
          continue;
        }

        const shopifyVariant = searchData.variants[0];
        
        // Get current inventory level
        const inventoryResponse = await fetch(
          `https://${shopifyDomain}/admin/api/2023-10/inventory_levels.json?inventory_item_ids=${shopifyVariant.inventory_item_id}`,
          {
            headers: {
              'X-Shopify-Access-Token': shopifyToken,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!inventoryResponse.ok) {
          throw new Error(`Failed to get inventory: ${inventoryResponse.statusText}`);
        }

        const inventoryData = await inventoryResponse.json();
        
        if (!inventoryData.inventory_levels || inventoryData.inventory_levels.length === 0) {
          console.warn(`No inventory locations found for variant: ${item.skuVariant}`);
          syncResults.push({
            skuVariant: item.skuVariant,
            success: false,
            error: 'No inventory locations found'
          });
          continue;
        }

        // Update inventory for the first location (primary location)
        const inventoryLevel = inventoryData.inventory_levels[0];
        const newQuantity = (inventoryLevel.available || 0) + item.quantityApproved;

        const updateResponse = await fetch(
          `https://${shopifyDomain}/admin/api/2023-10/inventory_levels/set.json`,
          {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': shopifyToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              location_id: inventoryLevel.location_id,
              inventory_item_id: shopifyVariant.inventory_item_id,
              available: newQuantity
            }),
          }
        );

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          throw new Error(`Failed to update inventory: ${JSON.stringify(errorData)}`);
        }

        console.log(`Successfully updated inventory for ${item.skuVariant}: +${item.quantityApproved} (new total: ${newQuantity})`);
        
        syncResults.push({
          skuVariant: item.skuVariant,
          success: true,
          previousQuantity: inventoryLevel.available || 0,
          addedQuantity: item.quantityApproved,
          newQuantity: newQuantity
        });

      } catch (itemError) {
        console.error(`Error syncing item ${item.skuVariant}:`, itemError);
        syncResults.push({
          skuVariant: item.skuVariant,
          success: false,
          error: itemError.message
        });
      }
    }

    // Log sync result to database
    const { error: logError } = await supabase
      .from('inventory_sync_logs')
      .insert({
        delivery_id: deliveryId,
        sync_results: syncResults,
        synced_at: new Date().toISOString(),
        success_count: syncResults.filter(r => r.success).length,
        error_count: syncResults.filter(r => !r.success).length
      });

    if (logError) {
      console.error('Failed to log sync result:', logError);
    }

    return new Response(JSON.stringify({
      success: true,
      deliveryId,
      results: syncResults,
      summary: {
        total: syncResults.length,
        successful: syncResults.filter(r => r.success).length,
        failed: syncResults.filter(r => !r.success).length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in sync-inventory-shopify:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
