import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuthenticatedUser } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Tool definitions for database queries
const tools = [
  {
    type: "function",
    function: {
      name: "search_orders",
      description: "Search production orders (pedidos de producción). Use for 'órdenes de producción', 'pedidos a talleres'. NOT for deliveries.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Product name to search for (partial match)" },
          status: { type: "string", description: "Order status filter (pending, in_progress, completed, cancelled)" },
          workshop_name: { type: "string", description: "Workshop name to filter by" },
          limit: { type: "number", description: "Max results to return (default 10)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_delayed_orders",
      description: "Get orders that are delayed (past due date and not completed)",
      parameters: {
        type: "object",
        properties: {
          days_overdue: { type: "number", description: "Minimum days overdue (default 0)" },
          limit: { type: "number", description: "Max results (default 20)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_workshop_stats",
      description: "Get statistics for workshops - orders count, deliveries, delays",
      parameters: {
        type: "object",
        properties: {
          workshop_name: { type: "string", description: "Specific workshop name (optional, returns all if not provided)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_deliveries_summary",
      description: "Get summary of deliveries - total units delivered, by workshop, by period",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Period: 'today', 'week', 'month', 'year' (default: month)" },
          workshop_name: { type: "string", description: "Filter by workshop name (optional)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search products by name or SKU. Returns product info with all variants (sizes, colors, stock).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Product name or SKU to search" },
          limit: { type: "number", description: "Max results (default 10)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_production_summary",
      description: "Get production summary - orders by status, pending quantities, completed quantities",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Period: 'week', 'month', 'year' (default: month)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_workshop_ranking",
      description: "Get ranking of workshops by performance metric. Use for 'taller que más produjo', 'ranking de talleres'. Supports date filtering.",
      parameters: {
        type: "object",
        properties: {
          metric: { type: "string", description: "Metric to rank by: 'delays', 'volume', 'quality' (default: volume)" },
          limit: { type: "number", description: "Top N workshops to return (default 5)" },
          start_date: { type: "string", description: "Start date YYYY-MM-DD for filtering deliveries (optional)" },
          end_date: { type: "string", description: "End date YYYY-MM-DD for filtering deliveries (optional)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_inventory_status",
      description: "Get inventory status - low stock alerts, stock levels by variant (color/size)",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Filter by product name (optional)" },
          low_stock_only: { type: "boolean", description: "Only show low stock items (default false)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_approved_production",
      description: "Get approved production (quantity_approved from deliveries) for a date range. Use for 'producción aprobada', 'unidades aprobadas'.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Start date in ISO format (YYYY-MM-DD)" },
          end_date: { type: "string", description: "End date in ISO format (YYYY-MM-DD)" },
          workshop_name: { type: "string", description: "Filter by workshop name (optional)" }
        },
        required: ["start_date", "end_date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_shopify_sales_summary",
      description: "Get Shopify sales summary for a date range. Use for 'ventas', 'cuánto vendimos', 'órdenes de Shopify'.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Start date in ISO format (YYYY-MM-DD)" },
          end_date: { type: "string", description: "End date in ISO format (YYYY-MM-DD)" }
        },
        required: ["start_date", "end_date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_top_selling_products",
      description: "Get top selling products from Shopify sales. Use for 'producto más vendido', 'qué producto se vende más'.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Start date in ISO format (YYYY-MM-DD)" },
          end_date: { type: "string", description: "End date in ISO format (YYYY-MM-DD)" },
          limit: { type: "number", description: "Number of products to return (default 10)" },
          metric: { type: "string", description: "'units' (default) for quantity sold, or 'revenue' for total sales value" }
        },
        required: ["start_date", "end_date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_deliveries",
      description: "Search deliveries (entregas físicas de talleres). Use for 'entregas en revisión', 'entregas con producto X', 'entregas del taller Y'. Returns detailed variants with sizes and colors.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Product name to search for (partial match)" },
          status: { type: "string", description: "Delivery status: 'pending', 'in_transit', 'in_quality' (en revisión), 'approved', 'completed'" },
          workshop_name: { type: "string", description: "Workshop name filter" },
          tracking_number: { type: "string", description: "Delivery tracking number (e.g., DEL-0366)" },
          size: { type: "string", description: "Filter by specific size (e.g., '6', '8', '3-4 años')" },
          color: { type: "string", description: "Filter by specific color" },
          limit: { type: "number", description: "Max results (default 10)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_delivery_variants",
      description: "Get detailed variants (product, color, size, SKU, quantities) in a specific delivery. Use when user asks about specific variants in a delivery, like 'qué variantes tiene la entrega DEL-0366' or 'hay talla 6 en esa entrega'.",
      parameters: {
        type: "object",
        properties: {
          tracking_number: { type: "string", description: "Delivery tracking number (e.g., DEL-0366)" },
          product_name: { type: "string", description: "Filter by product name (optional)" }
        },
        required: ["tracking_number"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "find_variant_location",
      description: "Find where a specific variant (product + size/color) is located - in stock, in orders, in deliveries. Use for 'dónde está la talla 6 de X', 'ubicación de variante'.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Product name to search for" },
          size: { type: "string", description: "Size to look for (e.g., '6', '8', '3-4 años')" },
          color: { type: "string", description: "Color to look for (optional)" }
        },
        required: ["product_name"]
      }
    }
  }
];

// Execute tool functions
async function executeTool(supabase: unknown, toolName: string, args: unknown, organizationId: string) {
  console.log(`Executing tool: ${toolName} with args:`, args);
  
  switch (toolName) {
    case "search_orders": {
      let query = supabase
        .from('orders')
        .select(`
          id, order_number, status, due_date, created_at, notes,
          order_items(
            quantity,
            product_variants(
              sku_variant, color, size,
              products(name, sku)
            )
          )
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(args.limit || 10);
      
      if (args.status) {
        query = query.eq('status', args.status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Filter by product name if provided
      let results = data || [];
      if (args.product_name) {
        const searchTerm = args.product_name.toLowerCase();
        results = results.filter((order: unknown) => 
          order.order_items?.some((item: unknown) => 
            item.product_variants?.products?.name?.toLowerCase().includes(searchTerm)
          )
        );
      }
      
      return results.map((order: unknown) => ({
        order_number: order.order_number,
        status: order.status,
        due_date: order.due_date,
        created_at: order.created_at,
        items: order.order_items?.map((item: unknown) => ({
          product: item.product_variants?.products?.name,
          variant: `${item.product_variants?.color || ''} ${item.product_variants?.size || ''}`.trim(),
          quantity: item.quantity
        })) || []
      }));
    }
    
    case "get_delayed_orders": {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, due_date, created_at,
          order_items(quantity, product_variants(products(name)))
        `)
        .eq('organization_id', organizationId)
        .lt('due_date', today)
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .order('due_date', { ascending: true })
        .limit(args.limit || 20);
      
      if (error) throw error;
      
      return (data || []).map((order: unknown) => {
        const dueDate = new Date(order.due_date);
        const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          order_number: order.order_number,
          status: order.status,
          due_date: order.due_date,
          days_overdue: daysOverdue,
          products: order.order_items?.map((i: unknown) => i.product_variants?.products?.name).filter(Boolean)
        };
      });
    }
    
    case "get_workshop_stats": {
      let query = supabase
        .from('workshops')
        .select(`
          id, name, contact_name, phone,
          deliveries(id, status, created_at)
        `)
        .eq('organization_id', organizationId);
      
      if (args.workshop_name) {
        query = query.ilike('name', `%${args.workshop_name}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map((workshop: unknown) => ({
        name: workshop.name,
        contact: workshop.contact_name,
        total_deliveries: workshop.deliveries?.length || 0,
        pending_deliveries: workshop.deliveries?.filter((d: unknown) => d.status === 'pending').length || 0,
        completed_deliveries: workshop.deliveries?.filter((d: unknown) => d.status === 'completed').length || 0
      }));
    }
    
    case "get_deliveries_summary": {
      const period = args.period || 'month';
      const startDate = new Date();
      
      switch (period) {
        case 'today': startDate.setHours(0, 0, 0, 0); break;
        case 'week': startDate.setDate(startDate.getDate() - 7); break;
        case 'month': startDate.setMonth(startDate.getMonth() - 1); break;
        case 'year': startDate.setFullYear(startDate.getFullYear() - 1); break;
      }
      
      const query = supabase
        .from('deliveries')
        .select(`
          id, status, delivery_date, created_at,
          workshops(name),
          delivery_items(quantity_delivered, quantity_approved)
        `)
        .eq('organization_id', organizationId)
        .gte('created_at', startDate.toISOString());
      
      const { data, error } = await query;
      if (error) throw error;
      
      const deliveries = data || [];
      const totalDelivered = deliveries.reduce((sum: number, d: unknown) => 
        sum + (d.delivery_items?.reduce((s: number, i: unknown) => s + (i.quantity_delivered || 0), 0) || 0), 0);
      const totalApproved = deliveries.reduce((sum: number, d: unknown) => 
        sum + (d.delivery_items?.reduce((s: number, i: unknown) => s + (i.quantity_approved || 0), 0) || 0), 0);
      
      // Group by workshop
      const byWorkshop: Record<string, number> = {};
      deliveries.forEach((d: unknown) => {
        const workshopName = d.workshops?.name || 'Sin taller';
        const units = d.delivery_items?.reduce((s: number, i: unknown) => s + (i.quantity_delivered || 0), 0) || 0;
        byWorkshop[workshopName] = (byWorkshop[workshopName] || 0) + units;
      });
      
      return {
        period,
        total_deliveries: deliveries.length,
        total_units_delivered: totalDelivered,
        total_units_approved: totalApproved,
        by_workshop: Object.entries(byWorkshop).map(([name, units]) => ({ name, units }))
      };
    }
    
    case "search_products": {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, name, sku, category, status,
          product_variants(id, sku_variant, color, size, stock_quantity)
        `)
        .eq('organization_id', organizationId)
        .or(`name.ilike.%${args.query}%,sku.ilike.%${args.query}%`)
        .limit(args.limit || 10);
      
      if (error) throw error;
      
      return (data || []).map((p: unknown) => ({
        name: p.name,
        sku: p.sku,
        category: p.category,
        status: p.status,
        variants_count: p.product_variants?.length || 0,
        total_stock: p.product_variants?.reduce((s: number, v: unknown) => s + (v.stock_quantity || 0), 0) || 0,
        variants: p.product_variants?.map((v: unknown) => ({
          sku_variant: v.sku_variant,
          color: v.color,
          size: v.size,
          stock: v.stock_quantity || 0
        })) || []
      }));
    }
    
    case "get_production_summary": {
      const period = args.period || 'month';
      const startDate = new Date();
      
      switch (period) {
        case 'week': startDate.setDate(startDate.getDate() - 7); break;
        case 'month': startDate.setMonth(startDate.getMonth() - 1); break;
        case 'year': startDate.setFullYear(startDate.getFullYear() - 1); break;
      }
      
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          status,
          order_items(quantity)
        `)
        .eq('organization_id', organizationId)
        .gte('created_at', startDate.toISOString());
      
      if (error) throw error;
      
      const summary = {
        period,
        total_orders: orders?.length || 0,
        by_status: {} as Record<string, { orders: number; units: number }>,
        total_units: 0
      };
      
      (orders || []).forEach((order: unknown) => {
        const status = order.status || 'pending';
        const units = order.order_items?.reduce((s: number, i: unknown) => s + (i.quantity || 0), 0) || 0;
        
        if (!summary.by_status[status]) {
          summary.by_status[status] = { orders: 0, units: 0 };
        }
        summary.by_status[status].orders++;
        summary.by_status[status].units += units;
        summary.total_units += units;
      });
      
      return summary;
    }
    
    case "get_workshop_ranking": {
      const metric = args.metric || 'volume';
      const limit = args.limit || 5;
      const { start_date, end_date } = args;
      
      // Build deliveries query with optional date filter
      let deliveriesQuery = supabase
        .from('deliveries')
        .select(`
          id, delivery_date,
          workshops!inner(id, name),
          delivery_items(quantity_delivered, quantity_approved, quantity_defective)
        `)
        .eq('organization_id', organizationId);
      
      // Apply date filters if provided
      if (start_date) {
        deliveriesQuery = deliveriesQuery.gte('delivery_date', start_date);
      }
      if (end_date) {
        deliveriesQuery = deliveriesQuery.lte('delivery_date', end_date);
      }
      
      const { data: deliveries, error } = await deliveriesQuery;
      if (error) throw error;
      
      console.log(`get_workshop_ranking: period=${start_date || 'all'} to ${end_date || 'all'}, deliveries found: ${deliveries?.length || 0}`);
      
      // Group by workshop
      const workshopStats: Record<string, unknown> = {};
      (deliveries || []).forEach((d: unknown) => {
        const workshopName = d.workshops?.name || 'Sin taller';
        const workshopId = d.workshops?.id;
        
        if (!workshopStats[workshopId]) {
          workshopStats[workshopId] = { 
            name: workshopName, 
            total_units: 0, 
            defective_units: 0, 
            total_deliveries: 0 
          };
        }
        
        const delivered = d.delivery_items?.reduce((s: number, i: unknown) => s + (i.quantity_delivered || 0), 0) || 0;
        const defective = d.delivery_items?.reduce((s: number, i: unknown) => s + (i.quantity_defective || 0), 0) || 0;
        
        workshopStats[workshopId].total_units += delivered;
        workshopStats[workshopId].defective_units += defective;
        workshopStats[workshopId].total_deliveries++;
      });
      
      // Calculate quality rate and create ranked array
      const ranked = Object.values(workshopStats).map((w: unknown) => ({
        ...w,
        quality_rate: w.total_units > 0 
          ? Math.round(((w.total_units - w.defective_units) / w.total_units * 100) * 10) / 10 
          : 100
      }));
      
      // Sort by metric
      if (metric === 'volume') {
        ranked.sort((a, b) => b.total_units - a.total_units);
      } else if (metric === 'quality') {
        ranked.sort((a, b) => b.quality_rate - a.quality_rate);
      } else if (metric === 'delays') {
        ranked.sort((a, b) => a.total_deliveries - b.total_deliveries);
      }
      
      return {
        period: start_date && end_date ? `${start_date} a ${end_date}` : 'histórico completo',
        metric,
        workshops: ranked.slice(0, limit)
      };
    }
    
    case "get_inventory_status": {
      let query = supabase
        .from('products')
        .select(`
          name, sku,
          product_variants(sku_variant, color, size, stock_quantity)
        `)
        .eq('organization_id', organizationId);
      
      if (args.product_name) {
        query = query.ilike('name', `%${args.product_name}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const results = (data || []).flatMap((p: unknown) => 
        (p.product_variants || []).map((v: unknown) => ({
          product: p.name,
          sku: v.sku_variant,
          variant: `${v.color || ''} ${v.size || ''}`.trim() || 'Default',
          color: v.color,
          size: v.size,
          stock: v.stock_quantity || 0,
          low_stock: (v.stock_quantity || 0) < 10
        }))
      );
      
      if (args.low_stock_only) {
        return results.filter(r => r.low_stock);
      }
      
      return results.slice(0, 50);
    }
    
    case "get_approved_production": {
      const { start_date, end_date, workshop_name } = args;
      
      console.log(`get_approved_production: ${start_date} to ${end_date}, workshop: ${workshop_name || 'all'}`);
      
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          id, delivery_date, status,
          workshops(name),
          delivery_items(quantity_approved)
        `)
        .eq('organization_id', organizationId)
        .gte('delivery_date', start_date)
        .lte('delivery_date', end_date);
      
      if (error) throw error;
      
      let deliveries = data || [];
      
      // Filter by workshop if provided
      if (workshop_name) {
        deliveries = deliveries.filter((d: unknown) => 
          d.workshops?.name?.toLowerCase().includes(workshop_name.toLowerCase())
        );
      }
      
      const totalApproved = deliveries.reduce((sum: number, d: unknown) => 
        sum + (d.delivery_items?.reduce((s: number, i: unknown) => s + (i.quantity_approved || 0), 0) || 0), 0);
      
      // Group by workshop
      const byWorkshop: Record<string, number> = {};
      deliveries.forEach((d: unknown) => {
        const name = d.workshops?.name || 'Sin taller';
        const units = d.delivery_items?.reduce((s: number, i: unknown) => s + (i.quantity_approved || 0), 0) || 0;
        byWorkshop[name] = (byWorkshop[name] || 0) + units;
      });
      
      return {
        start_date,
        end_date,
        total_deliveries: deliveries.length,
        total_units_approved: totalApproved,
        by_workshop: Object.entries(byWorkshop)
          .map(([name, units]) => ({ name, units }))
          .sort((a, b) => (b.units as number) - (a.units as number))
      };
    }
    
    case "get_shopify_sales_summary": {
      const { start_date, end_date } = args;
      
      console.log(`get_shopify_sales_summary: ${start_date} to ${end_date}`);
      
      // Query shopify_orders excluding cancelled/refunded
      const { data: orders, error } = await supabase
        .from('shopify_orders')
        .select(`
          id, shopify_order_id, order_number, total_price, subtotal_price,
          financial_status, fulfillment_status, created_at_shopify
        `)
        .eq('organization_id', organizationId)
        .gte('created_at_shopify', `${start_date}T00:00:00`)
        .lte('created_at_shopify', `${end_date}T23:59:59`)
        .is('cancelled_at', null)
        .not('financial_status', 'in', '("refunded","voided")');
      
      if (error) throw error;
      
      const ordersList = orders || [];
      const totalRevenue = ordersList.reduce((sum: number, o: unknown) => sum + (parseFloat(o.total_price) || 0), 0);
      const avgOrderValue = ordersList.length > 0 ? totalRevenue / ordersList.length : 0;
      
      // Group by financial status
      const byStatus: Record<string, { count: number; revenue: number }> = {};
      ordersList.forEach((o: unknown) => {
        const status = o.financial_status || 'unknown';
        if (!byStatus[status]) {
          byStatus[status] = { count: 0, revenue: 0 };
        }
        byStatus[status].count++;
        byStatus[status].revenue += parseFloat(o.total_price) || 0;
      });
      
      return {
        start_date,
        end_date,
        total_orders: ordersList.length,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        avg_order_value: Math.round(avgOrderValue * 100) / 100,
        by_financial_status: Object.entries(byStatus).map(([status, data]) => ({
          status,
          orders: data.count,
          revenue: Math.round(data.revenue * 100) / 100
        }))
      };
    }
    
    case "get_top_selling_products": {
      const { start_date, end_date, limit = 10, metric = 'units' } = args;
      
      console.log(`get_top_selling_products: ${start_date} to ${end_date}, metric: ${metric}, limit: ${limit}`);
      
      // First get valid order IDs (non-cancelled, non-refunded)
      const { data: validOrders, error: ordersError } = await supabase
        .from('shopify_orders')
        .select('id, shopify_order_id')
        .eq('organization_id', organizationId)
        .gte('created_at_shopify', `${start_date}T00:00:00`)
        .lte('created_at_shopify', `${end_date}T23:59:59`)
        .is('cancelled_at', null)
        .not('financial_status', 'in', '("refunded","voided")');
      
      if (ordersError) throw ordersError;
      
      const validOrderIds = (validOrders || []).map((o: unknown) => o.shopify_order_id);
      
      if (validOrderIds.length === 0) {
        return {
          start_date,
          end_date,
          total_orders: 0,
          products: [],
          message: "No hay órdenes de venta en este período"
        };
      }
      
      // Get line items for valid orders
      const { data: lineItems, error: itemsError } = await supabase
        .from('shopify_order_line_items')
        .select('title, variant_title, quantity, price, sku, shopify_order_id')
        .in('shopify_order_id', validOrderIds);
      
      if (itemsError) throw itemsError;
      
      // Aggregate by product
      const productMap: Record<string, { 
        title: string; 
        variant_title: string;
        units: number; 
        revenue: number; 
        orders: Set<number>;
      }> = {};
      
      (lineItems || []).forEach((item: unknown) => {
        const key = item.title;
        if (!productMap[key]) {
          productMap[key] = { 
            title: item.title,
            variant_title: item.variant_title || '',
            units: 0, 
            revenue: 0,
            orders: new Set()
          };
        }
        productMap[key].units += item.quantity || 0;
        productMap[key].revenue += (item.quantity || 0) * (parseFloat(item.price) || 0);
        productMap[key].orders.add(item.shopify_order_id);
      });
      
      // Convert to array and sort
      const products = Object.values(productMap).map(p => ({
        product: p.title,
        units_sold: p.units,
        revenue: Math.round(p.revenue * 100) / 100,
        orders_count: p.orders.size
      }));
      
      // Sort by metric
      if (metric === 'revenue') {
        products.sort((a, b) => b.revenue - a.revenue);
      } else {
        products.sort((a, b) => b.units_sold - a.units_sold);
      }
      
      return {
        start_date,
        end_date,
        metric,
        total_orders: validOrderIds.length,
        total_units_sold: products.reduce((sum, p) => sum + p.units_sold, 0),
        total_revenue: Math.round(products.reduce((sum, p) => sum + p.revenue, 0) * 100) / 100,
        products: products.slice(0, limit)
      };
    }
    
    case "search_deliveries": {
      const { product_name, status, workshop_name, tracking_number, size, color, limit = 10 } = args;
      
      console.log(`search_deliveries: product=${product_name}, status=${status}, workshop=${workshop_name}, tracking=${tracking_number}, size=${size}, color=${color}`);
      
      let query = supabase
        .from('deliveries')
        .select(`
          id, tracking_number, status, delivery_date, notes,
          workshops(name),
          delivery_items(
            quantity_delivered, quantity_approved, quantity_defective,
            order_items(
              product_variants(
                sku_variant, color, size,
                products(name, sku)
              )
            )
          )
        `)
        .eq('organization_id', organizationId)
        .order('delivery_date', { ascending: false })
        .limit(limit);
      
      // Map user-friendly status terms to actual status values
      if (status) {
        const statusMap: Record<string, string> = {
          'en_revision': 'in_quality',
          'en revisión': 'in_quality',
          'revision': 'in_quality',
          'calidad': 'in_quality',
          'pendiente': 'pending',
          'transito': 'in_transit',
          'en_transito': 'in_transit',
          'aprobada': 'approved',
          'completada': 'completed'
        };
        const actualStatus = statusMap[status.toLowerCase()] || status;
        query = query.eq('status', actualStatus);
      }
      
      // Filter by tracking number
      if (tracking_number) {
        query = query.ilike('tracking_number', `%${tracking_number}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      let deliveries = data || [];
      
      // Filter by workshop name if provided (post-query due to nested join)
      if (workshop_name) {
        deliveries = deliveries.filter((d: unknown) => 
          d.workshops?.name?.toLowerCase().includes(workshop_name.toLowerCase())
        );
      }
      
      // Filter by product name if provided (post-query filter due to nested structure)
      if (product_name) {
        deliveries = deliveries.filter((d: unknown) => 
          d.delivery_items?.some((item: unknown) => 
            item.order_items?.product_variants?.products?.name?.toLowerCase()
              .includes(product_name.toLowerCase())
          )
        );
      }
      
      // Helper function to check if a size matches (handles different formats)
      const sizeMatches = (variantSize: string | null, searchSize: string): boolean => {
        if (!variantSize || !searchSize) return false;
        const normalizedVariant = variantSize.toLowerCase().trim();
        const normalizedSearch = searchSize.toLowerCase().trim();
        
        // Direct match
        if (normalizedVariant === normalizedSearch) return true;
        
        // Check if variant contains the search term (e.g., "6 (3-4 años)" contains "6")
        if (normalizedVariant.includes(normalizedSearch)) return true;
        
        // Check if search contains the variant
        if (normalizedSearch.includes(normalizedVariant)) return true;
        
        // Extract just the number from sizes like "6 (3-4 años)"
        const variantNumber = normalizedVariant.match(/^(\d+)/)?.[1];
        const searchNumber = normalizedSearch.match(/^(\d+)/)?.[1];
        if (variantNumber && searchNumber && variantNumber === searchNumber) return true;
        
        return false;
      };
      
      // Filter by size if provided
      if (size) {
        deliveries = deliveries.filter((d: unknown) => 
          d.delivery_items?.some((item: unknown) => 
            sizeMatches(item.order_items?.product_variants?.size, size)
          )
        );
      }
      
      // Filter by color if provided
      if (color) {
        deliveries = deliveries.filter((d: unknown) => 
          d.delivery_items?.some((item: unknown) => 
            item.order_items?.product_variants?.color?.toLowerCase().includes(color.toLowerCase())
          )
        );
      }
      
      console.log(`search_deliveries: found ${deliveries.length} deliveries after filtering`);
      
      return deliveries.map((d: unknown) => {
        // Extract detailed variants
        const variants = d.delivery_items?.map((item: unknown) => ({
          product: item.order_items?.product_variants?.products?.name,
          sku: item.order_items?.product_variants?.products?.sku,
          color: item.order_items?.product_variants?.color,
          size: item.order_items?.product_variants?.size,
          sku_variant: item.order_items?.product_variants?.sku_variant,
          quantity_delivered: item.quantity_delivered,
          quantity_approved: item.quantity_approved,
          quantity_defective: item.quantity_defective
        })).filter((v: unknown) => v.product) || [];
        
        const uniqueProducts = [...new Set(variants.map((v: unknown) => v.product))];
        const uniqueSizes = [...new Set(variants.map((v: unknown) => v.size).filter(Boolean))];
        const uniqueColors = [...new Set(variants.map((v: unknown) => v.color).filter(Boolean))];
        
        const totalDelivered = d.delivery_items?.reduce(
          (s: number, i: unknown) => s + (i.quantity_delivered || 0), 0
        ) || 0;
        
        const totalApproved = d.delivery_items?.reduce(
          (s: number, i: unknown) => s + (i.quantity_approved || 0), 0
        ) || 0;
        
        const totalDefective = d.delivery_items?.reduce(
          (s: number, i: unknown) => s + (i.quantity_defective || 0), 0
        ) || 0;
        
        return {
          tracking_number: d.tracking_number,
          status: d.status,
          delivery_date: d.delivery_date,
          workshop: d.workshops?.name,
          products: uniqueProducts,
          sizes_included: uniqueSizes,
          colors_included: uniqueColors,
          variants: variants,
          total_delivered: totalDelivered,
          total_approved: totalApproved,
          total_defective: totalDefective,
          items_count: d.delivery_items?.length || 0
        };
      });
    }
    
    case "get_delivery_variants": {
      const { tracking_number, product_name } = args;
      
      console.log(`get_delivery_variants: tracking=${tracking_number}, product=${product_name}`);
      
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          tracking_number, status, delivery_date,
          workshops(name),
          delivery_items(
            quantity_delivered, quantity_approved, quantity_defective,
            order_items(
              quantity,
              product_variants(
                sku_variant, color, size,
                products(name, sku)
              )
            )
          )
        `)
        .eq('organization_id', organizationId)
        .ilike('tracking_number', `%${tracking_number}%`)
        .single();
        
      if (error) {
        console.log(`get_delivery_variants error:`, error);
        return { error: `No se encontró la entrega ${tracking_number}` };
      }
      
      const variants = data?.delivery_items?.map((item: unknown) => ({
        product: item.order_items?.product_variants?.products?.name,
        sku: item.order_items?.product_variants?.products?.sku,
        sku_variant: item.order_items?.product_variants?.sku_variant,
        color: item.order_items?.product_variants?.color,
        size: item.order_items?.product_variants?.size,
        quantity_ordered: item.order_items?.quantity,
        quantity_delivered: item.quantity_delivered,
        quantity_approved: item.quantity_approved,
        quantity_defective: item.quantity_defective
      })).filter((v: unknown) => {
        if (!v.product) return false;
        if (product_name) {
          return v.product.toLowerCase().includes(product_name.toLowerCase());
        }
        return true;
      }) || [];
      
      const uniqueSizes = [...new Set(variants.map((v: unknown) => v.size).filter(Boolean))];
      const uniqueColors = [...new Set(variants.map((v: unknown) => v.color).filter(Boolean))];
      const uniqueProducts = [...new Set(variants.map((v: unknown) => v.product).filter(Boolean))];
      
      return {
        tracking_number: data?.tracking_number,
        status: data?.status,
        workshop: data?.workshops?.name,
        delivery_date: data?.delivery_date,
        variants: variants,
        summary: {
          total_variants: variants.length,
          products: uniqueProducts,
          sizes_included: uniqueSizes,
          colors_included: uniqueColors,
          total_delivered: variants.reduce((s: number, v: unknown) => s + (v.quantity_delivered || 0), 0),
          total_approved: variants.reduce((s: number, v: unknown) => s + (v.quantity_approved || 0), 0)
        }
      };
    }
    
    case "find_variant_location": {
      const { product_name, size, color } = args;
      
      console.log(`find_variant_location: product=${product_name}, size=${size}, color=${color}`);
      
      // Helper function to check if a size matches
      const sizeMatches = (variantSize: string | null, searchSize: string): boolean => {
        if (!variantSize || !searchSize) return !searchSize;
        const normalizedVariant = variantSize.toLowerCase().trim();
        const normalizedSearch = searchSize.toLowerCase().trim();
        if (normalizedVariant === normalizedSearch) return true;
        if (normalizedVariant.includes(normalizedSearch)) return true;
        const variantNumber = normalizedVariant.match(/^(\d+)/)?.[1];
        const searchNumber = normalizedSearch.match(/^(\d+)/)?.[1];
        if (variantNumber && searchNumber && variantNumber === searchNumber) return true;
        return false;
      };
      
      const colorMatches = (variantColor: string | null, searchColor: string): boolean => {
        if (!searchColor) return true;
        if (!variantColor) return false;
        return variantColor.toLowerCase().includes(searchColor.toLowerCase());
      };
      
      // 1. Check in inventory (product_variants)
      const { data: products, error: productError } = await supabase
        .from('products')
        .select(`
          name, sku,
          product_variants(id, sku_variant, color, size, stock_quantity)
        `)
        .eq('organization_id', organizationId)
        .ilike('name', `%${product_name}%`);
      
      if (productError) throw productError;
      
      const matchingVariants = (products || []).flatMap((p: unknown) => 
        (p.product_variants || [])
          .filter((v: unknown) => sizeMatches(v.size, size) && colorMatches(v.color, color))
          .map((v: unknown) => ({
            product: p.name,
            sku_variant: v.sku_variant,
            color: v.color,
            size: v.size,
            stock: v.stock_quantity || 0,
            variant_id: v.id
          }))
      );
      
      // 2. Check in active orders (pending, assigned, in_progress)
      // IMPORTANTE: "assigned" es el estado más común - significa asignado a taller pero sin iniciar
      const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, due_date,
          order_items(
            id, quantity,
            product_variants(
              id, sku_variant, color, size,
              products(name)
            )
          )
        `)
        .eq('organization_id', organizationId)
        .in('status', ['pending', 'assigned', 'in_progress']);
      
      if (orderError) throw orderError;
      
      // Get all order_item_ids that match our criteria
      const orderItemIds: string[] = [];
      const orderItemQuantities: { [key: string]: number } = {};
      
      (orders || []).forEach((o: unknown) => {
        (o.order_items || []).forEach((item: unknown) => {
          const pn = item.product_variants?.products?.name;
          if (pn && pn.toLowerCase().includes(product_name.toLowerCase())) {
            if (sizeMatches(item.product_variants?.size, size) && colorMatches(item.product_variants?.color, color)) {
              orderItemIds.push(item.id);
              orderItemQuantities[item.id] = item.quantity;
            }
          }
        });
      });
      
      // Get delivered quantities for these order items
      const deliveredByOrderItem: { [key: string]: number } = {};
      if (orderItemIds.length > 0) {
        const { data: deliveryItems } = await supabase
          .from('delivery_items')
          .select('order_item_id, quantity_delivered')
          .in('order_item_id', orderItemIds);
        
        (deliveryItems || []).forEach((di: unknown) => {
          deliveredByOrderItem[di.order_item_id] = (deliveredByOrderItem[di.order_item_id] || 0) + di.quantity_delivered;
        });
      }
      
      // Build order results with pending quantities
      const statusLabels: { [key: string]: string } = {
        'pending': 'Pendiente de asignar',
        'assigned': 'Asignado a taller',
        'in_progress': 'En producción activa'
      };
      
      const inOrders = (orders || []).flatMap((o: unknown) => 
        (o.order_items || [])
          .filter((item: unknown) => {
            const pn = item.product_variants?.products?.name;
            if (!pn || !pn.toLowerCase().includes(product_name.toLowerCase())) return false;
            return sizeMatches(item.product_variants?.size, size) && colorMatches(item.product_variants?.color, color);
          })
          .map((item: unknown) => {
            const ordered = item.quantity || 0;
            const delivered = deliveredByOrderItem[item.id] || 0;
            const pending = ordered - delivered;
            return {
              order_number: o.order_number,
              status: o.status,
              status_label: statusLabels[o.status] || o.status,
              due_date: o.due_date,
              product: item.product_variants?.products?.name,
              size: item.product_variants?.size,
              color: item.product_variants?.color,
              quantity_ordered: ordered,
              quantity_delivered: delivered,
              quantity_pending: pending
            };
          })
          .filter((item: unknown) => item.quantity_pending > 0) // Only show if there's pending quantity
      );
      
      // 3. Check in deliveries (pending, in_transit, in_quality)
      const { data: deliveries, error: deliveryError } = await supabase
        .from('deliveries')
        .select(`
          tracking_number, status, delivery_date,
          workshops(name),
          delivery_items(
            quantity_delivered, quantity_approved,
            order_items(
              product_variants(
                sku_variant, color, size,
                products(name)
              )
            )
          )
        `)
        .eq('organization_id', organizationId)
        .in('status', ['pending', 'in_transit', 'in_quality', 'approved']);
      
      if (deliveryError) throw deliveryError;
      
      const inDeliveries = (deliveries || []).flatMap((d: unknown) => 
        (d.delivery_items || [])
          .filter((item: unknown) => {
            const pn = item.order_items?.product_variants?.products?.name;
            if (!pn || !pn.toLowerCase().includes(product_name.toLowerCase())) return false;
            return sizeMatches(item.order_items?.product_variants?.size, size) && 
                   colorMatches(item.order_items?.product_variants?.color, color);
          })
          .map((item: unknown) => ({
            tracking_number: d.tracking_number,
            delivery_status: d.status,
            workshop: d.workshops?.name,
            delivery_date: d.delivery_date,
            product: item.order_items?.product_variants?.products?.name,
            size: item.order_items?.product_variants?.size,
            color: item.order_items?.product_variants?.color,
            quantity_delivered: item.quantity_delivered,
            quantity_approved: item.quantity_approved
          }))
      );
      
      return {
        search_criteria: { product_name, size, color },
        inventory: {
          found: matchingVariants.length > 0,
          variants: matchingVariants,
          total_stock: matchingVariants.reduce((s: number, v: unknown) => s + (v.stock || 0), 0)
        },
        production_orders: {
          found: inOrders.length > 0,
          items: inOrders,
          total_ordered: inOrders.reduce((s: number, o: unknown) => s + (o.quantity_ordered || 0), 0),
          total_delivered: inOrders.reduce((s: number, o: unknown) => s + (o.quantity_delivered || 0), 0),
          total_pending: inOrders.reduce((s: number, o: unknown) => s + (o.quantity_pending || 0), 0)
        },
        deliveries: {
          found: inDeliveries.length > 0,
          items: inDeliveries,
          total_delivered: inDeliveries.reduce((s: number, d: unknown) => s + (d.quantity_delivered || 0), 0),
          total_approved: inDeliveries.reduce((s: number, d: unknown) => s + (d.quantity_approved || 0), 0)
        },
        summary: {
          variant_exists: matchingVariants.length > 0,
          available_stock: matchingVariants.reduce((s: number, v: unknown) => s + (v.stock || 0), 0),
          pending_in_production: inOrders.reduce((s: number, o: unknown) => s + (o.quantity_pending || 0), 0),
          in_deliveries: inDeliveries.reduce((s: number, d: unknown) => s + (d.quantity_delivered || 0), 0)
        }
      };
    }
    
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authResult = await requireAuthenticatedUser(req, corsHeaders);
    if (!authResult.ok) {
      return authResult.response;
    }
    console.log("✅ Authenticated user for sewdle-copilot:", authResult.userId);

    const body = await req.json();
    const { action, message, conversationHistory, organizationId } = body;
    
    // Handle test-connection action - just verify API key exists
    if (action === 'test-connection') {
      console.log("sewdle-copilot: Testing connection for org:", organizationId);
      
      if (!LOVABLE_API_KEY) {
        return new Response(
          JSON.stringify({ connected: false, error: "LOVABLE_API_KEY is not configured" }), 
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Verify the API key is valid by making a simple models list request
      try {
        const modelsResponse = await fetch("https://ai.gateway.lovable.dev/v1/models", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
          },
        });
        
        if (modelsResponse.ok) {
          return new Response(
            JSON.stringify({ connected: true, success: true }), 
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          const errorText = await modelsResponse.text();
          console.error("Lovable AI gateway validation failed:", modelsResponse.status, errorText);
          return new Response(
            JSON.stringify({ connected: false, error: "API Key inválida" }), 
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (fetchError) {
        console.error("Error validating Lovable AI key:", fetchError);
        return new Response(
          JSON.stringify({ connected: false, error: "Error al validar API Key" }), 
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }
    
    if (!organizationId) {
      throw new Error("Organization ID is required");
    }
    
    console.log(`Copilot request for org ${organizationId}: ${message}`);
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get current date in Colombian timezone with exact date ranges
    const now = new Date();
    
    // Calculate date strings in Bogota timezone
    const bogotaFormatter = new Intl.DateTimeFormat('es-CO', { 
      timeZone: 'America/Bogota',
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit'
    });
    const parts = bogotaFormatter.formatToParts(now);
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '2026');
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '1');
    const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
    
    // Today ISO
    const todayISO = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // This month range
    const thisMonthStartISO = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const thisMonthEndISO = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
    
    // This week range (Monday to Sunday)
    const currentDayOfWeek = new Date(year, month - 1, day).getDay();
    const mondayOffset = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
    const mondayDate = new Date(year, month - 1, day + mondayOffset);
    const sundayDate = new Date(mondayDate);
    sundayDate.setDate(mondayDate.getDate() + 6);
    const thisWeekStartISO = `${mondayDate.getFullYear()}-${String(mondayDate.getMonth() + 1).padStart(2, '0')}-${String(mondayDate.getDate()).padStart(2, '0')}`;
    const thisWeekEndISO = `${sundayDate.getFullYear()}-${String(sundayDate.getMonth() + 1).padStart(2, '0')}-${String(sundayDate.getDate()).padStart(2, '0')}`;
    
    // Last 7 days range
    const last7DaysStart = new Date(year, month - 1, day - 7);
    const last7DaysStartISO = `${last7DaysStart.getFullYear()}-${String(last7DaysStart.getMonth() + 1).padStart(2, '0')}-${String(last7DaysStart.getDate()).padStart(2, '0')}`;
    
    // Last 30 days range  
    const last30DaysStart = new Date(year, month - 1, day - 30);
    const last30DaysStartISO = `${last30DaysStart.getFullYear()}-${String(last30DaysStart.getMonth() + 1).padStart(2, '0')}-${String(last30DaysStart.getDate()).padStart(2, '0')}`;
    
    // Last 90 days range
    const last90DaysStart = new Date(year, month - 1, day - 90);
    const last90DaysStartISO = `${last90DaysStart.getFullYear()}-${String(last90DaysStart.getMonth() + 1).padStart(2, '0')}-${String(last90DaysStart.getDate()).padStart(2, '0')}`;
    
    const dateString = now.toLocaleDateString('es-CO', { 
      timeZone: 'America/Bogota',
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const currentMonthName = now.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', month: 'long', year: 'numeric' });
    
    console.log(`Date context: today=${todayISO}, thisMonth=${thisMonthStartISO} to ${thisMonthEndISO}, thisWeek=${thisWeekStartISO} to ${thisWeekEndISO}, last30Days=${last30DaysStartISO}`);

    const systemPrompt = `Eres Sewdle Copilot, un asistente EXPERTO en gestión de producción textil. Tienes conocimiento profundo del modelo de datos y los flujos del negocio.

═══════════════════════════════════════════════════════════════════
                    📋 MANUAL DEL NEGOCIO SEWDLE
═══════════════════════════════════════════════════════════════════

🏢 MODELO DE DATOS Y RELACIONES:

┌─────────────────────────────────────────────────────────────────┐
│ 📦 PRODUCTOS Y VARIANTES                                        │
├─────────────────────────────────────────────────────────────────┤
│ products (Producto base)                                         │
│   - name: nombre del producto (ej: "Ruana de Super Gatica Pink")│
│   - sku: código único del producto                               │
│   - category: categoría (ruanas, camisetas, etc.)               │
│   - status: active, inactive                                     │
│                                                                  │
│   └── product_variants (Variantes = Color + Talla)               │
│         - sku_variant: código único de variante                  │
│         - color: color de la variante                            │
│         - size: talla (ej: "6", "8", "6 (3-4 años)")            │
│         - stock_quantity: inventario disponible actual           │
│                                                                  │
│ IMPORTANTE sobre TALLAS:                                         │
│ - Las tallas pueden aparecer como "6" o "6 (3-4 años)"          │
│ - Siempre busca coincidencias parciales                          │
│ - La talla "6" coincide con "6 (3-4 años)"                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 🏭 ÓRDENES DE PRODUCCIÓN                                        │
├─────────────────────────────────────────────────────────────────┤
│ orders (Pedidos de producción asignados a talleres)              │
│   - order_number: número de orden (ej: "ORD-0001")              │
│   - due_date: fecha límite de entrega                            │
│                                                                  │
│ ESTADOS DE ÓRDENES (MUY IMPORTANTE):                              │
│   • "pending" = Orden creada, sin asignar a taller               │
│   • "assigned" = ASIGNADO a taller, pendiente de producir        │
│   • "in_progress" = En producción activa                          │
│   • "completed" = Producción completada                           │
│   • "cancelled" = Orden cancelada                                 │
│                                                                  │
│ 💡 ÓRDENES "ACTIVAS" incluyen: pending, assigned, in_progress    │
│    El status MÁS COMÚN es "assigned" - NO ignorarlo!             │
│                                                                  │
│   └── order_items (Líneas de la orden)                           │
│         - product_variant_id → product_variants                  │
│         - quantity: cantidad solicitada a fabricar               │
│                                                                  │
│   └── workshop_assignments (Asignación a taller)                 │
│         - workshop_id → workshops                                │
│         - assigned_date: fecha de asignación                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 📦 ENTREGAS (DIFERENTE DE ÓRDENES)                              │
├─────────────────────────────────────────────────────────────────┤
│ deliveries (Productos físicos entregados por talleres)           │
│   - tracking_number: número de seguimiento (ej: "DEL-0366")     │
│   - status: pending, in_transit, in_quality, approved, completed│
│   - delivery_date: fecha de entrega                              │
│   - workshop_id → workshops                                      │
│                                                                  │
│   └── delivery_items (Items de la entrega)                       │
│         - order_item_id → order_items → product_variants        │
│         - quantity_delivered: unidades físicas entregadas        │
│         - quantity_approved: aprobadas en control calidad        │
│         - quantity_defective: rechazadas por defectos           │
│                                                                  │
│ ESTADOS DE ENTREGAS:                                             │
│   • pending = pendiente de envío desde taller                    │
│   • in_transit = en camino hacia la empresa                      │
│   • in_quality = EN REVISIÓN / control de calidad               │
│   • approved = aprobada, lista para inventario                   │
│   • completed = proceso completo                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 🛒 VENTAS SHOPIFY                                               │
├─────────────────────────────────────────────────────────────────┤
│ shopify_orders (Órdenes de clientes en tienda online)           │
│   - order_number: #1001, #1002...                               │
│   - total_price: valor total de la venta                         │
│   - financial_status: paid, pending, refunded...                 │
│   - fulfillment_status: fulfilled, unfulfilled                   │
│                                                                  │
│   └── shopify_order_line_items (Productos vendidos)              │
│         - title: nombre del producto                             │
│         - variant_title: variante (color/talla)                  │
│         - quantity: unidades vendidas                            │
│         - price: precio unitario                                 │
│         - sku: código SKU                                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 🏪 TALLERES                                                     │
├─────────────────────────────────────────────────────────────────┤
│ workshops (Talleres de confección)                               │
│   - name: nombre del taller                                      │
│   - contact_name: nombre del contacto                            │
│   - phone: teléfono                                              │
│   - location: ubicación                                          │
│                                                                  │
│ workshop_pricing (Precios por producto/taller)                   │
│   - precio que se paga al taller por unidad producida           │
│                                                                  │
│ delivery_payments (Pagos por entregas)                           │
│   - payment_status: pending, paid                                │
│   - net_amount: monto neto a pagar                               │
│                                                                  │
│ order_advances (Anticipos a talleres)                            │
│   - amount: monto del anticipo                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 📊 MATERIALES E INVENTARIO                                      │
├─────────────────────────────────────────────────────────────────┤
│ materials (Materias primas)                                      │
│   - name, sku, category, unit                                    │
│   - current_stock: stock actual                                  │
│                                                                  │
│ material_inventory (Stock por ubicación)                         │
│   - location_type: warehouse, workshop                           │
│   - current_stock: cantidad en esa ubicación                     │
│                                                                  │
│ material_deliveries (Entregas de material a talleres)            │
│   - quantity_delivered: material enviado                         │
│   - quantity_remaining: material disponible en taller            │
└─────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════
                    📅 CONTEXTO TEMPORAL
═══════════════════════════════════════════════════════════════════

FECHA ACTUAL: ${dateString}
MES ACTUAL: ${currentMonthName}
AÑO ACTUAL: ${year}
HOY (ISO): ${todayISO}

RANGOS DE FECHAS PRECALCULADOS (USA ESTOS VALORES EXACTOS):
- "hoy" → start_date: "${todayISO}", end_date: "${todayISO}"
- "esta semana" → start_date: "${thisWeekStartISO}", end_date: "${thisWeekEndISO}"
- "este mes" → start_date: "${thisMonthStartISO}", end_date: "${thisMonthEndISO}"
- "últimos 7 días" → start_date: "${last7DaysStartISO}", end_date: "${todayISO}"
- "últimos 30 días" → start_date: "${last30DaysStartISO}", end_date: "${todayISO}"
- "últimos 90 días" → start_date: "${last90DaysStartISO}", end_date: "${todayISO}"

═══════════════════════════════════════════════════════════════════
                    🔧 GUÍA DE HERRAMIENTAS
═══════════════════════════════════════════════════════════════════

📊 VENTAS (Shopify - lo que compran los clientes):
   • "Ventas de hoy/esta semana/este mes" → get_shopify_sales_summary
   • "Producto más vendido" → get_top_selling_products

🏭 PRODUCCIÓN (lo que fabrican los talleres):
   • "Producción aprobada" → get_approved_production
   • "Órdenes de producción" → get_production_summary
   • "Buscar orden ORD-001" → search_orders

📦 ENTREGAS (productos físicos de talleres → control de calidad):
   • "Entregas en revisión" → search_deliveries con status: "in_quality"
   • "Entregas con producto X" → search_deliveries con product_name
   • "Entregas del taller Y" → search_deliveries con workshop_name
   • "Entrega DEL-0366" → search_deliveries con tracking_number
   • "¿Hay talla 6 en entregas?" → search_deliveries con size: "6"
   
📋 DETALLES DE VARIANTES EN ENTREGAS:
   • "¿Qué variantes tiene DEL-0366?" → get_delivery_variants
   • "Mostrar tallas en entrega X" → get_delivery_variants
   
🔍 UBICACIÓN DE VARIANTES:
   • "¿Dónde está la talla 6 de X?" → find_variant_location
   • "¿Hay talla 8 en stock/producción?" → find_variant_location

🏪 TALLERES:
   • "Ranking de talleres" → get_workshop_ranking
   • "Estadísticas de taller X" → get_workshop_stats

📦 INVENTARIO:
   • "Stock de producto X" → get_inventory_status
   • "Productos con bajo stock" → get_inventory_status con low_stock_only: true

═══════════════════════════════════════════════════════════════════
                    🧠 INSTRUCCIONES DE RAZONAMIENTO
═══════════════════════════════════════════════════════════════════

CUANDO BUSQUES VARIANTES ESPECÍFICAS (tallas, colores):
1. PRIMERO usa search_deliveries con los filtros apropiados (product_name, status, size)
2. Si la búsqueda devuelve resultados vacíos, usa get_delivery_variants para ver qué variantes SÍ existen
3. Usa find_variant_location para dar una respuesta completa sobre dónde está la variante

CUANDO NO ENCUENTRES ALGO:
1. Confirma que buscaste en el lugar correcto
2. Muestra qué variantes/tallas SÍ existen
3. Sugiere alternativas si es posible

DIFERENCIA CRÍTICA - NO CONFUNDIR:
• ÓRDENES (orders) = pedidos de producción → search_orders
• ENTREGAS (deliveries) = productos físicos recibidos → search_deliveries
• VENTAS (shopify_orders) = compras de clientes → get_shopify_sales_summary

═══════════════════════════════════════════════════════════════════
                    📝 REGLAS DE RESPUESTA
═══════════════════════════════════════════════════════════════════

1. Solo usa información REAL de la base de datos - NUNCA inventes
2. Responde siempre en español
3. Sé conciso pero informativo
4. Usa formato estructurado (tablas markdown o listas)
5. NO pidas fechas si el usuario usa términos temporales (ya tienes los rangos)
6. Cuando muestres variantes, incluye: producto, talla, color, cantidad

FORMATO DE RESPUESTA:
1. Resumen corto (1-2 líneas)
2. Datos en formato claro (tabla markdown si hay múltiples items)
3. Si no encontraste lo buscado, muestra qué SÍ existe`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(conversationHistory || []),
      { role: "user", content: message }
    ];

    // First call - let AI decide which tools to use
    const initialResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools,
        tool_choice: "auto"
      }),
    });

    if (!initialResponse.ok) {
      const status = initialResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ 
          error: "Límite de solicitudes excedido. Por favor, intenta en unos segundos." 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ 
          error: "Créditos de IA agotados. Contacta al administrador." 
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await initialResponse.text();
      console.error("AI gateway error:", status, errorText);
      throw new Error(`AI gateway error: ${status}`);
    }

    const initialData = await initialResponse.json();
    const assistantMessage = initialData.choices[0].message;

    // Check if AI wants to use tools
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log("AI requested tools:", assistantMessage.tool_calls.map((t: unknown) => t.function.name));
      
      const toolResults = [];
      
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
        
        try {
          const result = await executeTool(supabase, toolName, toolArgs, organizationId);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            content: JSON.stringify(result)
          });
          console.log(`Tool ${toolName} returned ${Array.isArray(result) ? result.length : 'object'} results`);
        } catch (error) {
          console.error(`Tool ${toolName} error:`, error);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: "tool",
            content: JSON.stringify({ error: `Error ejecutando consulta: ${error.message}` })
          });
        }
      }
      
      // Second call with tool results
      const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            ...messages,
            assistantMessage,
            ...toolResults
          ],
          stream: true
        }),
      });

      if (!finalResponse.ok) {
        throw new Error(`AI gateway error: ${finalResponse.status}`);
      }

      // Return streaming response
      return new Response(finalResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tools needed - stream the direct response
    const directResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        stream: true
      }),
    });

    return new Response(directResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Copilot error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Error desconocido" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
