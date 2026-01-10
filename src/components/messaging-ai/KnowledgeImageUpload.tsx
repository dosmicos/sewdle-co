import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ImagePlus, X, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface KnowledgeImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  organizationId: string;
  maxImages?: number;
}

export const KnowledgeImageUpload = ({ 
  images, 
  onImagesChange, 
  organizationId,
  maxImages = 5 
}: KnowledgeImageUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      toast.error('Solo se permiten imágenes JPG, PNG o WEBP');
      return false;
    }

    if (file.size > maxSize) {
      toast.error('La imagen no debe superar 5MB');
      return false;
    }

    return true;
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!validateFile(file)) return null;

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `knowledge/${organizationId}/${timestamp}-${random}.${ext}`;

    const { error } = await supabase.storage
      .from('messaging-media')
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      toast.error('Error al subir la imagen');
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('messaging-media')
      .getPublicUrl(path);

    return urlData.publicUrl;
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remainingSlots = maxImages - images.length;

    if (fileArray.length > remainingSlots) {
      toast.error(`Solo puedes agregar ${remainingSlots} imagen(es) más`);
      return;
    }

    setIsUploading(true);
    const newUrls: string[] = [];

    for (const file of fileArray) {
      const url = await uploadFile(file);
      if (url) {
        newUrls.push(url);
      }
    }

    if (newUrls.length > 0) {
      onImagesChange([...images, ...newUrls]);
      toast.success(`${newUrls.length} imagen(es) subida(s)`);
    }

    setIsUploading(false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (indexToRemove: number) => {
    onImagesChange(images.filter((_, index) => index !== indexToRemove));
  };

  const canAddMore = images.length < maxImages;

  return (
    <div className="space-y-3">
      <Label>Imágenes (opcional)</Label>
      
      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, index) => (
            <div 
              key={index} 
              className="relative group w-20 h-20 rounded-lg overflow-hidden border border-border"
            >
              <img 
                src={url} 
                alt={`Imagen ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {canAddMore && (
        <div
          className={`
            border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
            ${dragActive 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
            }
            ${isUploading ? 'pointer-events-none opacity-50' : ''}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {isUploading ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Subiendo...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="p-2 rounded-full bg-muted">
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  Arrastra imágenes o haz clic para seleccionar
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPG, PNG o WEBP • Máx. 5MB • {images.length}/{maxImages} imágenes
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {!canAddMore && (
        <p className="text-xs text-muted-foreground">
          Has alcanzado el límite de {maxImages} imágenes
        </p>
      )}
    </div>
  );
};
