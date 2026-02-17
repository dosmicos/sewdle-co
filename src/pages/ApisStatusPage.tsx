import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle2, XCircle, Clock, Wifi, ShoppingCart, Truck, Receipt, MessageSquare, Database, Brain } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';

type APIStatus = {
  status: 'idle' | 'checking' | 'connected' | 'error';
  responseTime?: number;
  error?: string;
};

type APIConfig = {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  checkFn: () => Promise<APIStatus>;
  category: 'external' | 'ai';
};

const ApisStatusPage = () => {
  const { currentOrganization } = useOrganization();
  const [apiStatuses, setApiStatuses] = useState<Record<string, APIStatus>>({});
  const [isChecking, setIsChecking] = useState(false);

  // Shopify API check
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
        return { status: 'error', responseTime, error: error.message };
      }

      if (!data?.success) {
        return { status: 'error', responseTime, error: data?.message || 'Sin conexión' };
      }

      return { status: 'connected', responseTime };
    } catch (err: unknown) {
      const responseTime = Math.round(performance.now() - startTime);
      return { status: 'error', responseTime, error: err.message || 'Error de conexión' };
    }
  }, [currentOrganization?.id]);

  // Envia.com API check
  const checkEnviaAPI = useCallback(async (): Promise<APIStatus> => {
    if (!currentOrganization?.id) {
      return { status: 'error', error: 'Sin organización' };
    }

    const startTime = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke('envia-quote', {
        body: {
          destination_city: 'Bogota',
          destination_department: 'Cundinamarca',
          declared_value: 50000
        }
      });

      const responseTime = Math.round(performance.now() - startTime);

      if (error) {
        return { status: 'error', responseTime, error: error.message };
      }

      if (data?.success || data?.quotes) {
        return { status: 'connected', responseTime };
      }

      if (data?.error && !data.error.includes('fetch') && !data.error.includes('network')) {
        return { status: 'connected', responseTime };
      }

      return { status: 'error', responseTime, error: data?.error || 'Sin respuesta' };
    } catch (err: unknown) {
      const responseTime = Math.round(performance.now() - startTime);
      return { status: 'error', responseTime, error: err.message || 'Error de conexión' };
    }
  }, [currentOrganization?.id]);

  // Alegra API check
  const checkAlegraAPI = useCallback(async (): Promise<APIStatus> => {
    if (!currentOrganization?.id) {
      return { status: 'error', error: 'Sin organización' };
    }

    const startTime = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke('alegra-api', {
        body: { 
          action: 'test-connection',
          organizationId: currentOrganization.id 
        }
      });

      const responseTime = Math.round(performance.now() - startTime);

      if (error) {
        return { status: 'error', responseTime, error: error.message };
      }

      if (data?.success || data?.connected) {
        return { status: 'connected', responseTime };
      }

      return { status: 'error', responseTime, error: data?.error || 'Sin conexión' };
    } catch (err: unknown) {
      const responseTime = Math.round(performance.now() - startTime);
      return { status: 'error', responseTime, error: err.message || 'Error de conexión' };
    }
  }, [currentOrganization?.id]);

  // WhatsApp/Meta API check - Fixed to check active channel instead of webhook_verified
  const checkWhatsAppAPI = useCallback(async (): Promise<APIStatus> => {
    if (!currentOrganization?.id) {
      return { status: 'error', error: 'Sin organización' };
    }

    const startTime = performance.now();
    try {
      // Check if there's an active messaging channel
      const { data: channel, error } = await supabase
        .from('messaging_channels')
        .select('id, is_active, meta_phone_number_id, ai_enabled')
        .eq('organization_id', currentOrganization.id)
        .eq('channel_type', 'whatsapp')
        .maybeSingle();

      const responseTime = Math.round(performance.now() - startTime);

      if (error) {
        return { status: 'error', responseTime, error: error.message };
      }

      if (!channel) {
        return { status: 'error', responseTime, error: 'Canal no configurado' };
      }

      // Consider connected if is_active is true and has phone number configured
      if (channel.is_active && channel.meta_phone_number_id) {
        return { status: 'connected', responseTime };
      }

      if (!channel.meta_phone_number_id) {
        return { status: 'error', responseTime, error: 'Número de teléfono no configurado' };
      }

      return { status: 'error', responseTime, error: 'Canal inactivo' };
    } catch (err: unknown) {
      const responseTime = Math.round(performance.now() - startTime);
      return { status: 'error', responseTime, error: err.message || 'Error de conexión' };
    }
  }, [currentOrganization?.id]);

  // Supabase Database check
  const checkSupabaseAPI = useCallback(async (): Promise<APIStatus> => {
    const startTime = performance.now();
    try {
      const { error } = await supabase
        .from('organizations')
        .select('id')
        .limit(1);

      const responseTime = Math.round(performance.now() - startTime);

      if (error) {
        return { status: 'error', responseTime, error: error.message };
      }

      return { status: 'connected', responseTime };
    } catch (err: unknown) {
      const responseTime = Math.round(performance.now() - startTime);
      return { status: 'error', responseTime, error: err.message || 'Error de conexión' };
    }
  }, []);

  // OpenAI API check
  const checkOpenAIAPI = useCallback(async (): Promise<APIStatus> => {
    if (!currentOrganization?.id) {
      return { status: 'error', error: 'Sin organización' };
    }

    const startTime = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke('messaging-ai-openai', {
        body: { 
          action: 'test-connection',
          organizationId: currentOrganization.id 
        }
      });

      const responseTime = Math.round(performance.now() - startTime);

      if (error) {
        if (error.message?.includes('OPENAI_API_KEY')) {
          return { status: 'error', responseTime, error: 'API Key no configurada' };
        }
        return { status: 'error', responseTime, error: error.message };
      }

      if (data?.connected || data?.success) {
        return { status: 'connected', responseTime };
      }

      return { status: 'error', responseTime, error: data?.error || 'Sin conexión' };
    } catch (err: unknown) {
      const responseTime = Math.round(performance.now() - startTime);
      return { status: 'error', responseTime, error: err.message || 'Error de conexión' };
    }
  }, [currentOrganization?.id]);

  // Gemini/Lovable AI check
  const checkGeminiAPI = useCallback(async (): Promise<APIStatus> => {
    if (!currentOrganization?.id) {
      return { status: 'error', error: 'Sin organización' };
    }

    const startTime = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke('sewdle-copilot', {
        body: { 
          action: 'test-connection',
          organizationId: currentOrganization.id 
        }
      });

      const responseTime = Math.round(performance.now() - startTime);

      if (error) {
        if (error.message?.includes('LOVABLE_API_KEY') || error.message?.includes('GEMINI')) {
          return { status: 'error', responseTime, error: 'API Key no configurada' };
        }
        return { status: 'error', responseTime, error: error.message };
      }

      if (data?.connected || data?.success) {
        return { status: 'connected', responseTime };
      }

      return { status: 'error', responseTime, error: data?.error || 'Sin conexión' };
    } catch (err: unknown) {
      const responseTime = Math.round(performance.now() - startTime);
      return { status: 'error', responseTime, error: err.message || 'Error de conexión' };
    }
  }, [currentOrganization?.id]);

  const apiConfigs: APIConfig[] = useMemo(() => [
    {
      id: 'supabase',
      name: 'Supabase (Base de datos)',
      description: 'Conexión a la base de datos principal del sistema',
      icon: Database,
      checkFn: checkSupabaseAPI,
      category: 'external'
    },
    {
      id: 'shopify',
      name: 'Shopify',
      description: 'Sincronización de pedidos, productos e inventario',
      icon: ShoppingCart,
      checkFn: checkShopifyAPI,
      category: 'external'
    },
    {
      id: 'envia',
      name: 'Envia.com',
      description: 'Cotización y generación de guías de envío',
      icon: Truck,
      checkFn: checkEnviaAPI,
      category: 'external'
    },
    {
      id: 'alegra',
      name: 'Alegra',
      description: 'Facturación electrónica y contabilidad',
      icon: Receipt,
      checkFn: checkAlegraAPI,
      category: 'external'
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp / Meta',
      description: 'Mensajería automatizada con clientes',
      icon: MessageSquare,
      checkFn: checkWhatsAppAPI,
      category: 'external'
    },
    {
      id: 'openai',
      name: 'OpenAI (GPT-4o-mini)',
      description: 'IA para respuestas automáticas en Mensajería',
      icon: Brain,
      checkFn: checkOpenAIAPI,
      category: 'ai'
    },
    {
      id: 'gemini',
      name: 'Google Gemini (Copilot)',
      description: 'IA para asistente Copilot del sistema',
      icon: Brain,
      checkFn: checkGeminiAPI,
      category: 'ai'
    }
  ], [checkSupabaseAPI, checkShopifyAPI, checkEnviaAPI, checkAlegraAPI, checkWhatsAppAPI, checkOpenAIAPI, checkGeminiAPI]);

  const externalApis = apiConfigs.filter(api => api.category === 'external');
  const aiApis = apiConfigs.filter(api => api.category === 'ai');

  const checkAllAPIs = useCallback(async () => {
    setIsChecking(true);
    
    // Set all to checking
    const checkingStatuses: Record<string, APIStatus> = {};
    apiConfigs.forEach(api => {
      checkingStatuses[api.id] = { status: 'checking' };
    });
    setApiStatuses(checkingStatuses);

    // Run all checks in parallel
    const results = await Promise.all(
      apiConfigs.map(async (api) => ({
        id: api.id,
        result: await api.checkFn()
      }))
    );

    // Update statuses
    const newStatuses: Record<string, APIStatus> = {};
    results.forEach(({ id, result }) => {
      newStatuses[id] = result;
    });
    setApiStatuses(newStatuses);
    setIsChecking(false);
  }, [apiConfigs]);

  const checkSingleAPI = useCallback(async (apiId: string) => {
    const api = apiConfigs.find(a => a.id === apiId);
    if (!api) return;

    setApiStatuses(prev => ({
      ...prev,
      [apiId]: { status: 'checking' }
    }));

    const result = await api.checkFn();
    
    setApiStatuses(prev => ({
      ...prev,
      [apiId]: result
    }));
  }, [apiConfigs]);

  const renderStatusBadge = (apiStatus: APIStatus | undefined) => {
    if (!apiStatus || apiStatus.status === 'idle') {
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Sin verificar
        </Badge>
      );
    }
    
    switch (apiStatus.status) {
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

  const renderResponseTime = (apiStatus: APIStatus | undefined) => {
    if (!apiStatus?.responseTime) return null;
    
    const timeColor = apiStatus.responseTime < 1000 
      ? 'text-green-600' 
      : apiStatus.responseTime < 3000 
        ? 'text-yellow-600' 
        : 'text-red-600';

    return (
      <span className={`text-sm ${timeColor} font-mono`}>
        {apiStatus.responseTime}ms
      </span>
    );
  };

  const renderAPICard = (api: APIConfig) => {
    const status = apiStatuses[api.id];
    const IconComponent = api.icon;
    
    return (
      <Card key={api.id} className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <IconComponent className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{api.name}</CardTitle>
                <CardDescription className="text-sm">
                  {api.description}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => checkSingleAPI(api.id)}
              disabled={status?.status === 'checking'}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`w-4 h-4 ${status?.status === 'checking' ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Estado:</span>
              {renderStatusBadge(status)}
            </div>
            {renderResponseTime(status)}
          </div>
          
          {status?.error && status.status === 'error' && (
            <div className="mt-3 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <strong>Error:</strong> {status.error}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const connectedCount = Object.values(apiStatuses).filter(s => s.status === 'connected').length;
  const errorCount = Object.values(apiStatuses).filter(s => s.status === 'error').length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Wifi className="w-8 h-8" />
            Estado de APIs
          </h1>
          <p className="text-muted-foreground">
            Monitorea el estado de todas las integraciones del sistema
          </p>
        </div>
        <Button
          onClick={checkAllAPIs}
          disabled={isChecking}
          className="flex items-center gap-2"
        >
          {isChecking ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Verificar Todas
            </>
          )}
        </Button>
      </div>

      {/* Summary Cards */}
      {Object.keys(apiStatuses).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Wifi className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total APIs</p>
                  <p className="text-2xl font-bold">{apiConfigs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-50 rounded-xl">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Conectadas</p>
                  <p className="text-2xl font-bold text-green-600">{connectedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-50 rounded-xl">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Con errores</p>
                  <p className="text-2xl font-bold text-red-600">{errorCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* External Integrations Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Database className="w-5 h-5" />
          Integraciones Externas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {externalApis.map(renderAPICard)}
        </div>
      </div>

      {/* AI Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Brain className="w-5 h-5" />
          Inteligencia Artificial
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {aiApis.map(renderAPICard)}
        </div>
      </div>
    </div>
  );
};

export default ApisStatusPage;
