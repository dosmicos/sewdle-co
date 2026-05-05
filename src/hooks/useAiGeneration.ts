import { useState } from 'react';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GenerationRequest {
  mode: string;
  prompt: string;
  seed_image_ids?: string[];
  template_id?: string;
  resolution?: string;
  base_image?: string;
  num_images?: number;
}

interface GeneratedImage {
  image_url: string;
  generation_id: string;
}

export const useAiGeneration = () => {
  const [generating, setGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [generationsToday, setGenerationsToday] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generate = async (request: GenerationRequest) => {
    try {
      setGenerating(true);
      setError(null);
      setGeneratedImages([]);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('No estás autenticado. Inicia sesión de nuevo.');

      const numImages = request.num_images || 4;
      const results: GeneratedImage[] = [];
      let lastGenerationsToday = 0;

      // Generate multiple images in parallel
      const promises = Array.from({ length: numImages }, () =>
        fetch(`${SUPABASE_URL}/functions/v1/generate-ai-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(request),
        }).then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error || `Error ${response.status}`);
          if (data?.error) throw new Error(data.error);
          return data;
        })
      );

      const settled = await Promise.allSettled(promises);

      for (const result of settled) {
        if (result.status === 'fulfilled') {
          const data = result.value;
          results.push({
            image_url: data.image_url,
            generation_id: data.generation_id,
          });
          lastGenerationsToday = data.generations_today || lastGenerationsToday;
        }
      }

      if (results.length === 0) {
        throw new Error('No se pudo generar ninguna imagen. Intenta de nuevo.');
      }

      setGeneratedImages(results);
      setGenerationsToday(lastGenerationsToday);
      toast({
        title: 'Imágenes generadas',
        description: `Se generaron ${results.length} imagen(es) exitosamente`,
      });
      return results;
    } catch (err: any) {
      const message = err.message || 'Error al generar la imagen';
      setError(message);
      toast({ title: 'Error de generación', description: message, variant: 'destructive' });
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const downloadImage = async (url?: string, filename?: string) => {
    const imageUrl = url || generatedImages[0]?.image_url;
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || `publicidad-ia-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast({ title: 'Descargada', description: 'Imagen descargada correctamente' });
    } catch (err: any) {
      toast({ title: 'Error', description: 'No se pudo descargar la imagen', variant: 'destructive' });
    }
  };

  const clearImage = () => {
    setGeneratedImages([]);
    setError(null);
  };

  // Backward compat
  const generatedImageUrl = generatedImages[0]?.image_url || null;
  const rateLimitUsed = generationsToday;
  const rateLimitMax = 50;

  return {
    generating,
    generatedImages,
    generatedImageUrl,
    rateLimitUsed,
    rateLimitMax,
    error,
    generate,
    downloadImage,
    clearImage,
  };
};
