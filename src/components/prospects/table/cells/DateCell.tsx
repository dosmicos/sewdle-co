import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DateCellProps {
  value?: string | null;
}

export const DateCell = ({ value }: DateCellProps) => {
  if (!value) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  try {
    const date = new Date(value);
    return (
      <span className="text-sm">
        {format(date, 'dd/MM/yyyy', { locale: es })}
      </span>
    );
  } catch (err) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }
};