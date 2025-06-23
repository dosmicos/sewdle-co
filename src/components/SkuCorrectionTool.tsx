
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
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
          <span>Corrección de SKUs</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-orange-50 p-4 rounded-lg">
            <h4 className="font-semibold text-orange-800 mb-2">
              ¿Productos importados con SKUs artificiales?
            </h4>
            <p className="text-sm text-orange-700 mb-3">
              Si importaste productos antes de esta corrección, es posible que tengan SKUs artificiales 
              generados automáticamente en lugar de los SKUs originales de Shopify.
            </p>
            <p className="text-sm text-orange-700">
              Esta herramienta corregirá los SKUs para que coincidan exactamente con los de Shopify.
            </p>
          </div>
          
          <Button
            onClick={handleCorrection}
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Corrigiendo SKUs...' : 'Corregir SKUs Artificiales'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SkuCorrectionTool;
