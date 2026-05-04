import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Package, Truck, Search, Loader2, RefreshCw, CheckCircle2, AlertCircle, Plus, X } from 'lucide-react';
import { useShippingManifests } from '@/hooks/useShippingManifests';
import { CARRIER_NAMES, type CarrierCode } from '@/features/shipping/types/envia';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface ManifestCreationModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface EnviaShipment {
  id: string;
  shipment_id: string | null;
  tracking_number: string;
  carrier: string;
  status: string;
  created_at: string;
  shopify_order_id: number | null;
  order_number: string | null;
  recipient_name: string | null;
  destination_city: string | null;
  source: 'envia_api' | 'database' | 'manual';
}

const CARRIERS: { value: CarrierCode; label: string }[] = [
  { value: 'coordinadora', label: 'Coordinadora' },
  { value: 'interrapidisimo', label: 'Interrapidísimo' },
  { value: 'deprisa', label: 'Deprisa' },
  { value: 'servientrega', label: 'Servientrega' },
  { value: 'tcc', label: 'TCC' },
  { value: 'envia', label: 'Envía' },
];

export const ManifestCreationModal: React.FC<ManifestCreationModalProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const { createManifest, loading } = useShippingManifests();

  const [carrier, setCarrier] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [shipments, setShipments] = useState<EnviaShipment[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingShipments, setLoadingShipments] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'envia_api' | 'database' | null>(null);
  // Manual add by tracking number
  const [manualTracking, setManualTracking] = useState('');
  const [addingManual, setAddingManual] = useState(false);

  const todayLabel = format(new Date(), "d 'de' MMMM yyyy", { locale: es });

  // Fetch today's shipments from Envia API (via edge function)
  const fetchShipments = useCallback(async (selectedCarrier: string) => {
    if (!selectedCarrier) {
      setShipments([]);
      return;
    }

    setLoadingShipments(true);
    setLoadError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/envia-list-shipments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ carrier: selectedCarrier }),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al cargar guías');
      }

      // Get tracking numbers already included in any existing manifest
      const { data: manifestedItems } = await supabase
        .from('manifest_items')
        .select('tracking_number')
        .not('tracking_number', 'is', null);

      const manifestedTrackings = new Set(
        (manifestedItems || []).map((i: any) => i.tracking_number)
      );

      // Preserve manually-added shipments
      const prevManual = shipments.filter(s => s.source === 'manual');
      const rawShipments: EnviaShipment[] = data.data || [];

      // Exclude guides already in an existing manifest
      const apiShipments = rawShipments.filter(
        s => !manifestedTrackings.has(s.tracking_number)
      );

      setShipments([...apiShipments, ...prevManual]);
      setDataSource(data.source);

      // Select all by default
      const allIds = new Set([
        ...apiShipments.map(s => s.id),
        ...prevManual.map(s => s.id),
      ]);
      setSelectedIds(allIds);
    } catch (err: any) {
      console.error('Error fetching Envia shipments:', err);
      setLoadError(err.message || 'Error al conectar con Envia');
    } finally {
      setLoadingShipments(false);
    }
  }, [shipments]);

  // Auto-load when carrier changes
  useEffect(() => {
    if (open && carrier) {
      fetchShipments(carrier);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrier, open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setCarrier('');
      setNotes('');
      setSearch('');
      setShipments([]);
      setSelectedIds(new Set());
      setLoadError(null);
      setDataSource(null);
      setManualTracking('');
    }
  }, [open]);

  // Add tracking manually
  const handleAddManual = async () => {
    const tracking = manualTracking.trim();
    if (!tracking || !carrier) return;

    // Check if already in list
    if (shipments.some(s => s.tracking_number === tracking)) {
      toast.warning('Esta guía ya está en la lista');
      return;
    }

    setAddingManual(true);
    try {
      // Try to find in DB for extra info
      const { data: dbLabel } = await supabase
        .from('shipping_labels')
        .select('id, shopify_order_id, order_number, recipient_name, destination_city, created_at')
        .eq('tracking_number', tracking)
        .maybeSingle();

      const newShipment: EnviaShipment = {
        id: dbLabel?.id || `manual_${tracking}`,
        shipment_id: null,
        tracking_number: tracking,
        carrier,
        status: 'created',
        created_at: dbLabel?.created_at || new Date().toISOString(),
        shopify_order_id: dbLabel?.shopify_order_id || null,
        order_number: dbLabel?.order_number || null,
        recipient_name: dbLabel?.recipient_name || null,
        destination_city: dbLabel?.destination_city || null,
        source: 'manual',
      };

      setShipments(prev => [...prev, newShipment]);
      setSelectedIds(prev => new Set([...prev, newShipment.id]));
      setManualTracking('');
      toast.success(`Guía ${tracking} agregada`);
    } catch (err) {
      console.error('Error adding manual tracking:', err);
    } finally {
      setAddingManual(false);
    }
  };

  const removeShipment = (id: string) => {
    setShipments(prev => prev.filter(s => s.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const filteredShipments = shipments.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.tracking_number?.toLowerCase().includes(q) ||
      s.order_number?.toLowerCase().includes(q) ||
      s.recipient_name?.toLowerCase().includes(q) ||
      s.destination_city?.toLowerCase().includes(q)
    );
  });

  const toggleShipment = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredShipments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredShipments.map(s => s.id)));
    }
  };

  const handleCreate = async () => {
    if (!carrier || selectedIds.size === 0) return;

    const selected = shipments.filter(s => selectedIds.has(s.id));

    // Pass all selected shipments (including envia_xxx / manual_xxx).
    // createManifest will upsert stub shipping_labels records for guides that
    // only exist in the Envia portal and have no DB record yet.
    const result = await createManifest({
      carrier,
      shipments: selected.map(s => ({
        id: s.id,
        tracking_number: s.tracking_number,
        shopify_order_id: s.shopify_order_id,
        order_number: s.order_number,
        recipient_name: s.recipient_name,
        destination_city: s.destination_city,
      })),
      notes: notes || undefined,
    });

    if (result) {
      onCreated();
      onClose();
    }
  };

  const allSelected = filteredShipments.length > 0 && selectedIds.size === filteredShipments.length;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[85vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Crear Manifiesto — Guías disponibles al {todayLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 pr-1">
          {/* Carrier selection */}
          <div className="space-y-2">
            <Label>Transportadora *</Label>
            <Select value={carrier} onValueChange={setCarrier}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar transportadora" />
              </SelectTrigger>
              <SelectContent>
                {CARRIERS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      {c.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Shipments list */}
          {carrier && (
            <div className="space-y-2">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>
                    Guías disponibles (últimos 7 días, estado: creada)
                    {!loadingShipments && shipments.length > 0 && (
                      <span className="ml-1 text-muted-foreground font-normal">
                        ({shipments.length})
                      </span>
                    )}
                  </Label>
                  {dataSource && !loadingShipments && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-4 ${
                        dataSource === 'envia_api'
                          ? 'border-green-500 text-green-700'
                          : 'border-amber-500 text-amber-700'
                      }`}
                    >
                      {dataSource === 'envia_api' ? '✓ API Envia' : '⚠ Base de datos'}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {shipments.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleAll}>
                      {allSelected ? 'Quitar todo' : 'Seleccionar todo'}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => fetchShipments(carrier)}
                    disabled={loadingShipments}
                    title="Recargar desde Envia"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingShipments ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>

              {/* Search */}
              {shipments.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por guía, orden, destinatario..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              )}

              {/* List */}
              <ScrollArea className="h-44 border rounded-md">
                {loadingShipments ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 gap-2 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <p className="text-sm">Consultando guías en Envia...</p>
                  </div>
                ) : loadError ? (
                  <div className="flex flex-col items-center justify-center h-full py-6 gap-2 text-destructive px-4">
                    <AlertCircle className="h-6 w-6" />
                    <p className="text-sm font-medium text-center">Error al cargar guías automáticamente</p>
                    <p className="text-xs text-muted-foreground text-center">{loadError}</p>
                    <p className="text-xs text-muted-foreground text-center">Puedes agregar las guías manualmente abajo</p>
                    <Button variant="outline" size="sm" onClick={() => fetchShipments(carrier)}>
                      Reintentar
                    </Button>
                  </div>
                ) : filteredShipments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 py-6">
                    <CheckCircle2 className="h-7 w-7 mb-1 text-muted-foreground/40" />
                    <p className="font-medium text-sm">No se encontraron guías automáticamente</p>
                    <p className="text-xs mt-0.5">Agrega los números de guía manualmente</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredShipments.map((s) => (
                      <div
                        key={s.id}
                        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors group ${
                          selectedIds.has(s.id) ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => toggleShipment(s.id)}
                      >
                        <Checkbox
                          checked={selectedIds.has(s.id)}
                          onCheckedChange={() => toggleShipment(s.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {s.order_number && (
                              <span className="font-medium text-sm">#{s.order_number}</span>
                            )}
                            <Badge variant="outline" className="text-xs font-mono">
                              {s.tracking_number}
                            </Badge>
                            {s.source === 'manual' && (
                              <Badge variant="secondary" className="text-[10px] h-4">manual</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {[s.recipient_name, s.destination_city].filter(Boolean).join(' • ') || 'Sin info de destino'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="text-xs text-muted-foreground shrink-0">
                            {format(new Date(s.created_at), 'HH:mm', { locale: es })}
                          </div>
                          {s.source === 'manual' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); removeShipment(s.id); }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-all"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Manual add tracking */}
              <div className="flex gap-2">
                <Input
                  placeholder="Agregar guía manualmente (número de tracking)..."
                  value={manualTracking}
                  onChange={(e) => setManualTracking(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddManual()}
                  className="text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddManual}
                  disabled={!manualTracking.trim() || addingManual}
                  className="shrink-0 gap-1.5"
                >
                  {addingManual ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Agregar
                </Button>
              </div>

              {selectedIds.size > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedIds.size} guía{selectedIds.size !== 1 ? 's' : ''} seleccionada{selectedIds.size !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea
              placeholder="Notas adicionales para el manifiesto..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!carrier || selectedIds.size === 0 || loading}
            size="lg"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear Manifiesto ({selectedIds.size} guías)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
