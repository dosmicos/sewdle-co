
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Upload, FileText, Download, Eye } from 'lucide-react';
import MaterialDeliveryForm from './MaterialDeliveryForm';

interface MaterialDelivery {
  id: string;
  orderId: string;
  orderName: string;
  workshopId: string;
  workshopName: string;
  materialId: string;
  materialName: string;
  materialSku: string;
  quantity: number;
  unit: string;
  deliveryDate: string;
  deliveredBy: string;
  supportDocument?: string;
  status: 'pending' | 'delivered' | 'consumed';
  consumedQty: number;
  remainingQty: number;
}

const MaterialDelivery = () => {
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [filterWorkshop, setFilterWorkshop] = useState('all');
  const [filterOrder, setFilterOrder] = useState('');

  // Mock data
  const deliveries: MaterialDelivery[] = [
    {
      id: '1',
      orderId: 'ORD001',
      orderName: 'Ruanas Primavera 2025',
      workshopId: 'W001',
      workshopName: 'Taller Principal',
      materialId: 'TEL001',
      materialName: 'Tela Algodón Premium',
      materialSku: 'TEL001',
      quantity: 50,
      unit: 'metros',
      deliveryDate: '2024-01-15',
      deliveredBy: 'Juan Pérez',
      supportDocument: 'guia_entrega_001.pdf',
      status: 'consumed',
      consumedQty: 35,
      remainingQty: 15
    },
    {
      id: '2',
      orderId: 'ORD002',
      orderName: 'Camisas Básicas',
      workshopId: 'W002',
      workshopName: 'Taller Norte',
      materialId: 'AVI001',
      materialName: 'Botones Plásticos',
      materialSku: 'AVI001',
      quantity: 200,
      unit: 'unidades',
      deliveryDate: '2024-01-20',
      deliveredBy: 'María González',
      supportDocument: 'guia_entrega_002.pdf',
      status: 'delivered',
      consumedQty: 0,
      remainingQty: 200
    }
  ];

  const workshops = [
    { id: 'W001', name: 'Taller Principal' },
    { id: 'W002', name: 'Taller Norte' },
    { id: 'W003', name: 'Taller Sur' }
  ];

  const filteredDeliveries = deliveries.filter(delivery => {
    const matchesWorkshop = filterWorkshop === 'all' || delivery.workshopId === filterWorkshop;
    const matchesOrder = !filterOrder || delivery.orderId.toLowerCase().includes(filterOrder.toLowerCase());
    return matchesWorkshop && matchesOrder;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500 text-white">Pendiente</Badge>;
      case 'delivered':
        return <Badge className="bg-blue-500 text-white">Entregado</Badge>;
      case 'consumed':
        return <Badge className="bg-green-500 text-white">Consumido</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  const calculateUsagePercentage = (consumed: number, total: number) => {
    return total > 0 ? Math.round((consumed / total) * 100) : 0;
  };

  return (
    <>
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-black">Historial de Entregas</h3>
          <Button 
            onClick={() => setShowDeliveryForm(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Entrega
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Filtrar por Taller
            </label>
            <Select value={filterWorkshop} onValueChange={setFilterWorkshop}>
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
            <label className="block text-sm font-medium text-black mb-2">
              Filtrar por Orden
            </label>
            <Input
              value={filterOrder}
              onChange={(e) => setFilterOrder(e.target.value)}
              placeholder="Número de orden..."
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orden</TableHead>
                <TableHead>Taller</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Consumido</TableHead>
                <TableHead>Sobrante</TableHead>
                <TableHead>Progreso</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeliveries.map((delivery) => {
                const usagePercentage = calculateUsagePercentage(delivery.consumedQty, delivery.quantity);
                return (
                  <TableRow key={delivery.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-black">{delivery.orderId}</div>
                        <div className="text-sm text-gray-600">{delivery.orderName}</div>
                      </div>
                    </TableCell>
                    <TableCell>{delivery.workshopName}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-black">{delivery.materialName}</div>
                        <div className="text-sm text-gray-600">SKU: {delivery.materialSku}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{delivery.quantity} {delivery.unit}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{delivery.consumedQty} {delivery.unit}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-green-600">{delivery.remainingQty} {delivery.unit}</span>
                    </TableCell>
                    <TableCell>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${usagePercentage}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600 mt-1">{usagePercentage}%</span>
                    </TableCell>
                    <TableCell>{getStatusBadge(delivery.status)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm" title="Ver detalles">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {delivery.supportDocument && (
                          <Button variant="ghost" size="sm" title="Descargar guía">
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {filteredDeliveries.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-black">No se encontraron entregas</h3>
            <p className="text-gray-600">Ajusta los filtros o registra una nueva entrega</p>
          </div>
        )}
      </Card>

      {showDeliveryForm && (
        <MaterialDeliveryForm onClose={() => setShowDeliveryForm(false)} />
      )}
    </>
  );
};

export default MaterialDelivery;
