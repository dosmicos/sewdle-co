import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import {
  extractNextPageInfo,
  productMatchesSearch,
} from "./shopify-products-helpers.ts";

const SHOPIFY_PRODUCTS_PAGE_LIMIT = 250;
const MAX_SHOPIFY_PRODUCT_PAGES = 25;

// Función de ordenamiento de variantes (copiada desde utils)
const extractAgeRangeStart = (str: string): number => {
  const lowerStr = str.toLowerCase();

  const agePatterns = [
    /(\d+)\s*a\s*\d+\s*mes/i,
    /(\d+)\s*-\s*\d+\s*mes/i,
    /(\d+)\s*to\s*\d+\s*month/i,
    /(\d+)\s*mes/i,
    /(\d+)m/i,
  ];

  for (const pattern of agePatterns) {
    const match = lowerStr.match(pattern);
    if (match) {
      return parseInt(match[1]);
    }
  }

  const match = str.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
};

const getStandardSizeOrder = (size: string): number => {
  const lowerSize = size.toLowerCase().trim();
  const sizeOrder: { [key: string]: number } = {
    "xxxs": 1,
    "3xs": 1,
    "xxs": 2,
    "2xs": 2,
    "xs": 3,
    "s": 4,
    "small": 4,
    "m": 5,
    "medium": 5,
    "l": 6,
    "large": 6,
    "xl": 7,
    "xxl": 8,
    "2xl": 8,
    "xxxl": 9,
    "3xl": 9,
    "4xl": 10,
  };
  return sizeOrder[lowerSize] || 999;
};

const isAgeVariant = (str: string): boolean => {
  const lowerStr = str.toLowerCase();
  return /\d+\s*(a|to|-)\s*\d+\s*(mes|month|año|year)|^\d+\s*(mes|month|m|año|year|y)/
    .test(lowerStr);
};

const isStandardSize = (str: string): boolean => {
  const lowerStr = str.toLowerCase().trim();
  return [
    "xxxs",
    "3xs",
    "xxs",
    "2xs",
    "xs",
    "s",
    "small",
    "m",
    "medium",
    "l",
    "large",
    "xl",
    "xxl",
    "2xl",
    "xxxl",
    "3xl",
    "4xl",
  ].includes(lowerStr);
};

