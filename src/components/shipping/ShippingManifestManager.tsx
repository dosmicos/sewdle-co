import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  XCircle,
  Loader2,
  Search,
  Printer,
  Trash2,
  PackageCheck,
} from 'lucide-react';
import { useShippingManifests, ShippingManifest, ManifestWithItems } from '@/hooks/useShippingManifests';
import { ManifestCreationModal } from './ManifestCreationModal';
import { ManifestScannerModal } from './ManifestScannerModal';
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
  const [showScannerModal, setShowScannerModal] = useState(false);
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

  const handleOpenScanner = async (manifestId: string) => {
    setActionLoading(manifestId);
    const manifest = await fetchManifestWithItems(manifestId);
    if (manifest) {
      setSelectedManifest(manifest);
      setShowScannerModal(true);
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
    // TODO: Implement print view
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

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Manifiestos</p>
              <p className="text-2xl font-bold">{manifests.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="h-12 w-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Manifiestos Abiertos</p>
              <p className="text-2xl font-bold">{openManifests}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Truck className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Manifiestos Hoy</p>
              <p className="text-2xl font-bold">{todayManifests}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions and filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Manifiestos de Envío
            </CardTitle>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Manifiesto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
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
              <SelectTrigger className="w-full sm:w-40">
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
              <SelectTrigger className="w-full sm:w-48">
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

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredManifests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No hay manifiestos</p>
              <p className="text-sm">Crea un nuevo manifiesto para comenzar</p>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Manifiesto</TableHead>
                    <TableHead>Transportadora</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-center">Guías</TableHead>
                    <TableHead className="text-center">Verificadas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredManifests.map((manifest) => {
                    const status = statusConfig[manifest.status] || statusConfig.open;
                    const progress = manifest.total_packages > 0
                      ? Math.round((manifest.total_verified / manifest.total_packages) * 100)
                      : 0;

                    return (
                      <TableRow key={manifest.id}>
                        <TableCell className="font-mono font-medium">
                          {manifest.manifest_number}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            {CARRIER_NAMES[manifest.carrier as CarrierCode] || manifest.carrier}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(manifest.manifest_date), 'dd MMM yyyy', { locale: es })}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{manifest.total_packages}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={progress === 100 ? 'default' : 'secondary'}
                            className={progress === 100 ? 'bg-green-600' : ''}
                          >
                            {manifest.total_verified} ({progress}%)
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            {status.icon}
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={actionLoading === manifest.id}
                              >
                                {actionLoading === manifest.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {manifest.status === 'open' && (
                                <>
                                  <DropdownMenuItem onClick={() => handleOpenScanner(manifest.id)}>
                                    <ScanLine className="h-4 w-4 mr-2" />
                                    Escanear Guías
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleCloseManifest(manifest.id)}>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Cerrar Manifiesto
                                  </DropdownMenuItem>
                                </>
                              )}
                              {manifest.status === 'closed' && (
                                <DropdownMenuItem onClick={() => handleConfirmPickup(manifest.id)}>
                                  <PackageCheck className="h-4 w-4 mr-2" />
                                  Confirmar Retiro
                                </DropdownMenuItem>
                              )}
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
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <ManifestCreationModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => fetchManifests()}
      />

      {selectedManifest && (
        <ManifestScannerModal
          open={showScannerModal}
          onClose={() => {
            setShowScannerModal(false);
            setSelectedManifest(null);
          }}
          manifest={selectedManifest}
          onUpdate={() => fetchManifests()}
        />
      )}

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
