import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NumberCellProps {
  value?: number | null;
  onSave: (value: number) => Promise<unknown>;
  min?: number;
  max?: number;
}

export const NumberCell = ({ value, onSave, min = 0, max }: NumberCellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value?.toString() || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const numValue = parseFloat(editValue);

    // Validation
    if (editValue && isNaN(numValue)) {
      setError('Valor inválido');
      return;
    }

    if (numValue < min) {
      setError(`Mínimo: ${min}`);
      return;
    }

    if (max !== undefined && numValue > max) {
      setError(`Máximo: ${max}`);
      return;
    }

    if (numValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(numValue);
      setIsEditing(false);
    } catch (err) {
      setError('Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value?.toString() || '');
    setError(null);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Render quality indicator
  const getQualityColor = (val: number) => {
    if (val >= 8) return 'text-green-600 font-semibold';
    if (val >= 6) return 'text-blue-600 font-medium';
    if (val >= 4) return 'text-amber-600';
    return 'text-red-600';
  };

  if (!isEditing) {
    return (
      <div
        className={cn(
          'px-2 py-1 rounded hover:bg-muted/50 cursor-pointer min-h-[32px] flex items-center justify-center',
          value !== null && value !== undefined ? getQualityColor(value) : 'text-muted-foreground italic'
        )}
        onClick={() => setIsEditing(true)}
      >
        {value !== null && value !== undefined ? value : '-'}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        type="number"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        className={cn(
          'h-8 w-20 text-center',
          error && 'border-destructive'
        )}
        disabled={isSaving}
        min={min}
        max={max}
        step="0.1"
      />
      
      <div className="flex gap-1">
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : error ? (
          <div className="relative group">
            <X className="h-4 w-4 text-destructive" />
            <span className="absolute left-0 top-6 text-xs bg-destructive text-destructive-foreground px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {error}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
};