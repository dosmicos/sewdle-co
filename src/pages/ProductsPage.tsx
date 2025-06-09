
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Package, Search } from 'lucide-react';

const ProductsPage = () => {
  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Productos</h1>
          <p className="text-muted-foreground">Catálogo de productos y plantillas</p>
        </div>
        <Button className="apple-button">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Producto
        </Button>
      </div>

      <Card className="apple-card p-6">
        <div className="flex items-center space-x-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar productos..."
              className="w-full pl-10 apple-input"
            />
          </div>
        </div>

        <div className="text-center py-12">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No hay productos registrados</h3>
          <p className="text-muted-foreground mb-4">Agrega productos para comenzar a crear órdenes</p>
          <Button className="apple-button">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Primer Producto
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ProductsPage;
