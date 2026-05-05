import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Building2, AlertTriangle } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';

interface OrganizationGuardProps {
  children: React.ReactNode;
  requiredFeature?: string;
  fallback?: React.ReactNode;
}

export const OrganizationGuard: React.FC<OrganizationGuardProps> = ({
  children,
  requiredFeature,
  fallback
}) => {
  const { currentOrganization, canAccessFeature, isLoading } = useOrganization();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center space-x-2 text-muted-foreground">
          <Building2 className="h-5 w-5 animate-pulse" />
          <span>Cargando organización...</span>
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

  if (requiredFeature && !canAccessFeature(requiredFeature)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="p-8">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p>
              Esta funcionalidad no está disponible en tu plan actual ({currentOrganization.plan}).
            </p>
            <Button variant="outline" size="sm" className="mt-2">
              Actualizar Plan
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
};