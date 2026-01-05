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
    
    // Get current date in Colombian timezone
    const currentDate = new Date();
    const dateOptions: Intl.DateTimeFormatOptions = { 
      timeZone: 'America/Bogota',
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    const dateString = currentDate.toLocaleDateString('es-CO', dateOptions);
    const currentMonth = currentDate.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', month: 'long', year: 'numeric' });
    const currentYear = currentDate.getFullYear();

    const systemPrompt = `Eres Sewdle Copilot, un asistente inteligente para gestión de producción textil.

FECHA ACTUAL: ${dateString}
MES ACTUAL: ${currentMonth}
AÑO ACTUAL: ${currentYear}

INTERPRETACIÓN DE FECHAS:
- "hoy" = ${dateString}
- "este mes" = ${currentMonth}
- "esta semana" = semana que incluye ${dateString}
- "este año" = ${currentYear}

REGLAS IMPORTANTES:
1. Solo responde con información real de la base de datos - NUNCA inventes datos
2. Si no encuentras información, dilo claramente y sugiere otra búsqueda
3. Responde siempre en español
4. Sé conciso pero informativo
5. Cuando muestres datos, usa formato estructurado (listas o tablas en markdown)
6. Al final de cada respuesta con datos, sugiere una acción siguiente
7. USA LA FECHA ACTUAL para interpretar referencias temporales como "hoy", "este mes", "esta semana"

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
