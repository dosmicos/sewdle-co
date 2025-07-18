import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export const ReplenishmentSuggestions: React.FC = () => {
  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Las sugerencias de reposición se generarán automáticamente basándose en el análisis de ventas de Shopify.
          Ejecuta primero una sincronización completa desde la pestaña "Sincronización Shopify".
        </AlertDescription>
      </Alert>
      
      <Card>
        <CardHeader>
          <CardTitle>Próximamente</CardTitle>
          <CardDescription>
            Esta funcionalidad se activará una vez que tengas datos de ventas sincronizados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            El sistema analizará patrones de venta, stock actual y tendencias para generar 
            sugerencias inteligentes de reposición de materiales e insumos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};