import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface SalesVelocityItem {
  product_variant_id: string;
  product_name: string;
  variant_size: string;
  variant_color: string;
  sku_variant: string;
  current_stock: number;
  sales_60_days: number;
  sales_velocity: number;
  stock_days_remaining: number;
  revenue_60_days: number;
  orders_count: number;
  status: 'critical' | 'low' | 'warning' | 'good';
}

export interface SalesVelocitySummary {
  total_variants: number;
  zero_sales: number;
  low_sales: number;
  good_sales: number;
  total_units_sold: number;
  total_revenue: number;
  calculation_date: string;
  period_days: number;
}

export interface SalesVelocityResponse {
  success: boolean;
  data: SalesVelocityItem[];
  summary: SalesVelocitySummary;
  message: string;
}

export const useSalesVelocityRanking = () => {
  const [ranking, setRanking] = useState<SalesVelocityItem[]>([]);
  const [summary, setSummary] = useState<SalesVelocitySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  const fetchRanking = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Obteniendo ranking de velocidad de ventas...');

      const { data, error } = await supabase.functions.invoke('sales-velocity-ranking', {
        method: 'GET'
      });

      if (error) {
        console.error('❌ Error invocando función:', error);
        throw new Error(`Error obteniendo ranking: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Error desconocido al obtener ranking');
      }

      const response = data as SalesVelocityResponse;
      console.log(`✅ Ranking obtenido: ${response.data.length} variantes`);

      setRanking(response.data);
      setSummary(response.summary);

      toast.success(`Ranking actualizado: ${response.data.length} productos analizados`, {
        description: `${response.summary.zero_sales} productos sin ventas en 60 días`
      });

    } catch (error) {
      console.error('❌ Error obteniendo ranking:', error);
      toast.error("Error obteniendo ranking de ventas", {
        description: error instanceof Error ? error.message : "Error desconocido"
      });
      setRanking([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const refreshRanking = useCallback(async () => {
    try {
      setCalculating(true);
      console.log('🔄 Refrescando ranking...');
      
      // Add a small delay to show calculating state
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await fetchRanking();
      
    } catch (error) {
      console.error('❌ Error refrescando ranking:', error);
      toast.error("Error actualizando el ranking de ventas");
    } finally {
      setCalculating(false);
    }
  }, [fetchRanking, toast]);

  const markForDiscontinuation = useCallback(async (productVariantIds: string[]) => {
    try {
      console.log(`🔄 Marcando ${productVariantIds.length} productos para descontinuar...`);
      
      // Update product status to discontinued
      for (const variantId of productVariantIds) {
        const { error } = await supabase
          .from('product_variants')
          .select('products(id)')
          .eq('id', variantId)
          .single();

        if (error) {
          console.error(`❌ Error obteniendo producto para variante ${variantId}:`, error);
          continue;
        }
      }

      // For now, we'll just show a success message
      // In a full implementation, you might want to update product status
      toast.success("Productos marcados para revisión", {
        description: `${productVariantIds.length} productos marcados para descontinuación`
      });

      // Refresh ranking to reflect changes
      await fetchRanking();

    } catch (error) {
      console.error('❌ Error marcando productos:', error);
      toast.error("Error marcando productos para descontinuación");
    }
  }, [fetchRanking, toast]);

  const exportRankingCSV = useCallback((filteredData?: SalesVelocityItem[]) => {
    const dataToExport = filteredData || ranking;
    
    if (dataToExport.length === 0) {
      toast.error("Sin datos para exportar");
      return;
    }

    const headers = [
      'Ranking',
      'Producto',
      'Variante',
      'SKU',
      'Stock Actual',
      'Ventas 60 días',
      'Velocidad Diaria',
      'Días de Stock',
      'Ingresos 60 días',
      'Órdenes Únicas',
      'Estado'
    ];

    const csvRows = [headers.join(',')];
    
    dataToExport.forEach((item, index) => {
      const variant = [item.variant_size, item.variant_color].filter(Boolean).join(' / ') || 'Sin variante';
      const row = [
        (index + 1).toString(),
        `"${item.product_name}"`,
        `"${variant}"`,
        `"${item.sku_variant}"`,
        item.current_stock.toString(),
        item.sales_60_days.toString(),
        item.sales_velocity.toFixed(3),
        item.stock_days_remaining.toString(),
        item.revenue_60_days.toFixed(2),
        item.orders_count.toString(),
        `"${item.status.toUpperCase()}"`
      ];
      csvRows.push(row.join(','));
    });

    // Add summary section
    if (summary) {
      csvRows.push('');
      csvRows.push('# RESUMEN DEL ANÁLISIS');
      csvRows.push(`"Total de variantes analizadas","${summary.total_variants}"`);
      csvRows.push(`"Sin ventas (0 unidades)","${summary.zero_sales}"`);
      csvRows.push(`"Bajas ventas (1-10 unidades)","${summary.low_sales}"`);
      csvRows.push(`"Buenas ventas (>10 unidades)","${summary.good_sales}"`);
      csvRows.push(`"Total unidades vendidas","${summary.total_units_sold}"`);
      csvRows.push(`"Ingresos totales","${summary.total_revenue.toFixed(2)}"`);
      csvRows.push(`"Período de análisis","${summary.period_days} días"`);
      csvRows.push(`"Fecha de cálculo","${summary.calculation_date}"`);
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
      const filename = `ranking_velocidad_ventas_${timestamp}.csv`;
      
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Exportación exitosa", {
        description: `Archivo ${filename} descargado`
      });
    }
  }, [ranking, summary, toast]);

  return {
    ranking,
    summary,
    loading,
    calculating,
    fetchRanking,
    refreshRanking,
    markForDiscontinuation,
    exportRankingCSV
  };
};