
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMaterialConsumption } from '@/hooks/useMaterialConsumption';

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
  materialValidation?: any;
}

export const useOrders = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { consumeOrderMaterials } = useMaterialConsumption();

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

        // **NUEVO: Consumo inteligente de materiales**
        const { materialValidation } = orderData;
        
        // Si hay materiales suficientes, consumir automáticamente
        if (materialValidation?.canProceed) {
          console.log('Sufficient materials available, consuming automatically...');
          
          const consumptions = orderData.supplies.map(supply => ({
            material_id: supply.materialId,
            quantity: supply.quantity
          }));

          try {
            await consumeOrderMaterials(order.id, consumptions);
            console.log('Materials consumed automatically for order:', order.id);
            
            toast({
              title: "¡Orden creada y materiales consumidos!",
              description: `La orden ${orderNumber} fue creada y los materiales fueron consumidos automáticamente del taller.`,
            });
          } catch (consumptionError) {
            console.error('Error consuming materials:', consumptionError);
            // No fallar la creación de la orden por error de consumo
            toast({
              title: "Orden creada con advertencia",
              description: `La orden ${orderNumber} fue creada pero hubo un problema al consumir los materiales. Puedes consumirlos manualmente.`,
              variant: "default",
            });
          }
        } else if (materialValidation?.insufficientMaterials?.length > 0) {
          console.log('Insufficient materials, order created but marked as pending materials');
          
          // Actualizar el estado de la orden para indicar que está pendiente de materiales
          await supabase
            .from('orders')
            .update({ 
              status: 'pending',
              notes: (orderData.notes || '') + '\n[Sistema] Pendiente de entrega de materiales al taller.'
            })
            .eq('id', order.id);

          toast({
            title: "Orden creada - Materiales pendientes",
            description: `La orden ${orderNumber} fue creada. Se necesita entregar ${materialValidation.insufficientMaterials.length} materiales al taller antes de iniciar producción.`,
            variant: "default",
          });
        } else {
          // Sin validación de materiales
          toast({
            title: "¡Orden creada exitosamente!",
            description: `La orden ${orderNumber} ha sido creada correctamente.`,
          });
        }
      } else {
        toast({
          title: "¡Orden creada exitosamente!",
          description: `La orden ${orderNumber} ha sido creada correctamente.`,
        });
      }

      // Crear asignación de taller si se seleccionó un taller
      if (orderData.workshopId) {
        console.log('Creating workshop assignment for workshop:', orderData.workshopId);
        
        const { data: { session } } = await supabase.auth.getSession();
        
        const { error: assignmentError } = await supabase
          .from('workshop_assignments')
          .insert([
            {
              order_id: order.id,
              workshop_id: orderData.workshopId,
              assigned_by: session?.user?.id || null,
              status: 'assigned',
              assigned_date: new Date().toISOString().split('T')[0],
              expected_completion_date: orderData.dueDate || null
            }
          ]);

        if (assignmentError) {
          console.error('Error creating workshop assignment:', assignmentError);
          throw assignmentError;
        }

        console.log('Successfully created workshop assignment');
      }

      // Manejar archivo de orden de corte (simulado por ahora)
      if (orderData.cuttingOrderFile) {
        console.log('Processing cutting order file:', orderData.cuttingOrderFile.name);
        
        const fileData = {
          order_id: order.id,
          file_name: orderData.cuttingOrderFile.name,
          file_url: `mock-url/${orderData.cuttingOrderFile.name}`,
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
          order_files (*),
          workshop_assignments (
            *,
            workshops (
              name
            )
          )
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
