
import { useState, useEffect, useCallback, useRef } from 'react';
import { useOrderDeliveryStats } from '@/hooks/useOrderDeliveryStats';

interface OrderStats {
  totalOrdered: number;
  totalApproved: number;
  totalPending: number;
  completionPercentage: number;
}

interface CachedStats {
  stats: OrderStats;
  timestamp: number;
  loading: boolean;
  error: string | null;
}

// Cache global para evitar re-llamadas
const statsCache = new Map<string, CachedStats>();
const CACHE_DURATION = 30000; // 30 segundos
const DEBOUNCE_DELAY = 100; // 100ms

export const useOptimizedOrderStats = (orderId: string) => {
  const [stats, setStats] = useState<OrderStats>({
    totalOrdered: 0,
    totalApproved: 0,
    totalPending: 0,
    completionPercentage: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getOrderStats } = useOrderDeliveryStats();
  const debounceRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  // Función estabilizada para obtener estadísticas
  const fetchStatsWithCache = useCallback(async (id: string) => {
    if (!id) {
      setLoading(false);
      setError(null);
      return;
    }

    // Verificar cache
    const cached = statsCache.get(id);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      setStats(cached.stats);
      setLoading(cached.loading);
      setError(cached.error);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Cancelar solicitud anterior si existe
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      // Timeout para evitar solicitudes colgadas
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, 10000); // 10 segundos timeout

      const orderStats = await getOrderStats(id);
      
      clearTimeout(timeoutId);

      if (orderStats) {
        const newStats = {
          totalOrdered: orderStats.total_ordered || 0,
          totalApproved: orderStats.total_approved || 0,
          totalPending: orderStats.total_pending || 0,
          completionPercentage: orderStats.completion_percentage || 0
        };

        setStats(newStats);
        
        // Guardar en cache
        statsCache.set(id, {
          stats: newStats,
          timestamp: now,
          loading: false,
          error: null
        });
      } else {
        // Usar valores por defecto si no hay datos
        const defaultStats = {
          totalOrdered: 0,
          totalApproved: 0,
          totalPending: 0,
          completionPercentage: 0
        };
        setStats(defaultStats);
        
        // Guardar en cache con valores por defecto
        statsCache.set(id, {
          stats: defaultStats,
          timestamp: now,
          loading: false,
          error: null
        });
      }
    } catch (err: any) {
      console.error('Error fetching order stats:', err);
      
      // Usar valores por defecto si hay error
      const defaultStats = {
        totalOrdered: 0,
        totalApproved: 0,
        totalPending: 0,
        completionPercentage: 0
      };
      
      // Si hay datos en cache, usarlos como fallback
      const cached = statsCache.get(id);
      if (cached && cached.stats) {
        setStats(cached.stats);
      } else {
        setStats(defaultStats);
      }
      
      setError('Error al cargar estadísticas');
      
      // Guardar error en cache para evitar re-llamadas inmediatas
      statsCache.set(id, {
        stats: cached?.stats || defaultStats,
        timestamp: now,
        loading: false,
        error: 'Error al cargar estadísticas'
      });
    } finally {
      setLoading(false);
    }
  }, [getOrderStats]);

  // Debounced fetch para evitar llamadas múltiples
  const debouncedFetch = useCallback((id: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchStatsWithCache(id);
    }, DEBOUNCE_DELAY);
  }, [fetchStatsWithCache]);

  useEffect(() => {
    debouncedFetch(orderId);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [orderId, debouncedFetch]);

  // Función para limpiar cache si es necesario
  const clearCache = useCallback((id?: string) => {
    if (id) {
      statsCache.delete(id);
    } else {
      statsCache.clear();
    }
  }, []);

  return { stats, loading, error, clearCache };
};
