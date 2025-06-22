
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, TrendingDown, TrendingUp } from 'lucide-react';
import { useMaterials } from '@/hooks/useMaterials';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useOrders } from '@/hooks/useOrders';
import { useMaterialDeliveries } from '@/hooks/useMaterialDeliveries';

const SuppliesDashboard = () => {
  const [filters, setFilters] = useState({
    workshop: 'all',
    order: 'all',
    material: 'all'
  });
  const [deliveries, setDeliveries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({
    totalDelivered: 0,
    totalConsumed: 0,
    totalRemaining: 0,
    lowStockMaterials: 0
  });

  const { materials, loading: materialsLoading } = useMaterials();
  const { workshops, loading: workshopsLoading } = useWorkshops();
  const { fetchOrders, loading: ordersLoading } = useOrders();
  const { fetchMaterialDeliveries, loading: deliveriesLoading } = useMaterialDeliveries();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [deliveries, materials]);

  const loadData = async () => {
    const [deliveriesData, ordersData] = await Promise.all([
      fetchMaterialDeliveries(),
      fetchOrders()
    ]);
    setDeliveries(deliveriesData || []);
    setOrders(ordersData || []);
  };

  const calculateStats = () => {
    const totalDelivered = deliveries.reduce((sum, delivery) => sum + (delivery.quantity_delivered || 0), 0);
    const totalConsumed = deliveries.reduce((sum, delivery) => sum + (delivery.quantity_consumed || 0), 0);
    const totalRemaining = totalDelivered - totalConsumed;
    const lowStockMaterials = materials.filter(material => 
      (material.current_stock || 0) <= (material.min_stock_alert || 0)
    ).length;

    setStats({
      totalDelivered,
      totalConsumed,
      totalRemaining,
      lowStockMaterials
    });
  };

  const filteredDeliveries = deliveries.filter(delivery => {
    if (filters.workshop !== 'all' && delivery.workshop_id !== filters.workshop) return false;
    if (filters.order !== 'all' && delivery.order_id !== filters.order) return false;
    if (filters.material !== 'all' && delivery.material_id !== filters.material) return false;
    return true;
  });

  const lowStockMaterials = materials.filter(material => 
    (material.current_stock || 0) <= (material.min_stock_alert || 0)
  );

  const loading = materialsLoading || workshopsLoading || ordersLoading || deliveriesLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4 animate-pulse" />
          <h3 className="text-lg font-semibold mb-2 text-black">Cargando dashboard...</h3>
          <p className="text-gray-600">Obteniendo datos de insumos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Package className="w-5 h-5" />
            <span>Filtros de Insumos</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Taller</label>
              <Select value={filters.workshop} onValueChange={(value) => setFilters(prev => ({ ...prev, workshop: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los talleres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los talleres</SelectItem>
                  {workshops.map((workshop) => (
                    <SelectItem key={workshop.id} value={workshop.id}>
                      {workshop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Orden</label>
              <Select value={filters.order} onValueChange={(value) => setFilters(prev => ({ ...prev, order: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las órdenes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las órdenes</SelectItem>
                  {orders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.order_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Material</label>
              <Select value={filters.material} onValueChange={(value) => setFilters(prev => ({ ...prev, material: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los materiales" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los materiales</SelectItem>
                  {materials.map((material) => (
                    <SelectItem key={material.id} value={material.id}>
                      {material.name} ({material.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entregado</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDelivered}</div>
            <p className="text-xs text-muted-foreground">unidades/metros entregados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Consumido</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalConsumed}</div>
            <p className="text-xs text-muted-foreground">unidades/metros consumidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Disponible</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRemaining}</div>
            <p className="text-xs text-muted-foreground">unidades/metros disponibles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Materiales con Stock Bajo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.lowStockMaterials}</div>
            <p className="text-xs text-muted-foreground">requieren reposición</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de Bajo Stock */}
      {lowStockMaterials.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-yellow-800">
              <AlertTriangle className="w-5 h-5" />
              <span>Alertas de Stock Bajo</span>
            </CardTitle>
            <CardDescription className="text-yellow-700">
              Los siguientes materiales tienen stock bajo y requieren reposición
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockMaterials.map((material) => (
                <div key={material.id} className="flex items-center justify-between p-3 bg-white rounded border">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    <div>
                      <div className="font-medium">{material.name}</div>
                      <div className="text-sm text-gray-600">{material.sku} - {material.category}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                      {material.current_stock} {material.unit}
                    </Badge>
                    <div className="text-xs text-gray-500 mt-1">
                      Mín: {material.min_stock_alert} {material.unit}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen de Movimientos por Material */}
      <Card>
        <CardHeader>
          <CardTitle>Movimientos de Inventario</CardTitle>
          <CardDescription>
            Vista detallada de entregas y consumos por material
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {materials.map((material) => {
              const materialDeliveries = deliveries.filter(d => d.material_id === material.id);
              const totalDelivered = materialDeliveries.reduce((sum, d) => sum + (d.quantity_delivered || 0), 0);
              const totalConsumed = materialDeliveries.reduce((sum, d) => sum + (d.quantity_consumed || 0), 0);
              const currentStock = material.current_stock || 0;
              
              if (totalDelivered === 0) return null;
              
              const consumedPercentage = totalDelivered > 0 ? (totalConsumed / totalDelivered) * 100 : 0;
              const stockPercentage = totalDelivered > 0 ? (currentStock / totalDelivered) * 100 : 0;
              
              return (
                <div key={material.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-semibold">{material.name}</div>
                      <div className="text-sm text-gray-600">
                        {material.sku} - {material.category}
                        {material.color && ` • ${material.color}`}
                      </div>
                    </div>
                    {currentStock <= (material.min_stock_alert || 0) && (
                      <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                        Stock Bajo
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Entregado: {totalDelivered} {material.unit}</span>
                      <span>Consumido: {totalConsumed} {material.unit}</span>
                      <span>Stock Actual: {currentStock} {material.unit}</span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div className="h-full flex">
                        <div 
                          className="bg-red-400 h-full" 
                          style={{ width: `${consumedPercentage}%` }}
                        ></div>
                        <div 
                          className="bg-green-400 h-full" 
                          style={{ width: `${stockPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>🔴 Consumido ({consumedPercentage.toFixed(1)}%)</span>
                      <span>🟢 En Stock ({stockPercentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuppliesDashboard;
