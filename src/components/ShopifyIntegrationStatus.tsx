import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Settings, 
  ShoppingCart,
  Loader2
} from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { ShopifyConfigurationModal } from './ShopifyConfigurationModal';

interface ShopifyConnectionStatus {
  isConnected: boolean;
  hasValidCredentials: boolean;
  storeUrl: string | null;
  lastSync: string | null;
  errorMessage: string | null;
  testing: boolean;
}

export const ShopifyIntegrationStatus: React.FC = () => {
  const { currentOrganization, canAccessFeature } = useOrganization();
  const [status, setStatus] = useState<ShopifyConnectionStatus>({
    isConnected: false,
    hasValidCredentials: false,
    storeUrl: null,
    lastSync: null,
    errorMessage: null,
    testing: false
  });
  const [loading, setLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const checkShopifyConnection = async () => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Check if organization has Shopify credentials
      const hasCredentials = !!(
        currentOrganization.shopify_store_url && 
        currentOrganization.shopify_credentials
      );

      if (!hasCredentials) {
        setStatus({
          isConnected: false,
          hasValidCredentials: false,
          storeUrl: null,
          lastSync: null,
          errorMessage: null,
          testing: false
        });
        return;
      }

      // Test connection by checking recent sync data
      const { data: recentOrders, error } = await supabase
        .from('shopify_orders')
        .select('created_at')
        .eq('organization_id', currentOrganization.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const lastSyncDate = recentOrders?.[0]?.created_at || null;

      setStatus({
        isConnected: true,
        hasValidCredentials: true,
        storeUrl: currentOrganization.shopify_store_url,
        lastSync: lastSyncDate,
        errorMessage: null,
        testing: false
      });

    } catch (error: any) {
      console.error('Error checking Shopify connection:', error);
      setStatus({
        isConnected: false,
        hasValidCredentials: !!(
          currentOrganization.shopify_store_url && 
          currentOrganization.shopify_credentials
        ),
        storeUrl: currentOrganization.shopify_store_url || null,
        lastSync: null,
        errorMessage: error.message || 'Error de conexión',
        testing: false
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setStatus(prev => ({ ...prev, testing: true }));
    
    try {
      // Call edge function to test Shopify connection
      const { data, error } = await supabase.functions.invoke('test-shopify-connection', {
        body: { organizationId: currentOrganization?.id }
      });

      if (error) throw error;

      if (data.success) {
        await checkShopifyConnection();
      } else {
        setStatus(prev => ({
          ...prev,
          errorMessage: data.error || 'Error de conexión',
          testing: false
        }));
      }
    } catch (error: any) {
      setStatus(prev => ({
        ...prev,
        errorMessage: error.message || 'Error al probar la conexión',
        testing: false
      }));
    }
  };

  useEffect(() => {
    checkShopifyConnection();
  }, [currentOrganization?.id]);

  const getStatusIcon = () => {
    if (loading) return <Loader2 className="h-5 w-5 animate-spin" />;
    if (status.isConnected) return <CheckCircle className="h-5 w-5 text-success" />;
    if (status.hasValidCredentials) return <AlertCircle className="h-5 w-5 text-warning" />;
    return <XCircle className="h-5 w-5 text-destructive" />;
  };

  const getStatusBadge = () => {
    if (loading) return <Badge variant="secondary">Verificando...</Badge>;
    if (status.isConnected) return <Badge variant="default" className="bg-success">Conectado</Badge>;
    if (status.hasValidCredentials) return <Badge variant="secondary">Configuración pendiente</Badge>;
    return <Badge variant="destructive">No configurado</Badge>;
  };

  const getStatusMessage = () => {
    if (loading) return "Verificando estado de la conexión...";
    if (status.isConnected) {
      const lastSyncText = status.lastSync 
        ? `Última sincronización: ${new Date(status.lastSync).toLocaleString()}`
        : "Sin datos de sincronización";
      return `Conectado a ${status.storeUrl}. ${lastSyncText}`;
    }
    if (status.hasValidCredentials) {
      return "Credenciales configuradas pero la conexión necesita verificación.";
    }
    return "No hay credenciales de Shopify configuradas para esta organización.";
  };

  // Check if user has access to Shopify integration
  if (!canAccessFeature('shopify_integration')) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Integración con Shopify
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              La integración con Shopify está disponible en los planes Professional y Enterprise.
              Actualiza tu plan para acceder a esta funcionalidad.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Integración con Shopify
            </div>
            {getStatusBadge()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {getStatusMessage()}
              </p>
            </div>
          </div>

          {status.errorMessage && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {status.errorMessage}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              variant={status.isConnected ? "outline" : "default"}
              onClick={() => setShowConfigModal(true)}
            >
              <Settings className="h-4 w-4 mr-2" />
              {status.hasValidCredentials ? 'Reconfigurar' : 'Configurar Shopify'}
            </Button>

            {status.hasValidCredentials && (
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={status.testing}
              >
                {status.testing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Probar Conexión
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ShopifyConfigurationModal
        open={showConfigModal}
        onOpenChange={setShowConfigModal}
        onSuccess={() => {
          setShowConfigModal(false);
          checkShopifyConnection();
        }}
      />
    </>
  );
};