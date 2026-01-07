import React from 'react';
import { Inbox, HelpCircle, Bot, Settings, Package, ChevronLeft, ChevronRight, GraduationCap, Brain, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';

type FilterType = 'inbox' | 'needs-help' | 'ai-managed';

interface WhatsAppSidebarProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  onNavigate: (section: 'config' | 'catalog' | 'train' | 'knowledge' | 'campaigns') => void;
  counts: {
    total: number;
    pending: number;
    resolved: number;
  };
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const menuItems: Array<{
  id: FilterType;
  label: string;
  icon: React.ElementType;
  countKey: 'total' | 'pending' | 'resolved';
}> = [
  { id: 'inbox', label: 'Mi bandeja de entrada', icon: Inbox, countKey: 'total' },
  { id: 'needs-help', label: 'Necesita ayuda', icon: HelpCircle, countKey: 'pending' },
  { id: 'ai-managed', label: 'IA gestionada', icon: Bot, countKey: 'resolved' },
];

export const WhatsAppSidebar: React.FC<WhatsAppSidebarProps> = ({
  activeFilter,
  onFilterChange,
  onNavigate,
  counts,
  collapsed,
  onToggleCollapse,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col h-screen min-h-screen bg-emerald-900 text-white transition-all duration-300 flex-shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header with collapse button */}
      <div className="flex items-center justify-between p-4 border-b border-emerald-800">
        {!collapsed && (
          <span className="font-semibold text-sm text-emerald-200">Bandeja</span>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-emerald-800 transition-colors ml-auto"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-emerald-300" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-emerald-300" />
          )}
        </button>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const count = counts[item.countKey];
            const isActive = activeFilter === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => onFilterChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                    isActive
                      ? "bg-emerald-600 text-white"
                      : "text-emerald-100 hover:bg-emerald-800 hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left text-sm font-medium truncate">
                        {item.label}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded-full",
                          isActive
                            ? "bg-emerald-500 text-white"
                            : "bg-emerald-700 text-emerald-200"
                        )}
                      >
                        {count}
                      </span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* AI Training section */}
      <div className="border-t border-emerald-800 py-4 px-2 space-y-1">
        {!collapsed && (
          <span className="px-3 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            Entrenamiento
          </span>
        )}
        <button
          onClick={() => onNavigate('train')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-emerald-100 hover:bg-emerald-800 hover:text-white transition-colors"
        >
          <GraduationCap className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Entrenar IA</span>}
        </button>
        <button
          onClick={() => onNavigate('knowledge')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-emerald-100 hover:bg-emerald-800 hover:text-white transition-colors"
        >
          <Brain className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Conocimiento</span>}
        </button>
        <button
          onClick={() => onNavigate('campaigns')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-emerald-100 hover:bg-emerald-800 hover:text-white transition-colors"
        >
          <Megaphone className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Campañas</span>}
        </button>
      </div>

      {/* Footer with config and catalog */}
      <div className="border-t border-emerald-800 py-4 px-2 space-y-1">
        <button
          onClick={() => onNavigate('config')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-emerald-100 hover:bg-emerald-800 hover:text-white transition-colors"
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Configuración</span>}
        </button>
        <button
          onClick={() => onNavigate('catalog')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-emerald-100 hover:bg-emerald-800 hover:text-white transition-colors"
        >
          <Package className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Catálogo</span>}
        </button>
      </div>
    </div>
  );
};
