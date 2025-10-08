import { Badge } from '@/components/ui/badge';

interface BadgeCellProps {
  value?: string | null;
}

export const BadgeCell = ({ value }: BadgeCellProps) => {
  if (!value) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  // Si el valor contiene comas, es una lista de badges
  if (value.includes(',')) {
    const items = value.split(',').map(item => item.trim());
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((item, index) => (
          <Badge key={index} variant="outline" className="text-xs">
            {item}
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <Badge variant="outline" className="text-xs">
      {value}
    </Badge>
  );
};