
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

const MaterialsCatalog = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const { materials, loading, fetchMaterials } = useMaterials();

  // Obtener categorías únicas para el filtro
  const categories = React.useMemo(() => {
    if (!materials || materials.length === 0) return [];
    return [...new Set(materials.map(m => m.category).filter(Boolean))];
  }, [materials]);

  // Filtrar materiales
  const filteredMaterials = React.useMemo(() => {
    if (!materials || materials.length === 0) return [];

    return materials.filter(material => {
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

      return true;
    });
  }, [materials, searchQuery, filterCategory, filterStatus]);

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
        </div>

        <Button 
          onClick={handleRefresh}
          variant="outline"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Actualizar
        </Button>
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
                  <TableHead>Acciones</TableHead>
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
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
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
              }}
              variant="outline"
            >
              Limpiar filtros
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default MaterialsCatalog;
