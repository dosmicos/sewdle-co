
import { useState, useEffect, useCallback } from 'react';
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
  materialValidation?: unknown;
}

export const useOrders = () => {
  const [orders, setOrders] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { consumeOrderMaterials } = useMaterialConsumption();

  const uploadOrderFile = async (file: File, orderId: string): Promise<string> => {
    try {
      console.log('Uploading file to Supabase Storage:', file.name);
      
      // Generate unique filename to avoid conflicts
      const fileExt = file.name.split('.').pop();
      const fileName = `${orderId}-${Date.now()}.${fileExt}`;
      const filePath = `orders/${fileName}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('order-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('order-files')
        .getPublicUrl(filePath);

      console.log('File uploaded successfully. Public URL:', urlData.publicUrl);
      return urlData.publicUrl;

    } catch (error) {
      console.error('Error in uploadOrderFile:', error);
      throw error;
    }
  };

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
        
        // Consolidar items por variantId para evitar duplicados
        const consolidatedItems: Record<string, { variantId: string; quantity: number; unitPrice: number }> = {};
        
        orderData.products.forEach(item => {
          if (consolidatedItems[item.variantId]) {
            // Sumar cantidad si ya existe
            consolidatedItems[item.variantId].quantity += item.quantity;
            console.log(`Consolidating duplicate variant ${item.variantId}: new quantity = ${consolidatedItems[item.variantId].quantity}`);
          } else {
            consolidatedItems[item.variantId] = {
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            };
          }
        });

        const orderItems = Object.values(consolidatedItems).map(item => {
          console.log('Processing consolidated product item:', item);
          return {
            order_id: order.id,
            product_variant_id: item.variantId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.quantity * item.unitPrice
          };
        });

        console.log('Order items to insert (consolidated):', orderItems);

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
        
        // Obtener organization_id actual
        const { data: orgData, error: orgError } = await supabase
          .rpc('get_current_organization_safe');
        
        if (orgError) {
          console.error('Error getting current organization:', orgError);
          throw orgError;
        }
        
        const { error: assignmentError } = await supabase
          .from('workshop_assignments')
          .insert([
            {
              order_id: order.id,
              workshop_id: orderData.workshopId,
              assigned_by: session?.user?.id || null,
              organization_id: orgData,
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

      // Manejar archivo de orden de corte - IMPLEMENTACIÓN REAL
      if (orderData.cuttingOrderFile) {
        console.log('Processing cutting order file:', orderData.cuttingOrderFile.name);
        
        try {
          // Upload file to Supabase Storage
          const fileUrl = await uploadOrderFile(orderData.cuttingOrderFile, order.id);
          
          const fileData = {
            order_id: order.id,
            file_name: orderData.cuttingOrderFile.name,
            file_url: fileUrl,
            file_type: orderData.cuttingOrderFile.type,
            file_size: orderData.cuttingOrderFile.size
          };

          const { error: fileError } = await supabase
            .from('order_files')
            .insert([fileData]);

          if (fileError) {
            console.error('Error creating order file record:', fileError);
            throw fileError;
          }

          console.log('Successfully uploaded and created order file reference');
        } catch (fileUploadError) {
          console.error('Error uploading cutting order file:', fileUploadError);
          toast({
            title: "Advertencia",
            description: "La orden fue creada pero hubo un problema al subir el archivo adjunto. Puedes intentar subirlo después.",
            variant: "default",
          });
        }
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

  const fetchOrders = useCallback(async () => {
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

      setOrders(data || []);
      return data;
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Error al cargar las órdenes",
        description: "No se pudieron cargar las órdenes de producción.",
        variant: "destructive",
      });
      setOrders([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    createOrder,
    fetchOrders,
    loading
  };
};
