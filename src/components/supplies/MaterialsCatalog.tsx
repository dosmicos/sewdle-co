import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Search, 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  Edit,
  Trash2,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { useMaterials } from '@/hooks/useMaterials';
import MaterialForm from './MaterialForm';
import { Material } from '@/types/materials';
import { usePermissions } from '@/hooks/usePermissions';
import { useUserContext } from '@/hooks/useUserContext';

const MaterialsCatalog = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<Material | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { materials, loading, fetchMaterials, deleteMaterial } = useMaterials();
  const { hasPermission } = usePermissions();
  const { workshopFilter, isWorkshopUser } = useUserContext();

  const canEditMaterials = hasPermission('insumos', 'edit');
  const canDeleteMaterials = hasPermission('insumos', 'delete');
  const canCreateMaterials = hasPermission('insumos', 'create');

  // Obtener categorías únicas para el filtro
  const categories = React.useMemo(() => {
    if (!materials || materials.length === 0) return [];
    return [...new Set(materials.map(m => m.category).filter(Boolean))];
  }, [materials]);

  // Obtener proveedores únicos para el filtro
  const suppliers = React.useMemo(() => {
    if (!materials || materials.length === 0) return [];
    return [...new Set(materials.map(m => m.supplier).filter(Boolean))];
  }, [materials]);

  // Filtrar materiales por taller (si aplica) y otros filtros
  const filteredMaterials = React.useMemo(() => {
    if (!materials || materials.length === 0) return [];

    return materials.filter(material => {
      // Si es usuario de taller, solo mostrar materiales disponibles en su taller
      if (isWorkshopUser && workshopFilter) {
        // Para usuarios de taller, solo mostrar materiales que tengan entregas en su taller
        // Esto requeriría una consulta adicional o modificar la función RPC
        // Por ahora, mostraremos todos los materiales pero se podría implementar esta lógica
      }
      // Filtro de búsqueda
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = 
          material.name?.toLowerCase().includes(searchLower) ||
          material.sku?.toLowerCase().includes(searchLower) ||
          material.category?.toLowerCase().includes(searchLower) ||
          material.supplier?.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Filtro de categoría
      if (filterCategory !== 'all' && material.category !== filterCategory) {
        return false;
      }

      // Filtro de estado de stock
      if (filterStatus !== 'all') {
        const stockStatus = getStockStatus(material);
        if (stockStatus.status !== filterStatus) {
          return false;
        }
      }

      // Filtro de proveedor
      if (filterSupplier !== 'all' && material.supplier !== filterSupplier) {
        return false;
      }

      return true;
    });
  }, [materials, searchQuery, filterCategory, filterStatus, filterSupplier]);

  const getStockStatus = (material: any) => {
    const currentStock = material.current_stock || 0;
    const minStock = material.min_stock_alert || 0;

    if (currentStock === 0) {
      return { status: 'critical', label: 'Sin Stock', color: 'bg-red-100 text-red-800' };
    } else if (currentStock <= minStock) {
      return { status: 'warning', label: 'Stock Bajo', color: 'bg-yellow-100 text-yellow-800' };
    } else {
      return { status: 'good', label: 'Stock OK', color: 'bg-green-100 text-green-800' };
    }
  };

  const handleRefresh = () => {
    fetchMaterials();
  };

  const handleEditMaterial = (material: Material) => {
    if (canEditMaterials) {
      setEditingMaterial(material);
    }
  };

  const handleDeleteClick = (material: Material) => {
    if (canDeleteMaterials) {
      setDeletingMaterial(material);
      setShowDeleteDialog(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingMaterial) return;

    try {
      await deleteMaterial(deletingMaterial.id);
      setShowDeleteDialog(false);
      setDeletingMaterial(null);
    } catch (error) {
      console.error('Error deleting material:', error);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
    setDeletingMaterial(null);
  };

  const handleCloseEditModal = () => {
    setEditingMaterial(null);
  };

  if (loading && (!materials || materials.length === 0)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-black">Cargando catálogo...</h3>
            <p className="text-gray-600">Obteniendo información de materiales</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controles de filtrado */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
            <Input
              type="text"
              placeholder="Buscar materiales..."
              className="w-80 pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="good">Stock OK</SelectItem>
              <SelectItem value="warning">Stock Bajo</SelectItem>
              <SelectItem value="critical">Sin Stock</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterSupplier} onValueChange={setFilterSupplier}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por proveedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los proveedores</SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier} value={supplier}>
                  {supplier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2">
          {canCreateMaterials && (
            <Button 
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Package className="w-4 h-4 mr-2" />
              Nuevo Material
            </Button>
          )}
        </div>
      </div>

      <Card className="p-6">
        {filteredMaterials && filteredMaterials.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Stock Actual</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Costo Unitario</TableHead>
                  {(canEditMaterials || canDeleteMaterials) && (
                    <TableHead>Acciones</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaterials.map((material) => {
                  const stockStatus = getStockStatus(material);
                  return (
                    <TableRow key={material.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium text-black">
                            {material.name || 'Sin nombre'}
                          </div>
                          {material.color && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {material.color}
                            </Badge>
                          )}
                          {material.description && (
                            <div className="text-sm text-gray-600 mt-1">
                              {material.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {material.sku || 'N/A'}
                      </TableCell>
                      <TableCell>{material.category || 'Sin categoría'}</TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {material.current_stock || 0} {material.unit || ''}
                        </span>
                        <div className="text-xs text-gray-500">
                          Mín: {material.min_stock_alert || 0} {material.unit || ''}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={stockStatus.color}>
                          {stockStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{material.supplier || 'No especificado'}</TableCell>
                      <TableCell>
                        {material.unit_cost 
                          ? `$${material.unit_cost.toLocaleString()}`
                          : 'No definido'
                        }
                      </TableCell>
                      {(canEditMaterials || canDeleteMaterials) && (
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {canEditMaterials && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => handleEditMaterial(material)}
                                      disabled={loading}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Editar material</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {canDeleteMaterials && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="text-red-500 hover:text-red-700"
                                      onClick={() => handleDeleteClick(material)}
                                      disabled={loading}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Eliminar material</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : materials && materials.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-600" />
            </Package>
            <h3 className="text-lg font-semibold mb-2 text-black">No hay materiales registrados</h3>
            <p className="text-gray-600 mb-4">
              Comienza agregando el primer material al catálogo
            </p>
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-600" />
            </Package>
            <h3 className="text-lg font-semibold mb-2 text-black">No hay materiales que coincidan</h3>
            <p className="text-gray-600 mb-4">
              Intenta ajustando los filtros de búsqueda
            </p>
            <Button 
              onClick={() => {
                setSearchQuery('');
                setFilterCategory('all');
                setFilterStatus('all');
                setFilterSupplier('all');
              }}
              variant="outline"
            >
              Limpiar filtros
            </Button>
          </div>
        )}
      </Card>

      {/* Modal de Creación */}
      {showCreateForm && canCreateMaterials && (
        <MaterialForm 
          onClose={() => setShowCreateForm(false)} 
        />
      )}

      {/* Modal de Edición */}
      {editingMaterial && canEditMaterials && (
        <MaterialForm 
          material={editingMaterial} 
          onClose={handleCloseEditModal} 
        />
      )}

      {/* Modal de Confirmación de Eliminación */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar Material?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar el material{' '}
              <span className="font-semibold text-black">
                "{deletingMaterial?.name}"
              </span>
              {deletingMaterial?.sku && (
                <span> ({deletingMaterial.sku})</span>
              )}
              ? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                'Eliminar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MaterialsCatalog;
