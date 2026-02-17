import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Receipt, CheckCircle, AlertCircle, Loader2, Building2, RefreshCw, Package } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BulkInvoiceCreator from '@/components/alegra/BulkInvoiceCreator';
import AlegraProductMapper from '@/components/alegra/AlegraProductMapper';

interface CompanyInfo {
  name?: string;
  identification?: string;
  email?: string;
  address?: {
    address?: string;
    city?: string;
  };
}

const AlegraPage = () => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testConnection = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('alegra-api', {
        body: { action: 'test-connection' }
      });

      if (error) throw error;
      
      if (data.success) {
        setIsConnected(true);
        setCompanyInfo(data.data);
        toast.success('Conexión exitosa con Alegra');
      } else {
        throw new Error(data.error);
      }
    } catch (error: unknown) {
      console.error('Error testing Alegra connection:', error);
      setIsConnected(false);
      toast.error('Error al conectar con Alegra: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Alegra - Facturación DIAN</h1>
        <p className="text-muted-foreground">
          Emisión de facturas electrónicas a través de Alegra
        </p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Estado de Conexión
          </CardTitle>
          <CardDescription>
            Conexión con tu cuenta de Alegra
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando conexión...
            </div>
          ) : isConnected === true ? (
            <div className="space-y-4">
              <Alert className="border-green-500 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">Conectado</AlertTitle>
                <AlertDescription className="text-green-700">
                  La conexión con Alegra está activa y funcionando correctamente.
                </AlertDescription>
              </Alert>
              
              {companyInfo && (
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Empresa:</span>
                    <span className="font-medium">{companyInfo.name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">NIT:</span>
                    <span className="font-medium">{companyInfo.identification || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{companyInfo.email || 'N/A'}</span>
                  </div>
                  {companyInfo.address && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dirección:</span>
                      <span className="font-medium">
                        {companyInfo.address.address}, {companyInfo.address.city}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              <Button variant="outline" onClick={testConnection} disabled={isLoading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Verificar conexión
              </Button>
            </div>
          ) : isConnected === false ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error de conexión</AlertTitle>
                <AlertDescription>
                  No se pudo conectar con Alegra. Verifica que las credenciales sean correctas.
                </AlertDescription>
              </Alert>
              
              <Button onClick={testConnection} disabled={isLoading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reintentar conexión
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Main Content with Tabs */}
      {isConnected ? (
        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Facturación Masiva
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Mapeo de Productos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Facturación Masiva
                </CardTitle>
                <CardDescription>
                  Crea facturas electrónicas desde pedidos pagados de Shopify. Los clientes se buscarán primero en Alegra.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BulkInvoiceCreator />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <AlegraProductMapper />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Facturación Masiva
            </CardTitle>
            <CardDescription>
              Crea facturas electrónicas desde pedidos pagados de Shopify. Los clientes se buscarán primero en Alegra.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Conexión requerida</p>
              <p className="text-sm">Primero debes establecer conexión con Alegra para usar este módulo.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AlegraPage;
