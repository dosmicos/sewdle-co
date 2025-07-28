
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { ReplenishmentSuggestions } from '@/components/supplies/ReplenishmentSuggestions';

export const ReplenishmentPage: React.FC = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Gestión de Reposición IA</h1>
          <p className="text-muted-foreground">
            Análisis automático de ventas con datos en tiempo real de Shopify
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Sugerencias Inteligentes de Reposición
          </CardTitle>
          <CardDescription>
            Basado en datos automáticos de ventas de Shopify, stock actual y demanda proyectada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReplenishmentSuggestions />
        </CardContent>
      </Card>
    </div>
  );
};
