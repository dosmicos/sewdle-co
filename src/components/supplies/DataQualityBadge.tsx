import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface DataQualityBadgeProps {
  quality: 'high' | 'medium' | 'low' | 'insufficient' | undefined;
}

export const DataQualityBadge = ({ quality }: DataQualityBadgeProps) => {
  if (!quality) return null;

  const config = {
    high: {
      label: 'Alta',
      variant: 'default' as const,
      tooltip: 'Datos de alta calidad: historial completo de snapshots diarios (>25 días)',
    },
    medium: {
      label: 'Media',
      variant: 'secondary' as const,
      tooltip: 'Datos de calidad media: datos inferidos de cambios de inventario en Shopify',
    },
    low: {
      label: 'Baja',
      variant: 'outline' as const,
      tooltip: 'Datos de calidad baja: estimación basada en fecha de creación de la variante',
    },
    insufficient: {
      label: 'Insuficiente',
      variant: 'destructive' as const,
      tooltip: 'Datos insuficientes: no hay suficiente información para calcular con precisión',
    },
  };

  const { label, variant, tooltip } = config[quality];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className="gap-1 cursor-help">
            <Info className="h-3 w-3" />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-sm">{tooltip}</p>
          {quality === 'low' || quality === 'insufficient' ? (
            <p className="text-xs text-muted-foreground mt-2">
              Los snapshots diarios mejorarán la precisión en los próximos 30 días
            </p>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
