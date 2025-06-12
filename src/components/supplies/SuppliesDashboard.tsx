import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Package, TrendingDown, TrendingUp } from 'lucide-react';

const SuppliesDashboard = () => {
  const [filters, setFilters] = useState({
    workshop: 'all',
    order: 'all',
    material: 'all'
  });

  // Mock data
  const workshops = [
    { id: 'W001', name: 'Taller Principal' },
    { id: 'W002', name: 'Taller Norte' },
    { id: 'W003', name: 'Taller Sur' }
  ];

  const orders = [
    { id: 'ORD001', name: 'Ruanas Primavera 2025' },
    { id: 'ORD002', name: 'Camisas Básicas' }
  ];

  const materials = [
    { id: 'TEL001', name: 'Tela Algodón Premium' },
    { id: 'AVI001', name: 'Botones Plásticos' },
    { id: 'ETI001', name: 'Etiquetas Marca' }
  ];

  const mockData = [
    {
      id: '1',
      materialSku: 'TEL001',
      materialName: 'Tela Algodón Premium',
      workshop: 'Taller Principal',
      order: 'ORD001',
      delivered: 100,
      consumed: 75,
      remaining: 25,
      unit: 'metros',
      lowStock: false
    },
    {
      id: '2',
      materialSku: 'AVI001',
      materialName: 'Botones Plásticos',
      workshop: 'Taller Norte',
      order: 'ORD002',
      delivered: 500,
      consumed: 480,
      remaining: 20,
      unit: 'unidades',
      lowStock: true
    },
    {
      id: '3',
      materialSku: 'ETI001',
      materialName: 'Etiquetas Marca',
      workshop: 'Taller Sur',
      order: 'ORD001',
      delivered: 200,
      consumed: 150,
      remaining: 50,
      unit: 'unidades',
      lowStock: false
    }
  ];

  const filteredData = mockData.filter(item => {
    if (filters.workshop !== 'all' && !item.workshop.includes(workshops.find(w => w.id === filters.workshop)?.name || '')) return false;
    if (filters.order !== 'all' && item.order !== filters.order) return false;
    if (filters.material !== 'all' && item.materialSku !== filters.material) return false;
    return true;
  });

  const totalDelivered = filteredData.reduce((sum, item) => sum + item.delivered, 0);
  const totalConsumed = filteredData.reduce((sum, item) => sum + item.consumed, 0);
  const totalRemaining = filteredData.reduce((sum, item) => sum + item.remaining, 0);
  const lowStockItems = filteredData.filter(item => item.lowStock).length;

  const getProgressColor = (consumed: number, delivered: number) => {
    const percentage = (consumed / delivered) * 100;
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

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
                      {order.id} - {order.name}
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
                      {material.name}
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
            <div className="text-2xl font-bold">{totalDelivered}</div>
            <p className="text-xs text-muted-foreground">unidades/metros</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Consumido</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConsumed}</div>
            <p className="text-xs text-muted-foreground">unidades/metros</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sobrante</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRemaining}</div>
            <p className="text-xs text-muted-foreground">unidades/metros</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bajo Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{lowStockItems}</div>
            <p className="text-xs text-muted-foreground">materiales</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de Bajo Stock */}
      {lowStockItems > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-yellow-800">
              <AlertTriangle className="w-5 h-5" />
              <span>Alertas de Bajo Stock</span>
            </CardTitle>
            <CardDescription className="text-yellow-700">
              Los siguientes materiales tienen stock bajo y requieren atención
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredData.filter(item => item.lowStock).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded border">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    <div>
                      <div className="font-medium">{item.materialName}</div>
                      <div className="text-sm text-gray-600">{item.workshop} - {item.order}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                    {item.remaining} {item.unit} restantes
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla de Insumos */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle de Insumos</CardTitle>
          <CardDescription>
            Vista detallada del estado de materiales por taller y orden
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredData.map((item) => {
              const consumedPercentage = (item.consumed / item.delivered) * 100;
              const remainingPercentage = (item.remaining / item.delivered) * 100;
              
              return (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-semibold">{item.materialName}</div>
                      <div className="text-sm text-gray-600">
                        {item.materialSku} - {item.workshop} - {item.order}
                      </div>
                    </div>
                    {item.lowStock && (
                      <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                        Bajo Stock
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Entregado: {item.delivered} {item.unit}</span>
                      <span>Consumido: {item.consumed} {item.unit}</span>
                      <span>Sobrante: {item.remaining} {item.unit}</span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div className="h-full flex">
                        <div 
                          className="bg-red-400 h-full" 
                          style={{ width: `${consumedPercentage}%` }}
                        ></div>
                        <div 
                          className="bg-green-400 h-full" 
                          style={{ width: `${remainingPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>🔴 Consumido ({consumedPercentage.toFixed(1)}%)</span>
                      <span>🟢 Sobrante ({remainingPercentage.toFixed(1)}%)</span>
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
