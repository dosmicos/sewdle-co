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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useOKR } from '@/contexts/OKRContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const checkinSchema = z.object({
  delta_value: z.number().optional(),
  progress_pct: z.number().min(0).max(120, 'El progreso no puede exceder 120%').optional(),
  confidence: z.enum(['low', 'med', 'high']),
  note: z.string().optional(),
  blockers: z.string().optional()
});

type CheckinFormData = z.infer<typeof checkinSchema>;

interface CheckinFormProps {
  open: boolean;
  onClose: () => void;
  keyResult: {
    id: string;
    title: string;
    current_value: number;
    target_value: number;
    unit: '%' | '#' | '$' | 'rate' | 'binary';
    progress_pct: number;
    confidence: 'low' | 'med' | 'high';
  };
}

export const CheckinForm: React.FC<CheckinFormProps> = ({
  open,
  onClose,
  keyResult
}) => {
  const { createCheckin } = useOKR();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CheckinFormData>({
    resolver: zodResolver(checkinSchema),
    defaultValues: {
      delta_value: 0,
      progress_pct: keyResult.progress_pct,
      confidence: keyResult.confidence,
      note: '',
      blockers: ''
    }
  });

  const watchedValues = form.watch();
  const newCurrentValue = keyResult.current_value + (watchedValues.delta_value || 0);
  const newProgressPct = watchedValues.progress_pct || keyResult.progress_pct;

  const formatValue = (value: number, unit: string) => {
    switch (unit) {
      case '%': return `${value}%`;
      case '$': return `$${value.toLocaleString()}`;
      case '#': return value.toString();
      case 'rate': return `${value}x`;
      case 'binary': return value > 0 ? 'Sí' : 'No';
      default: return value.toString();
    }
  };

  const onSubmit = async (data: CheckinFormData) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      const checkinData = {
        kr_id: keyResult.id,
        author_id: user.id,
        delta_value: data.delta_value,
        progress_pct: data.progress_pct,
        confidence: data.confidence,
        note: data.note || undefined,
        blockers: data.blockers || undefined
      };

      await createCheckin(checkinData);
      toast.success('Check-in registrado exitosamente');
      onClose();
    } catch (error) {
      console.error('Error creating checkin:', error);
      toast.error('Error registrando el check-in');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar Check-in</DialogTitle>
        </DialogHeader>

        {/* Key Result Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{keyResult.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>
                {formatValue(keyResult.current_value, keyResult.unit)} de {' '}
                {formatValue(keyResult.target_value, keyResult.unit)}
              </span>
              <span className="font-medium">
                {Math.round(keyResult.progress_pct)}%
              </span>
            </div>
            <Progress value={Math.min(keyResult.progress_pct, 100)} className="h-2" />
          </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Progress Update Method */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Actualizar Progreso</h3>
              
              {keyResult.unit !== 'binary' && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="delta_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cambio en Valor ({keyResult.unit})</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="Ej: +5, -2"
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
                    name="progress_pct"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Progreso Directo (%)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            max="120"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {keyResult.unit === 'binary' && (
                <FormField
                  control={form.control}
                  name="progress_pct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseFloat(value))}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">No Completado (0%)</SelectItem>
                          <SelectItem value="100">Completado (100%)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Preview */}
              {newCurrentValue !== keyResult.current_value && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Vista previa:</div>
                  <div className="text-sm">
                    Nuevo valor: {formatValue(newCurrentValue, keyResult.unit)} ({Math.round(newProgressPct)}%)
                  </div>
                </div>
              )}
            </div>

            {/* Confidence */}
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
                      <SelectItem value="high">Alta - Muy probable que se logre</SelectItem>
                      <SelectItem value="med">Media - Probable con esfuerzo</SelectItem>
                      <SelectItem value="low">Baja - Requiere intervención</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Note */}
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe el progreso, logros, o cambios importantes..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Blockers */}
            <FormField
              control={form.control}
              name="blockers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Obstáculos (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe cualquier obstáculo o desafío que esté impidiendo el progreso..."
                      className="min-h-[60px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Registrando...' : 'Registrar Check-in'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};