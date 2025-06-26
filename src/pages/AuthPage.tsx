

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, Building2, UserPlus, LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PasswordRecoveryModal from '@/components/PasswordRecoveryModal';

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive",
      });
      return;
    }

    if (isSignUp && !name) {
      toast({
        title: "Error",
        description: "Por favor ingresa tu nombre",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        const redirectUrl = `${window.location.origin}/`;
        const { data, error } = await supabase.auth.signUp({
          email: email.toLowerCase().trim(),
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              name: name,
            }
          }
        });

        if (error) throw error;

        if (data.user) {
          toast({
            title: "Registro exitoso",
            description: "Se ha enviado un enlace de confirmación a tu correo electrónico",
          });
          setIsSignUp(false);
          setName('');
        }
      } else {
        await login(email, password);
      }
    } catch (error) {
      toast({
        title: isSignUp ? "Error de registro" : "Error de autenticación",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [email, password, name, isSignUp, login, toast]);

  const toggleMode = useCallback(() => {
    setIsSignUp(!isSignUp);
    setName('');
  }, [isSignUp]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo and title */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-24 h-24 flex items-center justify-center">
            <img 
              src="/lovable-uploads/d2dedee3-0aae-4a76-a4e5-67f498c643ba.png" 
              alt="Sewdle Logo" 
              className="w-24 h-24 object-contain"
              onError={(e) => {
                // Fallback to Building2 icon if logo fails to load
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="w-24 h-24 bg-gray-900 rounded-2xl hidden items-center justify-center">
              <Building2 className="w-12 h-12 text-white" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-600">Bienvenido a Sewdle</p>
          </div>
        </div>

        {/* Auth form */}
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-medium text-gray-900">
              {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              {isSignUp && (
                <Input
                  type="text"
                  placeholder="Nombre completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  disabled={isLoading}
                />
              )}
              <Input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                disabled={isLoading}
              />
              <Input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                disabled={isLoading}
              />
            </div>

            {/* Password recovery link - only show in login mode */}
            {!isSignUp && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowPasswordRecovery(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                  disabled={isLoading}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-all duration-200 active:scale-[0.98]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isSignUp ? 'Creando cuenta...' : 'Iniciando sesión...'}
                </>
              ) : (
                <>
                  {isSignUp ? <UserPlus className="mr-2 h-4 w-4" /> : <LogIn className="mr-2 h-4 w-4" />}
                  {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
                </>
              )}
            </Button>
          </form>

          {/* Toggle between login and signup */}
          <div className="text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              disabled={isLoading}
            >
              {isSignUp 
                ? '¿Ya tienes cuenta? Inicia sesión' 
                : '¿No tienes cuenta? Regístrate'
              }
            </button>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">© 2024 Sewdle. Todos los derechos reservados.</p>
        </div>
      </div>

      {/* Password Recovery Modal */}
      <PasswordRecoveryModal
        isOpen={showPasswordRecovery}
        onClose={() => setShowPasswordRecovery(false)}
      />
    </div>
  );
};

export default AuthPage;

