
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
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo and title */}
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-foreground rounded-2xl flex items-center justify-center">
            <Building2 className="w-8 h-8 text-background" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight">TextilFlow</h1>
            <p className="text-sm text-muted-foreground">Sistema de Gestión de Talleres Textiles</p>
          </div>
        </div>

        {/* Login form */}
        <Card className="apple-card p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <Input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 apple-input text-foreground placeholder:text-muted-foreground"
                disabled={isLoading}
              />
              <Input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 apple-input text-foreground placeholder:text-muted-foreground"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 apple-button text-primary-foreground"
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

          {/* Test users */}
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground">Usuarios de prueba</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={fillAdminCredentials}
                className="h-10 border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-all duration-200"
                disabled={isLoading}
              >
                <User className="w-4 h-4 mr-2" />
                Admin
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={fillWorkshopCredentials}
                className="h-10 border-border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-all duration-200"
                disabled={isLoading}
              >
                <Building2 className="w-4 h-4 mr-2" />
                Taller
              </Button>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">© 2024 TextilFlow. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
