import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  Layers,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  BarChart3,
  Ruler,
  RefreshCw,
  PackageX,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useInventoryStats, formatCurrency } from '@/hooks/useInventoryStats';

// ── Componente principal ────────────────────────────────────

export const InventoryStatsPanel: React.FC = () => {
  const { data, loading, error, refetch } = useInventoryStats();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
        <p className="text-red-800 font-medium">Error al cargar estadísticas</p>
        <p className="text-sm text-red-700 mt-1">{error}</p>
        <Button onClick={refetch} variant="outline" className="mt-3">
          <RefreshCw className="w-4 h-4 mr-2" />
          Reintentar
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { summary, categoryInventory, categorySales, criticalStock, topSellers, noSalesProducts, sizeDistribution } = data;

  // Totales para la tabla de inventario por categoría
  const catTotals = categoryInventory.reduce(
    (acc, c) => ({
      products: acc.products + c.productCount,
      units: acc.units + c.totalUnits,
      value: acc.value + c.inventoryValue,
    }),
    { products: 0, units: 0, value: 0 }
  );

  // Totales para ventas por categoría
  const salesTotals = categorySales.reduce(
    (acc, c) => ({
      units: acc.units + c.unitsSold,
      revenue: acc.revenue + c.revenue,
      orders: acc.orders + c.ordersCount,
    }),
    { units: 0, revenue: 0, orders: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Botón refrescar */}
      <div className="flex justify-end">
        <Button onClick={refetch} variant="outline" size="sm" className="rounded-xl">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar datos
        </Button>
      </div>

      {/* ── Cards resumen ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-600">Productos Activos</p>
              <p className="text-2xl font-bold text-blue-700">{summary.totalActiveProducts}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-green-50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Layers className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-600">Total Unidades</p>
              <p className="text-2xl font-bold text-green-700">{summary.totalUnitsInStock.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-red-50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-600">Agotados</p>
              <p className="text-2xl font-bold text-red-700">{summary.outOfStockProducts}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-purple-50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-purple-600">Valor Inventario</p>
              <p className="text-xl font-bold text-purple-700">{formatCurrency(summary.estimatedInventoryValue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Inventario por Categoría ───────────────────────── */}
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="w-5 h-5 text-orange-500" />
            Inventario por Categoría
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right"># Productos</TableHead>
                  <TableHead className="text-right">Total Unidades</TableHead>
                  <TableHead className="text-right">Valor Inventario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryInventory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No hay datos de inventario disponibles
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {categoryInventory.map((cat, idx) => {
                      const isExpanded = expandedCategories.has(cat.category);
                      return (
                        <React.Fragment key={idx}>
                          <TableRow
                            className="cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => toggleCategory(cat.category)}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                )}
                                {cat.category}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{cat.productCount}</TableCell>
                            <TableCell className="text-right font-medium">{cat.totalUnits.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{formatCurrency(cat.inventoryValue)}</TableCell>
                          </TableRow>
                          {isExpanded && cat.products.map((prod, pIdx) => (
                            <TableRow key={`${idx}-${pIdx}`} className="bg-gray-50/50">
                              <TableCell className="pl-10">
                                <div className="text-sm">{prod.name}</div>
                                <div className="text-xs text-muted-foreground font-mono">{prod.sku}</div>
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">—</TableCell>
                              <TableCell className="text-right text-sm">{prod.totalUnits.toLocaleString()}</TableCell>
                              <TableCell className="text-right text-sm">{formatCurrency(prod.inventoryValue)}</TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      );
                    })}
                    <TableRow className="bg-gray-50 font-bold border-t-2">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{catTotals.products}</TableCell>
                      <TableCell className="text-right">{catTotals.units.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatCurrency(catTotals.value)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Ventas últimos 30 días por Categoría ───────────── */}
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="w-5 h-5 text-green-500" />
            Ventas Últimos 30 Días por Categoría
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Uds. Vendidas</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right"># Órdenes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categorySales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No hay datos de ventas en los últimos 30 días
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {categorySales.map((cat, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{cat.category}</TableCell>
                        <TableCell className="text-right font-medium">{cat.unitsSold.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatCurrency(cat.revenue)}</TableCell>
                        <TableCell className="text-right">{cat.ordersCount}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 font-bold border-t-2">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{salesTotals.units.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{formatCurrency(salesTotals.revenue)}</TableCell>
                      <TableCell className="text-right">{salesTotals.orders}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Fila dual: Stock Crítico + Top Vendidos ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Crítico */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Stock Crítico
            </CardTitle>
          </CardHeader>
          <CardContent>
            {criticalStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Package className="w-8 h-8 mb-2 text-green-400" />
                <p>Sin productos en estado crítico</p>
                <p className="text-xs mt-1">Los datos de reabastecimiento pueden no estar actualizados</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Días Supply</TableHead>
                      <TableHead>Urgencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {criticalStock.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="font-medium text-sm">{item.productName}</div>
                          {item.variantSize && (
                            <div className="text-xs text-muted-foreground">{item.variantSize}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">{item.currentStock}</TableCell>
                        <TableCell className="text-right">
                          {item.daysOfSupply !== null ? `${Math.round(item.daysOfSupply)}d` : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              item.urgency === 'critical'
                                ? 'bg-red-100 text-red-700 hover:bg-red-100'
                                : 'bg-orange-100 text-orange-700 hover:bg-orange-100'
                            }
                          >
                            {item.urgency === 'critical' ? 'Crítico' : 'Alto'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top 10 Más Vendidos */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Top 10 Más Vendidos (30 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSellers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <ShoppingCart className="w-8 h-8 mb-2 text-gray-400" />
                <p>No hay datos de ventas disponibles</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Vendidos</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topSellers.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{item.productTitle}</div>
                          <div className="text-xs text-muted-foreground">{item.sku}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{item.totalQuantity}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(item.totalRevenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Fila dual: Sin Ventas + Distribución por Talla ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productos sin ventas */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PackageX className="w-5 h-5 text-amber-500" />
              Sin Ventas en 30 Días (con stock)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {noSalesProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <TrendingUp className="w-8 h-8 mb-2 text-green-400" />
                <p>Todos los productos con stock tuvieron ventas</p>
              </div>
            ) : (
              <div className="rounded-md border max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Precio Base</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {noSalesProducts.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="font-medium text-sm">{item.productName}</div>
                          <div className="text-xs text-muted-foreground">{item.sku}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{item.currentStock.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-sm">
                          {item.basePrice ? formatCurrency(item.basePrice) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribución por talla */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Ruler className="w-5 h-5 text-indigo-500" />
              Distribución de Stock por Talla
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sizeDistribution.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Ruler className="w-8 h-8 mb-2 text-gray-400" />
                <p>No hay datos de tallas disponibles</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Talla</TableHead>
                      <TableHead className="text-right">Total Unidades</TableHead>
                      <TableHead className="text-right"># Variantes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sizeDistribution.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.size}</TableCell>
                        <TableCell className="text-right font-medium">{item.totalUnits.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{item.variantCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
