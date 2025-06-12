
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { User, UserFormData } from '@/types/users';
import { useToast } from '@/hooks/use-toast';

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
    
    // Simulación de validación de correo único
    const existingEmails = ['admin@textilflow.com', 'maria@ejemplo.com'];
    if (existingEmails.includes(email) && (!user || user.email !== email)) {
      setEmailError('Este correo ya está en uso');
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

  const handleSubmit = (e: React.FormEvent) => {
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

    // Simular envío de invitación por correo
    const tempPassword = generatePassword();
    
    onSave(formData);
    
    toast({
      title: user ? "Usuario actualizado" : "Usuario creado",
      description: user 
        ? "Los cambios han sido guardados correctamente"
        : `Usuario creado exitosamente. Se ha enviado una invitación a ${formData.email} con la contraseña temporal: ${tempPassword}`,
    });
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
            />
            <Label htmlFor="requiresPasswordChange" className="text-sm">
              Requiere cambio de contraseña en primer ingreso
            </Label>
          </div>

          {!user && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> Se generará una contraseña temporal de 12 caracteres y se enviará por correo electrónico al usuario.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!!emailError}>
              {user ? 'Actualizar' : 'Crear Usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UserModal;
