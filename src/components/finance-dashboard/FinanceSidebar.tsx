import React from 'react';
import { cn } from '@/lib/utils';
import {
  Home,
  BarChart3,
  Monitor,
  Users,
  Compass,
  Star,
  Search,
  Plus,
  ChevronLeft,
  LogOut,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  id: string;
}

const coreItems: NavItem[] = [
  { label: 'Summary', icon: <Home className="h-4 w-4" />, id: 'summary' },
];

const workspaceItems: NavItem[] = [
  { label: 'Marketing Acquisition', icon: <BarChart3 className="h-4 w-4" />, id: 'marketing' },
  { label: 'Website Conversion', icon: <Monitor className="h-4 w-4" />, id: 'web' },
  { label: 'Customer Retention', icon: <Users className="h-4 w-4" />, id: 'retention' },
  { label: 'Discovery', icon: <Compass className="h-4 w-4" />, id: 'discovery' },
];

interface FinanceSidebarProps {
  activeSection?: string;
  collapsed?: boolean;
  onToggle?: () => void;
  onOpenSettings?: () => void;
}

const FinanceSidebar: React.FC<FinanceSidebarProps> = ({
  activeSection = 'summary',
  collapsed = false,
  onToggle,
  onOpenSettings,
}) => {
  const { user, logout } = useAuth();

  if (collapsed) {
    return (
      <div className="w-[60px] border-r border-gray-200 bg-white flex flex-col items-center py-4">
        <button
          onClick={onToggle}
          className="mb-6 p-2 rounded-lg hover:bg-gray-100"
        >
          <ChevronLeft className="h-4 w-4 rotate-180 text-gray-500" />
        </button>
        {coreItems.map((item) => (
          <button
            key={item.id}
            className={cn(
              'p-2 rounded-lg mb-1 transition-colors',
              activeSection === item.id ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
            )}
          >
            {item.icon}
          </button>
        ))}
        <div className="flex-1" />
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg mb-1 text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-[220px] border-r border-gray-200 bg-white flex flex-col h-screen">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
              S
            </div>
            <span className="text-sm font-semibold text-gray-800">sewdle.co</span>
          </div>
          <button onClick={onToggle} className="p-1 rounded hover:bg-gray-100">
            <ChevronLeft className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        <nav className="space-y-1">
          {coreItems.map((item) => (
            <button
              key={item.id}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                activeSection === item.id
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
            <Star className="h-4 w-4" />
            Favorites
          </button>
        </nav>
      </div>

      <div className="px-4 mb-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              className="w-full h-8 pl-8 pr-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <Button size="icon" className="h-8 w-8 bg-blue-600 hover:bg-blue-700 rounded-lg">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="px-4 flex-1 overflow-y-auto">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Core Workspaces
        </p>
        <nav className="space-y-0.5">
          {workspaceItems.map((item) => (
            <button
              key={item.id}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                activeSection === item.id
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-gray-200 space-y-1">
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <Settings className="h-4 w-4" />
            Configuración
          </button>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-red-500 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Salir
        </button>
      </div>
    </div>
  );
};

export default FinanceSidebar;
