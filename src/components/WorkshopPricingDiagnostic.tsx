import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, DollarSign, Package, RefreshCw } from "lucide-react";
import { useWorkshopPricingGaps } from "@/hooks/useWorkshopPricingGaps";
import { useWorkshopPricing } from "@/hooks/useWorkshopPricing";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export const WorkshopPricingDiagnostic: React.FC = () => {
  const { gaps, loading, refetch } = useWorkshopPricingGaps();
  const { createPricing } = useWorkshopPricing();

  const handleQuickFix = async (gap: unknown) => {
    try {
      // Calcular precio sugerido basado en promedio de venta con descuento
      const suggestedPrice = Math.round(gap.avg_sale_price * 0.1); // 10% del precio de venta
      
      await createPricing({
        workshop_id: gap.workshop_id,
        product_id: gap.product_id,
        unit_price: suggestedPrice,
        currency: 'COP',
        effective_from: new Date().toISOString().split('T')[0],
        notes: `Precio configurado automáticamente basado en análisis de entregas`
      });

      refetch();
    } catch (error) {
      console.error('Error applying quick fix:', error);
    }
  };

  const workshopGroups = gaps.reduce((acc, gap) => {
    if (!acc[gap.workshop_name]) {
      acc[gap.workshop_name] = [];
    }
    acc[gap.workshop_name].push(gap);
    return acc;
  }, {} as Record<string, typeof gaps>);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Diagnóstico de Precios de Talleres
          </CardTitle>
          <CardDescription>
            Verificando configuración de precios...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (gaps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-success">
            <DollarSign className="h-5 w-5" />
            Configuración de Precios Completa
          </CardTitle>
          <CardDescription>
            Todos los talleres tienen precios configurados para sus productos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              No se detectaron problemas de configuración de precios
            </p>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Verificar nuevamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning">
          <AlertTriangle className="h-5 w-5" />
          Problemas Detectados en Precios de Talleres
        </CardTitle>
        <CardDescription>
          Se encontraron {gaps.length} productos sin precios configurados en {Object.keys(workshopGroups).length} talleres
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Los productos sin precios específicos de taller usan el precio de venta como fallback, 
            lo que puede resultar en pagos incorrectos a los talleres.
          </AlertDescription>
        </Alert>

        {Object.entries(workshopGroups).map(([workshopName, workshopGaps]) => (
          <div key={workshopName} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                {workshopName}
              </h4>
              <Badge variant="destructive">
                {workshopGaps.length} productos sin precio
              </Badge>
            </div>

            <div className="space-y-2">
              {workshopGaps.map(gap => (
                <div key={gap.product_id} className="flex items-center justify-between bg-muted/50 rounded p-3">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{gap.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {gap.deliveries_count} entregas • Precio promedio de venta: ${gap.avg_sale_price.toLocaleString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleQuickFix(gap)}
                  >
                    Configurar precio
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex justify-end">
          <Button variant="outline" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar diagnóstico
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};