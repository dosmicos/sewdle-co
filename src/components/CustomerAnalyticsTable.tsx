import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface CustomerAnalytics {
  customer_email: string;
  customer_name: string;
  orders_count: number;
  total_spent: number;
  avg_order_value: number;
  first_order_date: string;
  last_order_date: string;
  customer_segment: string;
}

interface CustomerAnalyticsTableProps {
  customers: CustomerAnalytics[];
  loading: boolean;
}

const getSegmentVariant = (segment: string) => {
  switch (segment) {
    case 'VIP': return 'default';
    case 'Regular': return 'secondary';
    case 'Repeat': return 'outline';
    case 'New': return 'outline';
    default: return 'outline';
  }
};

const getSegmentColor = (segment: string) => {
  switch (segment) {
    case 'VIP': return 'text-yellow-600';
    case 'Regular': return 'text-blue-600';
    case 'Repeat': return 'text-green-600';
    case 'New': return 'text-gray-600';
    default: return 'text-gray-600';
  }
};

export const CustomerAnalyticsTable: React.FC<CustomerAnalyticsTableProps> = ({ customers, loading }) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Cargando análisis...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análisis de Clientes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead className="text-right">Órdenes</TableHead>
                <TableHead className="text-right">Total Gastado</TableHead>
                <TableHead className="text-right">Promedio por Orden</TableHead>
                <TableHead>Primera Orden</TableHead>
                <TableHead>Última Orden</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="text-muted-foreground">
                      No hay datos de clientes disponibles
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {customer.customer_name}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {customer.customer_email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSegmentVariant(customer.customer_segment)}>
                        <span className={getSegmentColor(customer.customer_segment)}>
                          {customer.customer_segment}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {customer.orders_count}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${customer.total_spent.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      ${customer.avg_order_value.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDistanceToNow(new Date(customer.first_order_date), {
                          addSuffix: true,
                          locale: es
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDistanceToNow(new Date(customer.last_order_date), {
                          addSuffix: true,
                          locale: es
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};