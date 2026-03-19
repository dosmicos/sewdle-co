import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface SavedPrompt {
  id: string;
  organization_id: string;
  name: string;
  prompt: string;
  category: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useSavedPrompts = () => {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const orgId = currentOrganization?.id;

  const fetchPrompts = useCallback(async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await (supabase.from('ai_saved_prompts' as any) as any)
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setPrompts((data || []) as SavedPrompt[]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchPrompts(); }, [fetchPrompts]);

  const createPrompt = async (name: string, prompt: string, category?: string) => {
    if (!orgId) return;
    const { error: insertError } = await (supabase.from('ai_saved_prompts' as any) as any).insert({
      organization_id: orgId,
      created_by: user?.id || null,
      name,
      prompt,
      category: category || null,
    });
    if (insertError) {
      toast({ title: 'Error', description: insertError.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Prompt guardado', description: `"${name}" creado correctamente` });
    fetchPrompts();
  };

  const updatePrompt = async (id: string, updates: { name?: string; prompt?: string; category?: string }) => {
    const { error: updateError } = await (supabase.from('ai_saved_prompts' as any) as any)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (updateError) {
      toast({ title: 'Error', description: updateError.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Actualizado', description: 'Prompt actualizado correctamente' });
    fetchPrompts();
  };

  const deletePrompt = async (id: string) => {
    const { error: deleteError } = await (supabase.from('ai_saved_prompts' as any) as any)
      .delete()
      .eq('id', id);
    if (deleteError) {
      toast({ title: 'Error', description: deleteError.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Eliminado', description: 'Prompt eliminado correctamente' });
    fetchPrompts();
  };

  const duplicatePrompt = async (id: string) => {
    const original = prompts.find(p => p.id === id);
    if (!original) return;
    await createPrompt(
      `${original.name} (copia)`,
      original.prompt,
      original.category || undefined
    );
  };

  return { prompts, loading, error, refetch: fetchPrompts, createPrompt, updatePrompt, deletePrompt, duplicatePrompt };
};
