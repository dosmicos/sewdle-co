
import { useOptimizedOrderStats } from '@/hooks/useOptimizedOrderStats';

export const useOrderStats = (orderId: string) => {
  return useOptimizedOrderStats(orderId);
};
