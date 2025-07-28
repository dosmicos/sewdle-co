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
  const [copied, setCopied] = useState<string>('');
  const { toast } = useToast();
  
  // URLs de webhooks
  const ordersWebhookUrl = `https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/shopify-webhook`;
  const inventoryWebhookUrl = `https://ysdcsqsfnckeuafjyrbc.supabase.co/functions/v1/shopify-inventory-webhook`;
  
  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      toast({
        title: "¡Copiado!",
        description: "URL copiada al portapapeles",
      });
      setTimeout(() => setCopied(''), 2000);
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
      title: "3. Crear Webhook para Órdenes",
      description: "Configura el webhook para órdenes creadas",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orders-webhook-url">URL del Webhook de Órdenes</Label>
            <div className="flex gap-2">
              <Input 
                id="orders-webhook-url"
                value={ordersWebhookUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(ordersWebhookUrl, 'orders')}
              >
                {copied === 'orders' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
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
      title: "4. Crear Webhook para Inventario",
      description: "Configura el webhook para actualizaciones de inventario en tiempo real",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inventory-webhook-url">URL del Webhook de Inventario</Label>
            <div className="flex gap-2">
              <Input 
                id="inventory-webhook-url"
                value={inventoryWebhookUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(inventoryWebhookUrl, 'inventory')}
              >
                {copied === 'inventory' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Evento</Label>
              <Badge variant="secondary" className="mt-1">Inventory levels update</Badge>
            </div>
            <div>
              <Label>Formato</Label>
              <Badge variant="secondary" className="mt-1">JSON</Badge>
            </div>
          </div>
          
          <Alert>
            <Webhook className="h-4 w-4" />
            <AlertDescription>
              <strong>Importante:</strong> Esto habilitará actualizaciones automáticas de inventario cada vez que cambien los niveles de stock en Shopify.
            </AlertDescription>
          </Alert>
        </div>
      )
    },
    {
      title: "5. Configurar Autenticación",
      description: "Asegura que ambos webhooks sean verificados",
      content: (
        <div className="space-y-2">
          <p className="text-sm">
            En la configuración de ambos webhooks, asegúrate de usar el mismo secret que configuraste en Supabase.
          </p>
          <Alert>
            <Webhook className="h-4 w-4" />
            <AlertDescription>
              Shopify enviará el hash HMAC en el header <code>X-Shopify-Hmac-Sha256</code> para ambos webhooks
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
          Configuración de Webhooks en Tiempo Real
        </CardTitle>
        <CardDescription>
          Configura webhooks de Shopify para sincronizar automáticamente órdenes e inventario en tiempo real
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
            <strong>¡Importante!</strong> Una vez configurados ambos webhooks:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Cada nueva orden en Shopify se sincronizará automáticamente en tiempo real</li>
              <li>Los cambios de inventario se actualizarán instantáneamente sin necesidad de hacer click en "Actualizar Stock"</li>
              <li>Las métricas de ventas se mantendrán siempre actualizadas</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};