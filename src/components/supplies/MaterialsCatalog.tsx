
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Edit, Trash2, Package, AlertTriangle } from 'lucide-react';
import MaterialForm from './MaterialForm';
import { useMaterials } from '@/hooks/useMaterials';

const MaterialsCatalog = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingMaterial, setEditingMaterial] = useState<any | null>(null);
  const { materials, loading, deleteMaterial } = useMaterials();

  const filteredMaterials = materials.filter(material =>
    material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStockStatus = (material: any) => {
    if (material.stock_status === 'critical') {
      return { status: 'critical', color: 'bg-red-500', text: 'Stock Crítico' };
    }
    if (material.stock_status === 'warning') {
      return { status: 'warning', color: 'bg-yellow-500', text: 'Stock Bajo' };
    }
    return { status: 'good', color: 'bg-green-500', text: 'Stock OK' };
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este material?')) {
      await deleteMaterial(id);
    }
  };

  if (loading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="text-center py-12">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2 text-black">Cargando materiales...</h3>
          <p className="text-gray-600">Por favor espera mientras cargamos el catálogo</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="relative flex-1">
            <input 
              type="text" 
              placeholder="Buscar materiales por nombre, SKU o categoría..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-xl text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:ring-offset-0 transition-all duration-200"
              style={{ paddingLeft: '2.5rem', paddingRight: '1rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Stock Actual</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMaterials.map((material) => {
                const stockStatus = getStockStatus(material);
                return (
                  <TableRow key={material.id}>
                    <TableCell className="font-mono text-sm">{material.sku}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-black">{material.name}</div>
                        <div className="text-sm text-gray-600">{material.description}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{material.category}</Badge>
                    </TableCell>
                    <TableCell>{material.color || '-'}</TableCell>
                    <TableCell>{material.unit}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{material.current_stock}</span>
                        {stockStatus.status === 'critical' && (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${stockStatus.color} text-white`}>
                        {stockStatus.text}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingMaterial(material)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(material.id)}
                        >
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

        {filteredMaterials.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-black">No se encontraron materiales</h3>
            <p className="text-gray-600">Ajusta los filtros o agrega nuevos materiales al catálogo</p>
          </div>
        )}
      </Card>

      {editingMaterial && (
        <MaterialForm 
          material={editingMaterial} 
          onClose={() => setEditingMaterial(null)} 
        />
      )}
    </>
  );
};

export default MaterialsCatalog;
