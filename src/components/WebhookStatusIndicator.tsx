import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Zap } from 'lucide-react';

export const WebhookStatusIndicator: React.FC = () => {
  const [webhookStatus] = useState<'active' | 'inactive' | 'error'>('inactive'); // This would be fetched from your backend

  const getStatusColor = () => {
    switch (webhookStatus) {
      case 'active': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBadge = () => {
    switch (webhookStatus) {
      case 'active': 
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Activo
          </Badge>
        );
      case 'error': 
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      default: 
        return (
          <Badge variant="secondary">
            <AlertCircle className="h-3 w-3 mr-1" />
            Inactivo
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Zap className={`h-5 w-5 ${getStatusColor()}`} />
            Estado del Webhook
          </span>
          {getStatusBadge()}
        </CardTitle>
        <CardDescription>
          Estado actual de la sincronización en tiempo real
        </CardDescription>
      </CardHeader>
      <CardContent>
        {webhookStatus === 'inactive' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              El webhook no está configurado. Ve a la pestaña "Configuración" para activar la sincronización automática.
            </AlertDescription>
          </Alert>
        )}
        
        {webhookStatus === 'active' && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              ¡Webhook activo! Las nuevas órdenes se sincronizarán automáticamente.
            </AlertDescription>
          </Alert>
        )}
        
        {webhookStatus === 'error' && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Error en el webhook. Verifica la configuración en Shopify.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};