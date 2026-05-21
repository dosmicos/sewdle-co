
import { useState, useEffect } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { useUserContext } from '@/hooks/useUserContext';
import { useStoreContext } from '@/contexts/StoreContext';

export const useFilteredOrders = () => {
  const { createOrder, fetchOrders, loading } = useOrders();
  const { workshopFilter, isWorkshopUser } = useUserContext();
  const { activeStoreId } = useStoreContext();
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState<any>(null);

  const loadOrders = async () => {
    try {
      let data = await fetchOrders();

      // Filter by active store (null = all stores)
      if (activeStoreId) {
        data = data.filter((order: any) => order.store_id === activeStoreId);
      }

      if (isWorkshopUser) {
        // Usuario de taller SIEMPRE debe quedar acotado a su taller.
        // Si no tiene workshop_id configurado evitamos exponer datos de toda la organización.
        if (!workshopFilter) {
          setOrders([]);
          setError(new Error('Usuario de taller sin workshop_id asignado'));
          return;
        }

        const workshopOrders = data.filter((order: any) =>
          order.workshop_assignments?.some((assignment: any) => assignment.workshop_id === workshopFilter)
        );
        setOrders(workshopOrders);
      } else {
        // Roles con acceso completo
        setOrders(data);
      }
      setError(null);
    } catch (err) {
      setError(err);
      setOrders([]);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [isWorkshopUser, workshopFilter, activeStoreId]);

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
