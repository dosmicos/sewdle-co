import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface AiSkill {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  prompt: string;
  category: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  seed_image_ids: string[];
}

export const useAiSkills = () => {
  const [skills, setSkills] = useState<AiSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const orgId = currentOrganization?.id;

  const fetchSkills = useCallback(async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      setError(null);

      const { data: skillsData, error: skillsError } = await (supabase.from('ai_skills' as any) as any)
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (skillsError) throw skillsError;

      const skillsList = (skillsData || []) as any[];

      // Fetch seed image associations for all skills
      const skillIds = skillsList.map(s => s.id);
      let seedMap: Record<string, string[]> = {};

      if (skillIds.length > 0) {
        const { data: seedData, error: seedError } = await (supabase.from('ai_skill_seeds' as any) as any)
          .select('skill_id, seed_image_id')
          .in('skill_id', skillIds);
        if (seedError) throw seedError;

        for (const row of (seedData || []) as any[]) {
          if (!seedMap[row.skill_id]) seedMap[row.skill_id] = [];
          seedMap[row.skill_id].push(row.seed_image_id);
        }
      }

      const enrichedSkills: AiSkill[] = skillsList.map(skill => ({
        ...skill,
        seed_image_ids: seedMap[skill.id] || [],
      }));

      setSkills(enrichedSkills);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const createSkill = async (
    data: { name: string; description?: string; prompt: string; category?: string; is_active?: boolean },
    seedImageIds: string[] = []
  ) => {
    if (!orgId) return;
    const { data: inserted, error: insertError } = await (supabase.from('ai_skills' as any) as any)
      .insert({
        organization_id: orgId,
        created_by: user?.id || null,
        name: data.name,
        description: data.description || null,
        prompt: data.prompt,
        category: data.category || null,
        is_active: data.is_active !== undefined ? data.is_active : true,
      })
      .select('id')
      .single();
    if (insertError) {
      toast({ title: 'Error', description: insertError.message, variant: 'destructive' });
      return;
    }

    if (seedImageIds.length > 0 && inserted) {
      const junctionRows = seedImageIds.map(seedId => ({
        skill_id: (inserted as any).id,
        seed_image_id: seedId,
      }));
      const { error: junctionError } = await (supabase.from('ai_skill_seeds' as any) as any).insert(junctionRows);
      if (junctionError) {
        console.error('Error linking seed images:', junctionError);
      }
    }

    toast({ title: 'Skill creado', description: `"${data.name}" creado correctamente` });
    fetchSkills();
  };

  const updateSkill = async (
    id: string,
    data: { name?: string; description?: string; prompt?: string; category?: string; is_active?: boolean },
    seedImageIds?: string[]
  ) => {
    const { error: updateError } = await (supabase.from('ai_skills' as any) as any)
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (updateError) {
      toast({ title: 'Error', description: updateError.message, variant: 'destructive' });
      return;
    }

    if (seedImageIds !== undefined) {
      // Delete old junction rows
      await (supabase.from('ai_skill_seeds' as any) as any).delete().eq('skill_id', id);

      // Insert new junction rows
      if (seedImageIds.length > 0) {
        const junctionRows = seedImageIds.map(seedId => ({
          skill_id: id,
          seed_image_id: seedId,
        }));
        const { error: junctionError } = await (supabase.from('ai_skill_seeds' as any) as any).insert(junctionRows);
        if (junctionError) {
          console.error('Error linking seed images:', junctionError);
        }
      }
    }

    toast({ title: 'Actualizado', description: 'Skill actualizado correctamente' });
    fetchSkills();
  };

  const deleteSkill = async (id: string) => {
    // Delete junction rows first
    await (supabase.from('ai_skill_seeds' as any) as any).delete().eq('skill_id', id);

    const { error: deleteError } = await (supabase.from('ai_skills' as any) as any).delete().eq('id', id);
    if (deleteError) {
      toast({ title: 'Error', description: deleteError.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Eliminado', description: 'Skill eliminado correctamente' });
    fetchSkills();
  };

  return { skills, loading, error, refetch: fetchSkills, createSkill, updateSkill, deleteSkill };
};
