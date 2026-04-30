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
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { format, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import MetricCard from '@/components/finance-dashboard/MetricCard';
import FinanceDatePicker from '@/components/finance-dashboard/FinanceDatePicker';
import { useFinanceDateRange } from '@/hooks/useFinanceDateRange';
import { useAbandonedCarts, type AbandonedCart } from '@/hooks/useAbandonedCarts';
import { useCartRecoveryAttempts } from '@/hooks/useCartRecoveryAttempts';

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

const CartRecoveryDashboardPage: React.FC = () => {
  const dateRange = useFinanceDateRange();

  const daysWindow = useMemo(() => {
    const diffMs = dateRange.current.end.getTime() - dateRange.current.start.getTime();
    return Math.max(1, Math.ceil(diffMs / 86_400_000));
  }, [dateRange.current.start, dateRange.current.end]);

  const cartsQuery = useAbandonedCarts();
  const attemptsQuery = useCartRecoveryAttempts(daysWindow);

  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  const allCarts = cartsQuery.data?.carts ?? [];
  const cartStats = cartsQuery.data?.stats;
  const attemptStats = attemptsQuery.data?.stats;

  const carts = useMemo(() => {
    const startMs = dateRange.current.start.getTime();
    const endMs = dateRange.current.end.getTime();
    return allCarts.filter((c) => {
      if (!c.shopify_created_at) return false;
      const t = new Date(c.shopify_created_at).getTime();
      return t >= startMs && t <= endMs;
    });
  }, [allCarts, dateRange.current.start, dateRange.current.end]);

  const stats = useMemo(() => {
    const abandoned = carts.filter(c => c.is_abandoned).length;
    const sent = carts.filter(c => (c.last_message_step ?? 0) >= 1).length;
    const recovered = carts.filter(c => !!c.recovered_at).length;
    const optedOut = carts.filter(c => c.opted_out).length;
    const recoveredGmv = carts
      .filter(c => !!c.recovered_at)
      .reduce((sum, c) => sum + (Number(c.total_price) || 0), 0);
    const abandonedGmv = carts
      .filter(c => c.is_abandoned && !c.recovered_at)
      .reduce((sum, c) => sum + (Number(c.total_price) || 0), 0);
    const recoveryRate = sent > 0 ? (recovered / sent) * 100 : 0;
    return { abandoned, sent, recovered, optedOut, recoveredGmv, abandonedGmv, recoveryRate, total: carts.length };
  }, [carts]);

  const series = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.current.start, end: dateRange.current.end });
    const byDay = new Map<string, { date: string; abandoned: number; sent: number; recovered: number }>();
    days.forEach((d) => {
      const key = format(d, 'yyyy-MM-dd');
      byDay.set(key, { date: key, abandoned: 0, sent: 0, recovered: 0 });
    });
    for (const cart of carts) {
      if (!cart.shopify_created_at) continue;
      const day = format(new Date(cart.shopify_created_at), 'yyyy-MM-dd');
      const row = byDay.get(day);
      if (!row) continue;
      if (cart.is_abandoned) row.abandoned++;
      if ((cart.last_message_step ?? 0) >= 1) row.sent++;
      if (cart.recovered_at) row.recovered++;
    }
    return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [carts, dateRange.current.start, dateRange.current.end]);

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

  const isLoading = cartsQuery.isLoading || attemptsQuery.isLoading;
  const error = cartsQuery.error || attemptsQuery.error;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingCart className="h-7 w-7" />
            Cart Recovery
          </h1>
          <p className="text-muted-foreground mt-1">
            Carritos abandonados de Shopify y campañas de WhatsApp.
          </p>
        </div>
        <FinanceDatePicker dateRange={dateRange} />
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-2 py-3 text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Error cargando datos: {(error as any).message}</span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          icon={<ShoppingCart className="h-4 w-4" />}
          label="Abandonados"
          value={String(stats.abandoned)}
        />
        <MetricCard
          icon={<MessageSquareWarning className="h-4 w-4" />}
          label="Mensajes enviados"
          value={String(stats.sent)}
        />
        <MetricCard
          label="Read rate"
          value={`${(attemptStats?.readRate ?? 0).toFixed(1)}%`}
        />
        <MetricCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Recuperados"
          value={String(stats.recovered)}
        />
        <MetricCard
          label="Recovery rate"
          value={`${stats.recoveryRate.toFixed(1)}%`}
        />
        <MetricCard
          label="GMV recuperado"
          value={formatCOP(stats.recoveredGmv)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actividad por día</CardTitle>
          <p className="text-xs text-muted-foreground">
            Carritos abandonados, mensajes enviados y recuperaciones por día.
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => format(new Date(d), 'd MMM', { locale: es })}
                  tick={{ fontSize: 11 }}
                  stroke="#94a3b8"
                />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip
                  labelFormatter={(d) => format(new Date(d as string), "d MMM yyyy", { locale: es })}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="abandoned" name="Abandonados" stroke="#94a3b8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sent" name="Enviados" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="recovered" name="Recuperados" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

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
              <TabsTrigger value="all">Todos ({stats.total})</TabsTrigger>
              <TabsTrigger value="sent">Mensaje enviado ({stats.sent})</TabsTrigger>
              <TabsTrigger value="recovered">Recuperados ({stats.recovered})</TabsTrigger>
              <TabsTrigger value="opted_out">Opt-out ({stats.optedOut})</TabsTrigger>
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

export default CartRecoveryDashboardPage;
