import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { getISOWeek, getYear, startOfISOWeek, addDays, format } from 'date-fns';

export type ContentType = 'reel' | 'carousel' | 'story' | 'static_post' | 'tiktok' | 'live' | 'ugc' | 'email' | 'blog';
export type Platform = 'instagram' | 'tiktok' | 'facebook' | 'email' | 'blog' | 'whatsapp';
export type ContentStatus = 'idea' | 'briefed' | 'in_production' | 'review' | 'approved' | 'scheduled' | 'published';

export interface ContentPiece {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  content_type: ContentType;
  platform: Platform;
  status: ContentStatus;
  assigned_to: string | null;
  assigned_user_name?: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  copy_text: string | null;
  hashtags: string[];
  assets_needed: string | null;
  assets_url: string | null;
  approval_notes: string | null;
  week_number: number;
  year: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ContentPieceInput = Omit<ContentPiece, 'id' | 'org_id' | 'created_by' | 'created_at' | 'updated_at' | 'assigned_user_name'>;

export interface ContentFilters {
  platform?: Platform | 'all';
  status?: ContentStatus | 'all';
  assigned_to?: string | 'all';
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
}

export const PLATFORM_CONFIG: Record<Platform, { label: string; color: string; bgColor: string }> = {
  instagram: { label: 'Instagram', color: '#E4405F', bgColor: '#FDE8EC' },
  tiktok: { label: 'TikTok', color: '#000000', bgColor: '#F0F0F0' },
  facebook: { label: 'Facebook', color: '#1877F2', bgColor: '#E7F0FD' },
  email: { label: 'Email', color: '#6366F1', bgColor: '#EEF2FF' },
  blog: { label: 'Blog', color: '#059669', bgColor: '#ECFDF5' },
  whatsapp: { label: 'WhatsApp', color: '#25D366', bgColor: '#E8FAF0' },
};

export const CONTENT_TYPE_CONFIG: Record<ContentType, { label: string; icon: string }> = {
  reel: { label: 'Reel', icon: '🎬' },
  carousel: { label: 'Carrusel', icon: '🎠' },
  story: { label: 'Story', icon: '📱' },
  static_post: { label: 'Post', icon: '🖼️' },
  tiktok: { label: 'TikTok', icon: '🎵' },
  live: { label: 'Live', icon: '🔴' },
  ugc: { label: 'UGC', icon: '👥' },
  email: { label: 'Email', icon: '📧' },
  blog: { label: 'Blog', icon: '📝' },
};

export const STATUS_CONFIG: Record<ContentStatus, { label: string; color: string; bgColor: string; dotColor: string }> = {
  idea: { label: 'Idea', color: '#6B7280', bgColor: '#F3F4F6', dotColor: '#9CA3AF' },
  briefed: { label: 'Briefed', color: '#2563EB', bgColor: '#DBEAFE', dotColor: '#3B82F6' },
  in_production: { label: 'En Producción', color: '#D97706', bgColor: '#FEF3C7', dotColor: '#F59E0B' },
  review: { label: 'Revisión', color: '#7C3AED', bgColor: '#EDE9FE', dotColor: '#8B5CF6' },
  approved: { label: 'Aprobado', color: '#059669', bgColor: '#D1FAE5', dotColor: '#10B981' },
  scheduled: { label: 'Programado', color: '#0891B2', bgColor: '#CFFAFE', dotColor: '#06B6D4' },
  published: { label: 'Publicado', color: '#047857', bgColor: '#A7F3D0', dotColor: '#34D399' },
};

export const CHAR_LIMITS: Partial<Record<Platform, number>> = {
  instagram: 2200,
  tiktok: 4000,
  facebook: 63206,
  whatsapp: 1024,
};

function getWeekDates(weekNumber: number, year: number): string[] {
  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = startOfISOWeek(jan4);
  const weekStart = addDays(startOfWeek1, (weekNumber - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));
}

export function useContentPlanner(weekNumber: number, year: number, filters: ContentFilters = {}) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const orgId = currentOrganization?.id;
  const queryClient = useQueryClient();

  const weekDates = getWeekDates(weekNumber, year);

