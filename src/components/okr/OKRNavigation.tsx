import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Target, User, Users, Trophy, History } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

const navItems: NavItem[] = [
  {
    path: 'overview',
    label: 'Mapa General',
    icon: Target,
    description: 'Vista completa de objetivos organizacionales'
  },
  {
    path: 'mi-trimestre',
    label: 'Mi Trimestre',
    icon: User,
    description: 'Mis objetivos y progreso personal'
  },
  {
    path: 'area',
    label: 'Mi Área',
    icon: Users,
    description: 'Objetivos del equipo y colaboradores'
  },
  {
    path: 'incentivos',
    label: 'Incentivos',
    icon: Trophy,
    description: 'Sistema de recompensas y reconocimientos'
  },
  {
    path: 'historico',
    label: 'Histórico',
    icon: History,
    description: 'Trimestres anteriores y análisis'
  }
];

export const OKRNavigation = () => {
  const location = useLocation();
  const currentPath = location.pathname.split('/').pop() || 'overview';

  return (
    <nav className="flex space-x-1 px-6 pb-3">
      {navItems.map((item) => {
        const isActive = currentPath === item.path;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              "hover:bg-muted/50",
              isActive 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
            title={item.description}
          >
            <item.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};