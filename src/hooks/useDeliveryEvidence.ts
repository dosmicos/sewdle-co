
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useDeliveryEvidence = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const uploadEvidenceFiles = async (deliveryId: string, files: File[], description?: string) => {
    if (!files || files.length === 0) return;

    setLoading(true);
    try {
      const uploadPromises = files.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${deliveryId}/${Date.now()}-${Math.random()}.${fileExt}`;
        
        // Upload file to storage
        const { error: uploadError } = await supabase.storage
          .from('delivery-evidence')
          .upload(fileName, file);

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('delivery-evidence')
          .getPublicUrl(fileName);

        // Save file record to database
        const { error: dbError } = await supabase
          .from('delivery_files')
          .insert({
            delivery_id: deliveryId,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: (await supabase.auth.getUser()).data.user?.id,
            notes: description || null
          });

        if (dbError) {
          throw dbError;
        }

        return publicUrl;
      });

      await Promise.all(uploadPromises);
      
      toast({
        title: "Archivos subidos",
        description: `${files.length} archivo(s) de evidencia subidos exitosamente`,
      });

    } catch (error) {
      console.error('Error uploading evidence files:', error);
      toast({
        title: "Error al subir archivos",
        description: error instanceof Error ? error.message : "No se pudieron subir los archivos",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const fetchEvidenceFiles = async (deliveryId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('delivery_files')
        .select('*')
        .eq('delivery_id', deliveryId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching evidence files:', error);
      toast({
        title: "Error al cargar archivos",
        description: error instanceof Error ? error.message : "No se pudieron cargar los archivos de evidencia",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const deleteEvidenceFile = async (fileId: string, fileName: string) => {
    setLoading(true);
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('delivery-evidence')
        .remove([fileName]);

      if (storageError) {
        console.error('Error deleting from storage:', storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('delivery_files')
        .delete()
        .eq('id', fileId);

      if (dbError) {
        throw dbError;
      }

      toast({
        title: "Archivo eliminado",
        description: "El archivo de evidencia ha sido eliminado exitosamente",
      });

      return true;
    } catch (error) {
      console.error('Error deleting evidence file:', error);
      toast({
        title: "Error al eliminar archivo",
        description: error instanceof Error ? error.message : "No se pudo eliminar el archivo",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    uploadEvidenceFiles,
    fetchEvidenceFiles,
    deleteEvidenceFile,
    loading
  };
};
