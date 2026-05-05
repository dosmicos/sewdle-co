
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Package, Palette, Ruler, DollarSign, Hash } from 'lucide-react';

interface ProductVariant {
  size: string;
  color: string;
  sku: string;
  price: number;
  stock_quantity: number;
}

interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  image_url: string;
  variants: ProductVariant[];
}

interface ProductImportConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ShopifyProduct | null;
  onConfirm: () => void;
  loading: boolean;
}

const ProductImportConfirmation = ({ 
  open, 
  onOpenChange, 
  product, 
  onConfirm, 
  loading 
}: ProductImportConfirmationProps) => {
  if (!product) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Confirmar Importación de Producto
          </AlertDialogTitle>
          <AlertDialogDescription>
            Revisa los detalles del producto antes de importarlo a tu catálogo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-6">
          {/* Información del producto */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex gap-4">
              {product.image_url && (
                <img 
                  src={product.image_url} 
                  alt={product.title} 
                  className="w-24 h-24 rounded-lg object-cover flex-shrink-0" 
                />
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">{product.title}</h3>
                <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                  {product.description.replace(/<[^>]*>/g, '').substring(0, 200)}...
                </p>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="text-lg font-bold text-green-600">${product.price.toFixed(2)}</span>
                  <Badge variant="secondary" className="ml-2">
                    Shopify Import
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Variantes del producto */}
          {product.variants && product.variants.length > 0 && (
            <div>
              <h4 className="text-md font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Variantes a Importar ({product.variants.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                {product.variants.map((variant, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="space-y-2">
                      {variant.size && (
                        <div className="flex items-center gap-2">
                          <Ruler className="w-3 h-3 text-gray-500" />
                          <span className="text-sm">
                            <span className="font-medium">Talla:</span> {variant.size}
                          </span>
                        </div>
                      )}
                      {variant.color && (
                        <div className="flex items-center gap-2">
                          <Palette className="w-3 h-3 text-gray-500" />
                          <span className="text-sm">
                            <span className="font-medium">Color:</span> {variant.color}
                          </span>
                        </div>
                      )}
                      {variant.sku && (
                        <div className="flex items-center gap-2">
                          <Hash className="w-3 h-3 text-gray-500" />
                          <span className="text-sm">
                            <span className="font-medium">SKU:</span> {variant.sku}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        <span className="text-sm font-medium text-green-600">
                          ${variant.price.toFixed(2)}
                        </span>
                        <span className="text-sm text-gray-500">
                          Stock: {variant.stock_quantity || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Información adicional */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="font-medium text-blue-800 mb-2">¿Qué sucederá al importar?</h5>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Se creará un nuevo producto en tu catálogo con un SKU único</li>
              <li>• Todas las variantes se importarán con sus respectivos precios y stock</li>
              <li>• El producto se marcará con la categoría "Shopify Import"</li>
              <li>• Podrás editar toda la información después de la importación</li>
            </ul>
          </div>
        </div>

        <AlertDialogFooter className="flex gap-3">
          <AlertDialogCancel 
            disabled={loading}
            className="px-6"
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={loading}
            className="px-6 bg-blue-600 hover:bg-blue-700"
          >
            {loading ? 'Importando...' : 'Confirmar Importación'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ProductImportConfirmation;
