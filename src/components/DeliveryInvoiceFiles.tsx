
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Trash2, Eye, Receipt } from 'lucide-react';
import { useDeliveryEvidence } from '@/hooks/useDeliveryEvidence';
import { useUserContext } from '@/hooks/useUserContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DeliveryInvoiceFilesProps {
  deliveryId: string;
}

const DeliveryInvoiceFiles = ({ deliveryId }: DeliveryInvoiceFilesProps) => {
  const [files, setFiles] = useState<any[]>([]);
  const { fetchEvidenceFiles, deleteEvidenceFile, loading } = useDeliveryEvidence();
  const { canEditDeliveries } = useUserContext();

  useEffect(() => {
    loadFiles();
  }, [deliveryId]);

  const loadFiles = async () => {
    const allFiles = await fetchEvidenceFiles(deliveryId);
    // Filtrar solo archivos de cuenta de cobro/remisión
    const invoiceFiles = allFiles.filter(file => 
      file.file_category === 'invoice' ||
      (!file.file_category && file.file_type === 'application/pdf')
    );
    setFiles(invoiceFiles);
  };

  const handleDownload = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (fileId: string, fileUrl: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este archivo?')) {
      const success = await deleteEvidenceFile(fileId, fileUrl);
      if (success) {
        loadFiles();
      }
    }
  };

  const handlePreview = (fileUrl: string) => {
    window.open(fileUrl, '_blank');
  };

  const getFileIcon = (fileType: string) => {
    if (fileType === 'application/pdf') {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    return <Receipt className="w-5 h-5 text-blue-500" />;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Receipt className="w-5 h-5" />
            <span>Cuenta de Cobro/Remisión</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Cargando archivos...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Receipt className="w-5 h-5" />
          <span>Cuenta de Cobro/Remisión</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <div className="text-center py-8">
            <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No hay archivos de cuenta de cobro o remisión para esta entrega
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/25"
              >
                <div className="flex items-center space-x-3">
                  {getFileIcon(file.file_type)}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{file.file_name}</p>
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span>
                        {file.file_size ? `${(file.file_size / 1024 / 1024).toFixed(2)} MB` : 'Tamaño desconocido'}
                      </span>
                      <span>
                        Subido el {format(new Date(file.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </span>
                      {file.profiles?.name && (
                        <span>por {file.profiles.name}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    {file.file_type === 'application/pdf' ? 'PDF' : 'Documento'}
                  </Badge>
                  
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(file.file_url)}
                      title="Ver archivo"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(file.file_url, file.file_name)}
                      title="Descargar archivo"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    
                    {canEditDeliveries && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(file.id, file.file_url)}
                        className="text-red-500 hover:text-red-700"
                        title="Eliminar archivo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DeliveryInvoiceFiles;
