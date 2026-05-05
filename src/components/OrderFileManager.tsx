import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, X, Download, Edit, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OrderFileManagerProps {
  orderId: string;
  orderFiles: any[];
  onFilesUpdated: () => void;
  editable?: boolean;
}

const OrderFileManager = ({ orderId, orderFiles, onFilesUpdated, editable = true }: OrderFileManagerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of selectedFiles) {
        await uploadOrderFile(file);
      }
      
      toast({
        title: "Archivos subidos",
        description: `Se subieron ${selectedFiles.length} archivo(s) exitosamente.`,
      });
      
      onFilesUpdated();
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "Error",
        description: "Error al subir los archivos. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const uploadOrderFile = async (file: File): Promise<void> => {
    try {
      // Generar nombre único para el archivo
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${orderId}/${timestamp}_${sanitizedFileName}`;

      // Subir archivo a Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('order-files')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('order-files')
        .getPublicUrl(filePath);

      // Crear registro en la base de datos
      const { error: dbError } = await supabase
        .from('order_files')
        .insert([
          {
            order_id: orderId,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_type: file.type || 'application/octet-stream',
            file_size: file.size
          }
        ]);

      if (dbError) {
        throw dbError;
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  };

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    setDeleting(fileId);
    try {
      // Eliminar de la base de datos
      const { error: dbError } = await supabase
        .from('order_files')
        .delete()
        .eq('id', fileId);

      if (dbError) {
        throw dbError;
      }

      toast({
        title: "Archivo eliminado",
        description: `Se eliminó "${fileName}" exitosamente.`,
      });

      onFilesUpdated();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Error",
        description: "Error al eliminar el archivo. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleDownloadFile = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return <FileText className="w-8 h-8 text-blue-500" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Archivos Adjuntos ({orderFiles.length})</span>
            </div>
            {editable && (
              <Button
                onClick={() => fileInputRef.current?.click()}
                size="sm"
                disabled={uploading}
                className="flex items-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>{uploading ? 'Subiendo...' : 'Subir archivo'}</span>
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
          />

          {orderFiles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No hay archivos adjuntos</p>
              {editable && (
                <p className="text-sm">
                  Haz clic en "Subir archivo" para agregar documentos a esta orden.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {orderFiles.map((file: any) => (
                <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getFileIcon(file.file_name)}
                    <div>
                      <p className="font-medium text-black">{file.file_name}</p>
                      <p className="text-sm text-gray-600">
                        {file.file_type} • {formatFileSize(file.file_size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadFile(file.file_url, file.file_name)}
                      className="flex items-center space-x-1"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar</span>
                    </Button>
                    {editable && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteFile(file.id, file.file_name)}
                        disabled={deleting === file.id}
                        className="flex items-center space-x-1"
                      >
                        {deleting === file.id ? (
                          <span>Eliminando...</span>
                        ) : (
                          <>
                            <X className="w-4 h-4" />
                            <span>Eliminar</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editable && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Puedes subir archivos PDF, documentos de Word, imágenes y archivos de texto. 
            Los archivos se asociarán permanentemente a esta orden.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default OrderFileManager;