const sortVariants = (variants: any[]): any[] => {
  return [...variants].sort((a, b) => {
    const aValue = a.title || a.size || "";
    const bValue = b.title || b.size || "";

    if (!aValue && !bValue) return 0;
    if (!aValue) return 1;
    if (!bValue) return -1;

    if (isAgeVariant(aValue) && isAgeVariant(bValue)) {
      const aAge = extractAgeRangeStart(aValue);
      const bAge = extractAgeRangeStart(bValue);
      return aAge - bAge;
    }

    if (isStandardSize(aValue) && isStandardSize(bValue)) {
      const aOrder = getStandardSizeOrder(aValue);
      const bOrder = getStandardSizeOrder(bValue);
      return aOrder - bOrder;
    }

    const aNum = extractAgeRangeStart(aValue);
    const bNum = extractAgeRangeStart(bValue);
    if (aNum > 0 && bNum > 0) {
      return aNum - bNum;
    }

    if (isAgeVariant(aValue) && !isAgeVariant(bValue)) return -1;
    if (!isAgeVariant(aValue) && isAgeVariant(bValue)) return 1;

    if (isStandardSize(aValue) && !isStandardSize(bValue)) return -1;
    if (!isStandardSize(aValue) && isStandardSize(bValue)) return 1;

    return aValue.localeCompare(bValue, "es", { numeric: true });
  });
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log(
      "🔥 SHOPIFY-PRODUCTS FUNCTION STARTED AT:",
      new Date().toISOString(),
    );

    // Obtener credenciales desde los secretos de Supabase
    const rawStoreDomain = Deno.env.get("SHOPIFY_STORE_DOMAIN");
    const accessToken = Deno.env.get("SHOPIFY_ACCESS_TOKEN");

    // Normalize Shopify domain
    const storeDomain = rawStoreDomain?.includes(".myshopify.com")
      ? rawStoreDomain.replace(".myshopify.com", "")
      : rawStoreDomain;

    console.log("📊 Checking credentials...");
    console.log("Store Domain:", storeDomain ? "CONFIGURED" : "MISSING");
    console.log("Access Token:", accessToken ? "CONFIGURED" : "MISSING");
    console.log(`🔗 Using Shopify domain: ${storeDomain}.myshopify.com`);

    if (!storeDomain || !accessToken) {
      console.error("Missing Shopify credentials in environment variables");
      return new Response(
        JSON.stringify({
          error:
            "Credenciales de Shopify no configuradas. Por favor contacta al administrador.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { searchTerm } = await req.json().catch(() => ({ searchTerm: "" }));

    // Limpiar el dominio para asegurar formato correcto
    const cleanDomain = storeDomain.replace(/^https?:\/\//, "").replace(
      /\/$/,
      "",
    );

    const allProducts: any[] = [];
    let pageInfo: string | null = null;
    let pageCount = 0;

    do {
      pageCount += 1;

      const apiUrl = new URL(
        `https://${cleanDomain}.myshopify.com/admin/api/2023-10/products.json`,
      );
      apiUrl.searchParams.set("limit", String(SHOPIFY_PRODUCTS_PAGE_LIMIT));

      if (pageInfo) {
        apiUrl.searchParams.set("page_info", pageInfo);
      } else {
        // Obtener todos los productos activos y borrador, incluyendo no publicados.
        apiUrl.searchParams.set("status", "active,draft");
        apiUrl.searchParams.set("published_status", "any");
      }

      console.log(`Fetching Shopify products page ${pageCount}`);

      const response = await fetch(apiUrl.toString(), {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Shopify API Error: ${response.status} - ${response.statusText}`,
          errorText,
        );
        throw new Error(
          `Error de Shopify: ${response.status} - ${response.statusText}`,
        );
      }

      const pageData = await response.json();

      // Verificar que tenemos datos válidos
      if (!pageData.products || !Array.isArray(pageData.products)) {
        console.error(
          "❌ Invalid response from Shopify API - no products array",
        );
        throw new Error("Invalid response from Shopify API");
      }

      allProducts.push(...pageData.products);
      console.log(
        `✅ Shopify page ${pageCount}: ${pageData.products.length} products. Accumulated: ${allProducts.length}`,
      );

      pageInfo = extractNextPageInfo(response.headers.get("Link"));
    } while (pageInfo && pageCount < MAX_SHOPIFY_PRODUCT_PAGES);

    if (pageInfo) {
      console.warn(
        `⚠️ Shopify pagination stopped after ${MAX_SHOPIFY_PRODUCT_PAGES} pages. Some products may be omitted.`,
      );
    }

    const data = { products: allProducts };
    const fetchedProductsBeforeFilter = allProducts.length;
    console.log(
      `✅ Successfully fetched ${fetchedProductsBeforeFilter} products from Shopify across ${pageCount} page(s) at ${
        new Date().toISOString()
      }`,
    );

    // Procesar los productos
    if (data.products && data.products.length > 0) {
      for (const product of data.products) {
        if (product.variants && product.variants.length > 0) {
          // ORDENAR LAS VARIANTES ANTES DE PROCESARLAS
          product.variants = sortVariants(product.variants);

          for (const variant of product.variants) {
            // Usar la cantidad de inventario básica disponible en la variante
            variant.stock_quantity = variant.inventory_quantity || 0;

            // Log detallado para variantes específicas que están causando problemas
            if (
              variant.sku === "46092135956715" ||
              variant.sku === "46581502771435"
            ) {
              console.log(
                `🎯 VARIANT DEBUG - SKU: ${variant.sku}, Stock: ${variant.stock_quantity}, ID: ${variant.id}`,
              );
            }
          }
        }
      }

      // Si hay término de búsqueda, filtrar en el backend también
      if (searchTerm && searchTerm.trim()) {
        data.products = data.products.filter((product: any) =>
          productMatchesSearch(product, searchTerm)
        );
        console.log(
          `Filtered to ${data.products.length} products matching "${searchTerm}"`,
        );
      }
    }

    // Agregar metadata para validación
    const responseData = {
      ...data,
      _metadata: {
        timestamp: new Date().toISOString(),
        total_products: data.products?.length || 0,
        fetched_products_before_filter: fetchedProductsBeforeFilter,
        total_variants: data.products?.reduce((sum: number, p: any) =>
          sum + (p.variants?.length || 0), 0) || 0,
        shopify_pages_fetched: pageCount,
        shopify_page_limit: SHOPIFY_PRODUCTS_PAGE_LIMIT,
        pagination_complete: !pageInfo,
        function_version: "2.1",
      },
    };

    console.log(
      `📤 Returning ${responseData._metadata.total_products} products with ${responseData._metadata.total_variants} variants`,
    );

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error in shopify-products function:", error);
    return new Response(
      JSON.stringify({
        error: "Error al conectar con Shopify",
        details: message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
