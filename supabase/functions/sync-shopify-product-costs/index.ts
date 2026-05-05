import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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

    const graphqlUrl = `https://${storeDomain}.myshopify.com/admin/api/2024-10/graphql.json`;
    const shopifyHeaders = {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    };

    // Step 1: Fetch all ACTIVE products with variant costs via GraphQL
    interface VariantData {
      productId: number;
      productTitle: string;
      variantId: number;
      variantTitle: string;
      sku: string | null;
      price: number;
      cost: number;
    }

    const allVariants: VariantData[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;
    let productCount = 0;

    while (hasNextPage) {
      const query = `
        query getProductCosts($first: Int!, $after: String) {
          products(first: $first, after: $after, query: "status:active") {
            edges {
              node {
                id
                title
                variants(first: 100) {
                  edges {
                    node {
                      id
                      title
                      sku
                      price
                      inventoryItem {
                        unitCost {
                          amount
                        }
                      }
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;

      const response = await fetch(graphqlUrl, {
        method: "POST",
        headers: shopifyHeaders,
        body: JSON.stringify({
          query,
          variables: { first: 50, after: cursor },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Shopify GraphQL error: ${response.status} - ${errText}`);
      }

      const data = await response.json();

      if (data.errors) {
        console.error("❌ Shopify GraphQL errors:", JSON.stringify(data.errors));
        throw new Error(`Shopify API error: ${data.errors[0].message}`);
      }

      const edges = data.data.products.edges;
      for (const edge of edges) {
        const node = edge.node;
        const productId = parseInt(node.id.replace("gid://shopify/Product/", ""));
        productCount++;

        for (const ve of node.variants.edges) {
          const v = ve.node;
          const variantId = parseInt(v.id.replace("gid://shopify/ProductVariant/", ""));
          const cost = v.inventoryItem?.unitCost?.amount
            ? parseFloat(v.inventoryItem.unitCost.amount)
            : 0;

          allVariants.push({
            productId,
            productTitle: node.title,
            variantId,
            variantTitle: v.title,
            sku: v.sku || null,
            price: parseFloat(v.price) || 0,
            cost,
          });
        }
      }

      hasNextPage = data.data.products.pageInfo.hasNextPage;
      cursor = data.data.products.pageInfo.endCursor;
    }

    const withCostCount = allVariants.filter((v) => v.cost > 0).length;
    console.log(
      `📦 Fetched ${productCount} active products, ${allVariants.length} variants (${withCostCount} with cost)`
    );

    // Step 2: Build upsert rows
    const upsertRows = allVariants.map((v) => ({
      organization_id,
      product_id: v.productId,
      variant_id: v.variantId,
      title:
        v.variantTitle !== "Default Title"
          ? `${v.productTitle} - ${v.variantTitle}`
          : v.productTitle,
      sku: v.sku,
      price: v.price,
      product_cost: v.cost,
      source: "shopify",
      updated_at: new Date().toISOString(),
    }));

    // Step 3: Delete products no longer active (archived/deleted in Shopify)
    const activeProductIds = [...new Set(allVariants.map((v) => v.productId))];
    if (activeProductIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("product_costs")
        .delete()
        .eq("organization_id", organization_id)
        .eq("source", "shopify")
        .not("product_id", "in", `(${activeProductIds.join(",")})`);

      if (deleteError) {
        console.warn("⚠️ Failed to clean up archived products:", deleteError.message);
      }
    }

    // Step 4: Batch upsert in chunks of 500
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
        console.error(`❌ Upsert error batch ${i}:`, JSON.stringify(upsertError));
        throw new Error(`Upsert failed at batch ${i}: ${upsertError.message}`);
      } else {
        upserted += batch.length;
      }
    }

    console.log(`✅ Synced ${upserted} product costs (${withCostCount} with cost > 0)`);

    return new Response(
      JSON.stringify({
        success: true,
        products_fetched: productCount,
        variants_synced: upserted,
        with_cost: withCostCount,
        without_cost: allVariants.length - withCostCount,
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
