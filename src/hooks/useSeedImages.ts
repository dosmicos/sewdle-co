import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface SeedImage {
  id: string;
  organization_id: string;
  type: 'product' | 'advertising';
  name: string;
  image_url: string;
  category: string | null;
  created_by: string | null;
  created_at: string;
}

export const useSeedImages = (type?: 'product' | 'advertising') => {
  const [seedImages, setSeedImages] = useState<SeedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const orgId = currentOrganization?.id;

  const fetchSeedImages = useCallback(async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      setError(null);
      let query = (supabase.from('ai_seed_images' as any) as any)
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (type) query = query.eq('type', type);
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setSeedImages((data || []) as SeedImage[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orgId, type]);

  useEffect(() => { fetchSeedImages(); }, [fetchSeedImages]);

  const uploadSeedImage = async (file: File, seedType: 'product' | 'advertising'): Promise<string | null> => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({ title: 'Error', description: 'Solo se permiten archivos JPG, PNG o WEBP', variant: 'destructive' });
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Error', description: 'El archivo no puede superar 5MB', variant: 'destructive' });
      return null;
    }
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${seedType}s/${orgId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    const { data, error: uploadError } = await supabase.storage
      .from('publicidad-seeds')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });
    if (uploadError) {
      toast({ title: 'Error al subir', description: uploadError.message, variant: 'destructive' });
      return null;
    }
    const { data: urlData } = supabase.storage.from('publicidad-seeds').getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  const createSeedImage = async (data: { name: string; type: 'product' | 'advertising'; image_url: string; category?: string }) => {
    if (!orgId) return;
    const { error: insertError } = await (supabase.from('ai_seed_images' as any) as any).insert({
      organization_id: orgId,
      created_by: user?.id || null,
      ...data,
    });
    if (insertError) {
      toast({ title: 'Error', description: insertError.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Semilla creada', description: `"${data.name}" agregada correctamente` });
    fetchSeedImages();
  };

  const deleteSeedImage = async (id: string) => {
    const seed = seedImages.find(s => s.id === id);
    if (seed) {
      try {
        const path = new URL(seed.image_url).pathname.split('/publicidad-seeds/')[1];
        if (path) await supabase.storage.from('publicidad-seeds').remove([path]);
      } catch {}
    }
    const { error: deleteError } = await (supabase.from('ai_seed_images' as any) as any).delete().eq('id', id);
    if (deleteError) {
      toast({ title: 'Error', description: deleteError.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Eliminada', description: 'Imagen semilla eliminada' });
    fetchSeedImages();
  };

  return { seedImages, loading, error, refetch: fetchSeedImages, uploadSeedImage, createSeedImage, deleteSeedImage };
};
