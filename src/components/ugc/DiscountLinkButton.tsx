import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Link2, Copy, Check, ShoppingBag, DollarSign, TrendingUp,
  Trash2, PowerOff, Power, AlertCircle, Wallet, CreditCard, Smartphone, History,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useUgcDiscountLinks } from '@/hooks/useUgcDiscountLinks';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';

interface DiscountLinkButtonProps {
  creatorId: string;
  creatorName: string;
}

const formatCOP = (amount: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

const PAYOUT_TYPES = [
  { value: 'nequi', label: 'Nequi', icon: Smartphone },
  { value: 'discount', label: 'Descuento en tienda', icon: CreditCard },
  { value: 'other', label: 'Otro', icon: DollarSign },
] as const;

export const DiscountLinkButton: React.FC<DiscountLinkButtonProps> = ({ creatorId, creatorName }) => {
  const [open, setOpen] = useState(false);
  const [discountValue, setDiscountValue] = useState(10);
  const [commissionRate, setCommissionRate] = useState(10);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Payout state
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutType, setPayoutType] = useState<'nequi' | 'discount' | 'other'>('nequi');
  const [payoutNotes, setPayoutNotes] = useState('');

  const { isAdmin } = useAuth();
  const { discountLink, attributedOrders, payouts, loading, creating, registeringPayout, createDiscountLink, toggleActive, registerPayout, refetch } =
    useUgcDiscountLinks(creatorId);

  const redirectUrl = discountLink
    ? `https://ads.dosmicos.com/ugc/${discountLink.redirect_token}`
    : '';

  const balance = discountLink
    ? Math.max(discountLink.total_commission - discountLink.total_paid_out, 0)
    : 0;

  const handleCreate = async () => {
    await createDiscountLink({ discount_value: discountValue, commission_rate: commissionRate });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(redirectUrl);
    setCopied(true);
    toast.success('Link copiado');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggle = async () => {
    if (!discountLink) return;
    setToggling(true);
    await toggleActive(discountLink.id, !discountLink.is_active);
    setToggling(false);
  };

  const handleDelete = async () => {
    if (!discountLink) return;
    if (!window.confirm(`¿Eliminar el link de descuento de ${creatorName}? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('No autenticado');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-ugc-discount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ discount_link_id: discountLink.id }),
      });

      if (!response.ok) {
        const { error } = await (supabase.from('ugc_discount_links' as any) as any)
          .update({ is_active: false })
          .eq('id', discountLink.id);
        if (error) throw error;
        toast.success('Link desactivado');
      } else {
        toast.success('Link eliminado');
      }
      await refetch();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handlePayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0) { toast.error('Ingresa un monto válido'); return; }
    if (amount > balance) { toast.error('El monto supera el saldo disponible'); return; }
    await registerPayout({ amount, payout_type: payoutType, notes: payoutNotes || undefined });
    setPayoutOpen(false);
    setPayoutAmount('');
    setPayoutNotes('');
  };

  const hasLink = !!discountLink;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={hasLink ? 'border-green-200 text-green-700 hover:bg-green-50' : ''}
      >
        <ShoppingBag className="h-4 w-4 mr-1" />
        Link de Compras
        {hasLink && (
          <Badge variant="outline" className="ml-1 h-4 text-[10px] bg-green-100 text-green-700 border-green-200 px-1">
            Activo
          </Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Link de Compras — {creatorName}</DialogTitle>
            <DialogDescription>
              {hasLink
                ? 'Link único de descuento para compartir en redes. El cliente nunca ve el código de Shopify.'
                : 'Crea un link personalizado que aplica un descuento automáticamente al cliente.'}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : hasLink ? (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={discountLink.is_active
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-gray-100 text-gray-500 border-gray-200'}>
                  {discountLink.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {discountLink.discount_value}% desc. al cliente · {discountLink.commission_rate}% comisión
                </span>
              </div>

              {/* Link */}
              <div className="space-y-1">
                <Label className="text-xs">Link para compartir</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={redirectUrl} className="text-xs font-mono" />
                  <Button size="icon" variant="outline" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Balance card */}
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-green-700" />
                    <div>
                      <p className="text-xs text-green-700 font-medium">Saldo pendiente de pago</p>
                      <p className="text-xl font-bold text-green-800">{formatCOP(balance)}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Ganado: {formatCOP(discountLink.total_commission)}</p>
                    <p>Pagado: {formatCOP(discountLink.total_paid_out)}</p>
                  </div>
                </div>
                {isAdmin() && balance > 0 && (
                  <Button
                    size="sm"
                    className="w-full mt-3 bg-green-700 hover:bg-green-800 text-white"
                    onClick={() => { setPayoutOpen(true); setPayoutAmount(balance.toFixed(0)); }}
                  >
                    <DollarSign className="h-3.5 w-3.5 mr-1" />
                    Registrar Pago
                  </Button>
                )}
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border p-2 text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <ShoppingBag className="h-3 w-3" /> Pedidos
                  </p>
                  <p className="text-xl font-bold">{discountLink.total_orders}</p>
                </div>
                <div className="rounded-lg border p-2 text-center">
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <TrendingUp className="h-3 w-3" /> Revenue total
                  </p>
                  <p className="text-sm font-bold">{formatCOP(discountLink.total_revenue)}</p>
                </div>
              </div>

              {/* Recent orders */}
              {attributedOrders.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Últimos pedidos atribuidos</Label>
                  <div className="rounded-md border divide-y max-h-36 overflow-y-auto">
                    {attributedOrders.slice(0, 10).map((order) => (
                      <div key={order.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                        <span className="font-mono text-muted-foreground">#{order.shopify_order_number}</span>
                        <span className="text-muted-foreground">
                          {format(new Date(order.order_date), 'dd MMM', { locale: es })}
                        </span>
                        <span>{formatCOP(order.order_total)}</span>
                        <span className="text-green-600 font-medium">{formatCOP(order.commission_amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payout history */}
              {payouts.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    <History className="h-3 w-3" /> Historial de pagos
                  </Label>
                  <div className="rounded-md border divide-y max-h-28 overflow-y-auto">
                    {payouts.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                        <span className="text-muted-foreground">
                          {format(new Date(p.created_at), 'dd MMM yyyy', { locale: es })}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1 h-4">
                          {p.payout_type === 'nequi' ? 'Nequi' : p.payout_type === 'discount' ? 'Descuento' : 'Otro'}
                        </Badge>
                        {p.notes && <span className="text-muted-foreground truncate max-w-[80px]">{p.notes}</span>}
                        <span className="text-red-600 font-medium">-{formatCOP(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggle}
                  disabled={toggling}
                  className="flex-1"
                >
                  {toggling ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : discountLink.is_active ? (
                    <><PowerOff className="h-4 w-4 mr-1" /> Desactivar</>
                  ) : (
                    <><Power className="h-4 w-4 mr-1" /> Activar</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-destructive border-destructive/30 hover:bg-destructive/5"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md bg-blue-50 border border-blue-100 p-3 flex gap-2 text-xs text-blue-700">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Se crea un código aleatorio en Shopify. El creator solo recibe un link corto — nunca ve el código real.
                  El descuento se aplica automáticamente al hacer clic.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Descuento al cliente</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number" min={1} max={50}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(Number(e.target.value))}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Comisión para {creatorName.split(' ')[0]}</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number" min={1} max={50}
                      value={commissionRate}
                      onChange={(e) => setCommissionRate(Number(e.target.value))}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              </div>

              <Button onClick={handleCreate} disabled={creating} className="w-full">
                {creating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando en Shopify...</>
                ) : (
                  <><Link2 className="h-4 w-4 mr-2" /> Crear Link Único</>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payout registration dialog */}
      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pago — {creatorName.split(' ')[0]}</DialogTitle>
            <DialogDescription>
              Saldo disponible: <strong>{formatCOP(balance)}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Monto a pagar (COP)</Label>
              <Input
                type="number"
                min={1}
                max={balance}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tipo de pago</Label>
              <div className="grid grid-cols-3 gap-2">
                {PAYOUT_TYPES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPayoutType(value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition-colors ${
                      payoutType === value
                        ? 'border-primary bg-primary/5 text-primary font-medium'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notas (opcional)</Label>
              <Input
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
                placeholder="Ej: Nequi 300 123 4567"
              />
            </div>

            <Button
              onClick={handlePayout}
              disabled={registeringPayout || !payoutAmount || parseFloat(payoutAmount) <= 0}
              className="w-full"
            >
              {registeringPayout
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Registrando...</>
                : <><Check className="h-4 w-4 mr-2" /> Confirmar Pago</>
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
