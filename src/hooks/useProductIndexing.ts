import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface IndexingStats {
  totalIndexed: number;
  queueStats: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  lastIndexedAt: Date | null;
}

export const useProductIndexing = (organizationId?: string) => {
  // Query product_embeddings count using raw SQL via analytics
  const { data: embeddingsData, isLoading: isLoadingEmbeddings, refetch: refetchEmbeddings } = useQuery({
    queryKey: ['product-embeddings-count', organizationId],
    queryFn: async () => {
      if (!organizationId) return { count: 0, lastIndexedAt: null };
      
      try {
        // Try to query the table - will fail gracefully if table doesn't exist
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || 'https://ysdcsqsfnckeuafjyrbc.supabase.co'}/rest/v1/product_embeddings?organization_id=eq.${organizationId}&select=updated_at&order=updated_at.desc&limit=1`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZGNzcXNmbmNrZXVhZmp5cmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NzQyODksImV4cCI6MjA2NTM1MDI4OX0.LA-Z6t1uSQrVvZsPimxy65uPSEAf3sOHzOQD_zdt-mI',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
              'Prefer': 'count=exact'
            }
          }
        );
        
        if (!response.ok) {
          console.log('product_embeddings table not accessible');
          return { count: 0, lastIndexedAt: null };
        }

        const contentRange = response.headers.get('content-range');
        const count = contentRange ? parseInt(contentRange.split('/')[1] || '0') : 0;
        
        const data = await response.json();
        const lastIndexedAt = data?.[0]?.updated_at ? new Date(data[0].updated_at) : null;

        return { count, lastIndexedAt };
      } catch (error) {
        console.error('Error fetching embeddings:', error);
        return { count: 0, lastIndexedAt: null };
      }
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 2,
  });

  // Query product_indexing_queue stats
  const { data: queueData, isLoading: isLoadingQueue, refetch: refetchQueue } = useQuery({
    queryKey: ['product-indexing-queue', organizationId],
    queryFn: async () => {
      if (!organizationId) return { pending: 0, processing: 0, completed: 0, failed: 0 };

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || 'https://ysdcsqsfnckeuafjyrbc.supabase.co'}/rest/v1/product_indexing_queue?organization_id=eq.${organizationId}&select=status`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzZGNzcXNmbmNrZXVhZmp5cmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3NzQyODksImV4cCI6MjA2NTM1MDI4OX0.LA-Z6t1uSQrVvZsPimxy65uPSEAf3sOHzOQD_zdt-mI',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            }
          }
        );

        if (!response.ok) {
          console.log('product_indexing_queue table not accessible');
          return { pending: 0, processing: 0, completed: 0, failed: 0 };
        }

        const data = await response.json();
        
        const stats = {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0
        };

        for (const item of data || []) {
          const status = item.status as keyof typeof stats;
          if (status in stats) {
            stats[status]++;
          }
        }

        return stats;
      } catch (error) {
        console.error('Error fetching queue stats:', error);
        return { pending: 0, processing: 0, completed: 0, failed: 0 };
      }
    },
    enabled: !!organizationId,
    staleTime: 1000 * 30,
  });

  const refetchAll = async () => {
    await Promise.all([refetchEmbeddings(), refetchQueue()]);
  };

  const stats: IndexingStats = {
    totalIndexed: embeddingsData?.count || 0,
    queueStats: queueData || { pending: 0, processing: 0, completed: 0, failed: 0 },
    lastIndexedAt: embeddingsData?.lastIndexedAt || null
  };

  return {
    stats,
    isLoading: isLoadingEmbeddings || isLoadingQueue,
    refetch: refetchAll
  };
};
