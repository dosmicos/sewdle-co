import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Download, X, Image as ImageIcon } from 'lucide-react';

interface ImagePreviewProps {
  imageUrl: string | null;
  generating: boolean;
  onDownload: () => void;
  onClear: () => void;
}

const ImagePreview = ({ imageUrl, generating, onDownload, onClear }: ImagePreviewProps) => {
  if (generating) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-sm text-gray-600">Generando imagen...</p>
        </div>
      </Card>
    );
  }

  if (imageUrl) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
        <div className="p-4 space-y-4">
          <img
            src={imageUrl}
            alt="Imagen generada"
            className="w-full max-h-96 object-contain rounded"
          />
          <div className="flex items-center gap-2">
            <Button onClick={onDownload} variant="outline" className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Descargar
            </Button>
            <Button onClick={onClear} variant="outline" className="flex-1">
              <X className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">Tu imagen generada aparecera aqui</p>
      </div>
    </Card>
  );
};

export default ImagePreview;