  const query = useQuery({
    queryKey: ['content-pieces', orgId, weekNumber, year, filters],
    queryFn: async (): Promise<ContentPiece[]> => {
      let q = supabase
        .from('content_pieces')
        .select('*')
        .eq('org_id', orgId!)
        .eq('week_number', weekNumber)
        .eq('year', year)
        .order('scheduled_time', { ascending: true, nullsFirst: false });

      if (filters.platform && filters.platform !== 'all') {
        q = q.eq('platform', filters.platform);
      }
      if (filters.status && filters.status !== 'all') {
        q = q.eq('status', filters.status);
      }
      if (filters.assigned_to && filters.assigned_to !== 'all') {
        q = q.eq('assigned_to', filters.assigned_to);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as ContentPiece[]) || [];
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 2,
  });

  const teamQuery = useQuery({
    queryKey: ['team-members', orgId],
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase
        .rpc('get_organization_users_detailed');
      if (error) throw error;
      return (data || []).map((u: any) => ({
        id: u.id,
        name: u.name || u.email,
        email: u.email,
      }));
    },
    enabled: !!orgId,
    staleTime: 1000 * 60 * 10,
  });

  const addMutation = useMutation({
    mutationFn: async (input: ContentPieceInput) => {
      if (!orgId || !user) throw new Error('No organization or user');
      const { error } = await supabase
        .from('content_pieces')
        .insert({
          org_id: orgId,
          created_by: user.id,
          ...input,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-pieces', orgId, weekNumber, year] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ContentPieceInput> }) => {
      const { error } = await supabase
        .from('content_pieces')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-pieces', orgId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('content_pieces')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-pieces', orgId] });
    },
  });

  const moveToDate = useMutation({
    mutationFn: async ({ id, newDate }: { id: string; newDate: string }) => {
      const date = new Date(newDate + 'T00:00:00');
      const newWeek = getISOWeek(date);
      const newYear = getYear(date);
      const { error } = await supabase
        .from('content_pieces')
        .update({
          scheduled_date: newDate,
          week_number: newWeek,
          year: newYear,
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, newDate }) => {
      await queryClient.cancelQueries({ queryKey: ['content-pieces', orgId] });
      const previousPieces = queryClient.getQueryData<ContentPiece[]>(
        ['content-pieces', orgId, weekNumber, year, filters]
      );
      queryClient.setQueryData<ContentPiece[]>(
        ['content-pieces', orgId, weekNumber, year, filters],
        (old) => old?.map((p) => (p.id === id ? { ...p, scheduled_date: newDate } : p)) || []
      );
      return { previousPieces };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousPieces) {
        queryClient.setQueryData(
          ['content-pieces', orgId, weekNumber, year, filters],
          context.previousPieces
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['content-pieces', orgId] });
    },
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ContentStatus }) => {
      const { error } = await supabase
        .from('content_pieces')
        .update({ status } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['content-pieces', orgId] });
      const previousPieces = queryClient.getQueryData<ContentPiece[]>(
        ['content-pieces', orgId, weekNumber, year, filters]
      );
      queryClient.setQueryData<ContentPiece[]>(
        ['content-pieces', orgId, weekNumber, year, filters],
        (old) => old?.map((p) => (p.id === id ? { ...p, status } : p)) || []
      );
      return { previousPieces };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousPieces) {
        queryClient.setQueryData(
          ['content-pieces', orgId, weekNumber, year, filters],
          context.previousPieces
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['content-pieces', orgId] });
    },
  });

  // Contadores por status
  const statusCounts = (query.data || []).reduce<Record<ContentStatus, number>>(
    (acc, piece) => {
      acc[piece.status] = (acc[piece.status] || 0) + 1;
      return acc;
    },
    { idea: 0, briefed: 0, in_production: 0, review: 0, approved: 0, scheduled: 0, published: 0 }
  );

  // Agrupar por fecha
  const piecesByDate = weekDates.reduce<Record<string, ContentPiece[]>>((acc, date) => {
    acc[date] = (query.data || []).filter((p) => p.scheduled_date === date);
    return acc;
  }, {});

  return {
    pieces: query.data || [],
    piecesByDate,
    weekDates,
    statusCounts,
    isLoading: query.isLoading,
    teamMembers: teamQuery.data || [],
    addPiece: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    updatePiece: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deletePiece: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    moveToDate: moveToDate.mutateAsync,
    isMoving: moveToDate.isPending,
    changeStatus: changeStatus.mutateAsync,
    isChangingStatus: changeStatus.isPending,
  };
}

export function getCurrentWeekAndYear() {
  const now = new Date();
  return { week: getISOWeek(now), year: getYear(now) };
}
