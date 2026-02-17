
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, Package } from 'lucide-react';
import { useMaterials } from '@/hooks/useMaterials';

interface MaterialRequirement {
  materialId: string;
  quantity: number;
  notes?: string;
}

interface MaterialAvailabilityCheckerProps {
  requirements: MaterialRequirement[];
  className?: string;
}

const MaterialAvailabilityChecker = ({ requirements, className = '' }: MaterialAvailabilityCheckerProps) => {
  const { materials, loading } = useMaterials();
  const [availability, setAvailability] = useState<Array<{
    material: unknown;
    required: number;
    available: number;
    sufficient: boolean;
    isLowStock: boolean;
  }>>([]);

  useEffect(() => {
    if (materials.length > 0 && requirements.length > 0) {
      const availabilityData = requirements.map(req => {
        const material = materials.find(m => m.id === req.materialId);
        if (!material) {
          return {
            material: null,
            required: req.quantity,
            available: 0,
            sufficient: false,
            isLowStock: false
          };
        }

        const available = material.current_stock || 0;
        const sufficient = available >= req.quantity;
        const isLowStock = available <= (material.min_stock_alert || 0);

        return {
          material,
          required: req.quantity,
          available,
          sufficient,
          isLowStock
        };
      });

      setAvailability(availabilityData);
    }
  }, [materials, requirements]);

  if (loading) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center space-x-2">
          <Package className="w-5 h-5 text-gray-400 animate-pulse" />
          <span className="text-gray-600">Verificando disponibilidad de materiales...</span>
        </div>
      </Card>
    );
  }

  if (requirements.length === 0) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center space-x-2 text-gray-600">
          <Package className="w-5 h-5" />
          <span>No hay materiales requeridos</span>
        </div>
      </Card>
    );
  }

  const allSufficient = availability.every(item => item.sufficient);
  const hasLowStock = availability.some(item => item.isLowStock);

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-black flex items-center space-x-2">
            <Package className="w-5 h-5" />
            <span>Disponibilidad de Materiales</span>
          </h3>
          <Badge 
            variant={allSufficient ? "default" : "destructive"}
            className={allSufficient ? "bg-green-500" : "bg-red-500"}
          >
            {allSufficient ? 'Disponibles' : 'Stock Insuficiente'}
          </Badge>
        </div>

        <div className="space-y-3">
          {availability.map((item, index) => {
            if (!item.material) {
              return (
                <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded border border-red-200">
                  <div className="flex items-center space-x-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-red-700">Material no encontrado</span>
                  </div>
                </div>
              );
            }

            return (
              <div 
                key={item.material.id} 
                className={`flex items-center justify-between p-3 rounded border ${
                  item.sufficient 
                    ? item.isLowStock 
                      ? 'bg-yellow-50 border-yellow-200' 
                      : 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  {item.sufficient ? (
                    item.isLowStock ? (
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <div>
                    <div className="font-medium text-black">
                      {item.material.sku} - {item.material.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {item.material.category}
                      {item.material.color && ` • ${item.material.color}`}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`font-medium ${
                    item.sufficient ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {item.available} / {item.required} {item.material.unit}
                  </div>
                  {item.isLowStock && (
                    <div className="text-xs text-yellow-600">
                      Stock bajo (mín: {item.material.min_stock_alert})
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!allSufficient && (
          <div className="p-3 bg-red-50 rounded border border-red-200">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Algunos materiales no tienen stock suficiente. Revisa las entregas de materiales antes de proceder.
              </span>
            </div>
          </div>
        )}

        {hasLowStock && allSufficient && (
          <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
            <div className="flex items-center space-x-2 text-yellow-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Algunos materiales están en stock bajo. Considera programar reposición.
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default MaterialAvailabilityChecker;
