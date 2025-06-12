
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, TruckIcon, Scissors, Download } from 'lucide-react';

const SuppliesDashboard = () => {
  const [filterWorkshop, setFilterWorkshop] = useState('');
  const [filterOrder, setFilterOrder] = useState('');
  const [filterMaterial, setFilterMaterial] = useState('');

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

  // KPIs calculados
  const kpis = {
    totalDelivered: 250,
    totalConsumed: 180,
    totalRemaining: 70,
    deliveredValue: 125000,
    consumedValue: 90000,
    remainingValue: 35000
  };

  // Datos para la tabla con barra tricolor
  const supplyData = [
    {
      id: '1',
      material: 'Tela Algodón Premium',
      sku: 'TEL001',
      workshop: 'Taller Principal',
      order: 'ORD001',
      delivered: 50,
      consumed: 35,
      remaining: 15,
      unit: 'metros',
      status: 'in_progress'
    },
    {
      id: '2',
      material: 'Botones Plásticos',
      sku: 'AVI001',
      workshop: 'Taller Norte',
      order: 'ORD002',
      delivered: 200,
      consumed: 0,
      remaining: 200,
      unit: 'unidades',
      status: 'delivered'
    },
    {
      id: '3',
      material: 'Etiquetas Marca',
      sku: 'ETI001',
      workshop: 'Taller Sur',
      order: 'ORD001',
      delivered: 100,
      consumed: 95,
      remaining: 5,
      unit: 'unidades',
      status: 'almost_finished'
    }
  ];

  // Alertas de bajo stock
  const lowStockAlerts = [
    { material: 'Tela Algodón Premium', sku: 'TEL001', currentStock: 25, minStock: 50, workshop: 'Taller Principal' },
    { material: 'Etiquetas Marca', sku: 'ETI001', currentStock: 50, minStock: 200, workshop: 'Taller Sur' }
  ];

  const getProgressBarSegments = (delivered: number, consumed: number, remaining: number) => {
    const total = delivered;
    const consumedPercentage = (consumed / total) * 100;
    const remainingPercentage = (remaining / total) * 100;
    
    return {
      consumed: consumedPercentage,
      remaining: remainingPercentage
    };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Badge className="bg-blue-500 text-white">Entregado</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-500 text-white">En Proceso</Badge>;
      case 'almost_finished':
        return <Badge className="bg-orange-500 text-white">Por Terminar</Badge>;
      case 'completed':
        return <Badge className="bg-green-500 text-white">Completado</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-black">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-black mb-2">Taller</label>
            <Select value={filterWorkshop} onValueChange={setFilterWorkshop}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los talleres" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos los talleres</SelectItem>
                {workshops.map((workshop) => (
                  <SelectItem key={workshop.id} value={workshop.id}>
                    {workshop.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">Orden</label>
            <Select value={filterOrder} onValueChange={setFilterOrder}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las órdenes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas las órdenes</SelectItem>
                {orders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>
                    {order.id} - {order.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">Material</label>
            <Select value={filterMaterial} onValueChange={setFilterMaterial}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los materiales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos los materiales</SelectItem>
                {materials.map((material) => (
                  <SelectItem key={material.id} value={material.id}>
                    {material.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button className="bg-blue-500 hover:bg-blue-600 text-white">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <TruckIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Entregado</p>
              <p className="text-2xl font-bold text-black">{kpis.totalDelivered}</p>
              <p className="text-sm text-gray-500">${kpis.deliveredValue.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Scissors className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Consumido</p>
              <p className="text-2xl font-bold text-black">{kpis.totalConsumed}</p>
              <p className="text-sm text-gray-500">${kpis.consumedValue.toLocaleString()}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Package className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Sobrante Reutilizable</p>
              <p className="text-2xl font-bold text-black">{kpis.totalRemaining}</p>
              <p className="text-sm text-gray-500">${kpis.remainingValue.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Alertas de Bajo Stock */}
      {lowStockAlerts.length > 0 && (
        <Card className="p-6 border-l-4 border-l-red-500">
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-semibold text-black">Alertas de Bajo Stock</h3>
          </div>
          <div className="space-y-3">
            {lowStockAlerts.map((alert, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div>
                  <div className="font-medium text-black">{alert.material} ({alert.sku})</div>
                  <div className="text-sm text-gray-600">{alert.workshop}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-red-600 font-medium">
                    {alert.currentStock} / {alert.minStock} mínimo
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tabla con Barra Tricolor */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 text-black">Estado de Insumos</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-black">Material</th>
                <th className="text-left py-3 px-4 text-black">Taller</th>
                <th className="text-left py-3 px-4 text-black">Orden</th>
                <th className="text-left py-3 px-4 text-black">Progreso</th>
                <th className="text-left py-3 px-4 text-black">Cantidades</th>
                <th className="text-left py-3 px-4 text-black">Estado</th>
              </tr>
            </thead>
            <tbody>
              {supplyData.map((item) => {
                const segments = getProgressBarSegments(item.delivered, item.consumed, item.remaining);
                return (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <div className="font-medium text-black">{item.material}</div>
                        <div className="text-sm text-gray-600">SKU: {item.sku}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-black">{item.workshop}</td>
                    <td className="py-4 px-4 text-black">{item.order}</td>
                    <td className="py-4 px-4">
                      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                        <div className="flex h-full">
                          <div 
                            className="bg-green-500" 
                            style={{ width: `${segments.consumed}%` }}
                            title={`Consumido: ${item.consumed} ${item.unit}`}
                          ></div>
                          <div 
                            className="bg-orange-500" 
                            style={{ width: `${segments.remaining}%` }}
                            title={`Sobrante: ${item.remaining} ${item.unit}`}
                          ></div>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-green-600">Consumido</span>
                        <span className="text-orange-600">Sobrante</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm">
                        <div>Entregado: <span className="font-medium">{item.delivered} {item.unit}</span></div>
                        <div>Consumido: <span className="font-medium text-green-600">{item.consumed} {item.unit}</span></div>
                        <div>Sobrante: <span className="font-medium text-orange-600">{item.remaining} {item.unit}</span></div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {getStatusBadge(item.status)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Leyenda */}
      <Card className="p-4">
        <h4 className="font-medium text-black mb-2">Leyenda</h4>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>Consumido</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <span>Sobrante Reutilizable</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-200 rounded"></div>
            <span>No Entregado</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SuppliesDashboard;
