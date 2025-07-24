
import { useState, useEffect } from 'react';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useUserContext } from '@/hooks/useUserContext';

export const useFilteredDeliveries = () => {
  const { fetchDeliveries, loading } = useDeliveries();
  const { workshopFilter, isWorkshopUser } = useUserContext();
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [error, setError] = useState<any>(null);

  const loadDeliveries = async () => {
    try {
      // Fetch deliveries with sync status information
      const data = await fetchDeliveries();
      
      if (isWorkshopUser && workshopFilter) {
        // Filtrar entregas del taller del usuario
        const workshopDeliveries = data.filter(delivery => 
          delivery.workshop_id === workshopFilter
        );
        setDeliveries(workshopDeliveries);
      } else {
        // Admin ve todas las entregas
        setDeliveries(data);
      }
      setError(null);
    } catch (err) {
      setError(err);
      setDeliveries([]);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, [isWorkshopUser, workshopFilter]);

  return {
    deliveries,
    loading,
    error,
    createDelivery: () => Promise.resolve(), // Placeholder
    updateDelivery: () => Promise.resolve(), // Placeholder
    deleteDelivery: () => Promise.resolve(), // Placeholder
    refetch: loadDeliveries
  };
};
