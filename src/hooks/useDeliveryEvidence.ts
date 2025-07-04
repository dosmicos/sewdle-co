
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useDeliveryEvidence = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const uploadEvidenceFiles = async (deliveryId: string, files: File[], description?: string) => {
    if (!files || files.length === 0) {
      console.log('No files to upload');
      return;
    }

    setLoading(true);
    console.log(`Starting upload of ${files.length} file(s) for delivery ${deliveryId}`);
    
    try {
      // Obtener el usuario una sola vez al inicio
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Error getting user:', userError);
        throw new Error(`Error de autenticación: ${userError.message}`);
      }

      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      console.log('User authenticated:', user.id);

      // Procesar archivos secuencialmente para evitar problemas de concurrencia
      const uploadResults = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Processing file ${i + 1}/${files.length}: ${file.name} (${file.size} bytes)`);
        
        try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${deliveryId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
          
          console.log(`Uploading to storage: ${fileName}`);
          
          // Upload file to storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('delivery-evidence')
            .upload(fileName, file);

          if (uploadError) {
            console.error(`Storage upload error for file ${file.name}:`, uploadError);
            throw new Error(`Error subiendo archivo ${file.name}: ${uploadError.message}`);
          }

          console.log(`File uploaded successfully:`, uploadData);

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('delivery-evidence')
            .getPublicUrl(fileName);

          console.log(`Public URL generated: ${publicUrl}`);

          // Save file record to database
          const fileRecord = {
            delivery_id: deliveryId,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user.id,
            notes: description || null
          };

          console.log('Inserting file record to database:', fileRecord);

          const { data: dbData, error: dbError } = await supabase
            .from('delivery_files')
            .insert([fileRecord])
            .select();

          if (dbError) {
            console.error(`Database insert error for file ${file.name}:`, dbError);
            throw new Error(`Error guardando registro de archivo ${file.name}: ${dbError.message}`);
          }

          console.log(`File record saved to database:`, dbData);
          uploadResults.push({ file: file.name, url: publicUrl, success: true });

        } catch (fileError) {
          console.error(`Error processing file ${file.name}:`, fileError);
          uploadResults.push({ 
            file: file.name, 
            success: false, 
            error: fileError instanceof Error ? fileError.message : 'Error desconocido' 
          });
        }
      }

      // Verificar resultados
      const successCount = uploadResults.filter(r => r.success).length;
      const failureCount = uploadResults.filter(r => !r.success).length;

      console.log(`Upload summary: ${successCount} successful, ${failureCount} failed`);

      if (successCount > 0) {
        toast({
          title: "Archivos subidos",
          description: `${successCount} archivo(s) de evidencia subidos exitosamente${failureCount > 0 ? `. ${failureCount} archivo(s) fallaron.` : ''}`,
        });
      }

      if (failureCount > 0) {
        const failedFiles = uploadResults.filter(r => !r.success);
        console.error('Failed files:', failedFiles);
        
        if (successCount === 0) {
          throw new Error(`No se pudieron subir ninguno de los ${files.length} archivos`);
        }
      }

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
    console.log(`Fetching evidence files for delivery: ${deliveryId}`);
    
    try {
      // Consulta optimizada con LEFT JOIN explícito y manejo de casos sin usuario
      const { data, error } = await supabase
        .from('delivery_files')
        .select(`
          id,
          delivery_id,
          file_name,
          file_url,
          file_type,
          file_size,
          created_at,
          notes,
          uploaded_by,
          profiles:uploaded_by (
            id,
            name
          )
        `)
        .eq('delivery_id', deliveryId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching evidence files:', error);
        throw error;
      }

      // Procesar los datos para manejar casos donde no hay perfil de usuario
      const processedData = (data || []).map(file => ({
        ...file,
        profiles: file.profiles || { 
          id: file.uploaded_by, 
          name: 'Usuario eliminado' 
        }
      }));

      console.log(`Found ${processedData.length} evidence files`);
      return processedData;
      
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

  const deleteEvidenceFile = async (fileId: string, fileUrl: string) => {
    setLoading(true);
    console.log(`Deleting evidence file: ${fileId}`);
    
    try {
      // Extract file path from URL
      const urlParts = fileUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const deliveryFolder = urlParts[urlParts.length - 2];
      const filePath = `${deliveryFolder}/${fileName}`;

      console.log(`Deleting from storage: ${filePath}`);

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('delivery-evidence')
        .remove([filePath]);

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
        console.error('Error deleting from database:', dbError);
        throw dbError;
      }

      console.log('File deleted successfully');

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
