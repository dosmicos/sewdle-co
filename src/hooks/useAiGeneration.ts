import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GenerationRequest {
  mode: string;
  prompt: string;
  organization_id: string;
  seed_image_ids?: string[];
  template_id?: string;
  skill_id?: string;
  parameters?: Record<string, any>;
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

      const { data, error: invokeError } = await supabase.functions.invoke('generate-ai-image', {
        body: request,
      });

      if (invokeError) {
        throw invokeError;
      }

      // The edge function may return an error inside data
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

  const clearResult = () => {
    setResult(null);
    setError(null);
  };

  return { generating, result, error, generate, downloadImage, clearResult };
};
