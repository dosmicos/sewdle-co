
import { useState, useEffect, useCallback } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { useUserContext } from '@/hooks/useUserContext';

export const useFilteredOrders = () => {
  const { createOrder, fetchOrders, loading } = useOrders();
  const { workshopFilter, isWorkshopUser } = useUserContext();
  const [orders, setOrders] = useState<unknown[]>([]);
  const [error, setError] = useState<unknown>(null);

  const loadOrders = useCallback(async () => {
    try {
      const data = await fetchOrders();
      
      if (isWorkshopUser && workshopFilter) {
        // Filtrar órdenes asignadas al taller del usuario
        const workshopOrders = data.filter(order => {
          return order.workshop_assignments?.some((assignment: unknown) => 
            assignment.workshop_id === workshopFilter
          );
        });
        setOrders(workshopOrders);
      } else {
        // Admin ve todas las órdenes
        setOrders(data);
      }
      setError(null);
    } catch (err) {
      setError(err);
      setOrders([]);
    }
  }, [fetchOrders, isWorkshopUser, workshopFilter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  return {
    orders,
    loading,
    error,
    createOrder,
    updateOrder: () => Promise.resolve(), // Placeholder
    deleteOrder: () => Promise.resolve(), // Placeholder
    refetch: loadOrders
  };
};
