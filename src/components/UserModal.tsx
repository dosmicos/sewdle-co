
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { User, UserFormData } from '@/types/users';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface UserModalProps {
  user: User | null;
  onClose: () => void;
  onSave: (userData: UserFormData) => void;
}

const UserModal: React.FC<UserModalProps> = ({ user, onClose, onSave }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    role: '',
    workshopId: '',
    requiresPasswordChange: true
  });
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const mockWorkshops = [
    { id: '1', name: 'Taller Principal' },
    { id: '2', name: 'Taller Norte' },
    { id: '3', name: 'Taller Sur' }
  ];

  const roles = ['Administrador', 'Diseñador', 'Taller', 'Líder QC'];

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        workshopId: user.workshopId || '',
        requiresPasswordChange: user.requiresPasswordChange
      });
    }
  }, [user]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Formato de correo inválido');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleEmailChange = (email: string) => {
    setFormData({ ...formData, email });
    if (email) {
      validateEmail(email);
    } else {
      setEmailError('');
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.role) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos obligatorios",
        variant: "destructive"
      });
      return;
    }

    if (!validateEmail(formData.email)) {
      return;
    }

    if (formData.role === 'Taller' && !formData.workshopId) {
      toast({
        title: "Error",
        description: "Debes seleccionar un taller para el rol de Taller",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      if (!user) {
        // Create new user
        const tempPassword = generatePassword();
        console.log('Creating user with:', { email: formData.email, password: tempPassword });
        
        const { data, error } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            name: formData.name,
            role: formData.role,
            workshopId: formData.workshopId,
            requiresPasswordChange: formData.requiresPasswordChange
          }
        });

        if (error) {
          console.error('Error creating user:', error);
          throw error;
        }

        if (data.user) {
          // Update the profile with additional data
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              name: formData.name,
              email: formData.email
            });

          if (profileError) {
            console.error('Error updating profile:', profileError);
          }

          toast({
            title: "Usuario creado exitosamente",
            description: `Se ha creado el usuario para ${formData.email}. Contraseña temporal: ${tempPassword}`,
          });
        }
      } else {
        // Update existing user - for now just call the onSave callback
        onSave(formData);
        toast({
          title: "Usuario actualizado",
          description: "Los cambios han sido guardados correctamente",
        });
      }

      onClose();
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al procesar la solicitud",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {user ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre completo *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ingresa el nombre completo"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="usuario@ejemplo.com"
              required
              disabled={isLoading}
            />
            {emailError && (
              <p className="text-sm text-red-600">{emailError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rol *</Label>
            <Select 
              value={formData.role} 
              onValueChange={(value) => setFormData({ ...formData, role: value, workshopId: value !== 'Taller' ? '' : formData.workshopId })}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.role === 'Taller' && (
            <div className="space-y-2">
              <Label htmlFor="workshop">Taller asignado *</Label>
              <Select 
                value={formData.workshopId} 
                onValueChange={(value) => setFormData({ ...formData, workshopId: value })}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un taller" />
                </SelectTrigger>
                <SelectContent>
                  {mockWorkshops.map((workshop) => (
                    <SelectItem key={workshop.id} value={workshop.id}>
                      {workshop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="requiresPasswordChange"
              checked={formData.requiresPasswordChange}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, requiresPasswordChange: checked as boolean })
              }
              disabled={isLoading}
            />
            <Label htmlFor="requiresPasswordChange" className="text-sm">
              Requiere cambio de contraseña en primer ingreso
            </Label>
          </div>

          {!user && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> Se generará una contraseña temporal de 12 caracteres que se mostrará después de crear el usuario.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!!emailError || isLoading}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {user ? 'Actualizando...' : 'Creando...'}
                </>
              ) : (
                user ? 'Actualizar' : 'Crear Usuario'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UserModal;
