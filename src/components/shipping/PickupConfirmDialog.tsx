import React, { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Loader2, Copy, Truck } from 'lucide-react';
import { useShippingManifests, ManifestItem, ReconciliationData } from '@/hooks/useShippingManifests';
import { toast } from 'sonner';

interface PickupConfirmDialogProps {
  open: boolean;
  manifestId: string | null;
  issues: string[];
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => void;
}

/**
 * Diálogo de bloqueo de "Confirmar Retiro" ante descuadre.
 * Encabeza con la lista EXACTA de guías que no aparecen (pendientes por escanear,
 * 🔴 entregadas pero ausentes en la relación, 🟡 en la relación pero no en el
 * manifiesto) y obliga a escribir una justificación que queda registrada.
 */
export const PickupConfirmDialog: React.FC<PickupConfirmDialogProps> = ({
  open,
  manifestId,
  issues,
  onOpenChange,
  onConfirmed,
}) => {
  const { fetchManifestWithItems, confirmPickup } = useShippingManifests();

  const [loading, setLoading] = useState(false);
  const [pendingItems, setPendingItems] = useState<ManifestItem[]>([]);
  const [recon, setRecon] = useState<ReconciliationData | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !manifestId) return;
    setReason('');
    setLoading(true);
    fetchManifestWithItems(manifestId).then((m) => {
      if (m) {
        setPendingItems(m.items.filter(i => i.scan_status !== 'verified'));
        setRecon((m.reconciliation_data as ReconciliationData) ?? null);
      }
      setLoading(false);
    });
  }, [open, manifestId, fetchManifestWithItems]);

  const copyList = (label: string, list: string[]) => {
    navigator.clipboard?.writeText(list.join('\n')).then(
      () => toast.success(`${label}: ${list.length} guías copiadas`),
      () => toast.error('No se pudo copiar'),
    );
  };

  const handleConfirm = async () => {
    if (!manifestId || !reason.trim()) return;
    setSubmitting(true);
    const res = await confirmPickup(manifestId, { overrideReason: reason.trim() });
    setSubmitting(false);
    if (res.ok) {
      onOpenChange(false);
      onConfirmed();
    }
  };

  const missingInCarrier = recon?.missing_in_carrier ?? [];
  const extraInCarrier = recon?.extra_in_carrier ?? [];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500">
            <AlertTriangle className="h-5 w-5" />
            No cuadra el retiro
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-left">
              {/* Resumen de descuadres */}
              <ul className="space-y-1 text-sm">
                {issues.map((issue, i) => (
                  <li key={i} className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {issue}
                  </li>
                ))}
              </ul>

              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando guías…
                </div>
              ) : (
                <>
                  {/* Guías pendientes por escanear */}
                  {pendingItems.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-yellow-700 dark:text-yellow-500">
                          Guías sin escanear ({pendingItems.length})
                        </span>
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                          onClick={() => copyList('Sin escanear', pendingItems.map(i => i.tracking_number))}>
                          <Copy className="h-3 w-3" /> Copiar
                        </Button>
                      </div>
                      <ScrollArea className="h-28 border rounded-md p-2">
                        {pendingItems.map((item) => (
                          <div key={item.id} className="text-sm py-0.5 font-mono">
                            {item.tracking_number}
                            <span className="text-xs text-muted-foreground font-sans">
                              {' '}{item.recipient_name ? `· ${item.recipient_name}` : ''}
                            </span>
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                  )}

                  {/* 🔴 Entregadas pero ausentes en la relación de la transportadora */}
                  {missingInCarrier.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-red-600">
                          En tu manifiesto pero NO en la relación de Coordinadora ({missingInCarrier.length})
                        </span>
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                          onClick={() => copyList('No registradas por la transportadora', missingInCarrier)}>
                          <Copy className="h-3 w-3" /> Copiar
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {missingInCarrier.map((t) => (
                          <Badge key={t} variant="destructive" className="font-mono text-xs">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 🟡 En la relación pero no en el manifiesto */}
                  {extraInCarrier.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-yellow-700 dark:text-yellow-500">
                        En la relación de Coordinadora pero NO en tu manifiesto ({extraInCarrier.length})
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {extraInCarrier.map((t) => (
                          <Badge key={t} variant="outline" className="font-mono text-xs border-yellow-500 text-yellow-700">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Justificación obligatoria */}
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-sm">Justificación para confirmar de todos modos *</Label>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Ej: las 2 guías faltantes se entregan en la siguiente recolección…"
                      rows={2}
                    />
                  </div>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Volver a escanear</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={submitting || !reason.trim()}
            className="bg-yellow-600 hover:bg-yellow-700 gap-1.5"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
            Confirmar con justificación
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
