import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, AlertTriangle, Target } from 'lucide-react';
import { useIsDosmicos } from '@/hooks/useIsDosmicos';

interface OKRGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const OKRGuard: React.FC<OKRGuardProps> = ({
  children,
  fallback
}) => {
  const { organization: currentOrganization, isLoading, isDosmicos } = useIsDosmicos();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center space-x-2 text-muted-foreground">
          <Target className="h-5 w-5 animate-pulse" />
          <span>Verificando acceso a OKR...</span>
        </div>
      </div>
    );
  }

  if (!currentOrganization) {
    return (
      <div className="p-8">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No tienes acceso a ninguna organización. Contacta a tu administrador para obtener acceso.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Verificación de Dosmicos via hook

  if (!isDosmicos) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="p-8">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p>
              El módulo de OKRs está disponible exclusivamente para Dosmicos.
            </p>
            <p className="text-sm text-muted-foreground">
              Organización actual: {currentOrganization.name} ({currentOrganization.slug})
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
};