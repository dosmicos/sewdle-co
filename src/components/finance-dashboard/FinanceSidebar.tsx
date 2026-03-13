import React from 'react';
import { cn } from '@/lib/utils';
import {
  Home,
  Target,
  Users,
  ChevronLeft,
  LogOut,
  Settings,
  Sparkles,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  id: string;
  path: string;
}

const coreItems: NavItem[] = [
  { label: 'Summary', icon: <Home className="h-4 w-4" />, id: 'summary', path: '/' },
];

const workspaceItems: NavItem[] = [
  { label: 'Ad Performance', icon: <Target className="h-4 w-4" />, id: 'ad-performance', path: '/ad-performance' },
  { label: 'Intelligence', icon: <Sparkles className="h-4 w-4" />, id: 'intelligence', path: '/intelligence' },
  { label: 'UGC Performance', icon: <Users className="h-4 w-4" />, id: 'ugc-performance', path: '/ugc-performance' },
  { label: 'Cost Settings', icon: <DollarSign className="h-4 w-4" />, id: 'cost-settings', path: '/cost-settings' },
];

interface FinanceSidebarProps {
  activeSection?: string;
  collapsed?: boolean;
  onToggle?: () => void;
  onOpenSettings?: () => void;
}

const FinanceSidebar: React.FC<FinanceSidebarProps> = ({
  activeSection,
  collapsed = false,
  onToggle,
  onOpenSettings,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active section from URL if not explicitly provided
  const currentSection = activeSection ?? (() => {
    if (location.pathname === '/ad-performance') return 'ad-performance';
    if (location.pathname === '/intelligence') return 'intelligence';
    if (location.pathname === '/ugc-performance') return 'ugc-performance';
    if (location.pathname === '/cost-settings') return 'cost-settings';
    return 'summary';
  })();

  const handleNav = (item: NavItem) => {
    if (item.path) {
      navigate(item.path);
    }
  };

  if (collapsed) {
    return (
      <div className="w-[60px] border-r border-gray-200 bg-white flex flex-col items-center py-4">
        <button
          onClick={onToggle}
          className="mb-6 p-2 rounded-lg hover:bg-gray-100"
        >
          <ChevronLeft className="h-4 w-4 rotate-180 text-gray-500" />
        </button>
        {[...coreItems, ...workspaceItems].filter(i => i.path).map((item) => (
          <button
            key={item.id}
            onClick={() => handleNav(item)}
            className={cn(
              'p-2 rounded-lg mb-1 transition-colors',
              currentSection === item.id ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
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
              onClick={() => handleNav(item)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                currentSection === item.id
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

      <div className="px-4 flex-1 overflow-y-auto">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Core Workspaces
        </p>
        <nav className="space-y-0.5">
          {workspaceItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNav(item)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                currentSection === item.id
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-600 hover:bg-gray-100',
                !item.path && 'opacity-50 cursor-default'
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
