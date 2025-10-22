import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ReplenishmentSuggestion } from './useReplenishment';

export interface ProductionOrderData {
  workshopId: string;
  expectedDeliveryDate: string;
  notes?: string;
  suggestions: ReplenishmentSuggestion[];
}

export const useProductionOrders = () => {
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const createProductionOrder = async (orderData: ProductionOrderData) => {
    try {
      setCreating(true);

      // Get current user and organization
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data: orgData } = await supabase
        .from('organization_users')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (!orgData?.organization_id) throw new Error('Organización no encontrada');

      // Generate order number
      const { data: orderNumber } = await supabase
        .rpc('generate_order_number');

      // Calculate total amount
      const totalAmount = orderData.suggestions.reduce((sum, suggestion) => {
        // For now, we'll use a base price calculation
        // In a real scenario, you'd want to get product prices
        return sum + (suggestion.suggested_quantity * 10); // Placeholder price
      }, 0);

      // Create the order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          status: 'assigned',
          total_amount: totalAmount,
          due_date: orderData.expectedDeliveryDate,
          notes: `Orden de producción generada automáticamente desde sugerencias de reposición. ${orderData.notes || ''}`,
          organization_id: orgData.organization_id,
          created_by: user.id
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items for each suggestion
      const orderItems = [];
      for (const suggestion of orderData.suggestions) {
        // Get product variant details
        const { data: variant } = await supabase
          .from('product_variants')
          .select('product_id')
          .eq('id', suggestion.variant_id)
          .single();

        if (variant) {
          // Get product price (fallback to base price)
          const { data: product } = await supabase
            .from('products')
            .select('base_price')
            .eq('id', variant.product_id)
            .single();

          const unitPrice = product?.base_price || 10; // Fallback price

          orderItems.push({
            order_id: order.id,
            product_variant_id: suggestion.variant_id,
            quantity: suggestion.suggested_quantity,
            unit_price: unitPrice,
            total_price: suggestion.suggested_quantity * unitPrice
          });
        }
      }

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Create workshop assignment
      const { error: assignmentError } = await supabase
        .from('workshop_assignments')
        .insert({
          order_id: order.id,
          workshop_id: orderData.workshopId,
          assigned_by: user.id,
          assigned_date: new Date().toISOString().split('T')[0], // Use assigned_date with date format
          organization_id: orgData.organization_id
        });

      if (assignmentError) throw assignmentError;

      // Update replenishment records to executed status
      const variantIds = orderData.suggestions.map(s => s.variant_id);
      const { error: updateError } = await supabase
        .from('inventory_replenishment')
        .update({ status: 'executed' })
        .in('variant_id', variantIds);

      if (updateError) console.warn('Warning updating replenishment status:', updateError);

      toast({
        title: "Orden de producción creada",
        description: `Orden ${order.order_number} creada exitosamente y asignada al taller`,
      });

      return { success: true, order };

    } catch (error: any) {
      console.error('Error creating production order:', error);
      toast({
        title: "Error",
        description: error.message || "Error al crear la orden de producción",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setCreating(false);
    }
  };

  return {
    creating,
    createProductionOrder
  };
};