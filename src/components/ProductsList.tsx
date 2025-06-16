
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Package } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  category: string;
  base_price: number;
  image_url: string;
  status: string;
  created_at: string;
}

interface ProductsListProps {
  products: Product[];
  loading: boolean;
  error: string | null;
}

const ProductsList = ({ products, loading, error }: ProductsListProps) => {
  if (loading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando productos...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-black">Error al cargar productos</h3>
          <p className="text-red-600 mb-4">{error}</p>
        </div>
      </Card>
    );
  }

  if (products.length === 0) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-black">No hay productos registrados</h3>
          <p className="text-gray-600 mb-4">Agrega productos para comenzar a crear órdenes</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <div key={product.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
            {product.image_url && (
              <div className="mb-4">
                <img 
                  src={product.image_url} 
                  alt={product.name}
                  className="w-full h-48 object-cover rounded-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            )}
            
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-black text-lg">{product.name}</h3>
                <Badge variant="outline" className="ml-2">
                  {product.category || 'Sin categoría'}
                </Badge>
              </div>
              
              <div className="text-sm text-gray-600">
                <span className="font-medium">SKU:</span> {product.sku}
              </div>
              
              <div className="text-lg font-semibold text-green-600">
                ${product.base_price.toLocaleString('es-CO')}
              </div>
              
              <div className="flex space-x-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default ProductsList;
