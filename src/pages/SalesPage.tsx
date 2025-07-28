import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CalendarIcon, TrendingUp, ShoppingCart, Package } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface SalesData {
  metric_date: string;
  sales_quantity: number;
  orders_count: number;
  product_name: string;
  variant_size: string;
  variant_color: string;
  sku_variant: string;
}

interface DailySalesStats {
  date: string;
  total_quantity: number;
  total_orders: number;
  unique_products: number;
}

const SalesPage = () => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Fetch daily sales data
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['daily-sales', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_metrics')
        .select(`
          metric_date,
          sales_quantity,
          orders_count,
          product_variants!inner(
            sku_variant,
            size,
            color,
            products!inner(
              name
            )
          )
        `)
        .eq('metric_date', selectedDate)
        .order('sales_quantity', { ascending: false });

      if (error) throw error;

      return data?.map(item => ({
        metric_date: item.metric_date,
        sales_quantity: item.sales_quantity,
        orders_count: item.orders_count,
        product_name: item.product_variants.products.name,
        variant_size: item.product_variants.size || 'N/A',
        variant_color: item.product_variants.color || 'N/A',
        sku_variant: item.product_variants.sku_variant
      })) as SalesData[] || [];
    }
  });

  // Fetch overall stats for selected date
  const { data: dailyStats } = useQuery({
    queryKey: ['daily-stats', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_metrics')
        .select('sales_quantity, orders_count')
        .eq('metric_date', selectedDate);

      if (error) throw error;

      const stats: DailySalesStats = {
        date: selectedDate,
        total_quantity: data?.reduce((sum, item) => sum + item.sales_quantity, 0) || 0,
        total_orders: data?.reduce((sum, item) => sum + item.orders_count, 0) || 0,
        unique_products: data?.length || 0
      };

      return stats;
    }
  });

  // Fetch recent dates with sales
  const { data: recentDates } = useQuery({
    queryKey: ['recent-sales-dates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_metrics')
        .select('metric_date, sales_quantity')
        .order('metric_date', { ascending: false })
        .limit(30);

      if (error) throw error;

      // Group by date and sum quantities
      const dateMap = new Map();
      data?.forEach(item => {
        const date = item.metric_date;
        dateMap.set(date, (dateMap.get(date) || 0) + item.sales_quantity);
      });

      return Array.from(dateMap.entries())
        .map(([date, quantity]) => ({ date, quantity }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 10);
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ventas Diarias</h1>
          <p className="text-muted-foreground">
            Detalle de ventas por producto y variante
          </p>
        </div>
      </div>

      {/* Date Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Seleccionar Fecha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
            />
            <div className="flex flex-wrap gap-2">
              {recentDates?.slice(0, 5).map(({ date, quantity }) => (
                <Button
                  key={date}
                  variant={date === selectedDate ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDate(date)}
                  className="text-xs"
                >
                  {format(parseISO(date), 'dd MMM', { locale: es })}
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {quantity}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Stats */}
      {dailyStats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Vendido</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dailyStats.total_quantity}</div>
              <p className="text-xs text-muted-foreground">
                unidades vendidas
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dailyStats.total_orders}</div>
              <p className="text-xs text-muted-foreground">
                pedidos procesados
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Productos</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dailyStats.unique_products}</div>
              <p className="text-xs text-muted-foreground">
                variantes diferentes
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Detalle de Ventas - {format(parseISO(selectedDate), 'dd MMMM yyyy', { locale: es })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : salesData?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay ventas registradas para esta fecha
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Talla</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesData?.map((sale, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {sale.product_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {sale.sku_variant}
                      </Badge>
                    </TableCell>
                    <TableCell>{sale.variant_size}</TableCell>
                    <TableCell>{sale.variant_color}</TableCell>
                    <TableCell className="text-right font-bold">
                      {sale.sales_quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      {sale.orders_count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesPage;