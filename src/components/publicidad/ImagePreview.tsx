import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Download, X, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface GeneratedImage {
  image_url: string;
  generation_id: string;
}

interface ImagePreviewProps {
  images: GeneratedImage[];
  generating: boolean;
  onDownload: (url: string) => void;
  onClear: () => void;
}

const ImagePreview = ({ images, generating, onDownload, onClear }: ImagePreviewProps) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (generating) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-10 h-10 text-[#ff5c02] animate-spin" />
          <p className="text-sm text-gray-600">Generando imágenes...</p>
          <p className="text-xs text-gray-400">Esto puede tomar unos segundos</p>
        </div>
      </Card>
    );
  }

  if (images.length > 0) {
    const currentImage = images[selectedIndex] || images[0];

    return (
      <div className="space-y-4">
        {/* Main selected image */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="p-4 space-y-4">
            <div className="relative">
              <img
                src={currentImage.image_url}
                alt={`Imagen generada ${selectedIndex + 1}`}
                className="w-full max-h-[500px] object-contain rounded"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'flex flex-col items-center justify-center py-12 text-gray-400';
                    errorDiv.innerHTML = '<p class="text-sm">Error al cargar la imagen</p><p class="text-xs mt-1">La URL puede haber expirado</p>';
                    parent.appendChild(errorDiv);
                  }
                }}
              />
              {images.length > 1 && (
                <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                  {selectedIndex + 1} / {images.length}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => onDownload(currentImage.image_url)}
                variant="outline"
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar
              </Button>
              <Button onClick={onClear} variant="outline" size="icon">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Thumbnails grid */}
        {images.length > 1 && (
          <div className="grid grid-cols-4 gap-2">
            {images.map((img, index) => (
              <div
                key={img.generation_id || index}
                onClick={() => setSelectedIndex(index)}
                className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                  index === selectedIndex
                    ? 'border-[#ff5c02] ring-2 ring-[#ff5c02]/20'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <img
                  src={img.image_url}
                  alt={`Opción ${index + 1}`}
                  className="w-full aspect-square object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">Tus imágenes generadas aparecerán aquí</p>
        <p className="text-xs text-gray-400">Se generarán 4 opciones para elegir</p>
      </div>
    </Card>
  );
};

export default ImagePreview;
