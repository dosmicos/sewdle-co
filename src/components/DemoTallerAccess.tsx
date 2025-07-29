import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Key, LogIn, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createDemoTallerUser, loginAsDemoUser } from '@/utils/createDemoUser';

const DemoTallerAccess = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [demoCredentials, setDemoCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const { toast } = useToast();

  const handleCreateDemoUser = async () => {
    setIsCreating(true);
    try {
      const result = await createDemoTallerUser();
      
      if (result.success) {
        setDemoCredentials({
          email: result.email!,
          password: result.password!
        });
        toast({
          title: "Usuario demo creado",
          description: "Credenciales generadas exitosamente. Ahora puedes iniciar sesión.",
        });
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el usuario demo",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleLoginAsDemo = async () => {
    if (!demoCredentials) return;
    
    setIsLoggingIn(true);
    try {
      const result = await loginAsDemoUser(demoCredentials.email, demoCredentials.password);
      
      if (result.success) {
        toast({
          title: "Sesión iniciada",
          description: "Redirigiendo a la vista del taller...",
        });
        
        // Redirigir al dashboard después de un breve delay
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      } else {
        toast({
          title: "Error de autenticación",
          description: result.error,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo iniciar sesión",
        variant: "destructive"
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <Card className="p-6 bg-blue-50 border-blue-200">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-blue-900">
            Acceso Demo - Taller Marisol Trujillo
          </h3>
        </div>
        
        <p className="text-sm text-blue-800">
          Crea un usuario temporal para experimentar la interfaz desde la perspectiva del taller.
        </p>

        <div className="space-y-3">
          {!demoCredentials ? (
            <Button 
              onClick={handleCreateDemoUser}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando usuario demo...
                </>
              ) : (
                <>
                  <User className="w-4 h-4 mr-2" />
                  Crear Usuario Demo
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Credenciales Demo</span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Email:</span> 
                    <code className="ml-2 bg-gray-100 px-2 py-1 rounded text-xs">
                      {demoCredentials.email}
                    </code>
                  </div>
                  <div>
                    <span className="font-medium">Contraseña:</span>
                    <code className="ml-2 bg-gray-100 px-2 py-1 rounded text-xs">
                      {demoCredentials.password}
                    </code>
                  </div>
                </div>
                
                <div className="mt-3 flex gap-2">
                  <Badge variant="outline" className="text-green-700 border-green-300">
                    Taller: Marisol Trujillo
                  </Badge>
                  <Badge variant="outline" className="text-blue-700 border-blue-300">
                    Rol: Taller
                  </Badge>
                </div>
              </div>

              <Button 
                onClick={handleLoginAsDemo}
                disabled={isLoggingIn}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Iniciar Sesión como Taller
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        <div className="text-xs text-blue-600 bg-blue-100 p-3 rounded">
          <strong>Nota:</strong> Este usuario es temporal y está limitado solo al Taller Marisol Trujillo. 
          Podrás ver órdenes, entregas y datos específicos de este taller únicamente.
        </div>
      </div>
    </Card>
  );
};

export default DemoTallerAccess;