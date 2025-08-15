import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useOKR } from '@/contexts/OKRContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const objectiveSchema = z.object({
  title: z.string().min(5, 'El título debe tener al menos 5 caracteres'),
  description: z.string().optional(),
  level: z.enum(['area', 'company', 'team', 'individual']),
  tier: z.enum(['T1', 'T2']),
  area: z.enum(['marketing', 'diseno_prod', 'operaciones']).optional(),
  visibility: z.enum(['public', 'area', 'private']),
  period_start: z.string().min(1, 'Fecha de inicio requerida'),
  period_end: z.string().min(1, 'Fecha de fin requerida'),
  parent_objective_id: z.string().optional()
});

type ObjectiveFormData = z.infer<typeof objectiveSchema>;

interface ObjectiveFormProps {
  open: boolean;
  onClose: () => void;
  objective?: {
    id: string;
    title: string;
    description?: string;
    level: 'area' | 'company' | 'team' | 'individual';
    tier: 'T1' | 'T2';
    area?: 'marketing' | 'diseno_prod' | 'operaciones';
    visibility: 'public' | 'area' | 'private';
    period_start: string;
    period_end: string;
    parent_objective_id?: string;
  };
  mode?: 'create' | 'edit';
}

export const ObjectiveForm: React.FC<ObjectiveFormProps> = ({
  open,
  onClose,
  objective,
  mode = 'create'
}) => {
  const { createObjective, updateObjective, objectives } = useOKR();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<ObjectiveFormData>({
    resolver: zodResolver(objectiveSchema),
    defaultValues: {
      title: objective?.title || '',
      description: objective?.description || '',
      level: objective?.level || 'individual',
      tier: objective?.tier || 'T2',
      area: objective?.area,
      visibility: objective?.visibility || 'public',
      period_start: objective?.period_start || '',
      period_end: objective?.period_end || '',
      parent_objective_id: objective?.parent_objective_id || ''
    }
  });

  // Reset form when objective changes
  React.useEffect(() => {
    if (objective) {
      form.reset({
        title: objective.title,
        description: objective.description || '',
        level: objective.level,
        tier: objective.tier,
        area: objective.area,
        visibility: objective.visibility,
        period_start: objective.period_start.split('T')[0], // Format for date input
        period_end: objective.period_end.split('T')[0],
        parent_objective_id: objective.parent_objective_id || ''
      });
    } else {
      form.reset({
        title: '',
        description: '',
        level: 'individual',
        tier: 'T2',
        area: undefined,
        visibility: 'public',
        period_start: '',
        period_end: '',
        parent_objective_id: ''
      });
    }
  }, [objective, form]);

  const onSubmit = async (data: ObjectiveFormData) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      const objectiveData = {
        title: data.title,
        description: data.description,
        level: data.level,
        tier: data.tier,
        area: data.area,
        visibility: data.visibility,
        owner_id: user.id,
        period_start: new Date(data.period_start).toISOString(),
        period_end: new Date(data.period_end).toISOString(),
        parent_objective_id: data.parent_objective_id || undefined
      };

      if (mode === 'edit' && objective) {
        await updateObjective(objective.id, objectiveData);
        toast.success('Objetivo actualizado exitosamente');
      } else {
        await createObjective(objectiveData);
        toast.success('Objetivo creado exitosamente');
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving objective:', error);
      toast.error('Error guardando el objetivo');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter parent objectives (exclude current objective to prevent cycles)
  const availableParentObjectives = objectives.filter(obj => 
    obj.id !== objective?.id && obj.level !== 'individual'
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Editar Objetivo' : 'Crear Nuevo Objetivo'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título del Objetivo</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Mejorar eficiencia operacional del área"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe el objetivo y su impacto esperado..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Level and Tier */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nivel</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar nivel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="company">Empresa</SelectItem>
                        <SelectItem value="area">Área</SelectItem>
                        <SelectItem value="team">Equipo</SelectItem>
                        <SelectItem value="individual">Individual</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tier</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="T1">T1 (Crítico)</SelectItem>
                        <SelectItem value="T2">T2 (Importante)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Area and Visibility */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Área (Opcional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar área" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="diseno_prod">Diseño y Producto</SelectItem>
                        <SelectItem value="operaciones">Operaciones</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visibilidad</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar visibilidad" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="public">Público</SelectItem>
                        <SelectItem value="area">Solo área</SelectItem>
                        <SelectItem value="private">Privado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Period */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="period_start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Inicio</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="period_end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Fin</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Parent Objective */}
            {availableParentObjectives.length > 0 && (
              <FormField
                control={form.control}
                name="parent_objective_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Objetivo Padre (Opcional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar objetivo padre" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Sin objetivo padre</SelectItem>
                        {availableParentObjectives.map((obj) => (
                          <SelectItem key={obj.id} value={obj.id}>
                            {obj.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : mode === 'edit' ? 'Actualizar' : 'Crear Objetivo'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};