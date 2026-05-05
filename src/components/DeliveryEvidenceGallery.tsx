
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Image, Eye, Trash2, Download, Calendar, User, Loader2 } from 'lucide-react';
import { useDeliveryEvidence } from '@/hooks/useDeliveryEvidence';
import { useUserContext } from '@/hooks/useUserContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DeliveryEvidenceGalleryProps {
  deliveryId: string;
}

const DeliveryEvidenceGallery = ({ deliveryId }: DeliveryEvidenceGalleryProps) => {
  const [evidenceFiles, setEvidenceFiles] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string>('');
  const [initialLoading, setInitialLoading] = useState(true);
  const { fetchEvidenceFiles, deleteEvidenceFile, loading } = useDeliveryEvidence();
  const { isAdmin } = useUserContext();

  useEffect(() => {
    loadEvidence();
  }, [deliveryId]);

  const loadEvidence = async () => {
    try {
      const allFiles = await fetchEvidenceFiles(deliveryId);
      // Filtrar solo archivos de evidencia fotográfica
      const evidenceFiles = allFiles.filter(file => 
        file.file_category === 'evidence' || 
        (!file.file_category && file.file_type.startsWith('image/'))
      );
      setEvidenceFiles(evidenceFiles);
    } catch (error) {
      console.error('Error loading evidence:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleViewImage = (fileUrl: string, fileName: string) => {
    setSelectedImage(fileUrl);
    setSelectedImageName(fileName);
  };

  const handleDownloadImage = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteFile = async (fileId: string, fileUrl: string) => {
    const success = await deleteEvidenceFile(fileId, fileUrl);
    if (success) {
      loadEvidence(); // Refresh the list
    }
  };

  const isImageFile = (fileType: string) => {
    return fileType.startsWith('image/');
  };

  // Estado de carga inicial
  if (initialLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Cargando evidencia...</h3>
          <p className="text-muted-foreground">
            Obteniendo archivos de evidencia fotográfica
          </p>
        </CardContent>
      </Card>
    );
  }

  if (evidenceFiles.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Image className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sin evidencia fotográfica</h3>
          <p className="text-muted-foreground">
            No se ha subido evidencia fotográfica para esta entrega.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Image className="w-5 h-5" />
            <span>Evidencia Fotográfica ({evidenceFiles.length})</span>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {evidenceFiles.map((file) => (
              <div key={file.id} className="border rounded-lg overflow-hidden">
                {isImageFile(file.file_type) ? (
                  <div className="relative">
                    <img
                      src={file.file_url}
                      alt={file.file_name}
                      className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => handleViewImage(file.file_url, file.file_name)}
                    />
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="text-xs">
                        {(file.file_size / 1024).toFixed(0)} KB
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center bg-gray-100">
                    <Image className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                
                <div className="p-3">
                  <p className="font-medium text-sm truncate">{file.file_name}</p>
                  <div className="flex items-center text-xs text-muted-foreground mt-1">
                    <Calendar className="w-3 h-3 mr-1" />
                    {format(new Date(file.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </div>
                  {file.profiles?.name && (
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <User className="w-3 h-3 mr-1" />
                      {file.profiles.name}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewImage(file.file_url, file.file_name)}
                      className="flex-1"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Ver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadImage(file.file_url, file.file_name)}
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                    {isAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            disabled={loading}
                          >
                            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar evidencia?</AlertDialogTitle>
                            <AlertDialogDescription>
                              ¿Estás seguro de que deseas eliminar este archivo de evidencia? 
                              Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteFile(file.id, file.file_url)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Image Viewer Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedImageName}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            {selectedImage && (
              <img
                src={selectedImage}
                alt={selectedImageName}
                className="max-w-full max-h-[70vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DeliveryEvidenceGallery;
