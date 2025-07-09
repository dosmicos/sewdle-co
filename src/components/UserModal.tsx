
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRoles } from '@/hooks/useRoles';
import { useWorkshops } from '@/hooks/useWorkshops';

interface UserFormData {
  name: string;
  email: string;
  role: string;
  workshopId?: string;
  requiresPasswordChange: boolean;
}

interface UserModalProps {
  user: any | null;
  onClose: () => void;
  onSave: (userData: UserFormData) => Promise<any>;
}

const UserModal: React.FC<UserModalProps> = ({ user, onClose, onSave }) => {
  const { toast } = useToast();
  const { roles, loading: rolesLoading } = useRoles();
  const { workshops, loading: workshopsLoading } = useWorkshops();
  
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    role: '',
    workshopId: '',
    requiresPasswordChange: true
  });
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
      console.log('UserModal: Calling onSave with data:', formData);
      const result = await onSave(formData);
      console.log('UserModal: Received result from onSave:', result);
      if (!user && result?.success && result?.tempPassword) {
        toast({
          title: "¡Usuario creado exitosamente!",
          description: (
            <div className="space-y-2">
              <p>Usuario {formData.email} creado correctamente.</p>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                <p className="text-sm font-semibold text-yellow-800">Contraseña temporal:</p>
                <p className="text-lg font-mono font-bold text-yellow-900 break-all">{result.tempPassword}</p>
                <p className="text-xs text-yellow-700 mt-1">⚠️ Guarda esta contraseña, no se mostrará nuevamente</p>
              </div>
            </div>
          ),
          duration: 15000, // 15 segundos para que el usuario pueda copiar la contraseña
        });
        onClose(); // Cerrar el modal después de mostrar la contraseña
        return;
      }
      
      // Para edición exitosa, también cerrar el modal
      if (user && result?.success) {
        onClose();
        return;
      }
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

  if (rolesLoading || workshopsLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <div className="flex items-center justify-center p-6">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Cargando...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
              onValueChange={(value) => setFormData({ 
                ...formData, 
                role: value, 
                workshopId: value !== 'Taller' ? '' : formData.workshopId 
              })}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.name}>
                    {role.name}
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
                  {workshops
                    .filter(workshop => workshop.status === 'active')
                    .map((workshop) => (
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
