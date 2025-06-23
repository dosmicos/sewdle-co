
import { useState, useEffect } from 'react';
import { useOrders } from '@/hooks/useOrders';
import { useUserContext } from '@/hooks/useUserContext';

export const useFilteredOrders = () => {
  const { orders, loading, error, createOrder, updateOrder, deleteOrder, refetch } = useOrders();
  const { workshopFilter, isWorkshopUser } = useUserContext();
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!orders) {
      setFilteredOrders([]);
      return;
    }

    if (isWorkshopUser && workshopFilter) {
      // Filtrar órdenes asignadas al taller del usuario
      const workshopOrders = orders.filter(order => {
        return order.workshop_assignments?.some((assignment: any) => 
          assignment.workshop_id === workshopFilter
        );
      });
      setFilteredOrders(workshopOrders);
    } else {
      // Admin ve todas las órdenes
      setFilteredOrders(orders);
    }
  }, [orders, isWorkshopUser, workshopFilter]);

  return {
    orders: filteredOrders,
    loading,
    error,
    createOrder,
    updateOrder,
    deleteOrder,
    refetch
  };
};
