import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  ExternalLink,
  Key,
  ShoppingCart,
  Loader2,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ShopifyConfigurationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ShopifyCredentials {
  storeUrl: string;
  accessToken: string;
}

export const ShopifyConfigurationModal: React.FC<ShopifyConfigurationModalProps> = ({
  open,
  onOpenChange,
  onSuccess
}) => {
  const { currentOrganization, updateOrganization } = useOrganization();
  const [activeTab, setActiveTab] = useState('guide');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [credentials, setCredentials] = useState<ShopifyCredentials>({
    storeUrl: '',
    accessToken: ''
  });
  
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    storeInfo?: any;
  } | null>(null);

  // Load existing credentials when modal opens
  useEffect(() => {
    if (open && currentOrganization) {
      setCredentials({
        storeUrl: currentOrganization.shopify_store_url || '',
        accessToken: currentOrganization.shopify_credentials?.access_token || ''
      });
      setTestResult(null);
      setActiveTab('guide');
    }
  }, [open, currentOrganization]);

  const normalizeStoreUrl = (url: string): string => {
    // Remove protocol if present
    let cleanUrl = url.replace(/^https?:\/\//, '');
    
    // Remove trailing slash
    cleanUrl = cleanUrl.replace(/\/$/, '');
    
    // Add .myshopify.com if not present
    if (!cleanUrl.includes('.myshopify.com')) {
      // If it's just the store name, add the domain
      if (!cleanUrl.includes('.')) {
        cleanUrl = `${cleanUrl}.myshopify.com`;
      }
    }
    
    return `https://${cleanUrl}`;
  };

  const validateCredentials = (): string | null => {
    if (!credentials.storeUrl.trim()) {
      return 'La URL de la tienda es requerida';
    }
    
    if (!credentials.accessToken.trim()) {
      return 'El token de acceso es requerido';
    }
    
    const normalizedUrl = normalizeStoreUrl(credentials.storeUrl);
    if (!normalizedUrl.includes('.myshopify.com')) {
      return 'La URL debe ser una tienda válida de Shopify (ejemplo: tienda.myshopify.com)';
    }
    
    return null;
  };

  const testConnection = async () => {
    const validationError = validateCredentials();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const normalizedUrl = normalizeStoreUrl(credentials.storeUrl);
      
      const { data, error } = await supabase.functions.invoke('test-shopify-connection', {
        body: {
          storeUrl: normalizedUrl,
          accessToken: credentials.accessToken.trim()
        }
      });

      if (error) throw error;

      setTestResult({
        success: data.success,
        message: data.message,
        storeInfo: data.storeInfo
      });

      if (data.success) {
        toast.success('Conexión exitosa con Shopify');
        setActiveTab('config');
      } else {
        toast.error(data.message || 'Error al conectar con Shopify');
      }

    } catch (error: any) {
      console.error('Error testing Shopify connection:', error);
      setTestResult({
        success: false,
        message: error.message || 'Error al probar la conexión'
      });
      toast.error('Error al probar la conexión');
    } finally {
      setTesting(false);
    }
  };

  const saveConfiguration = async () => {
    const validationError = validateCredentials();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!currentOrganization) {
      toast.error('No hay organización seleccionada');
      return;
    }

    setLoading(true);

    try {
      const normalizedUrl = normalizeStoreUrl(credentials.storeUrl);
      
      await updateOrganization(currentOrganization.id, {
        shopify_store_url: normalizedUrl,
        shopify_credentials: {
          access_token: credentials.accessToken.trim(),
          configured_at: new Date().toISOString()
        }
      });

      toast.success('Configuración de Shopify guardada exitosamente');
      onSuccess();

    } catch (error: any) {
      console.error('Error saving Shopify configuration:', error);
      toast.error('Error al guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copiado al portapapeles');
  };

  const permissionsNeeded = [
    'read_products',
    'read_inventory',
    'read_orders',
    'read_customers',
    'write_inventory'
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Configuración de Shopify
          </DialogTitle>
          <DialogDescription>
            Configura la integración con tu tienda de Shopify para sincronizar datos automáticamente
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="guide">1. Guía de Configuración</TabsTrigger>
            <TabsTrigger value="test">2. Probar Conexión</TabsTrigger>
            <TabsTrigger value="config">3. Guardar Configuración</TabsTrigger>
          </TabsList>

          <TabsContent value="guide" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Crear Private App en Shopify</CardTitle>
                <CardDescription>
                  Sigue estos pasos para crear una aplicación privada en tu tienda Shopify
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-1">1</Badge>
                    <div>
                      <p className="font-medium">Accede al Admin de Shopify</p>
                      <p className="text-sm text-muted-foreground">
                        Ve a tu Admin de Shopify → Settings → Apps and sales channels
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-1">2</Badge>
                    <div>
                      <p className="font-medium">Desarrollar apps</p>
                      <p className="text-sm text-muted-foreground">
                        Haz clic en "Develop apps" en la parte inferior de la página
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-1">3</Badge>
                    <div>
                      <p className="font-medium">Crear app privada</p>
                      <p className="text-sm text-muted-foreground">
                        Haz clic en "Create an app" y asigna un nombre (ej: "Sistema de Producción")
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-1">4</Badge>
                    <div>
                      <p className="font-medium">Configurar permisos</p>
                      <p className="text-sm text-muted-foreground mb-2">
                        En la pestaña "Configuration", configura estos permisos de Admin API access scopes:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {permissionsNeeded.map((permission) => (
                          <div key={permission} className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-success" />
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {permission}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-1">5</Badge>
                    <div>
                      <p className="font-medium">Instalar y obtener token</p>
                      <p className="text-sm text-muted-foreground">
                        Haz clic en "Install app" y copia el "Admin API access token" que se genera
                      </p>
                    </div>
                  </div>
                </div>

                <Alert>
                  <Key className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Importante:</strong> Guarda el token de acceso de forma segura. 
                    No podrás verlo nuevamente una vez que cierres la página.
                  </AlertDescription>
                </Alert>

                <div className="flex justify-end">
                  <Button onClick={() => setActiveTab('test')}>
                    Continuar con la Configuración
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="test" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Probar Conexión</CardTitle>
                <CardDescription>
                  Ingresa las credenciales de tu tienda Shopify y prueba la conexión
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="storeUrl">URL de la Tienda</Label>
                    <Input
                      id="storeUrl"
                      placeholder="mi-tienda.myshopify.com"
                      value={credentials.storeUrl}
                      onChange={(e) => setCredentials(prev => ({ 
                        ...prev, 
                        storeUrl: e.target.value 
                      }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ejemplo: mi-tienda.myshopify.com (sin https://)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accessToken">Token de Acceso</Label>
                    <div className="flex gap-2">
                      <Input
                        id="accessToken"
                        type="password"
                        placeholder="shpat_..."
                        value={credentials.accessToken}
                        onChange={(e) => setCredentials(prev => ({ 
                          ...prev, 
                          accessToken: e.target.value 
                        }))}
                      />
                      {credentials.accessToken && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(credentials.accessToken)}
                        >
                          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      El token de Admin API access que obtuviste en el paso anterior
                    </p>
                  </div>
                </div>

                {testResult && (
                  <Alert variant={testResult.success ? "default" : "destructive"}>
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      {testResult.message}
                      {testResult.storeInfo && (
                        <div className="mt-2">
                          <p className="font-medium">Información de la tienda:</p>
                          <p>Nombre: {testResult.storeInfo.name}</p>
                          <p>Dominio: {testResult.storeInfo.domain}</p>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button onClick={testConnection} disabled={testing}>
                    {testing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Probar Conexión
                  </Button>
                  
                  {testResult?.success && (
                    <Button variant="outline" onClick={() => setActiveTab('config')}>
                      Continuar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Guardar Configuración</CardTitle>
                <CardDescription>
                  Revisa y guarda la configuración de Shopify para tu organización
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {testResult?.success && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      ¡Conexión verificada exitosamente! La configuración está lista para guardar.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Tienda</Label>
                    <p className="text-sm text-muted-foreground">
                      {normalizeStoreUrl(credentials.storeUrl)}
                    </p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Token</Label>
                    <p className="text-sm text-muted-foreground font-mono">
                      {credentials.accessToken.substring(0, 20)}...
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Organización</Label>
                    <p className="text-sm text-muted-foreground">
                      {currentOrganization?.name}
                    </p>
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Una vez guardada la configuración, podrás acceder a todas las funciones de 
                    integración con Shopify, incluyendo sincronización automática de productos, 
                    órdenes e inventario.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2">
                  <Button onClick={saveConfiguration} disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Guardar Configuración
                  </Button>
                  
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};