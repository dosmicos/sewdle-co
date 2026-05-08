import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import type { UgcToolkitAssignment } from './useUgcToolkitAssignments';

export type CreatorIdeaFilter = 'all' | 'with' | 'none' | `idea:${string}`;

export interface UgcToolkitIdeaOption {
  label: string;
  count: number;
}

export const normalizeToolkitLabel = (label?: string | null) =>
  (label || 'Idea de contenido').trim() || 'Idea de contenido';

export const useUgcToolkitAssignmentsSummary = (creatorIds: string[]) => {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const uniqueCreatorIds = useMemo(
    () => Array.from(new Set(creatorIds.filter(Boolean))).sort(),
    [creatorIds]
  );

  const { data: assignments = [], isLoading, error } = useQuery({
    queryKey: ['ugc-toolkit-assignments-summary', orgId, uniqueCreatorIds.join(',')],
    queryFn: async () => {
      if (!orgId || uniqueCreatorIds.length === 0) return [];

      const { data, error: queryError } = await (supabase.from('ugc_toolkit_assignments' as any) as any)
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .in('creator_id', uniqueCreatorIds)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;
      return (data || []) as UgcToolkitAssignment[];
    },
    enabled: !!orgId && uniqueCreatorIds.length > 0,
  });

  const assignmentsByCreator = useMemo(() => {
    const map = new Map<string, UgcToolkitAssignment[]>();
    assignments.forEach((assignment) => {
      const current = map.get(assignment.creator_id) || [];
      current.push(assignment);
      map.set(assignment.creator_id, current);
    });
    return map;
  }, [assignments]);

  const ideaFilterOptions = useMemo<UgcToolkitIdeaOption[]>(() => {
    const creatorsByLabel = new Map<string, Set<string>>();

    assignments.forEach((assignment) => {
      const label = normalizeToolkitLabel(assignment.label);
      const creatorSet = creatorsByLabel.get(label) || new Set<string>();
      creatorSet.add(assignment.creator_id);
      creatorsByLabel.set(label, creatorSet);
    });

    return Array.from(creatorsByLabel.entries())
      .map(([label, creators]) => ({ label, count: creators.size }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [assignments]);

  const withIdeasCount = useMemo(
    () => uniqueCreatorIds.filter((creatorId) => (assignmentsByCreator.get(creatorId)?.length || 0) > 0).length,
    [assignmentsByCreator, uniqueCreatorIds]
  );

  const withoutIdeasCount = Math.max(uniqueCreatorIds.length - withIdeasCount, 0);

  return {
    assignments,
    assignmentsByCreator,
    ideaFilterOptions,
    ideaFilterStats: {
      withIdeas: withIdeasCount,
      withoutIdeas: withoutIdeasCount,
    },
    isLoading,
    error,
  };
};
