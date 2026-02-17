import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle2, XCircle, Clock, Wifi } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';

type APIStatus = {
  status: 'idle' | 'checking' | 'connected' | 'error';
  responseTime?: number;
  error?: string;
};

const APIStatusCard = () => {
  const { currentOrganization } = useOrganization();
  const [shopifyStatus, setShopifyStatus] = useState<APIStatus>({ status: 'idle' });
  const [enviaStatus, setEnviaStatus] = useState<APIStatus>({ status: 'idle' });
  const [isChecking, setIsChecking] = useState(false);

  const checkShopifyAPI = useCallback(async (): Promise<APIStatus> => {
    if (!currentOrganization?.id) {
      return { status: 'error', error: 'Sin organización' };
    }

    const startTime = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke('test-shopify-connection', {
        body: { organizationId: currentOrganization.id }
      });

      const responseTime = Math.round(performance.now() - startTime);

      if (error) {
        console.error('Shopify API error:', error);
        return { status: 'error', responseTime, error: error.message };
      }

      if (!data?.success) {
        return { status: 'error', responseTime, error: data?.message || 'Sin conexión' };
      }

      return { status: 'connected', responseTime };
    } catch (err: unknown) {
      const responseTime = Math.round(performance.now() - startTime);
      console.error('Shopify API exception:', err);
      return { status: 'error', responseTime, error: err.message || 'Error de conexión' };
    }
  }, [currentOrganization?.id]);

  const checkEnviaAPI = useCallback(async (): Promise<APIStatus> => {
    if (!currentOrganization?.id) {
      return { status: 'error', error: 'Sin organización' };
    }

    const startTime = performance.now();
    try {
      // Simple ping with minimal test data
      const { data, error } = await supabase.functions.invoke('envia-quote', {
        body: {
          destination_city: 'Bogota',
          destination_department: 'Cundinamarca',
          declared_value: 50000
        }
      });

      const responseTime = Math.round(performance.now() - startTime);

      if (error) {
        console.error('Envia API error:', error);
        return { status: 'error', responseTime, error: error.message };
      }

      // Even if no quotes returned, if we got a response, the API is connected
      if (data?.success || data?.quotes) {
        return { status: 'connected', responseTime };
      }

      // If we got an error response but it's an API response, connection works
      if (data?.error && !data.error.includes('fetch') && !data.error.includes('network')) {
        return { status: 'connected', responseTime };
      }

      return { status: 'error', responseTime, error: data?.error || 'Sin respuesta' };
    } catch (err: unknown) {
      const responseTime = Math.round(performance.now() - startTime);
      console.error('Envia API exception:', err);
      return { status: 'error', responseTime, error: err.message || 'Error de conexión' };
    }
  }, [currentOrganization?.id]);

  const checkAllAPIs = useCallback(async () => {
    setIsChecking(true);
    setShopifyStatus({ status: 'checking' });
    setEnviaStatus({ status: 'checking' });

    // Run both checks in parallel
    const [shopifyResult, enviaResult] = await Promise.all([
      checkShopifyAPI(),
      checkEnviaAPI()
    ]);

    setShopifyStatus(shopifyResult);
    setEnviaStatus(enviaResult);
    setIsChecking(false);
  }, [checkShopifyAPI, checkEnviaAPI]);

  const renderStatusBadge = (apiStatus: APIStatus) => {
    switch (apiStatus.status) {
      case 'idle':
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Sin verificar
          </Badge>
        );
      case 'checking':
        return (
          <Badge variant="secondary" className="gap-1">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Verificando...
          </Badge>
        );
      case 'connected':
        return (
          <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-200 hover:bg-green-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Conectado
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Sin conexión
          </Badge>
        );
    }
  };

  const renderResponseTime = (apiStatus: APIStatus) => {
    if (apiStatus.responseTime === undefined) return null;
    
    const timeColor = apiStatus.responseTime < 1000 
      ? 'text-green-600' 
      : apiStatus.responseTime < 3000 
        ? 'text-yellow-600' 
        : 'text-red-600';

    return (
      <span className={`text-xs ${timeColor} font-mono`}>
        {apiStatus.responseTime}ms
      </span>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            Estado de APIs
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={checkAllAPIs}
            disabled={isChecking}
            className="h-7 text-xs"
          >
            {isChecking ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Verificar conexión
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Shopify Status */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Shopify</span>
            {renderStatusBadge(shopifyStatus)}
          </div>
          {renderResponseTime(shopifyStatus)}
        </div>

        {/* Envia.com Status */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Envia.com</span>
            {renderStatusBadge(enviaStatus)}
          </div>
          {renderResponseTime(enviaStatus)}
        </div>

        {/* Error details */}
        {(shopifyStatus.error || enviaStatus.error) && (
          <div className="text-xs text-muted-foreground mt-2 space-y-1">
            {shopifyStatus.error && (
              <p className="text-destructive">Shopify: {shopifyStatus.error}</p>
            )}
            {enviaStatus.error && (
              <p className="text-destructive">Envia: {enviaStatus.error}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default APIStatusCard;
