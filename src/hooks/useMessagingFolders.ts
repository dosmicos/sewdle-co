import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MessagingFolder {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export const useMessagingFolders = () => {
  const queryClient = useQueryClient();

  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['messaging-folders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messaging_folders')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as MessagingFolder[];
    },
  });

  // Count conversations per folder
  const { data: folderCounts = {} } = useQuery({
    queryKey: ['messaging-folder-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messaging_conversations')
        .select('folder_id')
        .not('folder_id', 'is', null);

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((conv: { folder_id: string | null }) => {
        if (conv.folder_id) {
          counts[conv.folder_id] = (counts[conv.folder_id] || 0) + 1;
        }
      });
      return counts;
    },
  });

  const createFolder = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      // Get organization_id from an existing channel (same pattern as other messaging hooks)
      const { data: channel } = await supabase
        .from('messaging_channels')
        .select('organization_id')
        .limit(1)
        .single();

      if (!channel) throw new Error('No hay organización configurada');

      const { data, error } = await supabase
        .from('messaging_folders')
        .insert({
          organization_id: channel.organization_id,
          name,
          color,
          sort_order: folders.length,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging-folders'] });
      toast.success('Carpeta creada');
    },
    onError: (error: unknown) => {
      toast.error(`Error al crear carpeta: ${error.message}`);
    },
  });

  const deleteFolder = useMutation({
    mutationFn: async (folderId: string) => {
      const { error } = await supabase
        .from('messaging_folders')
        .delete()
        .eq('id', folderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging-folders'] });
      queryClient.invalidateQueries({ queryKey: ['messaging-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messaging-folder-counts'] });
      toast.success('Carpeta eliminada');
    },
    onError: (error: unknown) => {
      toast.error(`Error al eliminar carpeta: ${error.message}`);
    },
  });

  const moveToFolder = useMutation({
    mutationFn: async ({ conversationId, folderId }: { conversationId: string; folderId: string | null }) => {
      const { error } = await supabase
        .from('messaging_conversations')
        .update({ folder_id: folderId })
        .eq('id', conversationId);

      if (error) throw error;
    },
    onMutate: async ({ conversationId, folderId }) => {
      await queryClient.cancelQueries({ queryKey: ['messaging-conversations'] });
      const previous = queryClient.getQueryData(['messaging-conversations']);

      // Optimistic update across all query keys matching messaging-conversations
      queryClient.setQueriesData(
        { queryKey: ['messaging-conversations'] },
        (old: unknown[] | undefined) => {
          if (!old) return old;
          return old.map((c: unknown) =>
            c.id === conversationId ? { ...c, folder_id: folderId } : c
          );
        }
      );

      return { previous };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messaging-folder-counts'] });
    },
    onError: (error: unknown, _, context) => {
      if (context?.previous) {
        queryClient.setQueriesData({ queryKey: ['messaging-conversations'] }, context.previous);
      }
      toast.error(`Error al mover conversación: ${error.message}`);
    },
  });

  return {
    folders,
    folderCounts,
    isLoading,
    createFolder: createFolder.mutate,
    isCreatingFolder: createFolder.isPending,
    deleteFolder: deleteFolder.mutate,
    isDeletingFolder: deleteFolder.isPending,
    moveToFolder: moveToFolder.mutate,
  };
};
