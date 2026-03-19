import React, { useState, useCallback, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSeedImages } from '@/hooks/useSeedImages';

interface ImageEditorProps {
  baseImage: string | null;
  onBaseImageChange: (value: string | null) => void;
  instructions: string;
  onInstructionsChange: (value: string) => void;
  selectedAdSeedIds: string[];
  onAdSeedIdsChange: (ids: string[]) => void;
}

const ImageEditor = ({
  baseImage,
  onBaseImageChange,
  instructions,
  onInstructionsChange,
  selectedAdSeedIds,
  onAdSeedIdsChange,
}: ImageEditorProps) => {
  const { toast } = useToast();
  const { seedImages } = useSeedImages('advertising');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Tipo de archivo no valido',
        description: 'Solo se permiten archivos JPG, PNG y WEBP.',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Archivo muy grande',
        description: 'El archivo debe ser menor a 5MB.',
        variant: 'destructive',
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      onBaseImageChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const toggleAdSeed = (id: string) => {
    if (selectedAdSeedIds.includes(id)) {
      onAdSeedIdsChange(selectedAdSeedIds.filter((s) => s !== id));
    } else {
      onAdSeedIdsChange([...selectedAdSeedIds, id]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Imagen base</Label>
        {baseImage ? (
          <div className="relative w-full max-w-md">
            <img
              src={baseImage}
              alt="Base"
              className="w-full h-48 object-cover rounded-lg border border-gray-300"
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => onBaseImageChange(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
              }}
            />
            <div className="space-y-2">
              <Upload className="w-8 h-8 text-gray-400 mx-auto" />
              <p className="text-sm text-gray-600">Arrastra una imagen o haz clic para seleccionar</p>
              <p className="text-xs text-gray-500">JPG, PNG o WEBP (max. 5MB)</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Instrucciones de edicion</Label>
        <Textarea
          value={instructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
          placeholder="Ej: Cambiar fondo a playa, agregar luz calida..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-gray-700">Fondos de referencia (opcional)</Label>
        {seedImages.length === 0 ? (
          <p className="text-sm text-gray-500">No hay imagenes de publicidad disponibles.</p>
        ) : (
          <div className="grid grid-cols-5 md:grid-cols-8 gap-2">
            {seedImages.map((seed) => {
              const isSelected = selectedAdSeedIds.includes(seed.id);
              return (
                <div
                  key={seed.id}
                  className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleAdSeed(seed.id)}
                  title={seed.name}
                >
                  <img src={seed.image_url} alt={seed.name} className="w-full aspect-square object-cover" />
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageEditor;
