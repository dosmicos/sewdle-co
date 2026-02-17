import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  RefreshCw,
  TrendingUp,
  Activity,
  Zap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncStats {
  totalDeliveries: number;
  syncedDeliveries: number;
  pendingDeliveries: number;
  failedDeliveries: number;
  syncSuccessRate: number;
  avgSyncTime: number;
  recentFailures: unknown[];
  topErrors: { error: string; count: number }[];
}

export const SyncMonitoringDashboard = () => {
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const loadSyncStats = useCallback(async () => {
    try {
      const { data: deliveries, error: deliveriesError } = await supabase
        .from('deliveries')
        .select(`
          id,
          synced_to_shopify,
          sync_attempts,
          last_sync_attempt,
          sync_error_message,
          delivery_items (
            id,
            synced_to_shopify,
            quantity_approved,
            sync_error_message,
            last_sync_attempt
          )
        `)
        .eq('status', 'approved');

      if (deliveriesError) throw deliveriesError;

      // Calcular estadísticas
      const totalDeliveries = deliveries?.length || 0;
      let syncedDeliveries = 0;
      let pendingDeliveries = 0;
      let failedDeliveries = 0;
      const recentFailures: unknown[] = [];
      const errorCounts: Record<string, number> = {};

      deliveries?.forEach(delivery => {
        const hasItemsToSync = delivery.delivery_items?.some(
          (item: unknown) => item.quantity_approved > 0
        );

        if (!hasItemsToSync) {
          // No hay items para sincronizar, considerar como sincronizado
          syncedDeliveries++;
        } else if (delivery.synced_to_shopify) {
          syncedDeliveries++;
        } else if (delivery.sync_error_message) {
          failedDeliveries++;
          recentFailures.push({
            id: delivery.id,
            error: delivery.sync_error_message,
            lastAttempt: delivery.last_sync_attempt
          });
          
          // Contar errores
          const errorKey = delivery.sync_error_message.substring(0, 50);
          errorCounts[errorKey] = (errorCounts[errorKey] || 0) + 1;
        } else {
          pendingDeliveries++;
        }
      });

      // Top errores
      const topErrors = Object.entries(errorCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([error, count]) => ({ error, count }));

      // Calcular tasa de éxito
      const syncSuccessRate = totalDeliveries > 0 
        ? Math.round((syncedDeliveries / totalDeliveries) * 100) 
        : 100;

      // Obtener logs recientes para calcular tiempo promedio
      const { data: syncLogs } = await supabase
        .from('inventory_sync_logs')
        .select('synced_at, created_at')
        .order('synced_at', { ascending: false })
        .limit(50);

      let avgSyncTime = 0;
      if (syncLogs && syncLogs.length > 0) {
        const times = syncLogs
          .filter(log => log.synced_at && log.created_at)
          .map(log => {
            const start = new Date(log.created_at).getTime();
            const end = new Date(log.synced_at).getTime();
            return end - start;
          });
        
        if (times.length > 0) {
          avgSyncTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length / 1000);
        }
      }

      setStats({
        totalDeliveries,
        syncedDeliveries,
        pendingDeliveries,
        failedDeliveries,
        syncSuccessRate,
        avgSyncTime,
        recentFailures: recentFailures.slice(0, 5),
        topErrors
      });

    } catch (error) {
      console.error('Error loading sync stats:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las estadísticas de sincronización",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSyncStats();
  };

  useEffect(() => {
    loadSyncStats();
    
    // Auto-refresh cada 30 segundos
    const interval = setInterval(loadSyncStats, 30000);
    
    return () => clearInterval(interval);
  }, [loadSyncStats]);

  if (loading || !stats) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <span className="ml-2">Cargando estadísticas...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con botón de refresh */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Monitor de Sincronización</h2>
          <p className="text-muted-foreground">Estado en tiempo real del sistema de sincronización con Shopify</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Entregas</p>
                <p className="text-2xl font-bold">{stats.totalDeliveries}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Sincronizadas</p>
                <p className="text-2xl font-bold">{stats.syncedDeliveries}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Pendientes</p>
                <p className="text-2xl font-bold">{stats.pendingDeliveries}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm font-medium">Con Errores</p>
                <p className="text-2xl font-bold">{stats.failedDeliveries}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Métricas de rendimiento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Tasa de Éxito
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Sincronización exitosa</span>
                <span className="text-2xl font-bold">{stats.syncSuccessRate}%</span>
              </div>
              <Progress value={stats.syncSuccessRate} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {stats.syncedDeliveries} de {stats.totalDeliveries} entregas sincronizadas
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Tiempo Promedio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Tiempo de sincronización</span>
                <span className="text-2xl font-bold">{stats.avgSyncTime}s</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Tiempo promedio basado en las últimas 50 sincronizaciones
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de fallos recientes */}
      {stats.recentFailures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Fallos Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentFailures.map((failure, index) => (
                <Alert key={index} variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <strong>Entrega {failure.id.substring(0, 8)}...</strong>
                        <p className="text-sm mt-1">{failure.error}</p>
                      </div>
                      {failure.lastAttempt && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {new Date(failure.lastAttempt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top errores */}
      {stats.topErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Errores Más Frecuentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.topErrors.map((error, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm flex-1 mr-2">{error.error}</span>
                  <Badge variant="outline">{error.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SyncMonitoringDashboard;
