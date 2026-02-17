import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TextCellProps {
  value?: string | null;
  onSave: (value: string) => Promise<any>;
  type?: 'text' | 'email';
  required?: boolean;
  multiline?: boolean;
}

export const TextCell = ({ 
  value, 
  onSave, 
  type = 'text',
  required = false,
  multiline = false 
}: TextCellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    // Validation
    if (required && !editValue.trim()) {
      setError('Este campo es requerido');
      return;
    }

    if (type === 'email' && editValue && !isValidEmail(editValue)) {
      setError('Email inválido');
      return;
    }

    if (editValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (err) {
      setError('Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setError(null);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (multiline && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (!multiline && e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <div
        className={cn(
          'px-2 py-1 rounded hover:bg-muted/50 cursor-pointer min-h-[32px] flex items-center',
          !value && 'text-muted-foreground italic'
        )}
        onClick={() => setIsEditing(true)}
      >
        {value || 'Click para editar'}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {multiline ? (
        <Textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className={cn(
            'min-h-[60px] resize-none',
            error && 'border-destructive'
          )}
          disabled={isSaving}
        />
      ) : (
        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className={cn(
            'h-8',
            error && 'border-destructive'
          )}
          disabled={isSaving}
        />
      )}
      
      <div className="flex gap-1">
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : error ? (
          <X className="h-4 w-4 text-destructive" />
        ) : null}
      </div>
    </div>
  );
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}