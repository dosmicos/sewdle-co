
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OrderItem {
  productId: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
}

interface OrderSupply {
  materialId: string;
  quantity: number;
  unit: string;
  notes?: string;
}

interface CreateOrderData {
  workshopId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  dueDate?: string;
  products: OrderItem[];
  supplies: OrderSupply[];
  notes?: string;
  cuttingOrderFile?: File;
}

export const useOrders = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createOrder = async (orderData: CreateOrderData) => {
    setLoading(true);
    try {
      console.log('Creating order with data:', orderData);

      // Generar número de orden único
      const { data: orderNumber, error: orderNumberError } = await supabase
        .rpc('generate_order_number');

      if (orderNumberError) {
        throw orderNumberError;
      }

      console.log('Generated order number:', orderNumber);

      // Calcular total amount
      const totalAmount = orderData.products.reduce((total, item) => {
        return total + (item.quantity * item.unitPrice);
      }, 0);

      // Crear la orden principal
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            order_number: orderNumber,
            client_name: orderData.clientName,
            client_email: orderData.clientEmail,
            client_phone: orderData.clientPhone,
            due_date: orderData.dueDate,
            total_amount: totalAmount,
            notes: orderData.notes,
            status: 'pending'
          }
        ])
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      console.log('Created order:', order);

      // Crear items de la orden
      if (orderData.products.length > 0) {
        const orderItems = orderData.products.map(item => ({
          order_id: order.id,
          product_variant_id: item.variantId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.quantity * item.unitPrice
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) {
          throw itemsError;
        }

        console.log('Created order items');
      }

      // Crear insumos de la orden
      if (orderData.supplies.length > 0) {
        const orderSupplies = orderData.supplies.map(supply => ({
          order_id: order.id,
          material_id: supply.materialId,
          quantity: supply.quantity,
          unit: supply.unit,
          notes: supply.notes
        }));

        const { error: suppliesError } = await supabase
          .from('order_supplies')
          .insert(orderSupplies);

        if (suppliesError) {
          throw suppliesError;
        }

        console.log('Created order supplies');
      }

      // Manejar archivo de orden de corte (simulado por ahora)
      if (orderData.cuttingOrderFile) {
        // En un entorno real, aquí subirías el archivo a Supabase Storage
        // y luego guardarías la referencia en order_files
        const fileData = {
          order_id: order.id,
          file_name: orderData.cuttingOrderFile.name,
          file_url: `mock-url/${orderData.cuttingOrderFile.name}`, // URL simulada
          file_type: orderData.cuttingOrderFile.type,
          file_size: orderData.cuttingOrderFile.size
        };

        const { error: fileError } = await supabase
          .from('order_files')
          .insert([fileData]);

        if (fileError) {
          throw fileError;
        }

        console.log('Created order file reference');
      }

      toast({
        title: "¡Orden creada exitosamente!",
        description: `La orden ${orderNumber} ha sido creada correctamente.`,
      });

      return order;

    } catch (error) {
      console.error('Error creating order:', error);
      toast({
        title: "Error al crear la orden",
        description: "Hubo un problema al crear la orden de producción. Por favor intenta de nuevo.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            product_variants (
              *,
              products (*)
            )
          ),
          order_supplies (
            *,
            materials (*)
          ),
          order_files (*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Error al cargar las órdenes",
        description: "No se pudieron cargar las órdenes de producción.",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    createOrder,
    fetchOrders,
    loading
  };
};
