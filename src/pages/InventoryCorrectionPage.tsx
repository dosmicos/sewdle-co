import React from 'react';
import { InventoryCorrectionTool } from '@/components/supplies/InventoryCorrectionTool';

const InventoryCorrectionPage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Corrección de Inventario</h1>
        <p className="text-gray-600 mt-2">
          Detecta y corrige discrepancias entre el inventario de Shopify y las entregas confirmadas
        </p>
      </div>
      
      <InventoryCorrectionTool />
    </div>
  );
};

export default InventoryCorrectionPage;