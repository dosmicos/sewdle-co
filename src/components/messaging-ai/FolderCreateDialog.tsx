import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const FOLDER_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
];

interface FolderCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: { name: string; color: string }) => void;
  isLoading?: boolean;
}

export const FolderCreateDialog: React.FC<FolderCreateDialogProps> = ({
  open,
  onOpenChange,
  onCreate,
  isLoading,
}) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(FOLDER_COLORS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({ name: name.trim(), color });
    setName('');
    setColor(FOLDER_COLORS[0]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Nueva carpeta</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="folder-name">Nombre</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Importantes"
              autoFocus
            />
          </div>
          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-1.5">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
