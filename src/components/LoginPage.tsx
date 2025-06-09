
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
      <div className="w-full max-w-sm space-y-8">
        {/* Logo and title */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-20 h-20 bg-foreground rounded-3xl flex items-center justify-center">
            <Building2 className="w-10 h-10 text-background" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">TextilFlow</h1>
            <p className="text-sm text-muted-foreground font-medium">Sistema de Gestión de Talleres Textiles</p>
          </div>
        </div>

        {/* Login form */}
        <Card className="bg-card border-0 shadow-xl rounded-3xl overflow-hidden">
          <div className="p-8 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder="Correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 border-0 bg-muted/30 rounded-2xl px-4 text-base font-medium placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0"
                  disabled={isLoading}
                />
                <Input
                  type="password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 border-0 bg-muted/30 rounded-2xl px-4 text-base font-medium placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0"
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-2xl transition-all duration-200 active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
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
                  <span className="w-full border-t border-muted/30" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-muted-foreground font-medium">Usuarios de prueba</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={fillAdminCredentials}
                  className="h-11 border-muted/30 bg-muted/10 hover:bg-muted/20 rounded-xl font-medium transition-all duration-200"
                  disabled={isLoading}
                >
                  <User className="w-4 h-4 mr-2" />
                  Admin
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={fillWorkshopCredentials}
                  className="h-11 border-muted/30 bg-muted/10 hover:bg-muted/20 rounded-xl font-medium transition-all duration-200"
                  disabled={isLoading}
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Taller
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground font-medium">© 2024 TextilFlow. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
