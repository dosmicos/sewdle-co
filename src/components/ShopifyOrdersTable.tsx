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

interface ShopifyOrder {
  id: string;
  shopify_order_id: number;
  order_number: string;
  customer_email: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_phone: string;
  created_at_shopify: string;
  financial_status: string;
  fulfillment_status: string;
  total_price: number;
  currency: string;
}

interface ShopifyOrdersTableProps {
  orders: ShopifyOrder[];
  loading: boolean;
}

const getStatusBadgeVariant = (status: string, type: 'financial' | 'fulfillment') => {
  if (type === 'financial') {
    switch (status) {
      case 'paid': return 'default';
      case 'partially_paid': return 'secondary';
      case 'pending': return 'outline';
      case 'authorized': return 'outline';
      case 'refunded': return 'destructive';
      default: return 'outline';
    }
  } else {
    switch (status) {
      case 'fulfilled': return 'default';
      case 'partial': return 'secondary';
      case 'unfulfilled': return 'outline';
      default: return 'outline';
    }
  }
};

const getStatusText = (status: string, type: 'financial' | 'fulfillment') => {
  if (type === 'financial') {
    switch (status) {
      case 'paid': return 'Pagado';
      case 'partially_paid': return 'Pago Parcial';
      case 'pending': return 'Pendiente';
      case 'authorized': return 'Autorizado';
      case 'refunded': return 'Reembolsado';
      default: return status;
    }
  } else {
    switch (status) {
      case 'fulfilled': return 'Enviado';
      case 'partial': return 'Parcial';
      case 'unfulfilled': return 'Sin Enviar';
      default: return status;
    }
  }
};

export const ShopifyOrdersTable: React.FC<ShopifyOrdersTableProps> = ({ orders, loading }) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Órdenes de Shopify</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Cargando órdenes...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Órdenes de Shopify</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orden</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Estado Pago</TableHead>
                <TableHead>Estado Envío</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="text-muted-foreground">
                      No hay órdenes disponibles
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.order_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {order.customer_first_name} {order.customer_last_name}
                        </div>
                        {order.customer_phone && (
                          <div className="text-sm text-muted-foreground">
                            {order.customer_phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {order.customer_email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDistanceToNow(new Date(order.created_at_shopify), {
                          addSuffix: true,
                          locale: es
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(order.financial_status, 'financial')}>
                        {getStatusText(order.financial_status, 'financial')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(order.fulfillment_status || 'unfulfilled', 'fulfillment')}>
                        {getStatusText(order.fulfillment_status || 'unfulfilled', 'fulfillment')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {order.currency} {order.total_price.toFixed(2)}
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