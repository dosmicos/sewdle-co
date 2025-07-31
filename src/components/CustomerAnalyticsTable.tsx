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
  totalCustomers: number;
  onPageChange: (page: number) => void;
  currentPage: number;
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

export const CustomerAnalyticsTable: React.FC<CustomerAnalyticsTableProps> = ({ 
  customers, 
  loading, 
  totalCustomers, 
  onPageChange, 
  currentPage 
}) => {
  const itemsPerPage = 50;
  const totalPages = Math.ceil(totalCustomers / itemsPerPage);

  const handlePageChange = (page: number) => {
    onPageChange(page);
  };
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
              Página {currentPage} de {totalPages} • {totalCustomers} clientes totales
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};