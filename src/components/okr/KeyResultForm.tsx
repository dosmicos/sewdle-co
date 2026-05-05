import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useOKR } from '@/contexts/OKRContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const keyResultSchema = z.object({
  title: z.string().min(5, 'El título debe tener al menos 5 caracteres'),
  current_value: z.number().min(0, 'El valor actual debe ser positivo'),
  target_value: z.number().min(0.1, 'El valor objetivo debe ser mayor a 0'),
  unit: z.enum(['%', '#', '$', 'rate', 'binary']),
  confidence: z.enum(['low', 'med', 'high']),
  data_source: z.enum(['manual', 'auto', 'computed']),
  private: z.boolean(),
  guardrail: z.boolean(),
  objective_id: z.string().min(1, 'Debe seleccionar un objetivo')
});

type KeyResultFormData = z.infer<typeof keyResultSchema>;

interface KeyResultFormProps {
  open: boolean;
  onClose: () => void;
  keyResult?: {
    id: string;
    title: string;
    current_value: number;
    target_value: number;
    unit: '%' | '#' | '$' | 'rate' | 'binary';
    confidence: 'low' | 'med' | 'high';
    data_source: 'manual' | 'auto' | 'computed';
    private: boolean;
    guardrail: boolean;
    objective_id: string;
  };
  objectiveId?: string;
  mode?: 'create' | 'edit';
}

export const KeyResultForm: React.FC<KeyResultFormProps> = ({
  open,
  onClose,
  keyResult,
  objectiveId,
  mode = 'create'
}) => {
  const { createKeyResult, updateKeyResult, objectives } = useOKR();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<KeyResultFormData>({
    resolver: zodResolver(keyResultSchema),
    defaultValues: {
      title: keyResult?.title || '',
      current_value: keyResult?.current_value || 0,
      target_value: keyResult?.target_value || 1,
      unit: keyResult?.unit || '%',
      confidence: keyResult?.confidence || 'med',
      data_source: keyResult?.data_source || 'manual',
      private: keyResult?.private || false,
      guardrail: keyResult?.guardrail || false,
      objective_id: keyResult?.objective_id || objectiveId || ''
    }
  });

  // Reset form when keyResult changes
  React.useEffect(() => {
    if (keyResult) {
      form.reset({
        title: keyResult.title,
        current_value: keyResult.current_value,
        target_value: keyResult.target_value,
        unit: keyResult.unit,
        confidence: keyResult.confidence,
        data_source: keyResult.data_source,
        private: keyResult.private,
        guardrail: keyResult.guardrail,
        objective_id: keyResult.objective_id
      });
    } else {
      form.reset({
        title: '',
        current_value: 0,
        target_value: 1,
        unit: '%',
        confidence: 'med',
        data_source: 'manual',
        private: false,
        guardrail: false,
        objective_id: objectiveId || ''
      });
    }
  }, [keyResult, objectiveId, form]);

  const onSubmit = async (data: KeyResultFormData) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      const keyResultData = {
        title: data.title,
        current_value: data.current_value,
        target_value: data.target_value,
        unit: data.unit,
        confidence: data.confidence,
        data_source: data.data_source,
        private: data.private,
        guardrail: data.guardrail,
        objective_id: data.objective_id,
        owner_id: user.id
      };

      if (mode === 'edit' && keyResult) {
        await updateKeyResult(keyResult.id, keyResultData);
        toast.success('Key Result actualizado exitosamente');
      } else {
        await createKeyResult(keyResultData);
        toast.success('Key Result creado exitosamente');
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving key result:', error);
      toast.error('Error guardando el Key Result');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUnitLabel = (unit: string) => {
    switch (unit) {
      case '%': return 'Porcentaje (%)';
      case '#': return 'Número (#)';
      case '$': return 'Dinero ($)';
      case 'rate': return 'Tasa (x)';
      case 'binary': return 'Binario (Sí/No)';
      default: return unit;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Editar Key Result' : 'Crear Nuevo Key Result'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Objective Selection */}
            <FormField
              control={form.control}
              name="objective_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Objetivo</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar objetivo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {objectives.map((obj) => (
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

            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título del Key Result</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Reducir tiempo de setup en 25%"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Unit */}
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unidad de Medida</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar unidad" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="%">Porcentaje (%)</SelectItem>
                      <SelectItem value="#">Número (#)</SelectItem>
                      <SelectItem value="$">Dinero ($)</SelectItem>
                      <SelectItem value="rate">Tasa (x)</SelectItem>
                      <SelectItem value="binary">Binario (Sí/No)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Values */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="current_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Actual</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="target_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Objetivo</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Confidence and Data Source */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="confidence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nivel de Confianza</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar confianza" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="med">Media</SelectItem>
                        <SelectItem value="low">Baja</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fuente de Datos</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar fuente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="auto">Automático</SelectItem>
                        <SelectItem value="computed">Calculado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Switches */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="private"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Key Result Privado</FormLabel>
                      <FormDescription>
                        Solo tú y los managers pueden ver este Key Result
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="guardrail"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Guardrail</FormLabel>
                      <FormDescription>
                        Este Key Result es crítico y no debe fallar
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : mode === 'edit' ? 'Actualizar' : 'Crear Key Result'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};