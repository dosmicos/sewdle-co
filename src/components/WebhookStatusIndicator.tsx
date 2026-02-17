import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Zap, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

interface WebhookLog {
  id: string;
  sync_type: string;
  start_time: string;
  end_time: string | null;
  status: string;
  orders_processed: number;
  error_message: string | null;
}

export const WebhookStatusIndicator: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const [lastWebhook, setLastWebhook] = useState<WebhookLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization?.id) return;

    const fetchLastWebhook = async () => {
      try {
        // Cast supabase to any to avoid TypeScript deep type instantiation error
        const client = supabase as any;
        const { data, error } = await client
          .from('sync_control_logs')
          .select('*')
          .eq('organization_id', currentOrganization.id)
          .order('start_time', { ascending: false })
          .limit(5);

        if (error) {
          console.error('Error fetching webhook status:', error);
        } else if (data && data.length > 0) {
          // Find the most recent webhook-related log
          const webhookLog = data.find((log: any) => 
            log.sync_type?.includes('webhook') || log.sync_type === 'shopify_orders'
          );
          if (webhookLog) {
            setLastWebhook({
              id: webhookLog.id,
              sync_type: webhookLog.sync_type,
              start_time: webhookLog.start_time,
              end_time: webhookLog.end_time,
              status: webhookLog.status,
              orders_processed: webhookLog.orders_processed,
              error_message: webhookLog.error_message
            });
          }
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLastWebhook();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('webhook-status')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sync_control_logs',
          filter: `organization_id=eq.${currentOrganization.id}`
        },
        (payload) => {
          const newLog = payload.new as WebhookLog;
          if (newLog.sync_type?.includes('webhook') || newLog.sync_type === 'shopify_orders') {
            setLastWebhook(newLog);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization?.id]);

  const getWebhookStatus = (): 'active' | 'inactive' | 'error' => {
    if (!lastWebhook) return 'inactive';
    
    const lastTime = new Date(lastWebhook.start_time);
    const now = new Date();
    const hoursSinceLastWebhook = (now.getTime() - lastTime.getTime()) / (1000 * 60 * 60);
    
    if (lastWebhook.status === 'error') return 'error';
    if (hoursSinceLastWebhook > 24) return 'inactive';
    return 'active';
  };

  const webhookStatus = getWebhookStatus();

  const getStatusColor = () => {
    switch (webhookStatus) {
      case 'active': return 'text-green-600';
      case 'error': return 'text-red-600';
      default: return 'text-muted-foreground';
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

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'hace unos segundos';
    if (diffMins < 60) return `hace ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
    if (diffHours < 24) return `hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    return `hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-muted-foreground" />
            Webhook
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-4 bg-muted rounded w-24"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Zap className={`h-4 w-4 ${getStatusColor()}`} />
            Webhook
          </span>
          {getStatusBadge()}
        </CardTitle>
        <CardDescription className="text-xs">
          Sincronización en tiempo real con Shopify
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {lastWebhook ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Última actualización: {formatRelativeTime(lastWebhook.start_time)}</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sin actividad reciente. Los pedidos nuevos se sincronizarán automáticamente.
          </p>
        )}
      </CardContent>
    </Card>
  );
};