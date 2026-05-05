import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Plus, Pencil, Copy, Trash2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSavedPrompts } from '@/hooks/useSavedPrompts';

const SavedPromptsManager = () => {
  const { prompts, loading, createPrompt, updatePrompt, deletePrompt } = useSavedPrompts();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<any | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [promptText, setPromptText] = useState('');
  const [category, setCategory] = useState('producto');
  const [saving, setSaving] = useState(false);

  const openCreateDialog = () => {
    setEditingPrompt(null);
    setName('');
    setPromptText('');
    setCategory('producto');
    setDialogOpen(true);
  };

  const openEditDialog = (prompt: any) => {
    setEditingPrompt(prompt);
    setName(prompt.name);
    setPromptText(prompt.prompt);
    setCategory(prompt.category || 'producto');
    setDialogOpen(true);
  };

  const handleDuplicate = async (prompt: any) => {
    try {
      await createPrompt({
        name: `${prompt.name} (copia)`,
        prompt: prompt.prompt,
        category: prompt.category,
      });
      toast({ title: 'Prompt duplicado', description: 'Se ha creado una copia del prompt.' });
    } catch (error: any) {
      toast({
        title: 'Error al duplicar',
        description: error.message || 'Hubo un problema al duplicar el prompt.',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !promptText.trim()) {
      toast({
        title: 'Campos requeridos',
        description: 'Debes ingresar un nombre y un prompt.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        prompt: promptText.trim(),
        category,
      };

      if (editingPrompt) {
        await updatePrompt(editingPrompt.id, data);
        toast({ title: 'Prompt actualizado', description: 'El prompt se ha actualizado exitosamente.' });
      } else {
        await createPrompt(data);
        toast({ title: 'Prompt creado', description: 'El prompt se ha guardado exitosamente.' });
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error al guardar',
        description: error.message || 'Hubo un problema al guardar el prompt.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setPromptToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!promptToDelete) return;
    try {
      await deletePrompt(promptToDelete);
      toast({ title: 'Prompt eliminado', description: 'El prompt ha sido eliminado.' });
    } catch (error: any) {
      toast({
        title: 'Error al eliminar',
        description: error.message || 'Hubo un problema al eliminar el prompt.',
        variant: 'destructive',
      });
    } finally {
      setDeleteConfirmOpen(false);
      setPromptToDelete(null);
    }
  };

  const categoryBadgeColor = (cat: string) => {
    switch (cat) {
      case 'producto':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'publicidad':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando prompts...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-black">Prompts Guardados</h3>
        <Button onClick={openCreateDialog} className="bg-[#ff5c02] text-white">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Prompt
        </Button>
      </div>

      {prompts.length === 0 ? (
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-black">No hay prompts guardados</h3>
            <p className="text-gray-600">Crea prompts reutilizables para agilizar la generacion de imagenes.</p>
          </div>
        </Card>
      ) : (
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            {/* Header */}
            <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
              <div className="grid grid-cols-12 gap-4 items-center text-sm font-medium text-gray-700">
                <div className="col-span-2">Nombre</div>
                <div className="col-span-2">Categoria</div>
                <div className="col-span-5">Prompt</div>
                <div className="col-span-3">Acciones</div>
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-100">
              {prompts.map((prompt) => (
                <div key={prompt.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{prompt.name}</p>
                    </div>
                    <div className="col-span-2">
                      <Badge variant="outline" className={categoryBadgeColor(prompt.category)}>
                        {prompt.category}
                      </Badge>
                    </div>
                    <div className="col-span-5">
                      <p className="text-sm text-gray-600 truncate">
                        {prompt.prompt.length > 80
                          ? `${prompt.prompt.substring(0, 80)}...`
                          : prompt.prompt}
                      </p>
                    </div>
                    <div className="col-span-3 flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEditDialog(prompt)}
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleDuplicate(prompt)}
                        title="Duplicar"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        onClick={() => handleDeleteClick(prompt.id)}
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Dialog para crear/editar prompt */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPrompt ? 'Editar Prompt' : 'Nuevo Prompt'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del prompt"
              />
            </div>

            <div className="space-y-2">
              <Label>Prompt</Label>
              <Textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="Escribe el prompt..."
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="producto">Producto</SelectItem>
                  <SelectItem value="publicidad">Publicidad</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSave} disabled={saving || !name.trim() || !promptText.trim()} className="w-full">
              {saving ? 'Guardando...' : editingPrompt ? 'Actualizar' : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AlertDialog para confirmar eliminacion */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar prompt?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. El prompt sera eliminado permanentemente.
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

export default SavedPromptsManager;
