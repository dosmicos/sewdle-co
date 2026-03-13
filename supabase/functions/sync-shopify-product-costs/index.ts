import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  sku: string | null;
  price: string;
  inventory_item_id: number;
}

interface ShopifyProduct {
  id: number;
  title: string;
  variants: ShopifyVariant[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organization_id } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Shopify credentials
    const rawStoreDomain = Deno.env.get("SHOPIFY_STORE_DOMAIN");
    const accessToken = Deno.env.get("SHOPIFY_ACCESS_TOKEN");
    const storeDomain = rawStoreDomain?.includes(".myshopify.com")
      ? rawStoreDomain.replace(".myshopify.com", "")
      : rawStoreDomain;

    if (!storeDomain || !accessToken) {
      return new Response(
        JSON.stringify({ error: "Credenciales de Shopify no configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const shopifyHeaders = {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    };

    const baseUrl = `https://${storeDomain}.myshopify.com/admin/api/2024-01`;

    // Step 1: Fetch all products (paginated)
    let allProducts: ShopifyProduct[] = [];
    let pageUrl: string | null = `${baseUrl}/products.json?limit=250&fields=id,title,variants`;

    while (pageUrl) {
      const response = await fetch(pageUrl, { headers: shopifyHeaders });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Shopify products API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      allProducts = allProducts.concat(data.products || []);

      // Pagination via Link header
      const linkHeader = response.headers.get("Link");
      pageUrl = null;
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (nextMatch) {
          pageUrl = nextMatch[1];
        }
      }
    }

    console.log(`📦 Fetched ${allProducts.length} products from Shopify`);

    // Step 2: Collect all inventory_item_ids
    const variantMap = new Map<number, { product: ShopifyProduct; variant: ShopifyVariant }>();
    for (const product of allProducts) {
      for (const variant of product.variants) {
        variantMap.set(variant.inventory_item_id, { product, variant });
      }
    }

    // Step 3: Fetch inventory item costs in batches of 100
    const inventoryItemIds = Array.from(variantMap.keys());
    const costMap = new Map<number, number>(); // inventory_item_id -> cost

    for (let i = 0; i < inventoryItemIds.length; i += 100) {
      const batch = inventoryItemIds.slice(i, i + 100);
      const idsParam = batch.join(",");
      const invResponse = await fetch(
        `${baseUrl}/inventory_items.json?ids=${idsParam}`,
        { headers: shopifyHeaders }
      );

      if (invResponse.ok) {
        const invData = await invResponse.json();
        for (const item of invData.inventory_items || []) {
          if (item.cost !== null && item.cost !== undefined) {
            costMap.set(item.id, parseFloat(item.cost));
          }
        }
      } else {
        console.warn(`⚠️ Failed to fetch inventory items batch starting at ${i}`);
      }
    }

    console.log(`💰 Fetched costs for ${costMap.size} inventory items`);

    // Step 4: Upsert into product_costs (only update shopify-sourced costs)
    const upsertRows = [];
    for (const [invItemId, { product, variant }] of variantMap) {
      const cost = costMap.get(invItemId) ?? 0;
      upsertRows.push({
        organization_id,
        product_id: product.id,
        variant_id: variant.id,
        title: variant.title !== "Default Title"
          ? `${product.title} - ${variant.title}`
          : product.title,
        sku: variant.sku || null,
        price: parseFloat(variant.price) || 0,
        product_cost: cost,
        source: "shopify",
        updated_at: new Date().toISOString(),
      });
    }

    // Batch upsert in chunks of 500
    let upserted = 0;
    for (let i = 0; i < upsertRows.length; i += 500) {
      const batch = upsertRows.slice(i, i + 500);
      const { error: upsertError } = await supabase
        .from("product_costs")
        .upsert(batch, {
          onConflict: "organization_id,product_id,variant_id",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error(`❌ Upsert error batch ${i}:`, upsertError);
      } else {
        upserted += batch.length;
      }
    }

    console.log(`✅ Synced ${upserted} product costs from Shopify`);

    return new Response(
      JSON.stringify({
        success: true,
        products_fetched: allProducts.length,
        costs_synced: upserted,
        inventory_costs_found: costMap.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error in sync-shopify-product-costs:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
