
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useShopifySync } from '@/hooks/useShopifySync';
import { RefreshCw, Calendar, AlertCircle, CheckCircle, Clock, Database, TrendingUp, Target, Layers } from 'lucide-react';
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
      // Refresh logs after sync with delay
      setTimeout(loadSyncLogs, 3000);
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
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
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

  const getCoverageColor = (coverage: number) => {
    if (coverage >= 90) return 'text-green-600';
    if (coverage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const latestSync = syncLogs.length > 0 ? syncLogs[0] : null;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {latestSync && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Database className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Última Sincronización</p>
                  <p className="text-lg font-bold">
                    {latestSync.execution_details?.actual_days_covered || latestSync.days_processed} días
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(latestSync.start_time), { addSuffix: true, locale: es })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Órdenes Procesadas</p>
                  <p className="text-lg font-bold">{latestSync.orders_processed}</p>
                  <p className="text-xs text-muted-foreground">
                    {latestSync.metrics_created} métricas creadas
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Target className={`h-5 w-5 ${latestSync.execution_details?.date_range_verified?.coverage_percentage >= 90 ? 'text-green-500' : latestSync.execution_details?.date_range_verified?.coverage_percentage >= 70 ? 'text-yellow-500' : 'text-red-500'}`} />
                <div>
                  <p className="text-sm text-muted-foreground">Cobertura Temporal</p>
                  <p className={`text-lg font-bold ${getCoverageColor(latestSync.execution_details?.date_range_verified?.coverage_percentage || 0)}`}>
                    {latestSync.execution_details?.date_range_verified?.coverage_percentage || 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {latestSync.execution_details?.date_range_verified?.actual_days || 0}/{latestSync.execution_details?.date_range_verified?.requested_days || 0} días
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                {getStatusIcon(latestSync.status)}
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <p className="text-lg font-bold">{latestSync.status}</p>
                  {latestSync.execution_details?.segmented_sync && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      Sincronización segmentada
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sincronización de Ventas Shopify (Segmentada)
          </CardTitle>
          <CardDescription>
            Ejecuta sincronizaciones manuales con estrategia segmentada para obtener el máximo de datos históricos. 
            La sincronización divide el período en chunks más pequeños para trabajar mejor con las limitaciones de la API de Shopify.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Button
              onClick={() => handleSync('initial')}
              disabled={loading}
              className="flex items-center gap-2"
              variant="default"
              size="lg"
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
            <div className="flex items-center gap-2 text-blue-600 mb-4 p-4 bg-blue-50 rounded-lg">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <div>
                <p className="font-medium">Ejecutando sincronización segmentada...</p>
                <p className="text-sm text-muted-foreground">
                  Procesando datos en chunks pequeños para maximizar la cobertura temporal. Esto puede tomar varios minutos.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Historial de Sincronizaciones</CardTitle>
            <CardDescription>
              Últimas 10 sincronizaciones ejecutadas con detalles de cobertura temporal
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
                  className="flex items-start justify-between p-4 border rounded-lg bg-card"
                >
                  <div className="flex items-start gap-3 flex-1">
                    {getStatusIcon(log.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">
                          {log.sync_type} Sync ({log.days_processed} días solicitados)
                        </span>
                        {getStatusBadge(log.status)}
                        {log.execution_details?.segmented_sync && (
                          <Badge variant="outline" className="text-xs">
                            <Layers className="h-3 w-3 mr-1" />
                            Segmentada
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600 mb-2">
                        <div>
                          <span className="font-medium">Órdenes:</span> {log.orders_processed}
                        </div>
                        <div>
                          <span className="font-medium">Métricas:</span> {log.metrics_created}
                        </div>
                        <div>
                          <span className="font-medium">Variantes:</span> {log.variants_updated}
                        </div>
                        {log.execution_details?.chunks_processed && (
                          <div>
                            <span className="font-medium">Chunks:</span> {log.execution_details.chunks_processed}
                          </div>
                        )}
                      </div>

                      {log.execution_details?.date_range_verified && (
                        <div className="text-xs text-muted-foreground bg-muted p-2 rounded mb-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                              <p><strong>Rango procesado:</strong> {log.execution_details.date_range_verified.oldest_order} a {log.execution_details.date_range_verified.newest_order}</p>
                              <p><strong>Cobertura:</strong> 
                                <span className={`font-medium ml-1 ${getCoverageColor(log.execution_details.date_range_verified.coverage_percentage)}`}>
                                  {log.execution_details.date_range_verified.actual_days}/{log.execution_details.date_range_verified.requested_days} días ({log.execution_details.date_range_verified.coverage_percentage}%)
                                </span>
                              </p>
                            </div>
                            {log.execution_details.date_range_verified.date_gaps > 0 && (
                              <div>
                                <p className="text-amber-600">
                                  <strong>Gaps detectados:</strong> {log.execution_details.date_range_verified.date_gaps} días sin datos
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {log.error_message && (
                        <div className="text-sm text-red-500 mt-1 p-2 bg-red-50 rounded">
                          <strong>Error:</strong> {log.error_message}
                        </div>
                      )}
                      
                      {log.execution_details?.version && (
                        <div className="text-xs text-green-600 mt-1 flex items-center gap-2">
                          <span>✅ Versión: {log.execution_details.version}</span>
                          {log.execution_details.segmented_sync && <span>• Sincronización segmentada activa</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right text-sm text-gray-500 ml-4">
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
