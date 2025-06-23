
import { useState, useEffect } from 'react';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useUserContext } from '@/hooks/useUserContext';

export const useFilteredDeliveries = () => {
  const { deliveries, loading, error, createDelivery, updateDelivery, deleteDelivery, refetch } = useDeliveries();
  const { workshopFilter, isWorkshopUser } = useUserContext();
  const [filteredDeliveries, setFilteredDeliveries] = useState<any[]>([]);

  useEffect(() => {
    if (!deliveries) {
      setFilteredDeliveries([]);
      return;
    }

    if (isWorkshopUser && workshopFilter) {
      // Filtrar entregas del taller del usuario
      const workshopDeliveries = deliveries.filter(delivery => 
        delivery.workshop_id === workshopFilter
      );
      setFilteredDeliveries(workshopDeliveries);
    } else {
      // Admin ve todas las entregas
      setFilteredDeliveries(deliveries);
    }
  }, [deliveries, isWorkshopUser, workshopFilter]);

  return {
    deliveries: filteredDeliveries,
    loading,
    error,
    createDelivery,
    updateDelivery,
    deleteDelivery,
    refetch
  };
};
