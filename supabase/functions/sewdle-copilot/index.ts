import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      description: "Search orders by product name, status, workshop, or date range. Use this to find specific orders or filter orders.",
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
      description: "Search products by name or SKU",
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
      description: "Get ranking of workshops by performance metric",
      parameters: {
        type: "object",
        properties: {
          metric: { type: "string", description: "Metric to rank by: 'delays', 'volume', 'quality' (default: volume)" },
          limit: { type: "number", description: "Top N workshops to return (default 5)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_inventory_status",
      description: "Get inventory status - low stock alerts, stock levels",
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
      description: "Get approved production (quantity_approved from deliveries) for a specific date range. Use this when user asks about 'producción aprobada', 'unidades aprobadas', or approved production.",
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
      description: "Get Shopify sales summary for a date range. Use for 'ventas', 'cuánto vendimos', 'órdenes de Shopify', 'cuántas ventas', or any sales metrics questions.",
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
      description: "Get top selling products from Shopify sales. Use for 'producto más vendido', 'productos top', 'best sellers', 'qué producto se vende más', or ranking of products by sales.",
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
  }
];

// Execute tool functions
async function executeTool(supabase: any, toolName: string, args: any, organizationId: string) {
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
        results = results.filter((order: any) => 
          order.order_items?.some((item: any) => 
            item.product_variants?.products?.name?.toLowerCase().includes(searchTerm)
          )
        );
      }
      
      return results.map((order: any) => ({
        order_number: order.order_number,
        status: order.status,
        due_date: order.due_date,
        created_at: order.created_at,
        items: order.order_items?.map((item: any) => ({
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
      
      return (data || []).map((order: any) => {
        const dueDate = new Date(order.due_date);
        const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          order_number: order.order_number,
          status: order.status,
          due_date: order.due_date,
          days_overdue: daysOverdue,
          products: order.order_items?.map((i: any) => i.product_variants?.products?.name).filter(Boolean)
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
      
      return (data || []).map((workshop: any) => ({
        name: workshop.name,
        contact: workshop.contact_name,
        total_deliveries: workshop.deliveries?.length || 0,
        pending_deliveries: workshop.deliveries?.filter((d: any) => d.status === 'pending').length || 0,
        completed_deliveries: workshop.deliveries?.filter((d: any) => d.status === 'completed').length || 0
      }));
    }
    
    case "get_deliveries_summary": {
      const period = args.period || 'month';
      let startDate = new Date();
      
      switch (period) {
        case 'today': startDate.setHours(0, 0, 0, 0); break;
        case 'week': startDate.setDate(startDate.getDate() - 7); break;
        case 'month': startDate.setMonth(startDate.getMonth() - 1); break;
        case 'year': startDate.setFullYear(startDate.getFullYear() - 1); break;
      }
      
      let query = supabase
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
      const totalDelivered = deliveries.reduce((sum: number, d: any) => 
        sum + (d.delivery_items?.reduce((s: number, i: any) => s + (i.quantity_delivered || 0), 0) || 0), 0);
      const totalApproved = deliveries.reduce((sum: number, d: any) => 
        sum + (d.delivery_items?.reduce((s: number, i: any) => s + (i.quantity_approved || 0), 0) || 0), 0);
      
      // Group by workshop
      const byWorkshop: Record<string, number> = {};
      deliveries.forEach((d: any) => {
        const workshopName = d.workshops?.name || 'Sin taller';
        const units = d.delivery_items?.reduce((s: number, i: any) => s + (i.quantity_delivered || 0), 0) || 0;
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
      
      return (data || []).map((p: any) => ({
        name: p.name,
        sku: p.sku,
        category: p.category,
        status: p.status,
        variants_count: p.product_variants?.length || 0,
        total_stock: p.product_variants?.reduce((s: number, v: any) => s + (v.stock_quantity || 0), 0) || 0
      }));
    }
    
    case "get_production_summary": {
      const period = args.period || 'month';
      let startDate = new Date();
      
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
      
      (orders || []).forEach((order: any) => {
        const status = order.status || 'pending';
        const units = order.order_items?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) || 0;
        
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
      
      const { data: workshops, error } = await supabase
        .from('workshops')
        .select(`
          id, name,
          deliveries(
            id, status, created_at,
            delivery_items(quantity_delivered, quantity_approved, quantity_defective)
          )
        `)
        .eq('organization_id', organizationId);
      
      if (error) throw error;
      
      const ranked = (workshops || []).map((w: any) => {
        const deliveries = w.deliveries || [];
        const totalDelivered = deliveries.reduce((sum: number, d: any) => 
          sum + (d.delivery_items?.reduce((s: number, i: any) => s + (i.quantity_delivered || 0), 0) || 0), 0);
        const totalDefective = deliveries.reduce((sum: number, d: any) => 
          sum + (d.delivery_items?.reduce((s: number, i: any) => s + (i.quantity_defective || 0), 0) || 0), 0);
        const qualityRate = totalDelivered > 0 ? ((totalDelivered - totalDefective) / totalDelivered * 100) : 100;
        
        return {
          name: w.name,
          total_deliveries: deliveries.length,
          total_units: totalDelivered,
          defective_units: totalDefective,
          quality_rate: Math.round(qualityRate * 10) / 10
        };
      });
      
      // Sort by metric
      if (metric === 'volume') {
        ranked.sort((a, b) => b.total_units - a.total_units);
      } else if (metric === 'quality') {
        ranked.sort((a, b) => b.quality_rate - a.quality_rate);
      } else if (metric === 'delays') {
        ranked.sort((a, b) => a.total_deliveries - b.total_deliveries); // Less is worse
      }
      
      return ranked.slice(0, limit);
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
      
      const results = (data || []).flatMap((p: any) => 
        (p.product_variants || []).map((v: any) => ({
          product: p.name,
          sku: v.sku_variant,
          variant: `${v.color || ''} ${v.size || ''}`.trim() || 'Default',
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
        deliveries = deliveries.filter((d: any) => 
          d.workshops?.name?.toLowerCase().includes(workshop_name.toLowerCase())
        );
      }
      
      const totalApproved = deliveries.reduce((sum: number, d: any) => 
        sum + (d.delivery_items?.reduce((s: number, i: any) => s + (i.quantity_approved || 0), 0) || 0), 0);
      
      // Group by workshop
      const byWorkshop: Record<string, number> = {};
      deliveries.forEach((d: any) => {
        const name = d.workshops?.name || 'Sin taller';
        const units = d.delivery_items?.reduce((s: number, i: any) => s + (i.quantity_approved || 0), 0) || 0;
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
      const totalRevenue = ordersList.reduce((sum: number, o: any) => sum + (parseFloat(o.total_price) || 0), 0);
      const avgOrderValue = ordersList.length > 0 ? totalRevenue / ordersList.length : 0;
      
      // Group by financial status
      const byStatus: Record<string, { count: number; revenue: number }> = {};
      ordersList.forEach((o: any) => {
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
      
      const validOrderIds = (validOrders || []).map((o: any) => o.shopify_order_id);
      
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
      
      (lineItems || []).forEach((item: any) => {
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
      let products = Object.values(productMap).map(p => ({
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
    
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory, organizationId } = await req.json();
    
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

    const systemPrompt = `Eres Sewdle Copilot, un asistente inteligente para gestión de producción textil.

FECHA ACTUAL: ${dateString}
MES ACTUAL: ${currentMonthName}
AÑO ACTUAL: ${year}
HOY (ISO): ${todayISO}

RANGOS DE FECHAS PARA HERRAMIENTAS (usa estos valores exactos - NO PIDAS FECHAS):
- "hoy" → start_date: "${todayISO}", end_date: "${todayISO}"
- "esta semana" → start_date: "${thisWeekStartISO}", end_date: "${thisWeekEndISO}"
- "este mes" → start_date: "${thisMonthStartISO}", end_date: "${thisMonthEndISO}"
- "últimos 7 días" / "última semana" → start_date: "${last7DaysStartISO}", end_date: "${todayISO}"
- "últimos 30 días" / "último mes" → start_date: "${last30DaysStartISO}", end_date: "${todayISO}"
- "últimos 90 días" / "últimos 3 meses" → start_date: "${last90DaysStartISO}", end_date: "${todayISO}"

DIFERENCIA CRÍTICA - ELIGE LA HERRAMIENTA CORRECTA:
1. VENTAS DE SHOPIFY (lo que se vendió a clientes):
   - "Ventas", "cuánto vendimos", "órdenes de Shopify" → get_shopify_sales_summary
   - "Producto más vendido", "qué se vendió más", "best sellers" → get_top_selling_products
   
2. PRODUCCIÓN (lo que fabrican los talleres):
   - "Producción aprobada", "unidades aprobadas", "entregas" → get_approved_production
   - "Órdenes de producción", "pedidos a talleres" → get_production_summary

REGLAS IMPORTANTES:
1. Solo responde con información real de la base de datos - NUNCA inventes datos
2. Si no encuentras información, dilo claramente
3. Responde siempre en español
4. Sé conciso pero informativo
5. Cuando muestres datos, usa formato estructurado (listas o tablas en markdown)
6. NUNCA pidas fechas si el usuario usa términos temporales como "hoy", "esta semana", "este mes", "últimos X días", "última semana", "último mes" - TÚ YA TIENES TODOS LOS RANGOS CALCULADOS ARRIBA
7. Solo pide aclaración si hay ambigüedad real (ej: "en abril" sin especificar año)

FORMATO DE RESPUESTA:
1. Resumen corto (1-2 líneas)
2. Datos en formato claro (tabla markdown o lista)
3. Sugerencia de acción (si aplica)

CONTEXTO: Estás ayudando a gestionar órdenes de producción, talleres, entregas e inventario.`;

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
      console.log("AI requested tools:", assistantMessage.tool_calls.map((t: any) => t.function.name));
      
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
