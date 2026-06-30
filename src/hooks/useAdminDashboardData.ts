import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useStoreContext } from '@/contexts/StoreContext';
import { useOrganization } from '@/contexts/OrganizationContext';

interface AdminDashboardStats {
  activeOrders: number;
  unitsInProduction: number;
  unitsDeliveredWeek: number;
  unitsApprovedWeek: number;
}

interface ProductionData {
  period: string;
  delivered: number;
  approved: number;
}

interface WorkshopRanking {
  workshopName: string;
  deliveredUnits: number;
  approvedUnits: number;
  qualityScore: number;
  compositeScore: number;
}


export const useAdminDashboardData = () => {
  const [stats, setStats] = useState<AdminDashboardStats>({
    activeOrders: 0,
    unitsInProduction: 0,
    unitsDeliveredWeek: 0,
    unitsApprovedWeek: 0
  });
  const [productionData, setProductionData] = useState<ProductionData[]>([]);
  const [workshopRanking, setWorkshopRanking] = useState<WorkshopRanking[]>([]);
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('monthly');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { activeStoreId } = useStoreContext();
  const { currentOrganization } = useOrganization();

  const fetchDashboardStats = async () => {
    try {
      // Stats agregadas EN EL SERVIDOR (RPC). Antes se traían order_items/delivery_items
      // al cliente y se sumaban, pero PostgREST corta en 1000 filas → "Unidades en
      // Producción" salía truncado. Ahora se suma en la base, sin límite.
      if (!currentOrganization?.id) {
        setStats({ activeOrders: 0, unitsInProduction: 0, unitsDeliveredWeek: 0, unitsApprovedWeek: 0 });
        return;
      }

      const { data: statsRows, error: statsError } = await (supabase as any).rpc('get_admin_dashboard_stats', {
        p_org_id: currentOrganization.id,
        p_store_id: activeStoreId ?? null,
      });
      if (statsError) throw statsError;
      const row = statsRows?.[0] || {};

      const activeOrdersCount = row.active_orders ?? 0;
      const unitsInProduction = row.units_in_production ?? 0;
      const unitsDeliveredWeek = row.delivered_this_week ?? 0;
      const unitsApprovedWeek = row.approved_this_week ?? 0;

      setStats({
        activeOrders: activeOrdersCount || 0,
        unitsInProduction,
        unitsDeliveredWeek,
        unitsApprovedWeek
      });

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast({
        title: "Error al cargar estadísticas",
        description: "No se pudieron cargar las estadísticas del dashboard.",
        variant: "destructive",
      });
    }
  };

  const fetchProductionData = async () => {
    try {
      const isWeekly = viewMode === 'weekly';
      const periods = isWeekly ? 8 : 6; // Last 8 weeks or 6 months

      // Formatea en fecha LOCAL (YYYY-MM-DD). Antes se usaba toISOString(), que
      // convierte a UTC y en zonas detrás de UTC (Colombia, UTC-5) corre cada
      // límite un día atrás (p.ej. el 1 de mes "1 ene 00:00" se vuelve "31 dic"),
      // desalineando los buckets respecto al mes calendario.
      const toDateStr = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      // Construir los buckets (periodos) con sus límites en formato YYYY-MM-DD.
      // Antes se hacían 2 consultas POR periodo de forma secuencial (16 round-trips,
      // ~220ms c/u = ~3.5s) — el cuello de botella del "Cargando datos...". La tabla
      // delivery_items es pequeña, así que ahora traemos TODA la ventana en UNA sola
      // consulta (ambas métricas) y agrupamos en memoria.
      const buckets = Array.from({ length: periods }, (_, idx) => {
        const i = periods - 1 - idx; // del más antiguo al más reciente
        if (isWeekly) {
          const endDate = new Date();
          endDate.setDate(endDate.getDate() - i * 7);
          const startDate = new Date(endDate);
          startDate.setDate(startDate.getDate() - 6);
          const month = endDate.toLocaleDateString('es-ES', { month: 'short' });
          const weekNum = Math.ceil(endDate.getDate() / 7);
          return { start: toDateStr(startDate), end: toDateStr(endDate), label: `${month} S${weekNum}`, delivered: 0, approved: 0 };
        }
        // Mes objetivo calculado con aritmética de índice de mes (puede ser
        // negativo: Date lo normaliza al año anterior). NO usar setMonth() sobre
        // la fecha de hoy: si hoy es 30 y el mes destino no tiene día 30 (p.ej.
        // febrero), JS desborda al mes siguiente y salían meses duplicados/saltados
        // ("ene, mar, mar, abr…" perdiendo "feb"). Al fijar el día en 1 no hay
        // desbordamiento, y la etiqueta se toma del propio startDate.
        const now = new Date();
        const monthIndex = now.getMonth() - i;
        const startDate = new Date(now.getFullYear(), monthIndex, 1);
        const endDate = new Date(now.getFullYear(), monthIndex + 1, 0);
        return { start: toDateStr(startDate), end: toDateStr(endDate), label: startDate.toLocaleDateString('es-ES', { month: 'short' }), delivered: 0, approved: 0 };
      });

      const windowStart = buckets[0].start;
      const windowEnd = buckets[buckets.length - 1].end;

      // Una sola consulta para toda la ventana, ambas cantidades + la fecha para agrupar.
      const { data, error } = await supabase
        .from('delivery_items')
        .select('quantity_delivered, quantity_approved, deliveries!inner(delivery_date)')
        .gte('deliveries.delivery_date', windowStart)
        .lte('deliveries.delivery_date', windowEnd);

      if (error) throw error;

      for (const item of (data as any[]) || []) {
        const dateStr: string | undefined = item.deliveries?.delivery_date;
        if (!dateStr) continue;
        // Buckets contiguos y sin solapamiento; comparación lexicográfica de fechas ISO.
        const bucket = buckets.find(b => dateStr >= b.start && dateStr <= b.end);
        if (bucket) {
          bucket.delivered += item.quantity_delivered || 0;
          bucket.approved += item.quantity_approved || 0;
        }
      }

      setProductionData(buckets.map(b => ({ period: b.label, delivered: b.delivered, approved: b.approved })));

    } catch (error) {
      console.error('Error fetching production data:', error);
    }
  };

  const fetchWorkshopRanking = async () => {
    try {
      // Get last week's data
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: workshopData, error } = await supabase
        .from('deliveries')
        .select(`
          workshop_id,
          workshops!inner(name),
          delivery_items!inner(
            quantity_delivered,
            quantity_approved
          )
        `)
        .gte('delivery_date', weekAgo.toISOString().split('T')[0]);

      if (error) throw error;

      // Group by workshop and calculate metrics
      const workshopStats: { [key: string]: any } = {};
      
      workshopData?.forEach(delivery => {
        const workshopId = delivery.workshop_id;
        const workshopName = delivery.workshops?.name || 'Taller';
        
        if (!workshopStats[workshopId]) {
          workshopStats[workshopId] = {
            workshopName,
            deliveredUnits: 0,
            approvedUnits: 0
          };
        }
        
        delivery.delivery_items?.forEach(item => {
          workshopStats[workshopId].deliveredUnits += item.quantity_delivered || 0;
          workshopStats[workshopId].approvedUnits += item.quantity_approved || 0;
        });
      });

      // Calculate scores and sort
      const workshopsArray = Object.values(workshopStats);
      
      // First pass: calculate quality scores
      const workshopsWithQuality = workshopsArray.map((workshop: any) => {
        const qualityScore = workshop.deliveredUnits > 0 
          ? Math.round((workshop.approvedUnits / workshop.deliveredUnits) * 100)
          : 0;
        
        return {
          ...workshop,
          qualityScore
        };
      });
      
      // Calculate volume scores based on relative ranking
      const maxDelivered = Math.max(...workshopsWithQuality.map(w => w.deliveredUnits || 1));
      
      const ranking = workshopsWithQuality.map((workshop: any) => {
        // Volume score: normalized to 0-100 based on delivered units
        const volumeScore = Math.round((workshop.deliveredUnits / maxDelivered) * 100);
        
        // Hybrid balanced composite score: 40% quality + 60% volume
        const compositeScore = Math.round((workshop.qualityScore * 0.4) + (volumeScore * 0.6));
        
        return {
          ...workshop,
          volumeScore,
          compositeScore
        };
      }).sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 5);

      setWorkshopRanking(ranking);

    } catch (error) {
      console.error('Error fetching workshop ranking:', error);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchDashboardStats(),
      fetchProductionData(),
      fetchWorkshopRanking()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, activeStoreId, currentOrganization?.id]);

  return {
    stats,
    productionData,
    workshopRanking,
    viewMode,
    setViewMode,
    loading,
    refreshData: loadAllData
  };
};