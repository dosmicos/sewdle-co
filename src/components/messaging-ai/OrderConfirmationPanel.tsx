import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Package, Send, CheckCircle, AlertTriangle, Clock, RefreshCw,
  Search, Phone, MapPin, DollarSign
} from 'lucide-react';
import { useOrderConfirmations, CODOrder } from '@/hooks/useOrderConfirmations';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  confirmed: { label: 'Confirmado', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  pending: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  needs_attention: { label: 'Requiere atencion', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
  not_sent: { label: 'Sin enviar', color: 'bg-gray-100 text-gray-600 border-gray-200', icon: Send },
  expired: { label: 'Expirado', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: Clock },
  cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-400 border-gray-200', icon: Clock },
};

export const OrderConfirmationPanel: React.FC = () => {
  const { orders, stats, loading, sending, fetchOrders, sendSingle, sendBulk } = useOrderConfirmations();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const filteredOrders = orders.filter(o => {
    // Search filter
    if (search) {
      const q = search.toLowerCase();
      const name = `${o.customer_first_name || ''} ${o.customer_last_name || ''}`.toLowerCase();
      const orderNum = String(o.order_number).toLowerCase();
      const phone = (o.customer_phone || o.shipping_address?.phone || '').toLowerCase();
      if (!name.includes(q) && !orderNum.includes(q) && !phone.includes(q)) return false;
    }

    // Status filter
    if (filter === 'all') return true;
    if (filter === 'not_sent') return !o.confirmation_status;
    return o.confirmation_status === filter;
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(price);
  };

  const getStatus = (order: CODOrder) => order.confirmation_status || 'not_sent';

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          label="Total COD"
          value={stats.total}
          icon={Package}
          color="bg-blue-50 text-blue-600"
          onClick={() => setFilter('all')}
          active={filter === 'all'}
        />
        <StatCard
          label="Sin enviar"
          value={stats.notSent}
          icon={Send}
          color="bg-gray-50 text-gray-600"
          onClick={() => setFilter('not_sent')}
          active={filter === 'not_sent'}
        />
        <StatCard
          label="Pendientes"
          value={stats.pending}
          icon={Clock}
          color="bg-amber-50 text-amber-600"
          onClick={() => setFilter('pending')}
          active={filter === 'pending'}
        />
        <StatCard
          label="Confirmados"
          value={stats.confirmed}
          icon={CheckCircle}
          color="bg-green-50 text-green-600"
          onClick={() => setFilter('confirmed')}
          active={filter === 'confirmed'}
        />
        <StatCard
          label="Requieren atencion"
          value={stats.needsAttention}
          icon={AlertTriangle}
          color="bg-red-50 text-red-600"
          onClick={() => setFilter('needs_attention')}
          active={filter === 'needs_attention'}
        />
      </div>

      {/* Actions bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, pedido o telefono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrders}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
            Actualizar
          </Button>
          <Button
            size="sm"
            onClick={sendBulk}
            disabled={sending || stats.notSent === 0}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Send className="h-4 w-4 mr-1" />
            {sending ? 'Enviando...' : `Enviar a todos (${stats.notSent})`}
          </Button>
        </div>
      </div>

      {/* Orders table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
          Cargando pedidos...
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Package className="h-10 w-10 mx-auto mb-3 text-gray-300" />
            {orders.length === 0
              ? 'No hay pedidos contra entrega pendientes'
              : 'No se encontraron pedidos con esos filtros'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredOrders.map(order => (
            <OrderRow
              key={order.shopify_order_id}
              order={order}
              status={getStatus(order)}
              onSend={() => sendSingle(order.shopify_order_id)}
              sending={sending}
              formatPrice={formatPrice}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Stat card component
const StatCard: React.FC<{
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  onClick: () => void;
  active: boolean;
}> = ({ label, value, icon: Icon, color, onClick, active }) => (
  <Card
    className={cn(
      "cursor-pointer transition-all hover:shadow-md",
      active && "ring-2 ring-indigo-500 ring-offset-1"
    )}
    onClick={onClick}
  >
    <CardContent className="p-3">
      <div className="flex items-center gap-2">
        <div className={cn("p-1.5 rounded-lg", color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

// Order row component
const OrderRow: React.FC<{
  order: CODOrder;
  status: string;
  onSend: () => void;
  sending: boolean;
  formatPrice: (n: number) => string;
}> = ({ order, status, onSend, sending, formatPrice }) => {
  const config = statusConfig[status] || statusConfig.not_sent;
  const StatusIcon = config.icon;
  const customerName = [order.customer_first_name, order.customer_last_name].filter(Boolean).join(' ') || 'Sin nombre';
  const phone = order.shipping_address?.phone || order.customer_phone || '-';
  const city = order.shipping_address?.city || '-';
  const orderNum = String(order.order_number).replace('#', '');

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Order info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm">#{orderNum}</span>
              <Badge variant="outline" className={cn("text-xs px-1.5 py-0", config.color)}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="font-medium text-gray-700">{customerName}</span>
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {phone}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {city}
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {formatPrice(order.total_price)}
              </span>
            </div>
          </div>

          {/* Right: Action */}
          <div className="flex-shrink-0">
            {status === 'not_sent' && (
              <Button
                size="sm"
                variant="outline"
                onClick={onSend}
                disabled={sending}
                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              >
                <Send className="h-3.5 w-3.5 mr-1" />
                Enviar
              </Button>
            )}
            {status === 'pending' && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Esperando respuesta
              </span>
            )}
            {status === 'confirmed' && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" />
                Confirmado
              </span>
            )}
            {status === 'needs_attention' && (
              <span className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Ver chat
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
