import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

interface AiImageGeneration {
  id: string;
  organization_id: string;
  mode: string;
  prompt: string;
  result_url: string | null;
  status: string;
  error_message: string | null;
  metadata: Record<string, any> | null;
  created_by: string | null;
  created_at: string;
}

interface HistoryFilters {
  mode?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const useGenerationHistory = (filters?: HistoryFilters) => {
  const [generations, setGenerations] = useState<AiImageGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const fetchHistory = useCallback(async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      setError(null);

      let query = (supabase.from('ai_image_generations' as any) as any)
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters?.mode) {
        query = query.eq('mode', filters.mode);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setGenerations((data || []) as AiImageGeneration[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orgId, filters?.mode, filters?.dateFrom, filters?.dateTo]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return { generations, loading, error, refetch: fetchHistory };
};
