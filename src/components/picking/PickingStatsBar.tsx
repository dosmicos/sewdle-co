import React from 'react';
import { usePickingOrderStats } from '@/hooks/usePickingOrderStats';
import { ShoppingBag, Package, AlertCircle, CheckCircle2, Zap } from 'lucide-react';

interface PickingStatsBarProps {
  onFilterClick: (filterType: 'pedidos' | 'para_empacar' | 'no_confirmados' | 'express' | 'empacados') => void;
}

export const PickingStatsBar: React.FC<PickingStatsBarProps> = ({ onFilterClick }) => {
  const { stats, loading } = usePickingOrderStats();

  if (loading) {
    return (
      <div className="flex items-center gap-4 text-xs text-muted-foreground py-2 border-b border-border/50">
        <span className="animate-pulse">Cargando estadísticas...</span>
      </div>
    );
  }

  const totalPedidos = stats.paraEmpacar + stats.noConfirmados;

  return (
    <div className="overflow-x-auto pb-1 -mb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="flex items-center gap-3 md:gap-4 text-xs text-muted-foreground py-2 border-b border-border/50 min-w-max">
        <button
          onClick={() => onFilterClick('pedidos')}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors whitespace-nowrap"
        >
          <ShoppingBag className="w-3 h-3 text-muted-foreground/70" />
          <span className="text-muted-foreground/70">Pedidos:</span>
          <span className="font-medium text-foreground">{totalPedidos}</span>
        </button>

        <span className="text-border">|</span>

        <button
          onClick={() => onFilterClick('para_empacar')}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors whitespace-nowrap"
        >
          <Package className="w-3 h-3 text-orange-500" />
          <span className="text-muted-foreground/70">Para empacar:</span>
          <span className="font-medium text-orange-600">{stats.paraEmpacar}</span>
        </button>

        <span className="text-border">|</span>

        <button
          onClick={() => onFilterClick('no_confirmados')}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors whitespace-nowrap"
        >
          <AlertCircle className="w-3 h-3 text-muted-foreground/70" />
          <span className="text-muted-foreground/70">No confirmados:</span>
          <span className="font-medium text-foreground">{stats.noConfirmados}</span>
        </button>

        <span className="text-border">|</span>

        <button
          onClick={() => onFilterClick('express')}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors whitespace-nowrap"
        >
          <Zap className="w-3 h-3 text-purple-500" />
          <span className="text-muted-foreground/70">Express:</span>
          <span className="font-medium text-purple-600">{stats.express}</span>
        </button>

        <span className="text-border">|</span>

        <button
          onClick={() => onFilterClick('empacados')}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors whitespace-nowrap"
        >
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          <span className="text-muted-foreground/70">Empacados:</span>
          <span className="font-medium text-green-600">{stats.empacados}</span>
        </button>
      </div>
    </div>
  );
};
