
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WorkshopOrder {
  id: string;
  orderNumber: string;
  productName: string;
  quantity: number;
  dueDate: string;
  status: string;
  priority: string;
  progress: number;
}

export const useWorkshopOrders = (workshopId: string) => {
  const [orders, setOrders] = useState<WorkshopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchOrders = async () => {
    try {
      setLoading(true);

      const { data: assignments, error } = await supabase
        .from('workshop_assignments')
        .select(`
          id,
          status,
          expected_completion_date,
          orders!inner(
            id,
            order_number,
            due_date,
            status,
            order_items(
              quantity,
              product_variants(
                product_id,
                products(name)
              )
            )
          ),
          deliveries:orders(
            delivery_items(quantity_approved, quantity_delivered)
          )
        `)
        .eq('workshop_id', workshopId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedOrders: WorkshopOrder[] = assignments?.map(assignment => {
        const order = assignment.orders;
        const totalQuantity = order.order_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
        
        // Obtener nombre del primer producto (simplificado)
        const firstProduct = order.order_items?.[0]?.product_variants?.products?.name || 'Producto';
        const productName = order.order_items && order.order_items.length > 1 
          ? `${firstProduct} (+${order.order_items.length - 1} más)`
          : firstProduct;

        // Calcular progreso basado en entregas aprobadas
        let totalApproved = 0;
        assignment.deliveries?.forEach((delivery: any) => {
          delivery.delivery_items?.forEach((item: any) => {
            totalApproved += item.quantity_approved || 0;
          });
        });

        const progress = totalQuantity > 0 ? Math.round((totalApproved / totalQuantity) * 100) : 0;

        // Determinar prioridad basada en fecha de vencimiento
        const daysUntilDue = order.due_date 
          ? Math.ceil((new Date(order.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          : 30;
        
        let priority = 'Baja';
        if (daysUntilDue <= 3) priority = 'Alta';
        else if (daysUntilDue <= 7) priority = 'Media';

        // Mapear estado
        let status = 'Pendiente';
        if (assignment.status === 'in_progress') status = 'En Progreso';
        else if (assignment.status === 'completed') status = 'Completado';

        return {
          id: assignment.id,
          orderNumber: order.order_number,
          productName,
          quantity: totalQuantity,
          dueDate: order.due_date || '',
          status,
          priority,
          progress
        };
      }) || [];

      setOrders(formattedOrders);

    } catch (error: any) {
      console.error('Error fetching workshop orders:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las órdenes del taller",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workshopId) {
      fetchOrders();
    }
  }, [workshopId]);

  return { orders, loading, refetch: fetchOrders };
};
