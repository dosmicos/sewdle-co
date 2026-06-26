import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
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
import {
  ScanLine,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Package,
  Loader2,
  ArrowLeft,
  Truck,
  Calendar,
  Flag,
  Printer,
  Link2,
  Copy,
  Plus,
  User,
} from 'lucide-react';
import {
  useShippingManifests,
  ManifestWithItems,
  ManifestItem,
  ReconciliationData,
} from '@/hooks/useShippingManifests';
import { CARRIER_NAMES, type CarrierCode } from '@/features/shipping/types/envia';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { openManifestPrintWindow } from './ManifestPrintView';

interface ManifestDetailViewProps {
  manifest: ManifestWithItems;
  onBack: () => void;
  onUpdate: () => void;
}

type ScanFeedback = {
  type: 'success' | 'warning' | 'error';
  message: string;
  trackingNumber: string;
};

export const ManifestDetailView: React.FC<ManifestDetailViewProps> = ({
  manifest,
  onBack,
  onUpdate,
}) => {
  const {
    scanTrackingNumber,
    closeManifest,
    recordCollectorCount,
    persistExtraScan,
    fetchExtraScans,
    addScannedGuiaToManifest,
    reconcileWithCoordinadora,
  } = useShippingManifests();

  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanFeedback[]>([]);
  const [items, setItems] = useState<ManifestItem[]>(manifest.items);
  const [extraScans, setExtraScans] = useState<string[]>([]);
  const [addingTracking, setAddingTracking] = useState<string | null>(null);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [closingManifest, setClosingManifest] = useState(false);

  // Conteo del recolector (todas las transportadoras)
  const [collectorCount, setCollectorCount] = useState<string>(
    manifest.collector_reported_count != null ? String(manifest.collector_reported_count) : ''
  );
  const [collectorName, setCollectorName] = useState<string>(manifest.collector_name ?? '');

  // Cruce con la relación de recogida de Coordinadora
  const isCoordinadora = manifest.carrier === 'coordinadora';
  const [linkInput, setLinkInput] = useState<string>(manifest.pickup_link_url ?? '');
  const [reconciling, setReconciling] = useState(false);
  const [reconResult, setReconResult] = useState<ReconciliationData | null>(
    (manifest.reconciliation_data as ReconciliationData) ?? null
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const scanInFlightRef = useRef(false);

  // Auto-focus on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Cargar las guías extra ya persistidas (escaneadas con la pistola fuera del manifiesto).
  useEffect(() => {
    fetchExtraScans(manifest.id).then((rows) => {
      const gun = rows.filter(r => r.source === 'gun').map(r => r.tracking_number);
      if (gun.length) setExtraScans(prev => Array.from(new Set([...gun, ...prev])));
    });
  }, [manifest.id, fetchExtraScans]);

  // Re-focus input after each scan completes.
  useEffect(() => {
    if (!scanning) {
      inputRef.current?.focus();
    }
  }, [scanning]);

  // Refresh items when manifest changes
  useEffect(() => {
    setItems(manifest.items);
  }, [manifest.items]);

  // Core scan function — takes a resolved tracking number directly so
  // auto-scan can pass the full number even when input only has 4 digits.
  const triggerScan = useCallback(async (trackingNumber: string) => {
    if (!trackingNumber || scanInFlightRef.current) return;

    scanInFlightRef.current = true;
    setScanning(true);
    setScanInput('');

    try {
      const timeout = new Promise<{ success: false; status: 'error'; message: string }>(resolve =>
        setTimeout(() => resolve({
          success: false,
          status: 'error' as const,
          message: 'Tiempo de espera agotado. Intenta de nuevo.',
        }), 8000)
      );

      const result = await Promise.race([
        scanTrackingNumber(manifest.id, trackingNumber),
        timeout,
      ]);

      const feedback: ScanFeedback = {
        type: result.success ? 'success' : result.status === 'already_scanned' ? 'warning' : 'error',
        message: result.message,
        trackingNumber,
      };

      setScanHistory(prev => [feedback, ...prev.slice(0, 49)]);

      if (result.success) {
        setItems(prev => prev.map(item =>
          item.tracking_number === trackingNumber
            ? { ...item, scanned_at: new Date().toISOString(), scan_status: 'verified' }
            : item
        ));
      } else if (result.status === 'not_found') {
        if (!extraScans.includes(trackingNumber)) {
          setExtraScans(prev => [...prev, trackingNumber]);
          // Persistir la guía extra para que quede auditada (antes se perdía al cerrar).
          persistExtraScan(manifest.id, trackingNumber, 'gun');
        }
      }
    } finally {
      scanInFlightRef.current = false;
      setScanning(false);
    }
  }, [manifest.id, scanTrackingNumber, extraScans, persistExtraScan]);

  // Enter key — resolves tracking from current input and delegates to triggerScan.
  const handleScan = useCallback(async () => {
    const trackingNumber = scanInput.trim().toUpperCase();
    if (!trackingNumber) return;
    await triggerScan(trackingNumber);
  }, [scanInput, triggerScan]);

  // Instant auto-scan.
  useEffect(() => {
    if (scanInFlightRef.current) return;
    const input = scanInput.trim();
    if (!input) return;

    const pendingTrackings = items
      .filter(i => i.scan_status === 'pending' || i.scan_status === null)
      .map(i => i.tracking_number.toUpperCase());

    const inputUpper = input.toUpperCase();

    if (pendingTrackings.includes(inputUpper)) {
      triggerScan(inputUpper);
      return;
    }

    if (/^\d{4}$/.test(input)) {
      const matches = pendingTrackings.filter(t => t.endsWith(input));
      if (matches.length === 1) {
        triggerScan(matches[0]);
      }
    }
  }, [scanInput, items, triggerScan]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan();
    }
  };

  // Agregar al vuelo una guía escaneada que no estaba en el manifiesto.
  const handleAddExtra = async (trackingNumber: string) => {
    setAddingTracking(trackingNumber);
    const res = await addScannedGuiaToManifest(manifest.id, trackingNumber);
    setAddingTracking(null);
    if (res.success) {
      setExtraScans(prev => prev.filter(t => t !== trackingNumber));
      if (res.item) {
        setItems(prev => [...prev, res.item as ManifestItem]);
      }
      if (res.labelCarrier && res.labelCarrier !== manifest.carrier) {
        toast.warning(`Ojo: la guía ${trackingNumber} es de ${res.labelCarrier}, no de ${manifest.carrier}`);
      } else {
        toast.success(`Guía ${trackingNumber} agregada al manifiesto`);
      }
      onUpdate();
    } else {
      toast.error(res.message || 'No se pudo agregar la guía');
    }
  };

  // Conteo del recolector — se guarda al salir del campo.
  const saveCollectorCount = () => {
    const trimmed = collectorCount.trim();
    const value = trimmed === '' ? null : parseInt(trimmed, 10);
    if (trimmed !== '' && Number.isNaN(value as number)) return;
    recordCollectorCount(manifest.id, value, collectorName.trim() || null);
    onUpdate();
  };

  // Cruce con Coordinadora.
  const handleReconcile = async () => {
    const link = linkInput.trim();
    if (!link) return;
    setReconciling(true);
    const res = await reconcileWithCoordinadora(manifest.id, link);
    setReconciling(false);
    if (res) {
      setReconResult(res.data);
      if (res.data.total_unidades != null) setCollectorCount(String(res.data.total_unidades));
      if (res.data.collector_name) setCollectorName(res.data.collector_name);
      if (res.status === 'matched') toast.success(res.message);
      else toast.warning(res.message);
      onUpdate();
    }
  };

  const copyList = (label: string, list: string[]) => {
    if (!list.length) return;
    navigator.clipboard?.writeText(list.join('\n')).then(
      () => toast.success(`${label}: ${list.length} guías copiadas`),
      () => toast.error('No se pudo copiar'),
    );
  };

  // Stats
  const totalItems = items.length;
  const verifiedItems = items.filter(i => i.scan_status === 'verified').length;
  const pendingItems = items.filter(i => i.scan_status === 'pending' || i.scan_status === null);
  const progress = totalItems > 0 ? (verifiedItems / totalItems) * 100 : 0;

  const collectorNum = collectorCount.trim() === '' ? null : parseInt(collectorCount, 10);
  const collectorMismatch = collectorNum != null && !Number.isNaN(collectorNum) && collectorNum !== verifiedItems;

  const handleFinishScan = () => setShowFinishDialog(true);

  const handleForceClose = async () => {
    setClosingManifest(true);
    const success = await closeManifest(manifest.id);
    setClosingManifest(false);
    if (success) {
      setShowFinishDialog(false);
      onUpdate();
      onBack();
    }
  };

  const handleBackClick = () => {
    onUpdate();
    onBack();
  };

  const isFullyVerified = verifiedItems === totalItems;
  const hasMissing = pendingItems.length > 0;
  const hasExtras = extraScans.length > 0;

  const missingInCarrier = reconResult?.missing_in_carrier ?? [];
  const extraInCarrier = reconResult?.extra_in_carrier ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        <Button variant="ghost" size="icon" onClick={handleBackClick}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{manifest.manifest_number}</h2>
            <Badge variant={manifest.status === 'open' ? 'default' : manifest.status === 'closed' ? 'secondary' : 'outline'}>
              {manifest.status === 'open' ? 'Abierto' : manifest.status === 'closed' ? 'Cerrado' : 'Retirado'}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Truck className="h-4 w-4" />
              {CARRIER_NAMES[manifest.carrier as CarrierCode] || manifest.carrier}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {format(new Date(manifest.manifest_date), 'dd/MM/yyyy', { locale: es })}
            </span>
            <span className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              {totalItems} guías
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => openManifestPrintWindow(manifest)}
          title="Imprimir manifiesto"
        >
          <Printer className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Progress bar */}
        <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progreso de verificación</span>
            <span className="font-medium">{verifiedItems} / {totalItems} ({Math.round(progress)}%)</span>
          </div>
          <Progress value={progress} className="h-3" />
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" /> {verifiedItems} verificados
            </span>
            <span className="flex items-center gap-1 text-yellow-600">
              <AlertCircle className="h-4 w-4" /> {pendingItems.length} pendientes
            </span>
            {hasExtras && (
              <span className="flex items-center gap-1 text-red-600">
                <AlertTriangle className="h-4 w-4" /> {extraScans.length} extras
              </span>
            )}
          </div>
        </div>

        {/* Conteo del recolector (todas las transportadoras) */}
        <div className={cn(
          'p-4 rounded-lg border space-y-3',
          collectorMismatch ? 'border-red-300 bg-red-50 dark:bg-red-900/10' : 'bg-muted/20'
        )}>
          <div className="flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4" />
            Conteo del recolector
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Paquetes que reporta</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={collectorCount}
                onChange={(e) => setCollectorCount(e.target.value)}
                onBlur={saveCollectorCount}
                placeholder="Ej: 76"
                className="w-28 h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nombre (opcional)</Label>
              <Input
                value={collectorName}
                onChange={(e) => setCollectorName(e.target.value)}
                onBlur={saveCollectorCount}
                placeholder="Recolector"
                className="w-44 h-9"
              />
            </div>
            <div className="text-sm">
              {collectorNum == null || Number.isNaN(collectorNum) ? (
                <span className="text-muted-foreground">Escaneadas: {verifiedItems}</span>
              ) : collectorMismatch ? (
                <span className="text-red-600 font-medium flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Descuadre: recolector {collectorNum} · escaneadas {verifiedItems}
                </span>
              ) : (
                <span className="text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" /> Cuadra ({verifiedItems})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Cruce con la relación de recogida de Coordinadora */}
        {isCoordinadora && (
          <div className="p-4 rounded-lg border bg-muted/20 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Link2 className="h-4 w-4" />
              Relación de recogida de Coordinadora
            </div>
            <div className="flex gap-2">
              <Input
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="Pega el link de recogida (relacion-envios.coordinadora.com/…)"
                className="text-sm"
              />
              <Button
                onClick={handleReconcile}
                disabled={!linkInput.trim() || reconciling}
                className="shrink-0 gap-1.5"
              >
                {reconciling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Cruzar
              </Button>
            </div>

            {reconResult && (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <span>Total Coordinadora: <span className="font-medium text-foreground">{reconResult.total_unidades}</span></span>
                  {reconResult.collector_name && <span>Recolector: {reconResult.collector_name}</span>}
                  {reconResult.fecha_recogida && <span>Fecha: {reconResult.fecha_recogida}</span>}
                  <span className="text-green-600">{reconResult.matched.length} coinciden</span>
                </div>

                {/* 🔴 Entregadas pero NO en la relación de Coordinadora */}
                {missingInCarrier.length > 0 && (
                  <div className="p-3 border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4" />
                        En tu manifiesto pero NO en la relación ({missingInCarrier.length})
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                        onClick={() => copyList('No registradas', missingInCarrier)}>
                        <Copy className="h-3 w-3" /> Copiar
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {missingInCarrier.map(t => (
                        <Badge key={t} variant="destructive" className="font-mono text-xs">{t}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-red-700/80 dark:text-red-400/80">
                      Coordinadora NO registró estas guías. Verifica que el recolector las haya recibido.
                    </p>
                  </div>
                )}

                {/* 🟡 En la relación pero NO en el manifiesto */}
                {extraInCarrier.length > 0 && (
                  <div className="p-3 border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-800 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-yellow-700 dark:text-yellow-500 flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4" />
                        En la relación pero NO en tu manifiesto ({extraInCarrier.length})
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                        onClick={() => copyList('Sin escanear', extraInCarrier)}>
                        <Copy className="h-3 w-3" /> Copiar
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {extraInCarrier.map(t => (
                        <Badge key={t} variant="outline" className="font-mono text-xs border-yellow-500 text-yellow-700">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {missingInCarrier.length === 0 && extraInCarrier.length === 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400 text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Todo cuadra con la relación de Coordinadora.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Scan input */}
        <div className="relative">
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escanear o escribir número de guía..."
            className="pl-10 h-14 text-lg font-mono"
            autoFocus
            disabled={scanning}
          />
          <Loader2 className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin transition-opacity duration-150",
            scanning ? "opacity-100" : "opacity-0"
          )} />
        </div>

        {/* Last scan feedback */}
        {scanHistory.length > 0 && (
          <div
            className={cn(
              'p-3 rounded-lg flex items-center gap-2 text-sm font-medium',
              scanHistory[0].type === 'success' && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
              scanHistory[0].type === 'warning' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
              scanHistory[0].type === 'error' && 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            )}
          >
            {scanHistory[0].type === 'success' && <CheckCircle2 className="h-5 w-5" />}
            {scanHistory[0].type === 'warning' && <AlertCircle className="h-5 w-5" />}
            {scanHistory[0].type === 'error' && <XCircle className="h-5 w-5" />}
            {scanHistory[0].message}
          </div>
        )}

        {/* Two column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pending items */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              Pendientes ({pendingItems.length})
            </h3>
            <ScrollArea className="h-64 border rounded-md">
              {pendingItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-green-600 p-4">
                  <CheckCircle2 className="h-8 w-8 mb-2" />
                  <p>¡Todas las guías verificadas!</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {pendingItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-2 rounded-md bg-yellow-50 dark:bg-yellow-900/10"
                    >
                      <Package className="h-4 w-4 text-yellow-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm">{item.tracking_number}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          #{item.order_number} • {item.recipient_name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Verified items */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Verificados ({verifiedItems})
            </h3>
            <ScrollArea className="h-64 border rounded-md">
              {verifiedItems === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                  <ScanLine className="h-8 w-8 mb-2" />
                  <p>Escanea guías para verificar</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {items
                    .filter(i => i.scan_status === 'verified')
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 p-2 rounded-md bg-green-50 dark:bg-green-900/10"
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm">{item.tracking_number}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            #{item.order_number} • {item.recipient_name}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Extra scans warning */}
        {hasExtras && (
          <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
                Guías escaneadas NO incluidas en el manifiesto ({extraScans.length})
              </h3>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                onClick={() => copyList('Extras', extraScans)}>
                <Copy className="h-3 w-3" /> Copiar
              </Button>
            </div>
            <div className="space-y-1">
              {extraScans.map((tracking) => (
                <div key={tracking} className="flex items-center justify-between gap-2 p-2 rounded-md bg-background/60">
                  <Badge variant="destructive" className="font-mono">{tracking}</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => handleAddExtra(tracking)}
                    disabled={addingTracking === tracking}
                  >
                    {addingTracking === tracking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Agregar al manifiesto
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {manifest.status === 'open' && (
        <div className="p-4 border-t bg-background">
          <Button
            size="lg"
            className="w-full"
            onClick={handleFinishScan}
          >
            <Flag className="h-4 w-4 mr-2" />
            Finalizar Escaneo
          </Button>
          <div className="mt-2 text-center text-sm text-muted-foreground">
            {hasMissing && <span className="text-yellow-600">{pendingItems.length} guías pendientes por verificar</span>}
            {hasMissing && (hasExtras || collectorMismatch) && ' • '}
            {hasExtras && <span className="text-red-600">{extraScans.length} guías extras detectadas</span>}
            {hasExtras && collectorMismatch && ' • '}
            {collectorMismatch && <span className="text-red-600">descuadre con el recolector</span>}
            {!hasMissing && !hasExtras && !collectorMismatch && <span className="text-green-600">✓ Todas las guías verificadas</span>}
          </div>
        </div>
      )}

      {/* Finish Dialog */}
      <AlertDialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {isFullyVerified && !collectorMismatch ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              )}
              Resumen de Verificación
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-left">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{verifiedItems} guías verificadas correctamente</span>
                </div>

                {collectorMismatch && (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>El recolector reporta {collectorNum}, verificaste {verifiedItems}</span>
                  </div>
                )}

                {hasMissing && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-yellow-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>{pendingItems.length} guías NO escaneadas:</span>
                    </div>
                    <ScrollArea className="h-32 border rounded-md p-2">
                      {pendingItems.map((item) => (
                        <div key={item.id} className="text-sm py-1">
                          • {item.tracking_number} ({item.recipient_name})
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}

                {hasExtras && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-4 w-4" />
                      <span>{extraScans.length} guías escaneadas NO están en el manifiesto:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {extraScans.map((tracking, idx) => (
                        <Badge key={idx} variant="destructive" className="font-mono text-xs">
                          {tracking}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {isFullyVerified && !hasExtras && !collectorMismatch && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
                    ¡Excelente! Todas las guías del manifiesto han sido verificadas correctamente.
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Al cerrar, el "Confirmar Retiro" quedará bloqueado si hay descuadre, hasta resolverlo o justificarlo.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir Escaneando</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceClose}
              className={cn((hasMissing || hasExtras || collectorMismatch) && 'bg-yellow-600 hover:bg-yellow-700')}
              disabled={closingManifest}
            >
              {closingManifest && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {(hasMissing || hasExtras || collectorMismatch) ? 'Cerrar de todos modos' : 'Cerrar Manifiesto'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
