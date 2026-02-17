import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProspectActivityType, ACTIVITY_TYPE_LABELS } from '@/types/prospects';
import { Card, CardContent } from '@/components/ui/card';

interface ActivityFormProps {
  onSubmit: (data: unknown) => Promise<void>;
  onCancel: () => void;
}

export const ActivityForm = ({ onSubmit, onCancel }: ActivityFormProps) => {
  const [activityType, setActivityType] = useState<ProspectActivityType>('note');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSubmit({
        activity_type: activityType,
        title,
        description,
        scheduled_date: scheduledDate || null,
        status: scheduledDate ? 'pending' : 'completed',
        completed_date: scheduledDate ? null : new Date().toISOString(),
      });
      
      // Reset form
      setTitle('');
      setDescription('');
      setScheduledDate('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Tipo de Actividad</Label>
            <Select value={activityType} onValueChange={(value) => setActivityType(value as ProspectActivityType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Ej: Primera llamada de contacto"
            />
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles de la actividad..."
              rows={3}
            />
          </div>

          {(activityType === 'videocall' || activityType === 'visit') && (
            <div>
              <Label htmlFor="scheduledDate">Fecha Programada</Label>
              <Input
                id="scheduledDate"
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Actividad'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
