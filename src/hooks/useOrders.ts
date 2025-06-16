
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

      // Validar que hay datos válidos
      if (orderData.products.length === 0 && orderData.supplies.length === 0) {
        throw new Error('Debe agregar al menos un producto o insumo a la orden');
      }

      // Generar número de orden único
      const { data: orderNumber, error: orderNumberError } = await supabase
        .rpc('generate_order_number');

      if (orderNumberError) {
        console.error('Error generating order number:', orderNumberError);
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
            due_date: orderData.dueDate,
            total_amount: totalAmount > 0 ? totalAmount : null,
            notes: orderData.notes || null,
            status: 'pending'
          }
        ])
        .select()
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        throw orderError;
      }

      console.log('Created order:', order);

      // Crear items de la orden solo si hay productos válidos
      if (orderData.products.length > 0) {
        console.log('Creating order items for products:', orderData.products);
        
        const orderItems = orderData.products.map(item => {
          console.log('Processing product item:', item);
          return {
            order_id: order.id,
            product_variant_id: item.variantId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.quantity * item.unitPrice
          };
        });

        console.log('Order items to insert:', orderItems);

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(orderItems);

        if (itemsError) {
          console.error('Error creating order items:', itemsError);
          throw itemsError;
        }

        console.log('Successfully created order items');
      }

      // Crear insumos de la orden solo si hay insumos válidos
      if (orderData.supplies.length > 0) {
        console.log('Creating order supplies:', orderData.supplies);
        
        const orderSupplies = orderData.supplies.map(supply => ({
          order_id: order.id,
          material_id: supply.materialId,
          quantity: supply.quantity,
          unit: supply.unit,
          notes: supply.notes || null
        }));

        console.log('Order supplies to insert:', orderSupplies);

        const { error: suppliesError } = await supabase
          .from('order_supplies')
          .insert(orderSupplies);

        if (suppliesError) {
          console.error('Error creating order supplies:', suppliesError);
          throw suppliesError;
        }

        console.log('Successfully created order supplies');
      }

      // Manejar archivo de orden de corte (simulado por ahora)
      if (orderData.cuttingOrderFile) {
        console.log('Processing cutting order file:', orderData.cuttingOrderFile.name);
        
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
          console.error('Error creating order file:', fileError);
          throw fileError;
        }

        console.log('Successfully created order file reference');
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
