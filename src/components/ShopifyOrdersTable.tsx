import React, { useState } from 'react';
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
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
  totalOrders: number;
  onPageChange: (page: number) => void;
  currentPage: number;
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

export const ShopifyOrdersTable: React.FC<ShopifyOrdersTableProps> = ({ 
  orders, 
  loading, 
  totalOrders, 
  onPageChange, 
  currentPage 
}) => {
  const itemsPerPage = 50;
  const totalPages = Math.ceil(totalOrders / itemsPerPage);

  const handlePageChange = (page: number) => {
    onPageChange(page);
  };
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
        
        {totalPages > 1 && (
          <div className="mt-4">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                    className={currentPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                
                {/* Páginas */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNumber;
                  if (totalPages <= 5) {
                    pageNumber = i + 1;
                  } else if (currentPage <= 3) {
                    pageNumber = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + i;
                  } else {
                    pageNumber = currentPage - 2 + i;
                  }
                  
                  return (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        onClick={() => handlePageChange(pageNumber)}
                        isActive={currentPage === pageNumber}
                        className="cursor-pointer"
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
                    className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
            
            <div className="text-sm text-muted-foreground text-center mt-2">
              Página {currentPage} de {totalPages} • {totalOrders} órdenes totales
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};