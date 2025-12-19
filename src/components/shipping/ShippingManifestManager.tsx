import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Package,
  Plus,
  ScanLine,
  Truck,
  MoreVertical,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  Printer,
  Trash2,
  PackageCheck,
} from 'lucide-react';
import { useShippingManifests, ShippingManifest, ManifestWithItems } from '@/hooks/useShippingManifests';
import { ManifestCreationModal } from './ManifestCreationModal';
import { ManifestDetailView } from './ManifestDetailView';
import { CARRIER_NAMES, type CarrierCode } from '@/features/shipping/types/envia';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const statusConfig: Record<string, { label: string; icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  open: { label: 'Abierto', icon: <Clock className="h-3 w-3" />, variant: 'secondary' },
  closed: { label: 'Cerrado', icon: <CheckCircle2 className="h-3 w-3" />, variant: 'default' },
  picked_up: { label: 'Recogido', icon: <PackageCheck className="h-3 w-3" />, variant: 'outline' },
};

export const ShippingManifestManager: React.FC = () => {
  const {
    manifests,
    loading,
    fetchManifests,
    fetchManifestWithItems,
    closeManifest,
    confirmPickup,
    deleteManifest,
  } = useShippingManifests();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedManifest, setSelectedManifest] = useState<ManifestWithItems | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [carrierFilter, setCarrierFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchManifests();
  }, [fetchManifests]);

  const handleOpenManifest = async (manifestId: string) => {
    setActionLoading(manifestId);
    const manifest = await fetchManifestWithItems(manifestId);
    if (manifest) {
      setSelectedManifest(manifest);
    }
    setActionLoading(null);
  };

  const handleCloseManifest = async (manifestId: string) => {
    setActionLoading(manifestId);
    await closeManifest(manifestId);
    setActionLoading(null);
  };

  const handleConfirmPickup = async (manifestId: string) => {
    setActionLoading(manifestId);
    await confirmPickup(manifestId);
    setActionLoading(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteManifest(deleteConfirm);
    setDeleteConfirm(null);
  };

  const handlePrint = (manifest: ShippingManifest) => {
    window.print();
  };

  // Filter manifests
  const filteredManifests = manifests.filter(m => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (carrierFilter !== 'all' && m.carrier !== carrierFilter) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        m.manifest_number.toLowerCase().includes(searchLower) ||
        m.carrier.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  // Stats
  const openManifests = manifests.filter(m => m.status === 'open').length;
  const todayManifests = manifests.filter(
    m => m.manifest_date === format(new Date(), 'yyyy-MM-dd')
  ).length;

  // If a manifest is selected, show detail view
  if (selectedManifest) {
    return (
      <ManifestDetailView
        manifest={selectedManifest}
        onBack={() => setSelectedManifest(null)}
        onUpdate={() => fetchManifests()}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Prominent Create Button */}
      <Button 
        onClick={() => setShowCreateModal(true)} 
        size="lg" 
        className="w-full gap-2"
      >
        <Plus className="h-5 w-5" />
        Crear Nuevo Manifiesto
      </Button>

      {/* Compact Stats Bar */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Total:</span>
            <span className="font-semibold">{manifests.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-muted-foreground">Abiertos:</span>
            <span className="font-semibold">{openManifests}</span>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-green-600" />
            <span className="text-muted-foreground">Hoy:</span>
            <span className="font-semibold">{todayManifests}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número de manifiesto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="open">Abierto</SelectItem>
            <SelectItem value="closed">Cerrado</SelectItem>
            <SelectItem value="picked_up">Recogido</SelectItem>
          </SelectContent>
        </Select>
        <Select value={carrierFilter} onValueChange={setCarrierFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Transportadora" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(CARRIER_NAMES).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Manifests List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredManifests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border rounded-lg bg-muted/30">
          <Package className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">No hay manifiestos</p>
          <p className="text-sm mb-4">Crea un nuevo manifiesto para comenzar</p>
          <Button onClick={() => setShowCreateModal(true)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Crear Manifiesto
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredManifests.map((manifest) => {
            const status = statusConfig[manifest.status] || statusConfig.open;
            const progress = manifest.total_packages > 0
              ? Math.round((manifest.total_verified / manifest.total_packages) * 100)
              : 0;
            const isActionLoading = actionLoading === manifest.id;

            return (
              <div 
                key={manifest.id} 
                className="border rounded-lg p-4 bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => handleOpenManifest(manifest.id)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Manifest Info */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-sm">
                        {manifest.manifest_number}
                      </span>
                      <Badge variant={status.variant} className="gap-1 text-xs">
                        {status.icon}
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Truck className="h-3.5 w-3.5" />
                        {CARRIER_NAMES[manifest.carrier as CarrierCode] || manifest.carrier}
                      </span>
                      <span>
                        {format(new Date(manifest.manifest_date), 'dd MMM yyyy', { locale: es })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="h-3.5 w-3.5" />
                        {manifest.total_verified}/{manifest.total_packages} guías
                        {progress === 100 && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                      </span>
                    </div>
                  </div>

                  {/* Direct Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    {manifest.status === 'open' && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleOpenManifest(manifest.id)}
                          disabled={isActionLoading}
                          className="gap-1.5"
                        >
                          {isActionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ScanLine className="h-4 w-4" />
                          )}
                          Escanear
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCloseManifest(manifest.id)}
                          disabled={isActionLoading}
                          className="gap-1.5"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Cerrar
                        </Button>
                      </>
                    )}
                    {manifest.status === 'closed' && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleConfirmPickup(manifest.id)}
                        disabled={isActionLoading}
                        className="gap-1.5"
                      >
                        {isActionLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PackageCheck className="h-4 w-4" />
                        )}
                        Confirmar Retiro
                      </Button>
                    )}
                    
                    {/* Additional actions in dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePrint(manifest)}>
                          <Printer className="h-4 w-4 mr-2" />
                          Imprimir
                        </DropdownMenuItem>
                        {manifest.status === 'open' && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteConfirm(manifest.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <ManifestCreationModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => fetchManifests()}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar manifiesto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Las guías asociadas quedarán disponibles
              para agregar a otro manifiesto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
