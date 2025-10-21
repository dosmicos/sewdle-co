
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, Building2, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasValidToken, setHasValidToken] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    console.log('Setting up password recovery handler...');
    const accessToken = searchParams.get('access_token');
    const type = searchParams.get('type');
    
    console.log('URL params:', { accessToken: !!accessToken, type });

    // Verificar que tenemos los parámetros necesarios
    if (!accessToken || type !== 'recovery') {
      console.log('Missing required parameters for recovery');
      toast({
        title: "Error",
        description: "Enlace de recuperación inválido. Por favor solicita un nuevo enlace.",
        variant: "destructive",
      });
      setHasValidToken(false);
      setIsCheckingToken(false);
      return;
    }

    let timeoutId: NodeJS.Timeout;
    let handled = false;

    // Escuchar los eventos de autenticación de Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth event:', event, 'Session:', !!session);

        // Supabase dispara el evento PASSWORD_RECOVERY cuando procesa el token
        if (event === 'PASSWORD_RECOVERY' && session && !handled) {
          handled = true;
          clearTimeout(timeoutId);
          console.log('Password recovery session established:', session.user?.email);
          
          setHasValidToken(true);
          setIsCheckingToken(false);
          toast({
            title: "Enlace válido",
            description: "Ahora puedes establecer tu nueva contraseña",
          });
        }
      }
    );

    // Timeout de seguridad: si después de 5 segundos no hay respuesta
    timeoutId = setTimeout(() => {
      if (!handled) {
        console.error('Timeout waiting for password recovery session');
        toast({
          title: "Error",
          description: "El enlace de recuperación es inválido o ha expirado",
          variant: "destructive",
        });
        setHasValidToken(false);
        setIsCheckingToken(false);
      }
    }, 5000);

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [searchParams, toast]);

  const validatePassword = (password: string) => {
    if (password.length < 6) {
      return "La contraseña debe tener al menos 6 caracteres";
    }
    return null;
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const passwordError = validatePassword(password);
    if (passwordError) {
      toast({
        title: "Error",
        description: passwordError,
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('Updating password...');
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error('Error updating password:', error);
        throw error;
      }

      console.log('Password updated successfully');
      setIsSuccess(true);
      toast({
        title: "Contraseña actualizada",
        description: "Tu contraseña ha sido cambiada exitosamente",
      });

      // Redirigir al dashboard después de 3 segundos
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    } catch (error) {
      console.error('Error updating password:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al actualizar la contraseña",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Mostrar spinner mientras verifica el token
  if (isCheckingToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Verificando enlace...</h1>
              <p className="text-sm text-gray-600">
                Por favor espera mientras verificamos tu enlace de recuperación
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar error si el token no es válido
  if (!hasValidToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Enlace inválido</h1>
              <p className="text-sm text-gray-600">
                El enlace de recuperación es inválido o ha expirado. Por favor solicita un nuevo enlace.
              </p>
            </div>
            <Button 
              onClick={() => navigate('/auth')} 
              className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-all duration-200"
            >
              Volver al inicio
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar pantalla de éxito
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">¡Contraseña actualizada!</h1>
              <p className="text-sm text-gray-600">
                Tu contraseña ha sido cambiada exitosamente. Serás redirigido al dashboard en unos segundos.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar formulario de cambio de contraseña
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo and title */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Nueva contraseña</h1>
            <p className="text-sm text-gray-600">Ingresa tu nueva contraseña para tu cuenta de TextilFlow</p>
          </div>
        </div>

        {isCheckingToken ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Verificando enlace...</h1>
              <p className="text-sm text-gray-600">
                Por favor espera mientras verificamos tu enlace de recuperación
              </p>
            </div>
          </div>
        ) : !hasValidToken ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Enlace inválido</h1>
              <p className="text-sm text-gray-600">
                El enlace de recuperación es inválido o ha expirado. Por favor solicita un nuevo enlace.
              </p>
            </div>
            <Button 
              onClick={() => navigate('/auth')} 
              className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-all duration-200"
            >
              Volver al inicio
            </Button>
          </div>
        ) : isSuccess ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">¡Contraseña actualizada!</h1>
              <p className="text-sm text-gray-600">
                Tu contraseña ha sido cambiada exitosamente. Serás redirigido al dashboard en unos segundos.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Reset password form */}
            <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-6">
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Nueva contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 bg-white border border-gray-300 rounded-xl px-4 py-3 pr-12 text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirmar contraseña"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-12 bg-white border border-gray-300 rounded-xl px-4 py-3 pr-12 text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-all duration-200 active:scale-[0.98]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Actualizando contraseña...
                    </>
                  ) : (
                    'Actualizar contraseña'
                  )}
                </Button>
              </form>
            </Card>

            {/* Footer */}
            <div className="text-center">
              <p className="text-xs text-gray-500">© 2024 TextilFlow. Todos los derechos reservados.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
