import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePasswordChangeRequired } from '@/hooks/usePasswordChangeRequired';
import { Loader2 } from 'lucide-react';

interface PasswordChangeRouteGuardProps {
  children: React.ReactNode;
}

/**
 * Guard de ruta que impide el acceso a cualquier página protegida
 * si el usuario debe cambiar su contraseña.
 * 
 * Lógica:
 * 1. Si no hay usuario → redirige a /auth
 * 2. Si debe cambiar contraseña → redirige a /password-change
 * 3. Si no requiere cambio → renderiza children
 */
const PasswordChangeRouteGuard = ({ children }: PasswordChangeRouteGuardProps) => {
  const { user, loading: authLoading } = useAuth();
  const { mustChangePassword, isLoading: passwordCheckLoading } = usePasswordChangeRequired();
  const location = useLocation();
  
  // Mostrar loader mientras se verifica autenticación o estado de contraseña
  if (authLoading || passwordCheckLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Verificando sesión...</p>
        </div>
      </div>
    );
  }
  
  // Sin usuario → redirigir a login
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  // Debe cambiar contraseña → redirigir a página de cambio
  if (mustChangePassword) {
    return <Navigate to="/password-change" replace />;
  }
  
  // Todo OK → renderizar contenido
  return <>{children}</>;
};

export default PasswordChangeRouteGuard;
