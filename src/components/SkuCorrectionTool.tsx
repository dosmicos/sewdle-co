
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
              Sistema de corrección mejorado
            </h4>
            <div className="text-sm text-orange-700 space-y-2">
              <p>• <strong>Detección inteligente:</strong> Solo corrige SKUs que realmente son artificiales</p>
              <p>• <strong>Mapeo por características:</strong> Encuentra variantes por talla y color, no por posición</p>
              <p>• <strong>Validación cruzada:</strong> Verifica coincidencias exactas con el catálogo de Shopify</p>
              <p>• <strong>SKUs reales:</strong> Asigna los SKUs originales de Shopify, no códigos generados</p>
              <p>• <strong>Logging detallado:</strong> Muestra exactamente qué cambios se realizan</p>
            </div>
          </div>
          
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>¿Cuándo usar esta herramienta?</strong><br/>
              Si tienes productos con SKUs que empiezan por "SHOPIFY-" o contienen códigos 
              generados automáticamente, esta herramienta los corregirá con los SKUs reales de Shopify.
            </p>
          </div>
          
          <Button
            onClick={handleCorrection}
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Corrigiendo SKUs...' : 'Iniciar Corrección Inteligente'}
          </Button>
          
          {loading && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-sm text-yellow-800">
                💡 <strong>Tip:</strong> Abre la consola del navegador (F12) para ver el progreso detallado de la corrección
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SkuCorrectionTool;
