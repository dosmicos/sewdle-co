import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProductAnalytics {
  sku: string;
  product_title: string;
  variant_title: string;
  total_quantity: number;
  total_revenue: number;
  avg_price: number;
  orders_count: number;
  customers_count: number;
}

interface ProductAnalyticsTableProps {
  products: ProductAnalytics[];
  loading: boolean;
}

export const ProductAnalyticsTable: React.FC<ProductAnalyticsTableProps> = ({ products, loading }) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Productos</CardTitle>
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
        <CardTitle>Análisis de Productos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Variante</TableHead>
                <TableHead className="text-right">Cantidad Total</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Precio Promedio</TableHead>
                <TableHead className="text-right">Órdenes</TableHead>
                <TableHead className="text-right">Clientes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="text-muted-foreground">
                      No hay datos de productos disponibles
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-sm">
                      {product.sku}
                    </TableCell>
                    <TableCell className="font-medium">
                      {product.product_title}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {product.variant_title || 'Sin variante'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {product.total_quantity}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${product.total_revenue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      ${product.avg_price.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.orders_count}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.customers_count}
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