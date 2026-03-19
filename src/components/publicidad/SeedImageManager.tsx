import React, { useState, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Upload, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSeedImages } from '@/hooks/useSeedImages';

interface SeedImageManagerProps {
  type: 'product' | 'advertising';
}

const SeedImageManager = ({ type }: SeedImageManagerProps) => {
  const { seedImages, loading, createSeedImage, uploadSeedImage, deleteSeedImage } = useSeedImages(type);
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [seedToDelete, setSeedToDelete] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const title = type === 'product' ? 'Semillas de Producto' : 'Semillas de Publicidad';

  const handleFileSelect = (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Tipo de archivo no valido',
        description: 'Solo se permiten archivos JPG, PNG y WEBP.',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Archivo muy grande',
        description: 'El archivo debe ser menor a 5MB.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleSave = async () => {
    if (!selectedFile || !name.trim()) {
      toast({
        title: 'Campos requeridos',
        description: 'Debes ingresar un nombre y seleccionar una imagen.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const imageUrl = await uploadSeedImage(selectedFile, type);
      if (!imageUrl) throw new Error('No se pudo subir la imagen');
      await createSeedImage({
        name: name.trim(),
        type,
        category: category.trim() || undefined,
        image_url: imageUrl,
      });
      toast({ title: 'Semilla creada', description: 'La imagen semilla se ha guardado exitosamente.' });
      resetForm();
      setDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error al guardar',
        description: error.message || 'Hubo un problema al guardar la semilla.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setCategory('');
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleDeleteClick = (id: string) => {
    setSeedToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!seedToDelete) return;
    try {
      await deleteSeedImage(seedToDelete);
      toast({ title: 'Semilla eliminada', description: 'La imagen semilla ha sido eliminada.' });
    } catch (error: any) {
      toast({
        title: 'Error al eliminar',
        description: error.message || 'Hubo un problema al eliminar la semilla.',
        variant: 'destructive',
      });
    } finally {
      setDeleteConfirmOpen(false);
      setSeedToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-black">{title}</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-3 animate-pulse">
              <div className="aspect-square bg-gray-200 rounded mb-2" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-black">{title}</h3>
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
          className="bg-[#ff5c02] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Agregar Semilla
        </Button>
      </div>

      {seedImages.length === 0 ? (
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-black">No hay semillas configuradas</h3>
            <p className="text-gray-600">Agrega imagenes semilla para usar como referencia en la generacion.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {seedImages.map((seed) => (
            <Card key={seed.id} className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
              <div className="p-3 space-y-2">
                <img
                  src={seed.image_url}
                  alt={seed.name}
                  className="aspect-square w-full object-cover rounded"
                />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{seed.name}</p>
                    {seed.category && (
                      <Badge variant="outline" className="text-xs mt-1">
                        {seed.category}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 flex-shrink-0"
                    onClick={() => handleDeleteClick(seed.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para agregar semilla */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Semilla</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                }}
              />
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="max-h-48 mx-auto rounded object-contain" />
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-600">Arrastra una imagen o haz clic para seleccionar</p>
                  <p className="text-xs text-gray-500">JPG, PNG o WEBP (max. 5MB)</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la semilla"
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria (opcional)</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ej: fondos, productos, texturas"
              />
            </div>

            <Button onClick={handleSave} disabled={saving || !selectedFile || !name.trim()} className="w-full">
              {saving ? 'Guardando...' : 'Guardar Semilla'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AlertDialog para confirmar eliminacion */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar semilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. La imagen semilla sera eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SeedImageManager;
