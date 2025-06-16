import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import ProductForm from '@/components/ProductForm';
import ProductsList from '@/components/ProductsList';
import { useProducts } from '@/hooks/useProducts';

const ProductsPage = () => {
  const [showProductForm, setShowProductForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { products, loading, error, refetch } = useProducts();

  // Filtrar productos basado en el término de búsqueda
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.category && product.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleProductFormSuccess = () => {
    setShowProductForm(false);
    refetch(); // Recargar productos cuando se cierra el formulario
  };

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">Productos</h1>
          <p className="text-gray-600">Catálogo de productos y plantillas</p>
        </div>
        <Button 
          onClick={() => setShowProductForm(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl px-6 py-3 transition-all duration-200 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Producto
        </Button>
      </div>

      {/* Barra de búsqueda */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 bg-white border border-gray-300 rounded-xl px-4 py-3 text-black placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:ring-offset-0 transition-all duration-200"
          />
        </div>
      </div>

      {/* Lista de productos */}
      <ProductsList 
        products={filteredProducts} 
        loading={loading} 
        error={error} 
      />
    </div>

    {showProductForm && (
      <ProductForm onSuccess={handleProductFormSuccess} />
    )}
  );
};

export default ProductsPage;
