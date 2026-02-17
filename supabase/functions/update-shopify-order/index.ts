import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to get current tags from Shopify
async function getCurrentShopifyTags(shopifyDomain: string, shopifyAccessToken: string, orderId: string): Promise<string[]> {
  const url = `https://${shopifyDomain}/admin/api/2024-01/orders/${orderId}.json`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Shopify-Access-Token': shopifyAccessToken,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Error fetching order ${orderId} from Shopify:`, errorText);
    throw new Error(`Failed to fetch order from Shopify: ${errorText}`);
  }

  const result = await response.json();
  const tagsString = result.order?.tags || '';
  return tagsString.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
}

// Helper to merge tags (case-insensitive dedup)
function mergeTags(existing: string[], toAdd: string[]): string[] {
  const existingLower = existing.map(t => t.toLowerCase());
  const merged = [...existing];
  
  for (const tag of toAdd) {
    if (!existingLower.includes(tag.toLowerCase())) {
      merged.push(tag);
    }
  }
  
  return merged;
}

// Helper to remove tags (case-insensitive)
function removeTags(existing: string[], toRemove: string[]): string[] {
  const toRemoveLower = toRemove.map(t => t.toLowerCase());
  return existing.filter(t => !toRemoveLower.includes(t.toLowerCase()));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { orderId, action, data } = await req.json()
    
    console.log(`🔄 Update Shopify Order - Action: ${action}, Order ID: ${orderId}`)

    if (!orderId || !action) {
      throw new Error('Missing required parameters: orderId and action')
    }

    const shopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN')
    const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN')

    if (!shopifyDomain || !shopifyAccessToken) {
      throw new Error('Shopify credentials not configured')
    }

    const shopifyApiUrl = `https://${shopifyDomain}/admin/api/2024-01/orders/${orderId}`

    let updatePayload: Record<string, unknown> = {}
    let response: Response
    let finalTags: string[] | null = null

    switch (action) {
      case 'add_tags': {
        // Merge tags using Shopify as source of truth
        console.log(`🏷️ ADD_TAGS for order ${orderId}`);
        console.log(`   Tags to add:`, data.tags);
        
        const currentTagsForAdd = await getCurrentShopifyTags(shopifyDomain, shopifyAccessToken, orderId);
        console.log(`   Current Shopify tags:`, currentTagsForAdd);
        
        const tagsToAdd = Array.isArray(data.tags) ? data.tags : [data.tags];
        finalTags = mergeTags(currentTagsForAdd, tagsToAdd);
        console.log(`   Final merged tags:`, finalTags);
        
        updatePayload = {
          order: {
            tags: finalTags.join(', ')
          }
        };
        response = await fetch(`${shopifyApiUrl}.json`, {
          method: 'PUT',
          headers: {
            'X-Shopify-Access-Token': shopifyAccessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload)
        });
        break;
      }

      case 'remove_tags': {
        // Remove tags using Shopify as source of truth
        console.log(`🏷️ REMOVE_TAGS for order ${orderId}`);
        console.log(`   Tags to remove:`, data.tags);
        
        const currentTagsForRemove = await getCurrentShopifyTags(shopifyDomain, shopifyAccessToken, orderId);
        console.log(`   Current Shopify tags:`, currentTagsForRemove);
        
        const tagsToRemove = Array.isArray(data.tags) ? data.tags : [data.tags];
        finalTags = removeTags(currentTagsForRemove, tagsToRemove);
        console.log(`   Final tags after removal:`, finalTags);
        
        updatePayload = {
          order: {
            tags: finalTags.join(', ')
          }
        };
        response = await fetch(`${shopifyApiUrl}.json`, {
          method: 'PUT',
          headers: {
            'X-Shopify-Access-Token': shopifyAccessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload)
        });
        break;
      }

      case 'update_tags': {
        console.log(`🏷️ Updating tags for order ${orderId}`)
        console.log(`   Tags received (type: ${typeof data.tags}):`, data.tags)
        
        // Asegurar que tags sea siempre un string
        const tagsString = Array.isArray(data.tags) 
          ? data.tags.join(', ')  // Si viene como array (legacy)
          : (data.tags || '');    // Si viene como string (nuevo formato)
        
        console.log(`   Tags to send to Shopify:`, tagsString)
        console.log(`   Tags string length: ${tagsString.length}`)
        console.log(`   Tags string value: "${tagsString}"`)
        
        updatePayload = {
          order: {
            tags: tagsString
          }
        }
        response = await fetch(`${shopifyApiUrl}.json`, {
          method: 'PUT',
          headers: {
            'X-Shopify-Access-Token': shopifyAccessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload)
        })
        break
      }

      case 'update_notes': {
        console.log(`📝 Updating notes`)
        updatePayload = {
          order: {
            note: data.notes || ''
          }
        }
        response = await fetch(`${shopifyApiUrl}.json`, {
          method: 'PUT',
          headers: {
            'X-Shopify-Access-Token': shopifyAccessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload)
        })
        break
      }

      case 'sync_from_shopify': {
        // Fetch ONLY minimal fields from Shopify for fast sync (optimized for latency)
        console.log(`🔄 SYNC_FROM_SHOPIFY for order ${orderId} (optimized)`);
        const syncStartTime = Date.now();
        
        // Request only the fields we need: note, tags, updated_at
        const syncResponse = await fetch(`${shopifyApiUrl}.json?fields=id,note,tags,updated_at`, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': shopifyAccessToken,
            'Content-Type': 'application/json',
          },
        });

        if (!syncResponse.ok) {
          const errorText = await syncResponse.text();
          throw new Error(`Failed to fetch order from Shopify: ${errorText}`);
        }

        const shopifyOrder = await syncResponse.json();
        const order = shopifyOrder.order;
        
        console.log(`   Shopify note: "${order.note || '(empty)'}" (length: ${(order.note || '').length})`);
        console.log(`   Shopify tags: "${order.tags || '(empty)'}"`);
        console.log(`   Fetch time: ${Date.now() - syncStartTime}ms`);
        
        // Update local database with Shopify data - skip raw_data for speed
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        const { error: dbError } = await supabaseClient
          .from('shopify_orders')
          .update({
            note: order.note || null,
            tags: order.tags || null,
            updated_at_shopify: order.updated_at
            // NOTE: raw_data is NOT updated here for performance - it's large and not needed for note sync
          })
          .eq('shopify_order_id', orderId);

        if (dbError) {
          console.error('❌ Error updating local database:', dbError);
          throw new Error(`Failed to update local database: ${dbError.message}`);
        }

        console.log(`✅ Local database synced with Shopify data (total: ${Date.now() - syncStartTime}ms)`);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Order synced from Shopify',
            note: order.note,
            tags: order.tags
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Shopify API Error for order ${orderId}:`)
      console.error(`   Status: ${response.status}`)
      console.error(`   Response: ${errorText}`)
      if (action === 'update_tags') {
        const orderPayload = updatePayload.order as Record<string, unknown> | undefined
        console.error(`   Sent tags: "${String(orderPayload?.tags ?? '')}"`)
      }
      throw new Error(`Shopify API error: ${errorText}`)
    }

    const result = await response.json()
    console.log(`✅ Shopify order updated successfully`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Order ${action} completed`,
        data: result,
        finalTags: finalTags // Return final tags for DB sync
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error updating Shopify order:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
