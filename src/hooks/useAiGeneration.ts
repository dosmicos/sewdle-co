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
}

interface GenerationResult {
  image_url: string;
  generation_id: string;
  generations_today: number;
}

export const useAiGeneration = () => {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generate = async (request: GenerationRequest) => {
    try {
      setGenerating(true);
      setError(null);
      setResult(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('No estás autenticado. Inicia sesión de nuevo.');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-ai-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || `Error ${response.status}`);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const generationResult: GenerationResult = {
        image_url: data.image_url,
        generation_id: data.generation_id,
        generations_today: data.generations_today,
      };

      setResult(generationResult);
      toast({ title: 'Imagen generada', description: 'Tu imagen ha sido creada exitosamente' });
      return generationResult;
    } catch (err: any) {
      const message = err.message || 'Error al generar la imagen';
      setError(message);
      toast({ title: 'Error de generación', description: message, variant: 'destructive' });
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const downloadImage = async (url: string, filename?: string) => {
    try {
      const response = await fetch(url);
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
    setResult(null);
    setError(null);
  };

  const handleDownload = () => {
    if (result?.image_url) {
      downloadImage(result.image_url);
    }
  };

  const generatedImageUrl = result?.image_url || null;
  const rateLimitUsed = result?.generations_today || 0;
  const rateLimitMax = 50;

  return { generating, result, error, generate, downloadImage: handleDownload, clearImage, generatedImageUrl, rateLimitUsed, rateLimitMax };
};
