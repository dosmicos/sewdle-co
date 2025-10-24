import React, { useState } from 'react';
import { PickingPackingLayout } from '@/components/picking/PickingPackingLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, Package } from 'lucide-react';
import { usePickingOrders, OperationalStatus } from '@/hooks/usePickingOrders';
import { PickingOrderDetailsModal } from '@/components/picking/PickingOrderDetailsModal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  picking: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  packing: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
  ready_to_ship: 'bg-green-100 text-green-800 hover:bg-green-100',
  shipped: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
};

const statusLabels = {
  pending: 'No preparado',
  picking: 'Picking',
  packing: 'Empacando',
  ready_to_ship: 'Listo para envío',
  shipped: 'Enviado',
};

const paymentStatusColors = {
  paid: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  partially_paid: 'bg-orange-100 text-orange-800',
};

const paymentStatusLabels = {
  paid: 'Pagado',
  pending: 'Pago pendiente',
  partially_paid: 'Parcialmente pagado',
};

const PickingPackingPage = () => {
  const { orders, loading, fetchOrders } = usePickingOrders();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<OperationalStatus | 'all'>('all');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.shopify_order?.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.shopify_order?.customer_first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.shopify_order?.customer_last_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || order.operational_status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.operational_status === 'pending').length,
    picking: orders.filter(o => o.operational_status === 'picking').length,
    packing: orders.filter(o => o.operational_status === 'packing').length,
    ready: orders.filter(o => o.operational_status === 'ready_to_ship').length,
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(filteredOrders.map(o => o.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId]);
    } else {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId));
    }
  };

  const formatCurrency = (amount?: number, currency?: string) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency || 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
      return `Hoy ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return date.toLocaleDateString('es-CO', { 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <PickingPackingLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </PickingPackingLayout>
    );
  }

  return (
    <PickingPackingLayout>
      <div className="space-y-6">
        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número de orden o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => fetchOrders()}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={selectedStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedStatus('all')}
            >
              Todos ({stats.total})
            </Button>
            <Button
              variant={selectedStatus === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedStatus('pending')}
            >
              No preparados ({stats.pending})
            </Button>
            <Button
              variant={selectedStatus === 'picking' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedStatus('picking')}
            >
              Picking ({stats.picking})
            </Button>
            <Button
              variant={selectedStatus === 'packing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedStatus('packing')}
            >
              Empacando ({stats.packing})
            </Button>
            <Button
              variant={selectedStatus === 'ready_to_ship' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedStatus('ready_to_ship')}
            >
              Listo ({stats.ready})
            </Button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm">
            <Package className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">
              Hoy: {stats.total} órdenes
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">
              ⚡ En proceso: {stats.picking + stats.packing}
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">
              ✅ Listas: {stats.ready}
            </span>
          </div>
        </div>

        {/* Orders Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Estado del pago</TableHead>
                <TableHead>Estado de preparación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    No se encontraron órdenes
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow 
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedOrders.includes(order.id)}
                        onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell 
                      className="font-medium"
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      #{order.shopify_order?.order_number}
                    </TableCell>
                    <TableCell onClick={() => setSelectedOrderId(order.id)}>
                      {formatDate(order.shopify_order?.created_at_shopify || order.created_at)}
                    </TableCell>
                    <TableCell onClick={() => setSelectedOrderId(order.id)}>
                      {order.shopify_order?.customer_first_name} {order.shopify_order?.customer_last_name}
                      {order.shopify_order?.customer_email && (
                        <div className="text-xs text-muted-foreground">
                          {order.shopify_order.customer_email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell onClick={() => setSelectedOrderId(order.id)}>
                      Online Store
                    </TableCell>
                    <TableCell className="text-right" onClick={() => setSelectedOrderId(order.id)}>
                      <span className="font-medium">
                        {formatCurrency(
                          order.shopify_order?.raw_data?.total_price,
                          order.shopify_order?.currency
                        )}
                      </span>
                    </TableCell>
                    <TableCell onClick={() => setSelectedOrderId(order.id)}>
                      <Badge 
                        variant="secondary"
                        className={paymentStatusColors[order.shopify_order?.financial_status as keyof typeof paymentStatusColors] || ''}
                      >
                        {paymentStatusLabels[order.shopify_order?.financial_status as keyof typeof paymentStatusLabels] || order.shopify_order?.financial_status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => setSelectedOrderId(order.id)}>
                      <Badge 
                        variant="secondary"
                        className={statusColors[order.operational_status]}
                      >
                        {statusLabels[order.operational_status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrderId && (
        <PickingOrderDetailsModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
        />
      )}

      {/* Debug indicator */}
      {selectedOrderId && (
        <div className="fixed bottom-4 right-4 bg-black text-white p-2 rounded z-[9999] text-xs">
          Modal abierto: {selectedOrderId}
        </div>
      )}
    </PickingPackingLayout>
  );
};

export default PickingPackingPage;