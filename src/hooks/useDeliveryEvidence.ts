
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useDeliveryEvidence = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const uploadEvidenceFiles = async (deliveryId: string, files: File[]): Promise<string[]> => {
    try {
      console.log('Uploading evidence files for delivery:', deliveryId, files);
      
      const uploadPromises = files.map(async (file) => {
        // Generate unique filename
        const fileExt = file.name.split('.').pop();
        const fileName = `${deliveryId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `evidence/${fileName}`;

        // Upload file to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('delivery-evidence')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Error uploading evidence file:', uploadError);
          throw uploadError;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('delivery-evidence')
          .getPublicUrl(filePath);

        // Create database record
        const { data: { session } } = await supabase.auth.getSession();
        
        const { error: dbError } = await supabase
          .from('delivery_files')
          .insert({
            delivery_id: deliveryId,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: session?.user?.id || null,
            notes: 'Evidencia de calidad'
          });

        if (dbError) {
          console.error('Error creating delivery file record:', dbError);
          throw dbError;
        }

        console.log('Evidence file uploaded successfully:', fileName);
        return urlData.publicUrl;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      return uploadedUrls;

    } catch (error) {
      console.error('Error in uploadEvidenceFiles:', error);
      throw error;
    }
  };

  const fetchDeliveryEvidence = async (deliveryId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('delivery_files')
        .select(`
          *,
          profiles!delivery_files_uploaded_by_fkey (
            name
          )
        `)
        .eq('delivery_id', deliveryId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching delivery evidence:', error);
      toast({
        title: "Error al cargar evidencia",
        description: "No se pudo cargar la evidencia de la entrega",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const deleteEvidenceFile = async (fileId: string, fileUrl: string) => {
    setLoading(true);
    try {
      // Extract file path from URL
      const urlParts = fileUrl.split('/');
      const filePath = `evidence/${urlParts[urlParts.length - 1]}`;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('delivery-evidence')
        .remove([filePath]);

      if (storageError) {
        console.warn('Error deleting from storage:', storageError);
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
        title: "Evidencia eliminada",
        description: "El archivo de evidencia ha sido eliminado",
      });

      return true;
    } catch (error) {
      console.error('Error deleting evidence file:', error);
      toast({
        title: "Error al eliminar",
        description: "No se pudo eliminar el archivo de evidencia",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    uploadEvidenceFiles,
    fetchDeliveryEvidence,
    deleteEvidenceFile,
    loading
  };
};
