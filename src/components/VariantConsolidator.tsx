import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { useVariantConsolidation } from '@/hooks/useVariantConsolidation';

export const VariantConsolidator: React.FC = () => {
  const { consolidateDuplicates, loading } = useVariantConsolidation();

  const handleConsolidateDuplicates = async () => {
    const result = await consolidateDuplicates();
    if (result?.success) {
      console.log('Consolidación completada:', result);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          Consolidador de Variantes Duplicadas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-amber-800 mb-1">
                Detección de Variantes Duplicadas
              </h4>
              <p className="text-sm text-amber-700">
                Identifica y consolida variantes duplicadas que tienen el mismo producto, tamaño y color.
                Preserva el stock total y actualiza todas las referencias.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center text-center space-y-4 p-6">
          <CheckCircle className="h-12 w-12 text-green-600" />
          <div>
            <h3 className="font-medium text-lg mb-2">Consolidar Duplicados</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Ejecuta la consolidación automática de variantes duplicadas preservando todos los datos importantes.
            </p>
          </div>
          <Button 
            onClick={handleConsolidateDuplicates}
            disabled={loading}
            size="lg"
            className="w-full max-w-xs"
          >
            {loading ? 'Consolidando...' : 'Consolidar Duplicados'}
          </Button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-800 mb-1">
                Cómo Funciona la Consolidación
              </h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• <strong>Detección inteligente:</strong> Identifica variantes con mismo producto, tamaño y color</li>
                <li>• <strong>Preservación de stock:</strong> Suma el stock de todas las variantes duplicadas</li>
                <li>• <strong>Priorización de SKUs:</strong> Mantiene SKUs numéricos sobre los temporales "SHOPIFY-"</li>
                <li>• <strong>Actualización de referencias:</strong> Actualiza orders, deliveries y otras tablas relacionadas</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};