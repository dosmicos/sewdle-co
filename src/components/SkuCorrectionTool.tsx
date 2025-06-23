
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Info } from 'lucide-react';
import { useSkuCorrection } from '@/hooks/useSkuCorrection';

const SkuCorrectionTool = () => {
  const { correctArtificialSkus, loading } = useSkuCorrection();

  const handleCorrection = async () => {
    try {
      await correctArtificialSkus();
    } catch (error) {
      console.error('Error en corrección:', error);
    }
  };

  return (
    <Card className="border-orange-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-orange-700">
          <AlertTriangle className="w-5 h-5" />
          <span>Corrección Inteligente de SKUs</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-orange-50 p-4 rounded-lg">
            <h4 className="font-semibold text-orange-800 mb-2 flex items-center">
              <Info className="w-4 h-4 mr-2" />
              Sistema de corrección mejorado v2.0
            </h4>
            <div className="text-sm text-orange-700 space-y-2">
              <p>• <strong>Detección avanzada:</strong> Detecta múltiples patrones de SKUs artificiales</p>
              <p>• <strong>Mapeo inteligente:</strong> Encuentra variantes por múltiples estrategias de coincidencia</p>
              <p>• <strong>Timestamps detectados:</strong> Identifica SKUs con códigos de tiempo generados automáticamente</p>
              <p>• <strong>Patrones específicos:</strong> Reconoce formatos como NOMBRE-LETRA-NUMEROS-VX-COLOR</p>
              <p>• <strong>SKUs reales:</strong> Asigna los SKUs originales de Shopify correctos</p>
              <p>• <strong>Logging detallado:</strong> Muestra exactamente qué cambios se realizan y por qué</p>
            </div>
          </div>
          
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Patrones de SKUs artificiales detectados:</strong><br/>
              • <code>SHOPIFY-XXXXXXX</code><br/>
              • <code>CHAQUETA-D-123-1750351775526-V1-AZUL</code><br/>
              • SKUs con timestamps de 13 dígitos<br/>
              • SKUs con múltiples guiones y patrones VX
            </p>
          </div>
          
          <Button
            onClick={handleCorrection}
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Corrigiendo SKUs...' : 'Iniciar Corrección Inteligente v2.0'}
          </Button>
          
          {loading && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-sm text-yellow-800">
                💡 <strong>Tip:</strong> Abre la consola del navegador (F12) para ver el progreso detallado de la corrección con el nuevo sistema de logging mejorado
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SkuCorrectionTool;
