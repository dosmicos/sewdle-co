import React from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface MessagingSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  isSearching?: boolean;
  placeholder?: string;
  className?: string;
}

export const MessagingSearchBar: React.FC<MessagingSearchBarProps> = ({
  value,
  onChange,
  onClear,
  isSearching = false,
  placeholder = 'Buscar por número, nombre o mensaje...',
  className,
}) => {
  return (
    <div className={cn('relative', className)}>
      {/* Search icon or loading spinner */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        {isSearching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
      </div>
      
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'pl-9 pr-8 h-9 text-sm',
          'bg-muted/50 border-border/50',
          'focus:bg-background focus:border-primary/50',
          'transition-colors'
        )}
      />
      
      {/* Clear button */}
      {value && (
        <button
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          type="button"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
