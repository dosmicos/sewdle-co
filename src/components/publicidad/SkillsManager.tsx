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
import { Plus, Pencil, Trash2, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAiSkills } from '@/hooks/useAiSkills';
import { useAiTemplates } from '@/hooks/useAiTemplates';
import { useSeedImages } from '@/hooks/useSeedImages';

const SkillsManager = () => {
  const { skills, loading, createSkill, updateSkill, deleteSkill } = useAiSkills();
  const { templates } = useAiTemplates();
  const { seedImages } = useSeedImages('product');
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<any | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [skillToDelete, setSkillToDelete] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [mode, setMode] = useState<string>('template');
  const [templateId, setTemplateId] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState('1K');
  const [selectedSeedIds, setSelectedSeedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName('');
    setMode('template');
    setTemplateId('');
    setPrompt('');
    setResolution('1K');
    setSelectedSeedIds([]);
  };

  const openCreateDialog = () => {
    setEditingSkill(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (skill: any) => {
    setEditingSkill(skill);
    setName(skill.name);
    setMode(skill.mode || 'template');
    setTemplateId(skill.template_id || '');
    setPrompt(skill.prompt || '');
    setResolution(skill.resolution || '1K');
    setSelectedSeedIds(skill.seed_image_ids || []);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Campo requerido', description: 'Debes ingresar un nombre.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        mode,
        template_id: mode === 'template' ? templateId || undefined : undefined,
        prompt: prompt.trim(),
        resolution,
        seed_image_ids: selectedSeedIds,
      };

      if (editingSkill) {
        await updateSkill(editingSkill.id, data);
        toast({ title: 'Skill actualizado', description: 'El skill se ha actualizado exitosamente.' });
      } else {
        await createSkill(data);
        toast({ title: 'Skill creado', description: 'El skill se ha guardado exitosamente.' });
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error al guardar',
        description: error.message || 'Hubo un problema al guardar el skill.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setSkillToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!skillToDelete) return;
    try {
      await deleteSkill(skillToDelete);
      toast({ title: 'Skill eliminado', description: 'El skill ha sido eliminado.' });
    } catch (error: any) {
      toast({
        title: 'Error al eliminar',
        description: error.message || 'Hubo un problema al eliminar el skill.',
        variant: 'destructive',
      });
    } finally {
      setDeleteConfirmOpen(false);
      setSkillToDelete(null);
    }
  };

  const toggleSeedImage = (id: string) => {
    setSelectedSeedIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const modeBadgeColor = (m: string) => {
    switch (m) {
      case 'template':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'free':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'edit':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return '';
    }
  };

  const modeLabel = (m: string) => {
    switch (m) {
      case 'template':
        return 'Template';
      case 'free':
        return 'Prompt Libre';
      case 'edit':
        return 'Edicion';
      default:
        return m;
    }
  };

  if (loading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando skills...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-black">Skills</h3>
        <Button onClick={openCreateDialog} className="bg-[#ff5c02] text-white">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Skill
        </Button>
      </div>

      {skills.length === 0 ? (
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-black">No hay skills configurados</h3>
            <p className="text-gray-600">Crea skills para combinar templates, prompts e imagenes semilla.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {skills.map((skill) => (
            <Card key={skill.id} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h4 className="font-bold text-gray-900">{skill.name}</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={modeBadgeColor(skill.mode)}>
                      {modeLabel(skill.mode)}
                    </Badge>
                    <Badge variant="outline">{skill.resolution || '1K'}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => openEditDialog(skill)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                    onClick={() => handleDeleteClick(skill.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {skill.prompt && (
                <p className="text-sm text-gray-600 truncate">
                  {skill.prompt.length > 80 ? `${skill.prompt.substring(0, 80)}...` : skill.prompt}
                </p>
              )}

              {skill.seed_image_ids && skill.seed_image_ids.length > 0 && (
                <div className="flex items-center gap-1">
                  {skill.seed_image_ids.slice(0, 5).map((seedId: string) => {
                    const seed = seedImages.find((s) => s.id === seedId);
                    return seed ? (
                      <img
                        key={seedId}
                        src={seed.image_url}
                        alt={seed.name}
                        className="w-8 h-8 rounded-full object-cover border border-gray-200"
                      />
                    ) : null;
                  })}
                  {skill.seed_image_ids.length > 5 && (
                    <span className="text-xs text-gray-500">+{skill.seed_image_ids.length - 5}</span>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para crear/editar skill */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSkill ? 'Editar Skill' : 'Nuevo Skill'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del skill" />
            </div>

            <div className="space-y-2">
              <Label>Modo</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="template">Template</SelectItem>
                  <SelectItem value="free">Prompt Libre</SelectItem>
                  <SelectItem value="edit">Edicion</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === 'template' && (
              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Prompt</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Escribe el prompt del skill..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Resolucion</Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1K">1K</SelectItem>
                  <SelectItem value="2K">2K</SelectItem>
                  <SelectItem value="4K">4K</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Imagenes Semilla</Label>
              {seedImages.length === 0 ? (
                <p className="text-sm text-gray-500">No hay imagenes semilla disponibles.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                  {seedImages.map((seed) => (
                    <div
                      key={seed.id}
                      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${
                        selectedSeedIds.includes(seed.id)
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleSeedImage(seed.id)}
                    >
                      <img src={seed.image_url} alt={seed.name} className="w-full aspect-square object-cover" />
                      {selectedSeedIds.includes(seed.id) && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full">
              {saving ? 'Guardando...' : editingSkill ? 'Actualizar' : 'Guardar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AlertDialog para confirmar eliminacion */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar skill?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. El skill sera eliminado permanentemente.
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

export default SkillsManager;
