import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ShoppingCart, Users, TrendingUp } from 'lucide-react';

interface ShopifyDashboardStatsProps {
  orders: any[];
  customerAnalytics: any[];
  productAnalytics: any[];
}

export const ShopifyDashboardStats: React.FC<ShopifyDashboardStatsProps> = ({
  orders,
  customerAnalytics,
  productAnalytics
}) => {
  const totalRevenue = orders.reduce((sum, order) => sum + (order.total_price || 0), 0);
  const totalOrders = orders.length;
  const totalCustomers = customerAnalytics.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const stats = [
    {
      title: "Ingresos Totales",
      value: `$${totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      description: "Ingresos de órdenes sincronizadas",
      color: "text-green-600"
    },
    {
      title: "Total Órdenes",
      value: totalOrders.toString(),
      icon: ShoppingCart,
      description: "Órdenes procesadas",
      color: "text-blue-600"
    },
    {
      title: "Clientes Únicos",
      value: totalCustomers.toString(),
      icon: Users,
      description: "Clientes que han realizado compras",
      color: "text-purple-600"
    },
    {
      title: "Valor Promedio",
      value: `$${avgOrderValue.toFixed(2)}`,
      icon: TrendingUp,
      description: "Valor promedio por orden",
      color: "text-orange-600"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};