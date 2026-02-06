import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Baby } from 'lucide-react';
import { useUgcCreatorChildren } from '@/hooks/useUgcCreators';
import type { UgcCreatorChild } from '@/types/ugc';

interface UgcChildrenManagerProps {
  creatorId: string;
}

export const UgcChildrenManager: React.FC<UgcChildrenManagerProps> = ({ creatorId }) => {
  const { children, isLoading, addChild, deleteChild } = useUgcCreatorChildren(creatorId);
  const [showForm, setShowForm] = useState(false);
  const [childName, setChildName] = useState('');
  const [ageDescription, setAgeDescription] = useState('');
  const [childSize, setChildSize] = useState('');
  const [childGender, setChildGender] = useState('');

  const resetForm = () => {
    setChildName('');
    setAgeDescription('');
    setChildSize('');
    setChildGender('');
    setShowForm(false);
  };

  const handleSubmit = () => {
    if (!ageDescription.trim()) return;
    console.log('[UGC Children] Submitting child:', { name: childName, ageDescription, childSize, childGender });
    addChild.mutate(
      {
        name: childName.trim() || `Hijo ${children.length + 1}`,
        age_description: ageDescription.trim(),
        size: childSize.trim() || undefined,
        gender: childGender || undefined,
      },
      {
        onSuccess: () => {
          console.log('[UGC Children] Child saved successfully');
          resetForm();
        },
        onError: (err) => {
          console.error('[UGC Children] Failed to save child:', err);
        },
      }
    );
  };

  const getGenderLabel = (gender: string | null) => {
    switch (gender) {
      case 'masculino': return 'Niño';
      case 'femenino': return 'Niña';
      case 'otro': return 'No especificado';
      default: return '';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-sm flex items-center gap-1">
          <Baby className="h-4 w-4" /> Hijos
        </h4>
        <Button variant="ghost" size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> Agregar
        </Button>
      </div>

      {showForm && (
        <Card className="mb-3">
          <CardContent className="p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Nombre (opcional)</Label>
                <Input
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Ej: Sofía"
                />
              </div>
              <div>
                <Label className="text-xs">Edad *</Label>
                <Input
                  value={ageDescription}
                  onChange={(e) => setAgeDescription(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Ej: 2 años, 18 meses, recién nacido"
                />
              </div>
              <div>
                <Label className="text-xs">Talla</Label>
                <Input
                  value={childSize}
                  onChange={(e) => setChildSize(e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Ej: 2T, 4T, 6"
                />
              </div>
              <div>
                <Label className="text-xs">Género</Label>
                <Select value={childGender} onValueChange={setChildGender}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Niño</SelectItem>
                    <SelectItem value="femenino">Niña</SelectItem>
                    <SelectItem value="otro">No especificado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmit} disabled={!ageDescription.trim() || addChild.isPending}>
                {addChild.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button size="sm" variant="ghost" onClick={resetForm}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : children.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Sin hijos registrados</p>
      ) : (
        <div className="space-y-2">
          {children.map((child, idx) => (
            <div key={child.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{child.name || `Hijo ${idx + 1}`}</span>
                {child.age_description && <span className="text-muted-foreground">• {child.age_description}</span>}
                {child.size && <span className="text-muted-foreground">• Talla: {child.size}</span>}
                {child.gender && <span className="text-muted-foreground">• {getGenderLabel(child.gender)}</span>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => deleteChild.mutate(child.id)}
                disabled={deleteChild.isPending}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
