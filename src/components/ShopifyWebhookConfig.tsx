import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Webhook, Settings, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const ShopifyWebhookConfig: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  // URL del webhook - reemplaza con tu dominio de proyecto
  const webhookUrl = `https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/shopify-webhook`;
  
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "¡Copiado!",
        description: "URL copiada al portapapeles",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo copiar al portapapeles",
        variant: "destructive",
      });
    }
  };

  const steps = [
    {
      title: "1. Configurar el Secret del Webhook",
      description: "Primero necesitas configurar el secret para verificar los webhooks",
      content: (
        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription>
            Ve a la configuración de secretos de Supabase y agrega <code>SHOPIFY_WEBHOOK_SECRET</code> con un valor secreto seguro.
          </AlertDescription>
        </Alert>
      )
    },
    {
      title: "2. Ir a Configuración de Webhooks en Shopify",
      description: "Accede a tu panel de administración de Shopify",
      content: (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Ve a: <strong>Configuración → Notificaciones → Webhooks</strong>
          </p>
          <Button 
            variant="outline" 
            onClick={() => window.open('https://admin.shopify.com/settings/notifications', '_blank')}
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir Shopify Admin
          </Button>
        </div>
      )
    },
    {
      title: "3. Crear Nuevo Webhook",
      description: "Configura el webhook para órdenes creadas",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">URL del Webhook</Label>
            <div className="flex gap-2">
              <Input 
                id="webhook-url"
                value={webhookUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(webhookUrl)}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Evento</Label>
              <Badge variant="secondary" className="mt-1">Order creation</Badge>
            </div>
            <div>
              <Label>Formato</Label>
              <Badge variant="secondary" className="mt-1">JSON</Badge>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "4. Configurar Autenticación",
      description: "Asegura que el webhook sea verificado",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            En la configuración del webhook, asegúrate de usar el mismo secret que configuraste en Supabase.
          </p>
          <Alert>
            <Webhook className="h-4 w-4" />
            <AlertDescription>
              Shopify enviará el hash HMAC en el header <code>X-Shopify-Hmac-Sha256</code>
            </AlertDescription>
          </Alert>
        </div>
      )
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          Configuración de Webhook en Tiempo Real
        </CardTitle>
        <CardDescription>
          Configura webhooks de Shopify para sincronizar automáticamente cada nueva orden
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {steps.map((step, index) => (
          <div key={index} className="border rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
            <p className="text-muted-foreground mb-3">{step.description}</p>
            {step.content}
          </div>
        ))}
        
        <Alert>
          <Check className="h-4 w-4" />
          <AlertDescription>
            <strong>¡Importante!</strong> Una vez configurado, cada nueva orden en Shopify se sincronizará automáticamente 
            en tiempo real con tu dashboard, actualizando tanto las órdenes como las métricas de ventas.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};