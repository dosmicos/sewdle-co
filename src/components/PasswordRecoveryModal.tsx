
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Mail, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { validatePassword } from '@/lib/passwordValidation';

interface PasswordRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PasswordRecoveryModal = ({ isOpen, onClose }: PasswordRecoveryModalProps) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Error",
        description: "Por favor ingresa tu correo electrónico",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Use the current origin to build the redirect URL
      // CORRECCIÓN: Usar la URL completa correcta para el entorno actual
      const baseUrl = window.location.origin;
      const redirectUrl = `${baseUrl}/reset-password`;
      
      console.log('Sending password reset email to:', email);
      console.log('Redirect URL:', redirectUrl);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        console.error('Error sending reset email:', error);
        throw error;
      }

      console.log('Password reset email sent successfully');
      setEmailSent(true);
      toast({
        title: "Email enviado",
        description: "Revisa tu correo electrónico para restablecer tu contraseña",
      });
    } catch (error) {
      console.error('Error sending password reset email:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al enviar el email de recuperación",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setEmailSent(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Recuperar contraseña
          </DialogTitle>
          <DialogDescription>
            {emailSent 
              ? "Te hemos enviado las instrucciones a tu correo electrónico"
              : "Ingresa tu correo electrónico para recibir las instrucciones de recuperación"
            }
          </DialogDescription>
        </DialogHeader>

        {emailSent ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-600">
                Hemos enviado un enlace de recuperación a:
              </p>
              <p className="font-medium">{email}</p>
              <p className="text-sm text-gray-500">
                Revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contraseña.
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              Cerrar
            </Button>
          </div>
        ) : (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                disabled={isLoading}
              />
            </div>
            
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-blue-500 hover:bg-blue-600"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar enlace'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PasswordRecoveryModal;
