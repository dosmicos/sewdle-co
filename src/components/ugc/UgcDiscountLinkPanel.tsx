import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Link2, Copy, Check, ShoppingBag, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useUgcDiscountLinks } from '@/hooks/useUgcDiscountLinks';

interface UgcDiscountLinkPanelProps {
  creatorId: string;
  creatorName: string;
}

const formatCOP = (amount: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

export const UgcDiscountLinkPanel: React.FC<UgcDiscountLinkPanelProps> = ({ creatorId, creatorName }) => {
  const { discountLink, attributedOrders, loading, creating, createDiscountLink, toggleActive } =
    useUgcDiscountLinks(creatorId);

  const [discountValue, setDiscountValue] = useState(10);
  const [commissionRate, setCommissionRate] = useState(10);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    await createDiscountLink({ discount_value: discountValue, commission_rate: commissionRate });
  };

  const handleCopy = () => {
    if (!discountLink) return;
    const url = `https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/ugc-redirect/${discountLink.redirect_token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!discountLink) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center space-y-2">
          <Link2 className="h-8 w-8 text-gray-300 mx-auto" />
          <p className="text-sm text-muted-foreground">
            {creatorName} aún no tiene un link de descuento. Crea uno para que pueda empezar a generar comisiones.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Descuento al cliente (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">Descuento que recibe el cliente al comprar</p>
            </div>
            <div className="space-y-2">
              <Label>Comisión para {creatorName} (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(Number(e.target.value))}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-xs text-muted-foreground">% del total del pedido que se acumula como comisión</p>
            </div>
          </div>

          <div className="rounded-md bg-blue-50 border border-blue-100 p-3 flex gap-2 text-sm text-blue-700">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              El creator solo recibe un link corto. El código de Shopify queda oculto y se aplica automáticamente al hacer clic.
            </span>
          </div>

          <Button onClick={handleCreate} disabled={creating} className="w-full">
            {creating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando en Shopify...</>
            ) : (
              <><Link2 className="h-4 w-4 mr-2" /> Crear Link de Descuento</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  const redirectUrl = `https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/ugc-redirect/${discountLink.redirect_token}`;

  return (
    <div className="space-y-6">
      {/* Status + Link */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={discountLink.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500'}>
              {discountLink.is_active ? 'Activo' : 'Inactivo'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {discountLink.discount_value}% descuento · {discountLink.commission_rate}% comisión
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Activo</Label>
            <Switch
              checked={discountLink.is_active}
              onCheckedChange={(val) => toggleActive(discountLink.id, val)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Input readOnly value={redirectUrl} className="text-xs font-mono" />
          <Button size="icon" variant="outline" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Este es el link que se comparte con {creatorName}. Al hacer clic, el descuento se aplica automáticamente sin mostrar ningún código.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <ShoppingBag className="h-3 w-3" /> Pedidos
          </div>
          <p className="text-2xl font-bold">{discountLink.total_orders}</p>
        </div>
        <div className="rounded-lg border p-3 space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" /> Revenue
          </div>
          <p className="text-lg font-bold">{formatCOP(discountLink.total_revenue)}</p>
        </div>
        <div className="rounded-lg border p-3 space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <DollarSign className="h-3 w-3" /> Comisión
          </div>
          <p className="text-lg font-bold text-green-600">{formatCOP(discountLink.total_commission)}</p>
        </div>
      </div>

      {/* Orders table */}
      {attributedOrders.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Pedidos atribuidos</p>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Pedido</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Fecha</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Comisión</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {attributedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">#{order.shopify_order_number}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {format(new Date(order.order_date), "dd MMM yyyy", { locale: es })}
                    </td>
                    <td className="px-3 py-2 text-right">{formatCOP(order.order_total)}</td>
                    <td className="px-3 py-2 text-right text-green-600 font-medium">{formatCOP(order.commission_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground text-sm">
          <ShoppingBag className="h-8 w-8 mx-auto mb-2 text-gray-200" />
          Aún no hay pedidos atribuidos a este link.
        </div>
      )}
    </div>
  );
};
