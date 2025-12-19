import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package, Truck, Calendar, Search, Loader2 } from 'lucide-react';
import { useShippingManifests } from '@/hooks/useShippingManifests';
import { CARRIER_NAMES, type CarrierCode } from '@/features/shipping/types/envia';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ManifestCreationModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface AvailableLabel {
  id: string;
  shopify_order_id: number;
  order_number: string;
  tracking_number: string;
  carrier: string;
  recipient_name: string | null;
  destination_city: string | null;
  created_at: string;
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
  const { createManifest, getAvailableLabels, loading } = useShippingManifests();
  
  const [carrier, setCarrier] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [availableLabels, setAvailableLabels] = useState<AvailableLabel[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingLabels, setLoadingLabels] = useState(false);

  // Load labels when carrier or dates change
  useEffect(() => {
    const loadLabels = async () => {
      if (!carrier) {
        setAvailableLabels([]);
        return;
      }

      setLoadingLabels(true);
      const labels = await getAvailableLabels(carrier, dateFrom, dateTo);
      setAvailableLabels(labels);
      setSelectedIds(new Set(labels.map(l => l.id))); // Select all by default
      setLoadingLabels(false);
    };

    loadLabels();
  }, [carrier, dateFrom, dateTo, getAvailableLabels]);

  // Filter labels by search
  const filteredLabels = availableLabels.filter(label => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      label.order_number.toLowerCase().includes(searchLower) ||
      label.tracking_number?.toLowerCase().includes(searchLower) ||
      label.recipient_name?.toLowerCase().includes(searchLower) ||
      label.destination_city?.toLowerCase().includes(searchLower)
    );
  });

  const toggleLabel = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredLabels.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLabels.map(l => l.id)));
    }
  };

  const handleCreate = async () => {
    if (!carrier || selectedIds.size === 0) return;

    const result = await createManifest({
      carrier,
      labelIds: Array.from(selectedIds),
      notes: notes || undefined,
    });

    if (result) {
      onCreated();
      onClose();
      // Reset form
      setCarrier('');
      setNotes('');
      setSelectedIds(new Set());
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Crear Nuevo Manifiesto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Desde
              </Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Hasta
              </Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* Labels list */}
          {carrier && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Guías disponibles ({availableLabels.length})</Label>
                {availableLabels.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAll}
                  >
                    {selectedIds.size === filteredLabels.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  </Button>
                )}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por orden, guía, destinatario..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-64 border rounded-md">
                {loadingLabels ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredLabels.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                    <Package className="h-8 w-8 mb-2" />
                    <p>No hay guías disponibles</p>
                    <p className="text-sm">para {CARRIER_NAMES[carrier as CarrierCode]} en este rango</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredLabels.map((label) => (
                      <div
                        key={label.id}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-muted/50 ${
                          selectedIds.has(label.id) ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => toggleLabel(label.id)}
                      >
                        <Checkbox
                          checked={selectedIds.has(label.id)}
                          onCheckedChange={() => toggleLabel(label.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">#{label.order_number}</span>
                            <Badge variant="outline" className="text-xs">
                              {label.tracking_number}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {label.recipient_name} • {label.destination_city}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(label.created_at), 'dd/MM', { locale: es })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {selectedIds.size > 0 && (
                <div className="text-sm text-muted-foreground">
                  {selectedIds.size} guías seleccionadas
                </div>
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!carrier || selectedIds.size === 0 || loading}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear Manifiesto ({selectedIds.size} guías)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
