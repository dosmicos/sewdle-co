import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { DEFAULT_EVENT_CATEGORIES } from '@/lib/marketingEventCategories';

export interface MarketingEventCategory {
  id: string;
  organization_id: string;
  key: string;
  label: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  is_builtin: boolean;
}

export type NewCategory = { label: string; color: string };
export type CategoryPatch = Partial<Pick<MarketingEventCategory, 'label' | 'color' | 'is_active' | 'sort_order'>>;

function slugify(label: string): string {
  const base = (label || 'tipo')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  // Suffix keeps the key unique per org even for duplicate labels.
  const suffix = Math.random().toString(36).slice(2, 7);
  return `custom_${base || 'tipo'}_${suffix}`;
}

export function useMarketingEventCategories() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();
  const queryKey = ['marketing-event-categories', orgId];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<MarketingEventCategory[]> => {
      const { data, error } = await supabase
        .from('marketing_event_categories')
        .select('*')
        .eq('organization_id', orgId!)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;

      let rows = (data as unknown as MarketingEventCategory[]) || [];

      // Defensive seed: an org with no categories (e.g. created after the
      // backfill migration) gets the built-ins so the calendar isn't blank.
      if (rows.length === 0 && orgId) {
        const seed = DEFAULT_EVENT_CATEGORIES.map((d, i) => ({
          organization_id: orgId,
          key: d.key,
          label: d.label,
          color: d.color,
          sort_order: i,
          is_builtin: true,
          is_active: true,
        }));
        const { data: seeded, error: seedErr } = await supabase
          .from('marketing_event_categories')
          .insert(seed)
          .select('*');
        if (!seedErr && seeded) rows = seeded as unknown as MarketingEventCategory[];
      }

      return rows;
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 5,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    // Colors/labels also render on the calendar — refresh events consumers.
    queryClient.invalidateQueries({ queryKey: ['marketing-events', orgId] });
  };

  const addMutation = useMutation({
    mutationFn: async (input: NewCategory) => {
      if (!orgId) throw new Error('No organization');
      const existing = query.data || [];
      const nextOrder = existing.reduce((m, c) => Math.max(m, c.sort_order), -1) + 1;
      const { error } = await supabase.from('marketing_event_categories').insert({
        organization_id: orgId,
        key: slugify(input.label),
        label: input.label.trim() || 'Nuevo tipo',
        color: input.color,
        sort_order: nextOrder,
        is_builtin: false,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: CategoryPatch }) => {
      const { error } = await supabase
        .from('marketing_event_categories')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: async (category: MarketingEventCategory) => {
      if (!orgId) throw new Error('No organization');
      if (category.is_builtin) {
        throw new Error('Los tipos predeterminados no se pueden eliminar; puedes ocultarlos.');
      }
      // Reassign events of this type to 'other' so they don't lose their color
      // mapping (resolver would fall back to gray, but keep data consistent).
      await supabase
        .from('marketing_events')
        .update({ event_type: 'other' })
        .eq('organization_id', orgId)
        .eq('event_type', category.key);
      const { error } = await supabase
        .from('marketing_event_categories')
        .delete()
        .eq('id', category.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Swap sort_order with the neighbour in the given direction. */
  const reorderMutation = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: 'up' | 'down' }) => {
      const list = [...(query.data || [])].sort((a, b) => a.sort_order - b.sort_order);
      const idx = list.findIndex((c) => c.id === id);
      if (idx === -1) return;
      const swapWith = direction === 'up' ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= list.length) return;
      const a = list[idx];
      const b = list[swapWith];
      await Promise.all([
        supabase.from('marketing_event_categories').update({ sort_order: b.sort_order }).eq('id', a.id),
        supabase.from('marketing_event_categories').update({ sort_order: a.sort_order }).eq('id', b.id),
      ]);
    },
    onSuccess: invalidate,
  });

  const all = query.data || [];

  return {
    categories: all,
    activeCategories: all.filter((c) => c.is_active),
    isLoading: query.isLoading,
    addCategory: addMutation.mutateAsync,
    updateCategory: updateMutation.mutateAsync,
    removeCategory: removeMutation.mutateAsync,
    reorderCategory: reorderMutation.mutateAsync,
    isMutating:
      addMutation.isPending ||
      updateMutation.isPending ||
      removeMutation.isPending ||
      reorderMutation.isPending,
  };
}
