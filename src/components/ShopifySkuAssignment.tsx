
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Settings, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Play, 
  Pause,
  Activity,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { useShopifySkuAssignment } from '@/hooks/useShopifySkuAssignment';
import { useSkuAssignmentProgress } from '@/hooks/useSkuAssignmentProgress';

const ShopifySkuAssignment = () => {
  const { assignShopifySkus, resumeProcess, loading } = useShopifySkuAssignment();
  const { 
    currentProcess, 
    getProgressPercentage, 
    startNewProcess, 
    resumeProcess: resumeFromProgress,
    cancelProcess 
  } = useSkuAssignmentProgress();
  const [result, setResult] = useState<any>(null);

  const handleNewAssignment = async () => {
    const assignmentResult = await startNewProcess(100);
    if (assignmentResult) {
      setResult(assignmentResult);
    }
  };

  const handleResumeProcess = async () => {
    if (currentProcess) {
      const resumeResult = await resumeFromProgress(
        currentProcess.process_id, 
        currentProcess.current_cursor || undefined
      );
      if (resumeResult) {
        setResult(resumeResult);
      }
    }
  };

  const handleCancelProcess = async () => {
    if (currentProcess) {
      await cancelProcess(currentProcess.process_id);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'paused': return <Pause className="w-4 h-4 text-yellow-500" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-gray-500" />;
      default: return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-500';
      case 'paused': return 'bg-yellow-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'cancelled': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-blue-700">
          <Settings className="w-5 h-5" />
          <span>Asignación Inteligente de SKUs en Shopify</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Información del sistema mejorado */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              Sistema optimizado con detección inteligente
            </h4>
            <div className="text-sm text-blue-700 space-y-2">
              <p>• <strong>Detección inteligente:</strong> Solo procesa productos que realmente necesitan SKUs</p>
              <p>• <strong>Evita repeticiones:</strong> Salta automáticamente productos ya procesados</p>
              <p>• <strong>Análisis previo:</strong> Cuenta productos pendientes antes de comenzar</p>
              <p>• <strong>Progreso real:</strong> Muestra avance basado en trabajo realizado</p>
              <p>• <strong>Procesamiento eficiente:</strong> 100 variantes por lote para mejor control</p>
            </div>
          </div>

          {/* Estado del proceso actual */}
          {currentProcess && (
            <div className="bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(currentProcess.status)}
                  <span className="font-medium">Proceso Actual</span>
                  <Badge variant="outline" className={`text-white ${getStatusColor(currentProcess.status)}`}>
                    {currentProcess.status}
                  </Badge>
                </div>
                <div className="text-sm text-gray-500">
                  ID: {currentProcess.process_id.slice(0, 8)}...
                </div>
              </div>

              {/* Barra de progreso mejorada */}
              {currentProcess.total_variants > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Progreso de Variantes</span>
                    <span className="text-sm text-gray-600">
                      {getProgressPercentage(currentProcess)}%
                    </span>
                  </div>
                  <Progress value={getProgressPercentage(currentProcess)} className="h-2" />
                  <div className="text-xs text-gray-500 mt-1">
                    {currentProcess.processed_variants || 0} de {currentProcess.total_variants || 0} variantes procesadas
                  </div>
                </div>
              )}

              {/* Estadísticas del proceso actual */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    {currentProcess.updated_variants || 0}
                  </div>
                  <div className="text-xs text-gray-600">SKUs Asignados</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">
                    {currentProcess.total_products || 0}
                  </div>
                  <div className="text-xs text-gray-600">Productos Pendientes</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">
                    {currentProcess.error_variants || 0}
                  </div>
                  <div className="text-xs text-gray-600">Errores</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">
                    {currentProcess.shopify_api_calls || 0}
                  </div>
                  <div className="text-xs text-gray-600">API Calls</div>
                </div>
              </div>

              {/* Rate limiting info */}
              {currentProcess.rate_limit_hits > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                  <div className="text-sm text-yellow-800 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Rate limits detectados: {currentProcess.rate_limit_hits} veces (manejados automáticamente)
                  </div>
                </div>
              )}

              {/* Controles del proceso */}
              <div className="flex space-x-2">
                {currentProcess.status === 'paused' && (
                  <Button 
                    onClick={handleResumeProcess}
                    disabled={loading}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Continuar Proceso
                  </Button>
                )}
                
                {(currentProcess.status === 'running' || currentProcess.status === 'paused') && (
                  <Button 
                    onClick={handleCancelProcess}
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}
          
          {/* Botón para nuevo proceso */}
          <Button
            onClick={handleNewAssignment}
            disabled={loading || (currentProcess && currentProcess.status === 'running')}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Settings className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {currentProcess && currentProcess.status === 'running' 
              ? 'Analizando y Procesando...' 
              : 'Iniciar Asignación Inteligente'}
          </Button>

          {/* Resultado del último proceso */}
          {result && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold mb-3 flex items-center">
                {result.status === 'completed' ? (
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                ) : (
                  <Clock className="w-5 h-5 text-blue-500 mr-2" />
                )}
                Resultado del Proceso
              </h4>
              
              <div className={`p-3 rounded border ${
                result.status === 'completed' 
                  ? 'bg-green-50 border-green-200 text-green-800' 
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
                <p className="font-medium">
                  {result.status === 'completed' ? '✅' : '📊'} {result.message}
                </p>
                
                {result.summary && (
                  <div className="mt-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div>SKUs asignados: <strong>{result.summary.updatedVariants || 0}</strong></div>
                      <div>Errores: <strong>{result.summary.errorVariants || 0}</strong></div>
                      {result.summary.productsScanned && (
                        <>
                          <div>Productos revisados: <strong>{result.summary.productsScanned}</strong></div>
                          <div>Ya procesados: <strong>{result.summary.productsSkipped || 0}</strong></div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ShopifySkuAssignment;
