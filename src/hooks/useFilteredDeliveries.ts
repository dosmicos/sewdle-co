
import { useState, useEffect } from 'react';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useUserContext } from '@/hooks/useUserContext';

export const useFilteredDeliveries = () => {
  const { fetchDeliveries, loading } = useDeliveries();
  const { workshopFilter, isWorkshopUser } = useUserContext();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [error, setError] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const loadDeliveries = async () => {
    try {
      console.log('[Deliveries] Cargando entregas...', { isWorkshopUser, workshopFilter });
      const data = await fetchDeliveries();

      console.log(`[Deliveries] RPC retornó ${data.length} entregas`);

      if (data.length === 0) {
        console.warn('[Deliveries] 0 entregas retornadas. Posible problema con get_current_organization_safe() retornando NULL.');
        setDebugInfo('La consulta retornó 0 entregas. Esto puede indicar un problema con la organización del usuario.');
      } else {
        setDebugInfo(null);
      }

      if (isWorkshopUser && workshopFilter) {
        const workshopDeliveries = data.filter(delivery =>
          delivery.workshop_id === workshopFilter
        );
        console.log(`[Deliveries] Filtro workshop: ${workshopDeliveries.length}/${data.length}`);
        if (workshopDeliveries.length === 0 && data.length > 0) {
          console.warn(`[Deliveries] Workshop filter ${workshopFilter} no coincide con ninguna entrega`);
          setDebugInfo(`Hay ${data.length} entregas pero ninguna coincide con tu taller asignado.`);
        }
        setDeliveries(workshopDeliveries);
      } else {
        setDeliveries(data);
      }
      setError(null);
    } catch (err) {
      console.error('[Deliveries] Error cargando entregas:', err);
      setError(err);
      setDeliveries([]);
      setDebugInfo(null);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, [isWorkshopUser, workshopFilter]);

  return {
    deliveries,
    loading,
    error,
    debugInfo,
    createDelivery: () => Promise.resolve(), // Placeholder
    updateDelivery: () => Promise.resolve(), // Placeholder
    deleteDelivery: () => Promise.resolve(), // Placeholder
    refetch: loadDeliveries
  };
};
