
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useShopifySync } from '@/hooks/useShopifySync';
import { RefreshCw, Calendar, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface SyncLog {
  id: string;
  sync_type: string;
  sync_mode: string;
  status: string;
  start_time: string;
  end_time?: string;
  days_processed: number;
  orders_processed: number;
  variants_updated: number;
  metrics_created: number;
  error_message?: string;
  execution_details?: any;
}

export const ShopifySyncManager: React.FC = () => {
  const { triggerSync, getSyncLogs, loading } = useShopifySync();
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [refreshingLogs, setRefreshingLogs] = useState(false);

  const loadSyncLogs = async () => {
    setRefreshingLogs(true);
    try {
      const logs = await getSyncLogs();
      setSyncLogs(logs);
    } catch (error) {
      console.error('Error loading sync logs:', error);
    } finally {
      setRefreshingLogs(false);
    }
  };

  useEffect(() => {
    loadSyncLogs();
  }, []);

  const handleSync = async (mode: 'initial' | 'daily' | 'monthly') => {
    try {
      await triggerSync(mode);
      // Refresh logs after sync
      setTimeout(loadSyncLogs, 2000);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'default',
      failed: 'destructive',
      running: 'secondary'
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sincronización de Ventas Shopify
          </CardTitle>
          <CardDescription>
            Ejecuta sincronizaciones manuales y monitorea el progreso. La sincronización inicial captura todos los datos históricos con paginación completa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Button
              onClick={() => handleSync('initial')}
              disabled={loading}
              className="flex items-center gap-2"
              variant="outline"
            >
              <Calendar className="h-4 w-4" />
              Sincronización Inicial (90 días)
            </Button>
            
            <Button
              onClick={() => handleSync('daily')}
              disabled={loading}
              className="flex items-center gap-2"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4" />
              Sincronización Diaria (7 días)
            </Button>
            
            <Button
              onClick={() => handleSync('monthly')}
              disabled={loading}
              className="flex items-center gap-2"
              variant="outline"
            >
              <Calendar className="h-4 w-4" />
              Sincronización Mensual (30 días)
            </Button>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-blue-600 mb-4">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Ejecutando sincronización...
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Historial de Sincronizaciones</CardTitle>
            <CardDescription>
              Últimas 10 sincronizaciones ejecutadas
            </CardDescription>
          </div>
          <Button
            onClick={loadSyncLogs}
            disabled={refreshingLogs}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 ${refreshingLogs ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {syncLogs.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No hay registros de sincronización
              </p>
            ) : (
              syncLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(log.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {log.sync_type} ({log.days_processed} días)
                        </span>
                        {getStatusBadge(log.status)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {log.orders_processed} órdenes • {log.metrics_created} métricas • {log.variants_updated} variantes actualizadas
                      </div>
                      {log.error_message && (
                        <div className="text-sm text-red-500 mt-1">
                          Error: {log.error_message}
                        </div>
                      )}
                      {log.execution_details?.pagination_used && (
                        <div className="text-sm text-green-600 mt-1">
                          ✅ Paginación completa utilizada
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div>
                      {formatDistanceToNow(new Date(log.start_time), { 
                        addSuffix: true, 
                        locale: es 
                      })}
                    </div>
                    {log.end_time && (
                      <div>
                        Duración: {Math.round(
                          (new Date(log.end_time).getTime() - new Date(log.start_time).getTime()) / 1000
                        )}s
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
