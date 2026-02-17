import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MaterialTransfer {
  id: string;
  material_id: string;
  from_location_type: 'warehouse' | 'workshop';
  from_location_id: string;
  to_location_type: 'warehouse' | 'workshop';
  to_location_id: string;
  quantity: number;
  status: 'pending' | 'approved' | 'completed' | 'cancelled';
  notes?: string;
  requested_by?: string;
  approved_by?: string;
  completed_by?: string;
  transfer_date?: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
  material?: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    category: string;
    color?: string;
  };
  from_location_name?: string;
  to_location_name?: string;
}

export const useMaterialTransfers = () => {
  const [transfers, setTransfers] = useState<MaterialTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchTransfers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('material_transfers')
        .select(`
          *,
          material:materials (
            id,
            name,
            sku,
            unit,
            category,
            color
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enriquecer con nombres de ubicación
      const enrichedData = await Promise.all((data || []).map(async (transfer) => {
        let fromLocationName = '';
        let toLocationName = '';
        
        // Obtener nombre de ubicación origen
        if (transfer.from_location_type === 'warehouse') {
          const { data: warehouseData } = await supabase
            .from('warehouses')
            .select('name')
            .eq('id', transfer.from_location_id)
            .single();
          fromLocationName = warehouseData?.name || 'Bodega';
        } else {
          const { data: workshopData } = await supabase
            .from('workshops')
            .select('name')
            .eq('id', transfer.from_location_id)
            .single();
          fromLocationName = workshopData?.name || 'Taller';
        }

        // Obtener nombre de ubicación destino
        if (transfer.to_location_type === 'warehouse') {
          const { data: warehouseData } = await supabase
            .from('warehouses')
            .select('name')
            .eq('id', transfer.to_location_id)
            .single();
          toLocationName = warehouseData?.name || 'Bodega';
        } else {
          const { data: workshopData } = await supabase
            .from('workshops')
            .select('name')
            .eq('id', transfer.to_location_id)
            .single();
          toLocationName = workshopData?.name || 'Taller';
        }

        return {
          ...transfer,
          from_location_type: transfer.from_location_type as 'warehouse' | 'workshop',
          to_location_type: transfer.to_location_type as 'warehouse' | 'workshop',
          from_location_name: fromLocationName,
          to_location_name: toLocationName,
          material: (transfer.material as Record<string, unknown>)?.id ? transfer.material as Record<string, unknown> : undefined
        } as MaterialTransfer;
      }));

      setTransfers(enrichedData);
    } catch (error: unknown) {
      console.error('Error fetching transfers:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las transferencias",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createTransfer = async (transferData: {
    material_id: string;
    from_location_type: 'warehouse' | 'workshop';
    from_location_id: string;
    to_location_type: 'warehouse' | 'workshop';
    to_location_id: string;
    quantity: number;
    notes?: string;
  }) => {
    try {
      // Get current user and organization info
      const { data: userData } = await supabase.auth.getUser();
      const { data: orgData } = await supabase
        .from('organization_users')
        .select('organization_id')
        .eq('user_id', userData.user?.id)
        .eq('status', 'active')
        .single();

      const { data, error } = await supabase
        .from('material_transfers')
        .insert([{
          ...transferData,
          organization_id: orgData?.organization_id,
          requested_by: userData.user?.id
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Transferencia creada correctamente",
      });

      await fetchTransfers();
      return data;
    } catch (error: unknown) {
      console.error('Error creating transfer:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la transferencia",
        variant: "destructive",
      });
      throw error;
    }
  };

  const approveTransfer = async (transferId: string) => {
    try {
      const { error } = await supabase
        .from('material_transfers')
        .update({
          status: 'approved',
          approved_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', transferId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Transferencia aprobada",
      });

      await fetchTransfers();
    } catch (error: unknown) {
      console.error('Error approving transfer:', error);
      toast({
        title: "Error",
        description: "No se pudo aprobar la transferencia",
        variant: "destructive",
      });
    }
  };

  const processTransfer = async (transferId: string) => {
    try {
      const { data, error } = await supabase.rpc('process_material_transfer', {
        p_transfer_id: transferId
      });

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Transferencia procesada correctamente",
      });

      await fetchTransfers();
    } catch (error: unknown) {
      console.error('Error processing transfer:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo procesar la transferencia",
        variant: "destructive",
      });
    }
  };

  const cancelTransfer = async (transferId: string) => {
    try {
      const { error } = await supabase
        .from('material_transfers')
        .update({ status: 'cancelled' })
        .eq('id', transferId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Transferencia cancelada",
      });

      await fetchTransfers();
    } catch (error: unknown) {
      console.error('Error cancelling transfer:', error);
      toast({
        title: "Error",
        description: "No se pudo cancelar la transferencia",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  return {
    transfers,
    loading,
    createTransfer,
    approveTransfer,
    processTransfer,
    cancelTransfer,
    refetch: fetchTransfers
  };
};
