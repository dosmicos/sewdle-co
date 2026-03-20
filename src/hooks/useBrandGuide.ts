import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface BrandGuide {
  id: string;
  organization_id: string;
  brand_name: string | null;
  tagline: string | null;
  brand_voice: string | null;
  brand_tone: string | null;
  target_audience: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  colors: { hex: string; name: string; usage: string }[];
  fonts: { heading?: string; body?: string };
  logo_url: string | null;
  product_image_urls: string[];
  mood_keywords: string[];
  visual_style: string | null;
  do_list: string[];
  dont_list: string[];
  prompt_prefix: string | null;
  source: 'auto' | 'manual';
  extraction_status: 'pending' | 'extracting' | 'complete' | 'failed';
  last_extracted_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useBrandGuide = () => {
  const [brandGuide, setBrandGuide] = useState<BrandGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchBrandGuide = useCallback(async () => {
    const orgId = currentOrganization?.id;
    if (!orgId) return;
    try {
      setLoading(true);

      const { data, error } = await (supabase.from('brand_guides' as any) as any)
        .select('*')
        .eq('organization_id', orgId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      setBrandGuide((data as BrandGuide) || null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => { fetchBrandGuide(); }, [fetchBrandGuide]);

  const extractBrand = useCallback(async () => {
    const orgId = currentOrganization?.id;
    if (!orgId) return;
    try {
      setExtracting(true);

      const { data, error } = await supabase.functions.invoke('extract-brand', {
        body: {},
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({ title: 'Marca extraida', description: 'La guia de marca se extrajo correctamente' });
      await fetchBrandGuide();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Error al extraer la marca', variant: 'destructive' });
    } finally {
      setExtracting(false);
    }
  }, [currentOrganization?.id, fetchBrandGuide]);

  const updateBrandGuide = useCallback(async (updates: Partial<BrandGuide>) => {
    if (!brandGuide?.id) return;
    try {
      const { error: updateError } = await (supabase.from('brand_guides' as any) as any)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', brandGuide.id);

      if (updateError) throw updateError;

      toast({ title: 'Actualizado', description: 'Guia de marca actualizada correctamente' });
      await fetchBrandGuide();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }, [brandGuide?.id, fetchBrandGuide]);

  const getPromptPrefix = useCallback((): string | null => {
    if (brandGuide?.extraction_status === 'complete') {
      return brandGuide?.prompt_prefix || null;
    }
    return null;
  }, [brandGuide]);

  return { brandGuide, loading, extracting, fetchBrandGuide, extractBrand, updateBrandGuide, getPromptPrefix };
};
