import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DeliveryPayment {
  id: string;
  delivery_id: string;
  workshop_id: string;
  order_id: string;
  total_units: number;
  billable_units: number;
  unit_price: number;
  gross_amount: number;
  advance_deduction: number;
  net_amount: number;
  payment_status: 'pending' | 'paid' | 'partial' | 'cancelled';
  payment_date?: string;
  payment_method?: string;
  reference_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  paid_by?: string;
  tracking_number?: string;
  workshop_name?: string;
  order_number?: string;
}

export interface DeliveryPaymentCalculation {
  total_units: number;
  billable_units: number;
  gross_amount: number;
  advance_deduction: number;
  net_amount: number;
  workshop_payment_method: string;
}

export const useDeliveryPayments = () => {
  const [payments, setPayments] = useState<DeliveryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('delivery_payments')
        .select(`
          *,
          deliveries!delivery_payments_delivery_id_fkey(tracking_number),
          workshops!delivery_payments_workshop_id_fkey(name),
          orders!delivery_payments_order_id_fkey(order_number)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedData = data?.map(item => ({
        ...item,
        tracking_number: item.deliveries?.tracking_number,
        workshop_name: item.workshops?.name,
        order_number: item.orders?.order_number,
        payment_status: item.payment_status as 'pending' | 'paid' | 'partial' | 'cancelled'
      })) || [];

      setPayments(transformedData);
    } catch (error) {
      console.error('Error fetching delivery payments:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los pagos de entregas"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculatePayment = async (deliveryId: string): Promise<DeliveryPaymentCalculation | null> => {
    try {
      const { data, error } = await supabase
        .rpc('calculate_delivery_payment', { delivery_id_param: deliveryId });

      if (error) throw error;
      return data?.[0] || null;
    } catch (error) {
      console.error('Error calculating payment:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo calcular el pago"
      });
      return null;
    }
  };

  const createPayment = async (deliveryId: string) => {
    try {
      // First calculate the payment
      const calculation = await calculatePayment(deliveryId);
      if (!calculation) {
        throw new Error('No se pudo calcular el pago');
      }

      // Get delivery info
      const { data: delivery, error: deliveryError } = await supabase
        .from('deliveries')
        .select('workshop_id, order_id')
        .eq('id', deliveryId)
        .single();

      if (deliveryError) throw deliveryError;

      // Create payment record
      const { data, error } = await supabase
        .from('delivery_payments')
        .insert({
          delivery_id: deliveryId,
          workshop_id: delivery.workshop_id,
          order_id: delivery.order_id,
          total_units: calculation.total_units,
          billable_units: calculation.billable_units,
          unit_price: calculation.billable_units > 0 ? calculation.gross_amount / calculation.billable_units : 0,
          gross_amount: calculation.gross_amount,
          advance_deduction: calculation.advance_deduction,
          net_amount: calculation.net_amount,
          payment_status: 'pending',
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Pago creado",
        description: "El registro de pago ha sido creado correctamente"
      });

      fetchPayments();
      return data;
    } catch (error) {
      console.error('Error creating payment:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo crear el registro de pago"
      });
      throw error;
    }
  };

  const markAsPaid = async (
    paymentId: string,
    paymentDetails: {
      payment_date: string;
      payment_method?: string;
      reference_number?: string;
      notes?: string;
    }
  ) => {
    try {
      const { error } = await supabase
        .from('delivery_payments')
        .update({
          ...paymentDetails,
          payment_status: 'paid',
          paid_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', paymentId);

      if (error) throw error;

      toast({
        title: "Pago registrado",
        description: "El pago ha sido marcado como pagado"
      });

      fetchPayments();
    } catch (error) {
      console.error('Error marking payment as paid:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo registrar el pago"
      });
      throw error;
    }
  };

  const updatePayment = async (paymentId: string, updates: Partial<DeliveryPayment>) => {
    try {
      const { error } = await supabase
        .from('delivery_payments')
        .update(updates)
        .eq('id', paymentId);

      if (error) throw error;

      toast({
        title: "Pago actualizado",
        description: "El pago ha sido actualizado correctamente"
      });

      fetchPayments();
    } catch (error) {
      console.error('Error updating payment:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar el pago"
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  return {
    payments,
    loading,
    calculatePayment,
    createPayment,
    markAsPaid,
    updatePayment,
    refetch: fetchPayments
  };
};