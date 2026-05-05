import React from 'react';
import { Button } from '@/components/ui/button';
import { TrendingUp, AlertTriangle, Package, Factory } from 'lucide-react';

interface CopilotQuickActionsProps {
  onAction: (query: string) => void;
  disabled?: boolean;
}

const quickActions = [
  {
    label: "Producción del mes",
    query: "Dame un resumen de la producción aprobada de este mes",
    icon: TrendingUp
  },
  {
    label: "Órdenes atrasadas",
    query: "¿Cuáles órdenes están atrasadas esta semana?",
    icon: AlertTriangle
  },
  {
    label: "Más vendidos",
    query: "¿Cuál es el producto más vendido?",
    icon: Package
  },
  {
    label: "Ranking talleres",
    query: "Muéstrame el ranking de talleres por volumen de producción",
    icon: Factory
  }
];

export default function CopilotQuickActions({ onAction, disabled }: CopilotQuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2 p-3 border-b border-border bg-muted/30">
      {quickActions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            className="text-xs h-7 gap-1"
            onClick={() => onAction(action.query)}
            disabled={disabled}
          >
            <Icon className="w-3 h-3" />
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}
