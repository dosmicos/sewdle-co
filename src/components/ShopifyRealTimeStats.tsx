import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RealTimeStats {
  total_orders: number;
  total_revenue: number;
  total_customers: number;
  avg_order_value: number;
  orders_today: number;
  revenue_today: number;
  top_selling_product: string;
  last_updated: string;
}

export const ShopifyRealTimeStats: React.FC = () => {
  const [stats, setStats] = useState<RealTimeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<string>('');
  const { toast } = useToast();

  const fetchRealTimeStats = async () => {
    setLoading(true);
    try {
      // Get overall statistics
      const { data: overallStats, error: overallError } = await supabase
        .from('shopify_orders')
        .select('total_price, customer_email, created_at_shopify')
        .eq('financial_status', 'paid');

      if (overallError) throw overallError;

      // Get today's statistics
      const today = new Date().toISOString().split('T')[0];
      const { data: todayStats, error: todayError } = await supabase
        .from('shopify_orders')
        .select('total_price')
        .eq('financial_status', 'paid')
        .gte('created_at_shopify', today + 'T00:00:00Z')
        .lt('created_at_shopify', today + 'T23:59:59Z');

      if (todayError) throw todayError;

      // Get top selling product
      const { data: topProduct, error: productError } = await supabase
        .from('shopify_order_line_items')
        .select('title, sku')
        .order('quantity', { ascending: false })
        .limit(1)
        .single();

      if (productError && productError.code !== 'PGRST116') {
        console.warn('Error fetching top product:', productError);
      }

      // Calculate statistics
      const totalOrders = overallStats.length;
      const totalRevenue = overallStats.reduce((sum, order) => sum + (order.total_price || 0), 0);
      const uniqueCustomers = new Set(overallStats.map(order => order.customer_email)).size;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      
      const ordersToday = todayStats.length;
      const revenueToday = todayStats.reduce((sum, order) => sum + (order.total_price || 0), 0);

      const calculatedStats: RealTimeStats = {
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        total_customers: uniqueCustomers,
        avg_order_value: avgOrderValue,
        orders_today: ordersToday,
        revenue_today: revenueToday,
        top_selling_product: topProduct?.title || 'N/A',
        last_updated: new Date().toISOString()
      };

      setStats(calculatedStats);
      setLastSync(new Date().toLocaleTimeString());

    } catch (error: any) {
      console.error('Error fetching real-time stats:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las estadísticas en tiempo real",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealTimeStats();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchRealTimeStats, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getTrendIcon = (current: number, threshold: number = 0) => {
    if (current > threshold) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (current < threshold) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            Estadísticas en Tiempo Real
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
              <div className="h-4 bg-muted rounded w-2/3"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Estadísticas en Tiempo Real
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {lastSync}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchRealTimeStats}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Today's Performance */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground">Hoy</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{stats.orders_today}</span>
                {getTrendIcon(stats.orders_today)}
              </div>
              <p className="text-xs text-muted-foreground">Órdenes</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">
                  {formatCurrency(stats.revenue_today)}
                </span>
                {getTrendIcon(stats.revenue_today)}
              </div>
              <p className="text-xs text-muted-foreground">Ingresos</p>
            </div>
          </div>
        </div>

        {/* Overall Performance */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground">Total</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xl font-bold">{stats.total_orders}</span>
              <p className="text-xs text-muted-foreground">Órdenes Totales</p>
            </div>
            <div className="space-y-1">
              <span className="text-xl font-bold">
                {formatCurrency(stats.total_revenue)}
              </span>
              <p className="text-xs text-muted-foreground">Ingresos Totales</p>
            </div>
            <div className="space-y-1">
              <span className="text-xl font-bold">{stats.total_customers}</span>
              <p className="text-xs text-muted-foreground">Clientes Únicos</p>
            </div>
            <div className="space-y-1">
              <span className="text-xl font-bold">
                {formatCurrency(stats.avg_order_value)}
              </span>
              <p className="text-xs text-muted-foreground">Valor Promedio</p>
            </div>
          </div>
        </div>

        {/* Top Product */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground">Producto Top</h4>
          <p className="text-sm font-medium truncate" title={stats.top_selling_product}>
            {stats.top_selling_product}
          </p>
        </div>

        {/* Last Update */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Última actualización: {new Date(stats.last_updated).toLocaleString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};