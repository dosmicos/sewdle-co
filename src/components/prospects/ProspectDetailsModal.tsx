import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WorkshopProspect, STAGE_LABELS, ProspectStage } from '@/types/prospects';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProspectActivities } from '@/hooks/useProspectActivities';
import { ActivityForm } from './ActivityForm';
import { ActivityTimeline } from './ActivityTimeline';
import { Building2, Phone, Mail, MapPin, Calendar, Save, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { z } from 'zod';

interface ProspectDetailsModalProps {
  prospect: WorkshopProspect | null;
  open: boolean;
  onClose: () => void;
  onUpdateStage: (id: string, stage: ProspectStage) => Promise<void>;
}

const notesSchema = z.string().max(2000, { message: "Las notas no pueden exceder 2000 caracteres" });

export const ProspectDetailsModal = ({ prospect, open, onClose, onUpdateStage }: ProspectDetailsModalProps) => {
  const { activities, createActivity, refetch } = useProspectActivities(prospect?.id);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [notes, setNotes] = useState(prospect?.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: prospect?.name || '',
    contact_person: prospect?.contact_person || '',
    phone: prospect?.phone || '',
    email: prospect?.email || '',
    address: prospect?.address || '',
    city: prospect?.city || '',
    source: prospect?.source || '',
  });

  if (!prospect) return null;

  const handleStageChange = async (newStage: string) => {
    setUpdatingStage(true);
    try {
      await onUpdateStage(prospect.id, newStage as ProspectStage);
      await createActivity({
        prospect_id: prospect.id,
        organization_id: prospect.organization_id,
        activity_type: 'stage_change',
        title: `Cambio de etapa a: ${STAGE_LABELS[newStage as ProspectStage]}`,
        status: 'completed',
        completed_date: new Date().toISOString(),
      });
      refetch();
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleActivitySubmit = async (data: any) => {
    if (!prospect?.organization_id) return;
    await createActivity({
      prospect_id: prospect.id,
      organization_id: prospect.organization_id,
      ...data,
    });
    setShowActivityForm(false);
  };

  const handleSaveNotes = async () => {
    try {
      // Validate notes
      notesSchema.parse(notes);
      
      setSavingNotes(true);
      
      // Update prospect notes via onUpdateStage's parent update function
      await onUpdateStage(prospect.id, prospect.stage);
      
      // Since we don't have direct access to onUpdate, we'll use supabase directly
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase
        .from('workshop_prospects')
        .update({ notes: notes.trim() })
        .eq('id', prospect.id);

      if (error) throw error;

      toast.success('Notas guardadas correctamente');
      setIsEditingNotes(false);
      
      // Create activity log
      await createActivity({
        prospect_id: prospect.id,
        organization_id: prospect.organization_id,
        activity_type: 'note',
        title: 'Notas actualizadas',
        status: 'completed',
        completed_date: new Date().toISOString(),
      });
      
      refetch();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Error al guardar las notas');
      }
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      // Validar que el nombre no esté vacío
      if (!editFormData.name.trim()) {
        toast.error('El nombre del taller es obligatorio');
        return;
      }

      // Validar email si se proporcionó
      if (editFormData.email && !editFormData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        toast.error('El email no es válido');
        return;
      }

      setSavingEdit(true);

      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase
        .from('workshop_prospects')
        .update({
          name: editFormData.name.trim(),
          contact_person: editFormData.contact_person.trim() || null,
          phone: editFormData.phone.trim() || null,
          email: editFormData.email.trim() || null,
          address: editFormData.address.trim() || null,
          city: editFormData.city.trim() || null,
          source: editFormData.source || null,
        })
        .eq('id', prospect.id);

      if (error) throw error;

      toast.success('Prospecto actualizado correctamente');
      setIsEditing(false);

      // Crear actividad de actualización
      await createActivity({
        prospect_id: prospect.id,
        organization_id: prospect.organization_id,
        activity_type: 'note',
        title: 'Información del prospecto actualizada',
        status: 'completed',
        completed_date: new Date().toISOString(),
      });

      // Refrescar datos
      await onUpdateStage(prospect.id, prospect.stage);
      refetch();
    } catch (error) {
      toast.error('Error al actualizar el prospecto');
      console.error('Error updating prospect:', error);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setEditFormData({
      name: prospect?.name || '',
      contact_person: prospect?.contact_person || '',
      phone: prospect?.phone || '',
      email: prospect?.email || '',
      address: prospect?.address || '',
      city: prospect?.city || '',
      source: prospect?.source || '',
    });
    setIsEditing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-primary" />
              <DialogTitle className="text-2xl">{prospect.name}</DialogTitle>
            </div>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCancelEdit}
                  disabled={savingEdit}
                >
                  Cancelar
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Guardar
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info Section */}
          {isEditing ? (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name">Nombre del Taller *</Label>
                  <Input
                    id="name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nombre del taller"
                    disabled={savingEdit}
                  />
                </div>
                <div>
                  <Label htmlFor="contact">Persona de Contacto</Label>
                  <Input
                    id="contact"
                    value={editFormData.contact_person}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                    placeholder="Nombre del contacto"
                    disabled={savingEdit}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Número de teléfono"
                    disabled={savingEdit}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="correo@ejemplo.com"
                    disabled={savingEdit}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="address">Dirección</Label>
                  <Input
                    id="address"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Dirección completa"
                    disabled={savingEdit}
                  />
                </div>
                <div>
                  <Label htmlFor="city">Ciudad</Label>
                  <Input
                    id="city"
                    value={editFormData.city}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Ciudad"
                    disabled={savingEdit}
                  />
                </div>
                <div>
                  <Label htmlFor="source">Origen del Contacto</Label>
                  <Select
                    value={editFormData.source}
                    onValueChange={(value) => setEditFormData(prev => ({ ...prev, source: value }))}
                    disabled={savingEdit}
                  >
                    <SelectTrigger id="source">
                      <SelectValue placeholder="Seleccionar origen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                      <SelectItem value="Referido">Referido</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Creado: {format(new Date(prospect.created_at), 'dd MMM yyyy', { locale: es })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                {prospect.contact_person && (
                  <p><strong>Contacto:</strong> {prospect.contact_person}</p>
                )}
                {prospect.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>{prospect.phone}</span>
                  </div>
                )}
                {prospect.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>{prospect.email}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {prospect.city && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{prospect.city}</span>
                  </div>
                )}
                {prospect.source && (
                  <p><strong>Origen:</strong> {prospect.source}</p>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm text-muted-foreground">
                    Creado: {format(new Date(prospect.created_at), 'dd MMM yyyy', { locale: es })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Stage Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Etapa Actual</label>
            <Select value={prospect.stage} onValueChange={handleStageChange} disabled={updatingStage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STAGE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="activities" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="activities">Actividades</TabsTrigger>
              <TabsTrigger value="notes">Notas</TabsTrigger>
            </TabsList>

            <TabsContent value="activities" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setShowActivityForm(!showActivityForm)}>
                  {showActivityForm ? 'Cancelar' : 'Nueva Actividad'}
                </Button>
              </div>

              {showActivityForm && (
                <ActivityForm onSubmit={handleActivitySubmit} onCancel={() => setShowActivityForm(false)} />
              )}

              <ActivityTimeline activities={activities} />
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">Notas del prospecto</label>
                  {!isEditingNotes ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setIsEditingNotes(true)}
                    >
                      Editar
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setNotes(prospect.notes || '');
                          setIsEditingNotes(false);
                        }}
                        disabled={savingNotes}
                      >
                        Cancelar
                      </Button>
                      <Button 
                        size="sm"
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Guardar
                      </Button>
                    </div>
                  )}
                </div>
                
                {isEditingNotes ? (
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Escribe notas sobre este prospecto..."
                    className="min-h-[200px] resize-none"
                    maxLength={2000}
                    disabled={savingNotes}
                  />
                ) : (
                  <div className="p-4 bg-muted/50 rounded-lg min-h-[200px] whitespace-pre-wrap">
                    {prospect.notes || 'No hay notas. Haz clic en "Editar" para agregar notas.'}
                  </div>
                )}
                
                {isEditingNotes && (
                  <p className="text-xs text-muted-foreground text-right">
                    {notes.length}/2000 caracteres
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
