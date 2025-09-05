import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { useVariantConsolidation } from '@/hooks/useVariantConsolidation';
import { useShopifySkuAssignment } from '@/hooks/useShopifySkuAssignment';

export const VariantDuplicateManager: React.FC = () => {
  const { consolidateDuplicates, loading: consolidationLoading } = useVariantConsolidation();
  const { assignShopifySkus, loading: assignmentLoading } = useShopifySkuAssignment();

  const handleConsolidateDuplicates = async () => {
    const result = await consolidateDuplicates();
    if (result?.success) {
      console.log('Consolidación completada:', result);
    }
  };

  const handleImprovedSkuAssignment = async () => {
    const result = await assignShopifySkus({ maxVariants: 50 });
    if (result?.success) {
      console.log('Asignación de SKUs completada:', result);
    }
  };

  const isLoading = consolidationLoading || assignmentLoading;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          Gestor de Variantes Duplicadas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-amber-800 mb-1">
                Problema: Variantes Duplicadas
              </h4>
              <p className="text-sm text-amber-700 mb-3">
                La asignación automática de SKUs puede crear variantes duplicadas para el mismo 
                producto con idénticas características (tamaño/color).
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <h3 className="font-medium">Consolidar Duplicados</h3>
                <p className="text-sm text-muted-foreground">
                  Identifica y consolida variantes duplicadas existentes, preservando stock y referencias.
                </p>
                <Button 
                  onClick={handleConsolidateDuplicates}
                  disabled={isLoading}
                  className="w-full"
                >
                  {consolidationLoading ? 'Consolidando...' : 'Consolidar Ahora'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <RefreshCw className="h-8 w-8 text-blue-600" />
                <h3 className="font-medium">Asignación Mejorada</h3>
                <p className="text-sm text-muted-foreground">
                  Ejecuta la asignación de SKUs mejorada que previene la creación de duplicados.
                </p>
                <Button 
                  onClick={handleImprovedSkuAssignment}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full"
                >
                  {assignmentLoading ? 'Asignando...' : 'Asignar SKUs'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-800 mb-1">
                Solución Implementada
              </h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• <strong>Consolidación inteligente:</strong> Detecta variantes con mismo producto/tamaño/color</li>
                <li>• <strong>Preservación de datos:</strong> Consolida stock y actualiza todas las referencias</li>
                <li>• <strong>Priorización de SKUs:</strong> Mantiene SKUs numéricos sobre los temporales "SHOPIFY-"</li>
                <li>• <strong>Prevención futura:</strong> Verifica variantes existentes antes de crear nuevas</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};