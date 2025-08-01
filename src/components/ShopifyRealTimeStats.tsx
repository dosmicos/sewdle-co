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
  orders_yesterday?: number;
  revenue_yesterday?: number;
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
      // Get overall statistics (matching the analytics filters)
      const { data: overallStats, error: overallError } = await supabase
        .from('shopify_orders')
        .select('total_price, customer_email, created_at_shopify')
        .in('financial_status', ['paid', 'partially_paid', 'pending']);

      if (overallError) throw overallError;

      // Get today's statistics
      const today = new Date().toISOString().split('T')[0];
      const { data: todayStats, error: todayError } = await supabase
        .from('shopify_orders')
        .select('total_price')
        .in('financial_status', ['paid', 'partially_paid', 'pending'])
        .gte('created_at_shopify', today + 'T00:00:00Z')
        .lt('created_at_shopify', today + 'T23:59:59Z');

      if (todayError) throw todayError;

      // Get yesterday's statistics for comparison
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const { data: yesterdayStats, error: yesterdayError } = await supabase
        .from('shopify_orders')
        .select('total_price')
        .in('financial_status', ['paid', 'partially_paid', 'pending'])
        .gte('created_at_shopify', yesterdayStr + 'T00:00:00Z')
        .lt('created_at_shopify', yesterdayStr + 'T23:59:59Z');

      if (yesterdayError) throw yesterdayError;

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
      
      // Calculate yesterday's metrics for comparison
      const ordersYesterday = yesterdayStats.length;
      const revenueYesterday = yesterdayStats.reduce((sum, order) => sum + (order.total_price || 0), 0);

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

      setStats({
        ...calculatedStats,
        orders_yesterday: ordersYesterday,
        revenue_yesterday: revenueYesterday
      } as any);
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
    return '$' + new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2
    }).format(amount);
  };

  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const getTrendIcon = (percentage: number) => {
    if (percentage > 0) return <TrendingUp className="h-4 w-4" />;
    if (percentage < 0) return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const getTrendColor = (percentage: number) => {
    if (percentage > 0) return "text-success";
    if (percentage < 0) return "text-destructive";
    return "text-muted-foreground";
  };

  if (!stats) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const revenueChange = calculatePercentageChange(stats.revenue_today, stats.revenue_yesterday || 0);
  const ordersChange = calculatePercentageChange(stats.orders_today, stats.orders_yesterday || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Estadísticas en Tiempo Real</h2>
          <p className="text-muted-foreground">
            Última actualización: {lastSync}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchRealTimeStats}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

        {/* Pedidos */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Pedidos</p>
              <div className="flex items-center space-x-2">
                <p className="text-2xl font-bold">{stats.orders_today}</p>
                <div className={`flex items-center text-sm ${getTrendColor(ordersChange)}`}>
                  {getTrendIcon(ordersChange)}
                  <span className="ml-1">
                    {Math.abs(ordersChange).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clientes Únicos */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Clientes Únicos</p>
              <p className="text-2xl font-bold">{stats.total_customers}</p>
            </div>
          </CardContent>
        </Card>

        {/* Valor Promedio */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Valor Promedio</p>
              <p className="text-2xl font-bold">
                {formatCurrency(stats.avg_order_value)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
};