import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const AlegraPage = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Alegra - Facturación DIAN</h1>
        <p className="text-muted-foreground">
          Emisión de facturas electrónicas a través de Alegra
        </p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Configuración pendiente</AlertTitle>
        <AlertDescription>
          Para habilitar la facturación electrónica, es necesario configurar las credenciales de API de Alegra (token y API key).
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Facturación Electrónica
          </CardTitle>
          <CardDescription>
            Emite facturas electrónicas válidas ante la DIAN directamente desde la plataforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Receipt className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Módulo en preparación</p>
            <p className="text-sm">Una vez configuradas las credenciales, podrás emitir facturas electrónicas aquí.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AlegraPage;
