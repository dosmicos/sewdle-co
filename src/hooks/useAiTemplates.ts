import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

interface AiTemplate {
  id: string;
  name: string;
  prompt_base: string;
  category: 'product' | 'advertising';
  resolution: string;
  dimensions: string | null;
  is_active: boolean;
  sort_order: number;
  organization_id: string | null;
  created_at: string;
}

export const useAiTemplates = (category?: string) => {
  const [templates, setTemplates] = useState<AiTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const fetchTemplates = useCallback(async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      setError(null);
      let query = (supabase.from('ai_templates' as any) as any)
        .select('*')
        .eq('is_active', true)
        .or(`organization_id.eq.${orgId},organization_id.is.null`)
        .order('sort_order', { ascending: true });
      if (category) query = query.eq('category', category);
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setTemplates((data || []) as AiTemplate[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orgId, category]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  return { templates, loading, error, refetch: fetchTemplates };
};
