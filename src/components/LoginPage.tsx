
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, User, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
    } catch (error) {
      toast({
        title: "Error de autenticación",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fillAdminCredentials = () => {
    setEmail('admin@textilflow.com');
    setPassword('admin123456');
  };

  const fillWorkshopCredentials = () => {
    setEmail('taller1@ejemplo.com');
    setPassword('password123');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">TextilFlow</h1>
          <p className="text-muted-foreground">Sistema de Gestión de Talleres Textiles</p>
        </div>

        <Card className="apple-card p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Correo electrónico
              </label>
              <Input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="apple-input"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="apple-input"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full apple-button"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar sesión'
              )}
            </Button>
          </form>

          <div className="space-y-3">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Usuarios de prueba</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={fillAdminCredentials}
                className="flex items-center justify-center space-x-2 p-3 rounded-xl"
                disabled={isLoading}
              >
                <User className="w-4 h-4" />
                <span className="text-xs">Admin</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={fillWorkshopCredentials}
                className="flex items-center justify-center space-x-2 p-3 rounded-xl"
                disabled={isLoading}
              >
                <Building2 className="w-4 h-4" />
                <span className="text-xs">Taller</span>
              </Button>
            </div>
          </div>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          © 2024 TextilFlow. Todos los derechos reservados.
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
