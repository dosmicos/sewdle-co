import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ShoppingCart, Phone, ExternalLink, CheckCircle2, MessageSquareWarning, Search, AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAbandonedCarts, type AbandonedCart } from '@/hooks/useAbandonedCarts';

const formatCOP = (amount: number | null | undefined) => {
  if (!amount && amount !== 0) return 'COP 0';
  return `COP ${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Number(amount))}`;
};

type FilterTab = 'all' | 'sent' | 'recovered' | 'opted_out';

const cartStatus = (cart: AbandonedCart): { label: string; tone: 'success' | 'warning' | 'muted' | 'danger' } => {
  if (cart.recovered_at) return { label: 'Recuperado', tone: 'success' };
  if (cart.opted_out) return { label: 'Opt-out', tone: 'danger' };
  if ((cart.last_message_step ?? 0) >= 1) return { label: 'Mensaje enviado', tone: 'warning' };
  return { label: 'Pendiente', tone: 'muted' };
};

const toneClasses: Record<string, string> = {
  success: 'bg-green-50 text-green-700 border-green-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  muted: 'bg-gray-50 text-gray-700 border-gray-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
};

const CartRecoveryPage: React.FC = () => {
  const { data, isLoading, error } = useAbandonedCarts();
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  const carts = data?.carts ?? [];
  const stats = data?.stats;

  const filteredCarts = useMemo(() => {
    let list = carts;
    if (filterTab === 'sent') list = list.filter(c => (c.last_message_step ?? 0) >= 1 && !c.recovered_at && !c.opted_out);
    if (filterTab === 'recovered') list = list.filter(c => !!c.recovered_at);
    if (filterTab === 'opted_out') list = list.filter(c => c.opted_out);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(c =>
        (c.customer_first_name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q)
      );
    }
    return list;
  }, [carts, filterTab, search]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShoppingCart className="h-7 w-7" />
          Recuperación de Carritos
        </h1>
        <p className="text-muted-foreground mt-1">
          Carritos abandonados de Shopify y mensajes enviados por WhatsApp en los últimos 30 días.
        </p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-2 py-3 text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Error cargando carritos: {(error as any).message}</span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Carritos abandonados"
          value={stats?.abandonedCarts ?? 0}
          subtitle={`${stats?.totalCarts ?? 0} carritos totales`}
        />
        <KpiCard
          title="Mensajes enviados"
          value={stats?.messagesSent ?? 0}
          subtitle="WhatsApp recovery"
        />
        <KpiCard
          title="Recuperados"
          value={stats?.recoveredCarts ?? 0}
          subtitle={`Tasa ${(stats?.recoveryRate ?? 0).toFixed(1)}%`}
          accent="success"
        />
        <KpiCard
          title="GMV recuperado"
          value={formatCOP(stats?.recoveredGmv ?? 0)}
          subtitle={`Pendiente: ${formatCOP(stats?.abandonedGmv ?? 0)}`}
          accent="success"
        />
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle className="text-lg">Carritos</CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o teléfono"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="md:w-72"
              />
            </div>
          </div>
          <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as FilterTab)}>
            <TabsList>
              <TabsTrigger value="all">Todos ({carts.length})</TabsTrigger>
              <TabsTrigger value="sent">Mensaje enviado ({stats?.messagesSent ?? 0})</TabsTrigger>
              <TabsTrigger value="recovered">Recuperados ({stats?.recoveredCarts ?? 0})</TabsTrigger>
              <TabsTrigger value="opted_out">Opt-out ({stats?.optedOutCarts ?? 0})</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Cargando carritos…</div>
          ) : filteredCarts.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Sin carritos para los filtros seleccionados.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead>Mensaje</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCarts.map((cart) => {
                  const status = cartStatus(cart);
                  const customerLabel =
                    (cart.customer_first_name || '').trim() ||
                    cart.email ||
                    cart.phone ||
                    'Sin identificar';
                  const created = cart.shopify_created_at
                    ? format(new Date(cart.shopify_created_at), "d MMM yyyy HH:mm", { locale: es })
                    : '—';
                  const sentAt = cart.last_message_sent_at
                    ? format(new Date(cart.last_message_sent_at), "d MMM HH:mm", { locale: es })
                    : null;

                  return (
                    <TableRow key={cart.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{customerLabel}</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            {cart.phone ? <><Phone className="h-3 w-3" />{cart.phone}</> : 'Sin teléfono'}
                          </span>
                          {cart.email && (
                            <span className="text-xs text-muted-foreground">{cart.email}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{formatCOP(cart.total_price)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{created}</TableCell>
                      <TableCell>
                        {sentAt ? (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MessageSquareWarning className="h-3 w-3" />
                            {sentAt}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={toneClasses[status.tone]}>
                          {status.tone === 'success' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {cart.recovery_url && !cart.recovered_at ? (
                          <a
                            href={cart.recovery_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Ver en Shopify
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

interface KpiCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  accent?: 'success';
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, subtitle, accent }) => (
  <Card>
    <CardContent className="pt-6">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${accent === 'success' ? 'text-green-700' : ''}`}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </CardContent>
  </Card>
);

export default CartRecoveryPage;
