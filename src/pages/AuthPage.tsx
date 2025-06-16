
import React, { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, Building2, UserPlus, LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
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

  const fillAdminCredentials = useCallback(() => {
    setEmail('admin@textilflow.com');
    setPassword('admin123456');
    setIsSignUp(false);
  }, []);

  const fillWorkshopCredentials = useCallback(() => {
    setEmail('taller1@ejemplo.com');
    setPassword('password123');
    setIsSignUp(false);
  }, []);

  const toggleMode = useCallback(() => {
    setIsSignUp(!isSignUp);
    setName('');
  }, [isSignUp]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo and title */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">TextilFlow</h1>
            <p className="text-sm text-gray-600">Sistema de Gestión de Talleres Textiles</p>
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

          {/* Test users - only show in login mode */}
          {!isSignUp && (
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-gray-500">Usuarios de prueba</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={fillAdminCredentials}
                  className="h-10 border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-gray-900 rounded-xl transition-all duration-200"
                  disabled={isLoading}
                >
                  Admin
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={fillWorkshopCredentials}
                  className="h-10 border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-gray-900 rounded-xl transition-all duration-200"
                  disabled={isLoading}
                >
                  Taller
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">© 2024 TextilFlow. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
